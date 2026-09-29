// ============ 场景：地形、建筑、植被、人物、远景 ============
const W = {}; // world state

// ---------- utils ----------
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20251785);
const rr = (a, b) => a + (b - a) * R();
function smooth(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
const sq = v => v * v;
const lerp = (a, b, t) => a + (b - a) * t;
const col = h => new THREE.Color(h);

// ---------- terrain ----------
const WATER_Y = 0.9;
const PONDS = [{ x: -24, z: 7, a: 11, b: 7 }, { x: 4, z: 8, a: 11, b: 7 }];
const CHANNEL = { x0: -15, x1: -5, z: 7, w: 2.0 };

function baseH(x, z) {
  const tn = 0.35 + 0.65 * smooth(110, -40, x);
  const ts = 0.4 + 0.6 * smooth(120, -60, x);
  let h = 1.2 + 22 * tn * Math.exp(-sq((z + 64) / 22)) + 19 * ts * Math.exp(-sq((z - 54) / 18));
  h += 1.0 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05) + 0.6 * Math.sin(x * 0.11 + z * 0.07) + 0.3 * Math.sin(x * 0.23 - z * 0.19);
  // 远处起伏
  const r = Math.hypot(x, z);
  h += smooth(150, 260, r) * (6 + 5 * Math.sin(x * 0.02) * Math.cos(z * 0.025));
  return h;
}

// 平台（建筑基址），y 在 init 中由 baseH 求出
const FLATS = [
  { id: 'gate', x: 78, z: -30.5, r: 4.5 },
  { id: 'yard', x: 38, z: -18, r: 11, pave: 1 },
  { id: 'shanfang', x: 22, z: -36.5, r: 10, pave: 1 },
  { id: 'shucang', x: -1, z: -41.5, r: 11.5, pave: 1 },
  { id: 'xiaomian', x: -22, z: -34, r: 6.5, pave: 1 },
  { id: 'shishijie', x: -44, z: -6, r: 8, pave: 1 },
  { id: 'kitchen', x: 53, z: 6, r: 7, pave: 1 },
  { id: 'nanlou', x: 18, z: 45.5, r: 8, pave: 1 },
  { id: 'xiting', x: -37, z: 3, r: 3.5 }
];
function pondMask(x, z) {
  let m = 0, rim = 0;
  for (const p of PONDS) {
    const d = Math.hypot((x - p.x) / p.a, (z - p.z) / p.b);
    m = Math.max(m, smooth(1.0, 0.72, d));
    rim = Math.max(rim, smooth(1.5, 1.0, d));
  }
  const dz = Math.abs(z - CHANNEL.z) / CHANNEL.w;
  const inx = smooth(CHANNEL.x0 - 1.5, CHANNEL.x0 + 0.5, x) * smooth(CHANNEL.x1 + 1.5, CHANNEL.x1 - 0.5, x);
  m = Math.max(m, smooth(1.0, 0.45, dz) * inx);
  rim = Math.max(rim, smooth(2.2, 1.0, dz) * inx);
  return { m, rim };
}
function H(x, z) {
  let h = baseH(x, z);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    const w = smooth(f.r + 6, f.r, d);
    if (w > 0) h = lerp(h, f.y, w);
  }
  const { m, rim } = pondMask(x, z);
  if (rim > 0) h = lerp(h, WATER_Y + 0.35, rim);
  if (m > 0) h = lerp(h, WATER_Y - 1.6, m);
  if (m < 0.02) h = Math.max(h, WATER_Y + 0.22);
  return h;
}

const OUTER_Y = 3.2;
function groundAt(x, z) { return (Math.abs(x) < 179 && Math.abs(z) < 179) ? H(x, z) : OUTER_Y; }
// 渡鹤桥桥面
const BRIDGE = { x: -10, z: 7, L: 10, rise: 1.4 };
function walkY(x, z) {
  let y = H(x, z);
  if (Math.abs(x - BRIDGE.x) < 1.3 && Math.abs(z - BRIDGE.z) < BRIDGE.L / 2) {
    const t = (z - (BRIDGE.z - BRIDGE.L / 2)) / BRIDGE.L;
    y = Math.max(y, WATER_Y - 0.1 + BRIDGE.rise * Math.sin(Math.PI * t) + 0.35);
  }
  return y;
}

// 南楼石阶（东山墙外，北低南高）
const STAIR = { x: 24.2, w: 1.5, z0: 42.2, z1: 47.6, landZ0: 47.6, landZ1: 48.8, landX0: 22.5, n: 16 };
function stairY(z) {
  const f = Math.max(0, Math.min(1, (z - STAIR.z0) / (STAIR.z1 - STAIR.z0)));
  const k = Math.min(STAIR.n - 1, Math.floor(f * STAIR.n)), fr = f * STAIR.n - k;
  const lvl = f >= 1 ? STAIR.n : k + smooth(0.3, 0.9, fr);
  return W.stairY0 + (W.stairY1 - W.stairY0) * lvl / STAIR.n + 0.02;
}

// ---------- routes (袁枚所走的路) ----------
const SPOTS = {
  chaimen:  { P: [78, -34], cam: [80.5, -42.5], look: [78, 2.2, -30] },
  zhujing:  { P: [64, -23], cam: [70.5, -26.8], look: [56, 3.2, -20.5] },
  dayuan:   { P: [43, -18.5], cam: [49.8, -15.8], look: [31, 3.4, -18] },
  shanfang: { P: [22, -30], cam: [26.8, -24.2], look: [22, 3.6, -38] },
  shucang:  { P: [-1, -36.5], cam: [1.2, -30.2], look: [-3, 4.2, -44] },
  xiaomian: { P: [-20, -29.2], cam: [-14.8, -25.2], look: [-22, 2.4, -35] },
  tenghua:  { P: [-29.25, -20.5], cam: [-27.1, -26.2], look: [-34, 1.0, -12] },
  shishijie:{ P: [-37.5, -5], cam: [-31.8, -1.4], look: [-45, 2.8, -6] },
  shuanghu: { P: [-10, 6.6], cam: [-10.2, -1.2], look: [-30, 1.8, 5] },
  xiangxue: { P: [27, 14], cam: [20.2, 18.8], look: [34, 2.6, 9] },
  chuxia:   { P: [46, 7], cam: [41.2, 12.6], look: [53, 2.8, 6] },
  nanlou:   { P: [16.6, 44.2], cam: [19.2, 45.4], look: [5, 2, -15], high: 1 },
  mubie:    { P: [78, -33.8], cam: [80, -42], look: [78, 2.0, -31] }
};
const ROUTES = [
  [[78, -30.5], [75.5, -27], [70, -25]],
  [[57, -21.5], [50, -19.5]],
  [[37, -24], [30, -27], [25, -29]],
  [[14, -31.5], [7, -34.2]],
  [[-8, -34.2], [-15, -31]],
  [[-24, -28.5], [-26, -28], [-30, -23]],
  [[-28.5, -18], [-34, -12], [-35.5, -8]],
  [[-32, -3], [-22, -2.6], [-14, -1.6], [-10, 1.8]],
  [[-10, 12], [-9, 16.5], [0, 17.6], [10, 18], [20, 16.4]],
  [[35, 10.5], [41, 8.5]],
  [[46, 14], [40, 22], [31, 30], [25.5, 36], [24.2, 40.5], [24.2, 42.0, 'sb'], [24.2, 47.6, 'st'], [24.2, 48.2, 'up'], [22.3, 48.2, 'up'], [19.5, 46.8, 'up']],
  [[19.5, 46.8, 'up'], [22.3, 48.2, 'up'], [24.2, 48.2, 'up'], [24.2, 47.6, 'st'], [24.2, 42.0, 'sb'], [24.2, 40.5], [26, 36], [34, 28], [48, 20], [58, 10], [62, -4], [66, -16], [71, -24], [76, -27.5], [78, -30.5]]
];
const CORRIDOR = [[-26, -28], [-30, -23], [-28.5, -18], [-34, -12]];
function routePts(i) { // station i -> i+1
  const A = SPOTS[STATIONS[i].id], B = SPOTS[STATIONS[i + 1].id];
  return [A.high ? [...A.P, 'up'] : A.P, ...ROUTES[i], B.high ? [...B.P, 'up'] : B.P];
}
let PATH_SEGS = [];
function buildPathSegs() {
  PATH_SEGS = [];
  for (let i = 0; i < ROUTES.length; i++) {
    const p = routePts(i);
    for (let k = 0; k < p.length - 1; k++) if (!(p[k][2] && p[k + 1][2])) PATH_SEGS.push([p[k][0], p[k][1], p[k + 1][0], p[k + 1][1]]);
  }
  // 入园前的一小段路
  PATH_SEGS.push([78, -34, 79, -48]);
}
function distSeg(px, pz, s) {
  const [ax, az, bx, bz] = s; const dx = bx - ax, dz = bz - az;
  let t = ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz); t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function pathDist(x, z) { let d = 1e9; for (const s of PATH_SEGS) { const v = distSeg(x, z, s); if (v < d) d = v; } return d; }

// ---------- 田畦 ----------
const FIELDS = [];
function buildFields() {
  const kinds = ['rape', 'rape', 'rape', 'wheat', 'wheat', 'wheat', 'paddy', 'paddy', 'veg'];
  const zones = [{ x0: -152, x1: -56, z0: -22, z1: 30 }, { x0: 62, x1: 96, z0: 12, z1: 32 }];
  for (const zn of zones) {
    for (let x = zn.x0; x < zn.x1; x += 13) for (let z = zn.z0; z < zn.z1; z += 9) {
      FIELDS.push({ x0: x + 0.6, x1: x + 12.4, z0: z + 0.5, z1: z + 8.5, k: kinds[Math.floor(R() * kinds.length)] });
    }
  }
}
function fieldAt(x, z) { for (const f of FIELDS) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) return f; return null; }
const PLUM_ZONE = { x0: 16, x1: 44, z0: 7, z1: 28 };
const BAMBOO_ZONE = { x0: 50, x1: 76, z0: -34, z1: -13 };

// ---------- textures（工笔：细线勾勒、淡彩平涂） ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8; return t;
}
const INKC = 'rgba(52,44,36,';
function leafPath(g, x, y, ang, len, wid, bend = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c;
  const tx = x + c * len, ty = y + s * len;
  const mx = x + c * len * 0.45, my = y + s * len * 0.45;
  g.beginPath(); g.moveTo(x, y);
  g.quadraticCurveTo(mx + nx * (wid + bend), my + ny * (wid + bend), tx, ty);
  g.quadraticCurveTo(mx - nx * (wid - bend), my - ny * (wid - bend), x, y);
  g.closePath();
  return [tx, ty];
}
function makeTextures() {
  const T = {};
  const r = rng(515);
  const pick = a => a[Math.floor(r() * a.length)];
  // 瓦垄：每 1.6 单位 8 垄
  T.tile = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5b6066'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const x = i * 32; const gr = g.createLinearGradient(x, 0, x + 32, 0);
      gr.addColorStop(0, '#41454b'); gr.addColorStop(0.42, '#767b83'); gr.addColorStop(0.58, '#6b7077'); gr.addColorStop(1, '#41454b');
      g.fillStyle = gr; g.fillRect(x + 2, 0, 28, h);
      g.strokeStyle = 'rgba(28,28,32,.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 1, 0); g.lineTo(x + 1, h); g.stroke();
      for (let y = 0; y < h; y += 16) { g.strokeStyle = 'rgba(30,30,34,.35)'; g.beginPath(); g.moveTo(x + 3, y + (i % 2) * 8 + 0.5); g.quadraticCurveTo(x + 16, y + (i % 2) * 8 - 3, x + 29, y + (i % 2) * 8 + 0.5); g.stroke(); }
    }
  }, true);
  // 檐下椽子与望板
  T.rafter = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#86644a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,50,36,.35)'; g.lineWidth = 1; for (let y = 0; y < h; y += 12) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
    for (let x = 4; x < w; x += 16) { g.fillStyle = '#5a3d2b'; g.fillRect(x, 0, 7, h); g.strokeStyle = 'rgba(40,28,20,.8)'; g.strokeRect(x + 0.5, -1, 6, h + 2); }
  }, true);
  // 格扇：步步锦
  T.lattice = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#ede6d3'; g.fillRect(0, 0, w, h);
    const wood = '#5c3b2a';
    const top = 14, bot = h * 0.66;
    g.strokeStyle = wood; g.lineWidth = 2.2;
    const cw = 38, ch = 30;
    for (let y = top; y < bot - 4; y += ch) for (let x = 12; x < w - 12; x += cw) {
      const k = ((x / cw) + (y / ch)) % 2 < 1;
      g.strokeRect(x + 0.5, y + 0.5, cw, ch);
      if (k) { g.beginPath(); g.moveTo(x + cw * 0.3, y); g.lineTo(x + cw * 0.3, y + ch * 0.55); g.lineTo(x + cw, y + ch * 0.55); g.stroke(); }
      else { g.beginPath(); g.moveTo(x, y + ch * 0.45); g.lineTo(x + cw * 0.7, y + ch * 0.45); g.lineTo(x + cw * 0.7, y + ch); g.stroke(); }
    }
    g.fillStyle = '#6a4633'; g.fillRect(0, bot, w, h - bot);
    g.fillStyle = '#76503a'; g.fillRect(12, bot + 10, w - 24, 34); g.fillRect(12, bot + 56, w - 24, h - bot - 70);
    g.strokeStyle = 'rgba(40,26,18,.9)'; g.lineWidth = 1.2;
    g.strokeRect(12.5, bot + 10.5, w - 25, 33); g.strokeRect(20.5, bot + 16.5, w - 41, 21);
    g.strokeRect(12.5, bot + 56.5, w - 25, h - bot - 71); g.strokeRect(22.5, bot + 66.5, w - 45, h - bot - 91);
    g.beginPath(); g.ellipse(w / 2, bot + 56 + (h - bot - 70) / 2, 34, 22, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 12; g.strokeStyle = '#4b3022'; g.strokeRect(0, 0, w, h);
  });
  // 挂落：细木回纹，透空
  T.gualuo = canvasTex(512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#5c3b2a'; g.lineWidth = 3;
    g.fillStyle = '#5c3b2a'; g.fillRect(0, 0, w, 7);
    for (let x = 0; x < w; x += 32) {
      g.beginPath(); g.moveTo(x, 7); g.lineTo(x, 30); g.lineTo(x + 22, 30); g.lineTo(x + 22, 16); g.lineTo(x + 10, 16); g.lineTo(x + 10, 22); g.stroke();
      g.beginPath(); g.moveTo(x + 16, 7); g.lineTo(x + 16, 12); g.stroke();
    }
    g.beginPath(); g.moveTo(0, 30); g.lineTo(w, 30); g.stroke();
    for (let x = 16; x < w; x += 64) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 48); g.lineTo(x + 8, 56); g.stroke(); }
  }, true);
  T.plank = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#6b4a33'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,26,18,.9)'; g.lineWidth = 1.2;
    for (let x = 0; x < w; x += 21) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); }
    g.strokeStyle = 'rgba(120,90,60,.35)'; for (let i = 0; i < 40; i++) { const x = r() * w; g.beginPath(); g.moveTo(x, r() * h); g.lineTo(x + r() * 2, r() * h); g.stroke(); }
    g.fillStyle = '#4b3022'; g.fillRect(0, 40, w, 10); g.fillRect(0, h - 50, w, 10);
  });
  T.soft = canvasTex(64, 64, (g, w, h) => { const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); });
  // 草地细笔
  T.grass = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f3f0e4'; g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      g.strokeStyle = r() < 0.8 ? `rgba(70,88,48,${0.12 + r() * 0.2})` : `rgba(255,252,236,${0.3 + r() * 0.3})`;
      g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, true);
  // 水纹：工笔波线
  T.water = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#aebfb8'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 24; row++) {
      const y = row * (h / 24) + 6, off = (row % 2) * 24;
      g.strokeStyle = 'rgba(62,92,90,.55)'; g.lineWidth = 1.1;
      for (let x = -48 + off; x < w + 48; x += 48) { g.beginPath(); g.moveTo(x, y + 6); g.bezierCurveTo(x + 10, y - 5, x + 30, y - 5, x + 48, y + 6); g.stroke(); }
      g.strokeStyle = 'rgba(245,244,234,.4)'; g.lineWidth = 0.9;
      for (let x = -48 + off + 12; x < w + 48; x += 96) { g.beginPath(); g.moveTo(x, y + 2); g.quadraticCurveTo(x + 12, y - 3, x + 24, y + 2); g.stroke(); }
    }
  }, true);
  T.waterN = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w * Math.PI * 2, v = y / h * Math.PI * 2;
      const dx = Math.cos(u * 3 + v) * 0.5 + Math.cos(u * 7 - v * 2) * 0.3 + Math.cos(u * 11 + v * 5) * 0.2;
      const dy = Math.cos(v * 4 - u) * 0.5 + Math.cos(v * 9 + u * 3) * 0.3 + Math.sin(v * 13 - u * 4) * 0.2;
      const i = (y * w + x) * 4; img.data[i] = 128 + dx * 40; img.data[i + 1] = 128 + dy * 40; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, true);
  // 阔叶：一片片勾勒
  T.leaf = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const fills = ['#6f8452', '#7c8f5a', '#889a63', '#65794b', '#94a36c', '#7a8b58'];
    const leaves = [];
    for (let i = 0; i < 95; i++) { const rad = Math.sqrt(r()) * 104; const a = r() * Math.PI * 2; leaves.push([128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad * 0.85, r() * Math.PI * 2]); }
    leaves.sort((a, b) => a[1] - b[1]);
    g.strokeStyle = INKC + '.7)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(128, 200); g.quadraticCurveTo(128 + (r() - 0.5) * 60, 150, 128 + (r() - 0.5) * 170, 60 + r() * 90); g.stroke(); }
    for (const [x, y, a] of leaves) {
      const len = 15 + r() * 10, wid = 5 + r() * 3.5;
      const [tx, ty] = leafPath(g, x, y, a, len, wid, (r() - 0.5) * 2);
      g.fillStyle = pick(fills); g.fill();
      g.strokeStyle = INKC + '.85)'; g.lineWidth = 0.9; g.stroke();
      g.strokeStyle = INKC + '.45)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (tx - x) * 0.85, y + (ty - y) * 0.85); g.stroke();
    }
  });
  // 竹叶：个字、介字
  T.bamboo = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const fills = ['#5c7843', '#6b8650', '#7a9258', '#56703f'];
    for (let k = 0; k < 9; k++) {
      const ox = 40 + r() * 176, oy = 30 + r() * 150;
      g.strokeStyle = INKC + '.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ox - 20, oy - 26); g.quadraticCurveTo(ox - 6, oy - 10, ox, oy); g.stroke();
      const n = 3 + Math.floor(r() * 3), base = Math.PI / 2 + (r() - 0.5) * 0.8;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.42 + (r() - 0.5) * 0.15;
        leafPath(g, ox, oy, a, 44 + r() * 22, 5 + r() * 2, (r() - 0.5) * 3);
        g.fillStyle = pick(fills); g.fill(); g.strokeStyle = INKC + '.9)'; g.lineWidth = 0.9; g.stroke();
      }
    }
  });
  // 松针：扇形细线
  T.pine = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 11; k++) {
      const cx = 30 + r() * 196, cy = 60 + r() * 130;
      g.fillStyle = 'rgba(78,98,70,.3)'; g.beginPath(); g.ellipse(cx, cy - 8, 26, 11, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(40,60,42,.95)'; g.lineWidth = 1.7;
      for (let i = 0; i < 42; i++) { const a = Math.PI + 0.12 + i / 41 * (Math.PI - 0.24); const l = 18 + r() * 14; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.8); g.stroke(); }
      g.strokeStyle = 'rgba(58,44,34,.9)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx - 34, cy + 6); g.quadraticCurveTo(cx - 10, cy + 2, cx, cy); g.stroke();
    }
  });
  // 梅花：白梅、红梅
  const blossom = (petal, edge) => canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#3b2f28'; g.lineCap = 'round';
    const tips = [];
    for (let k = 0; k < 7; k++) {
      let x = 128 + (r() - 0.5) * 30, y = 236, a = -Math.PI / 2 + (r() - 0.5) * 1.6;
      g.lineWidth = 2.6; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { a += (r() - 0.5) * 0.9; const l = 22 + r() * 16; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); tips.push([x, y]); g.lineWidth = Math.max(0.8, g.lineWidth - 0.4); }
      g.stroke();
    }
    for (const [tx, ty] of tips) for (let q = 0; q < 2; q++) {
      const x = tx + (r() - 0.5) * 22, y = ty + (r() - 0.5) * 22, rad = 3.6 + r() * 1.6;
      if (r() < 0.25) { g.fillStyle = edge; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); continue; }
      for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2 + r(); g.beginPath(); g.arc(x + Math.cos(a) * rad * 0.9, y + Math.sin(a) * rad * 0.9, rad * 0.75, 0, 7); g.fillStyle = petal; g.fill(); g.strokeStyle = edge; g.lineWidth = 0.7; g.stroke(); }
      g.fillStyle = '#d6ad45'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill();
    }
  });
  T.plum = blossom('#f6f2ec', 'rgba(150,108,108,.9)');
  T.peach = blossom('#efc0ca', 'rgba(160,86,98,.9)');
  // 垂柳
  T.willow = canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 16; k++) {
      const x0 = 8 + r() * 112, len = 150 + r() * 100, sway = (r() - 0.5) * 20;
      g.strokeStyle = 'rgba(92,106,52,.9)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + sway, len * 0.5, x0 + sway * 0.6, len); g.stroke();
      for (let t = 0.08; t < 1; t += 0.05) { const x = x0 + sway * (2 * t * (1 - t)) + sway * 0.6 * t * t, y = len * t; const a = Math.PI / 2 + (r() < 0.5 ? 0.6 : -0.6); leafPath(g, x, y, a, 7, 1.8); g.fillStyle = r() < 0.5 ? '#a9b86a' : '#bcc682'; g.fill(); g.strokeStyle = 'rgba(80,96,40,.6)'; g.lineWidth = 0.5; g.stroke(); }
    }
  });
  // 梧桐新芽、紫藤花苞
  T.bud = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) { const x = 20 + r() * 88, y = 20 + r() * 88; leafPath(g, x, y, r() * 7, 9, 3.5); g.fillStyle = r() < 0.5 ? '#b3c07c' : '#c4cc8e'; g.fill(); g.strokeStyle = INKC + '.7)'; g.lineWidth = 0.7; g.stroke(); }
  });
  T.wisteria = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,60,40,.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 20); g.bezierCurveTo(40, 0, 80, 40, 128, 18); g.stroke();
    for (let i = 0; i < 14; i++) { const x = 8 + r() * 112, y = 18 + r() * 20; leafPath(g, x, y, Math.PI / 2 + (r() - 0.5), 12, 4); g.fillStyle = '#7f9a5a'; g.fill(); g.strokeStyle = INKC + '.7)'; g.lineWidth = 0.6; g.stroke(); }
    for (let i = 0; i < 7; i++) { const x = 10 + r() * 108; let y = 26 + r() * 10; for (let k = 0; k < 6; k++) { g.fillStyle = k < 2 ? '#8f7aae' : '#a996c4'; g.beginPath(); g.ellipse(x + (r() - 0.5) * 3, y, 3 - k * 0.3, 2.3 - k * 0.2, 0, 0, 7); g.fill(); y += 6; } }
  });
  // 竹竿、树皮
  T.culm = canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#6f7f45'); gr.addColorStop(0.35, '#a3b06a'); gr.addColorStop(1, '#6a7a40');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) { g.fillStyle = 'rgba(48,56,30,.9)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(230,232,200,.6)'; g.fillRect(0, y + 3, w, 2); }
  }, true);
  T.bark = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#5c4838'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = r() * w; g.strokeStyle = r() < 0.6 ? 'rgba(34,26,20,.7)' : 'rgba(140,118,96,.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 8, h * 0.3, x + (r() - 0.5) * 8, h * 0.7, x + (r() - 0.5) * 4, h); g.stroke(); }
  }, true);
  // 远山：淡墨层叠，勾轮廓，加披麻皴
  T.mountains = canvasTex(2048, 256, (g, w, h) => {
    const ridge = (base, amp, color, seed, fade, line) => {
      const rr2 = rng(seed); const ph = [rr2() * 6, rr2() * 6, rr2() * 6]; const pts = [];
      for (let x = 0; x <= w; x += 3) {
        const u = x / w * Math.PI * 2;
        pts.push([x, base - amp * (0.55 * Math.sin(u * 3 + ph[0]) + 0.3 * Math.sin(u * 7 + ph[1]) + 0.15 * Math.sin(u * 17 + ph[2]) + 0.6) * (0.6 + 0.4 * Math.sin(u * 2 + ph[2]))]);
      }
      g.beginPath(); g.moveTo(0, h); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(w, h); g.closePath();
      const gr = g.createLinearGradient(0, base - amp * 1.3, 0, base + 30); gr.addColorStop(0, color); gr.addColorStop(1, fade);
      g.fillStyle = gr; g.fill();
      g.strokeStyle = line; g.lineWidth = 1.1; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      g.lineWidth = 0.7;
      for (let i = 0; i < pts.length; i += 5) { if (rr2() < 0.5) continue; const [x, y] = pts[i]; const l = 8 + rr2() * 22; g.beginPath(); g.moveTo(x, y + 3); g.quadraticCurveTo(x + 3, y + l * 0.5, x - 2 + rr2() * 4, y + l); g.stroke(); }
    };
    ridge(170, 110, 'rgba(118,132,128,0.5)', 3, 'rgba(118,132,128,0)', 'rgba(80,94,90,0.45)');
    ridge(200, 80, 'rgba(92,106,102,0.62)', 9, 'rgba(92,106,102,0)', 'rgba(60,72,68,0.55)');
  }, true);
  return T;
}

// ---------- materials ----------
function makeMaterials(T) {
  const M = {};
  const L = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: col(c) }, o));
  M.wall = L('#ece5d3');
  M.wallD = L('#e6dfcc', { side: THREE.DoubleSide });
  M.wood = L('#5e3b2a');
  M.woodL = L('#7a5236');
  M.roof = L('#ffffff', { map: T.tile, side: THREE.DoubleSide });
  M.under = L('#ffffff', { map: T.rafter, side: THREE.DoubleSide });
  M.ridge = L('#44474c');
  M.stone = L('#b8af9c');
  M.stoneD = L('#9d9483');
  M.lattice = L('#ffffff', { map: T.lattice, side: THREE.DoubleSide });
  M.gualuo = L('#ffffff', { map: T.gualuo, side: THREE.DoubleSide, alphaTest: 0.5, transparent: false });
  M.plank = L('#ffffff', { map: T.plank, side: THREE.DoubleSide });
  M.thatch = L('#8f8060', { side: THREE.DoubleSide });
  M.rock = new THREE.MeshLambertMaterial({ color: col('#aaa79d') });
  M.lantern = new THREE.MeshLambertMaterial({ color: col('#b8462f'), emissive: col('#ff9a50'), emissiveIntensity: 0 });
  M.line = new THREE.LineBasicMaterial({ color: col('#3a2f26'), transparent: true, opacity: 0.4 });
  M.ink = new THREE.MeshBasicMaterial({ color: col('#3a2f26'), side: THREE.BackSide });
  // 叶片卡片
  const card = (map, extra = {}) => {
    const m = new THREE.MeshLambertMaterial(Object.assign({ color: 0xffffff, map, side: THREE.DoubleSide, alphaTest: 0.45 }, extra));
    m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 });
    return m;
  };
  M.cLeaf = card(T.leaf); M.cBamboo = card(T.bamboo); M.cPine = card(T.pine); M.cPlum = card(T.plum); M.cPeach = card(T.peach);
  M.cWillow = card(T.willow); M.cBud = card(T.bud); M.cWisteria = card(T.wisteria);
  T.culm.repeat.set(1, 6);
  M.culm = L('#ffffff', { map: T.culm });
  T.bark.repeat.set(1, 3);
  M.bark = L('#ffffff', { map: T.bark }); M.barkD = L('#cfc6bd', { map: T.bark });
  return M;
}
// 叶片卡片几何：数片交叉的面，外加一片平放
function cardGeo(n = 3, horiz = true, hScale = 1) {
  const parts = [];
  for (let i = 0; i < n; i++) { const p = new THREE.PlaneGeometry(1, hScale); p.rotateY(i * Math.PI / n); parts.push(p); }
  if (horiz) { const p = new THREE.PlaneGeometry(1, 1); p.rotateX(-Math.PI / 2); parts.push(p); }
  return THREE.BufferGeometryUtils.mergeBufferGeometries(parts, false);
}

// ---------- geometry builders ----------
// 屋面：上为瓦面，下为椽子望板，檐口封板连起两层，不再是一张薄纸
function roofPt(s, u, v, P) {
  const x = -P.L / 2 + u * P.L;
  const z = s * P.S * (1 - v);
  let y = P.rise * (v * (1 - P.curve) + P.curve * v * v);
  const e = Math.pow(Math.abs(2 * u - 1), 6) * sq(1 - v) * P.up;
  return [x, y + e, z + s * e * 0.25];
}
function roofGeo(w, d, rise, over, curve = 0.35, up = 0.45, dy = 0) {
  const P = { L: w + 2 * over, S: d / 2 + over, rise, curve, up }; const nx = 16, ny = 7;
  const pos = [], uv = [], idx = [];
  for (const s of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const [x, y, z] = roofPt(s, i / nx, j / ny, P); pos.push(x, y + dy, z); uv.push(x / 1.6, j / ny * P.S / 1.6);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d2 = c + 1;
      if (s > 0) idx.push(a, b, c, b, d2, c); else idx.push(a, c, b, b, c, d2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function roofFascia(w, d, rise, over, curve, up, th) {
  const P = { L: w + 2 * over, S: d / 2 + over, rise, curve, up }; const nx = 16, ny = 7;
  const pos = [], idx = [], uv = [];
  const strip = pts => { const b = pos.length / 3; pts.forEach(([x, y, z], k) => { pos.push(x, y, z, x, y - th, z); uv.push(k / pts.length, 0, k / pts.length, 1); }); for (let k = 0; k < pts.length - 1; k++) { const a = b + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } };
  for (const s of [-1, 1]) {
    strip(Array.from({ length: nx + 1 }, (_, i) => roofPt(s, i / nx, 0, P)));
    for (const u of [0, 1]) strip(Array.from({ length: ny + 1 }, (_, j) => roofPt(s, u, j / ny, P)));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function roofSet(g, w, d, rise, over, y, opt = {}) {
  const { curve = 0.35, up = 0.45, top = W.M.roof, ry = 0, x = 0, z = 0, th = 0.16 } = opt;
  g.add(mesh(roofGeo(w, d, rise, over, curve, up), top, x, y, z, { edge: 35, ry }));
  g.add(mesh(roofGeo(w, d, rise, over, curve, up, -th), W.M.under, x, y, z, { edge: false, ry }));
  g.add(mesh(roofFascia(w, d, rise, over, curve, up, th), W.M.wood, x, y, z, { edge: false, ry }));
}
function gableGeo(d, rise) {
  const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rise * 0.92); sh.closePath();
  return new THREE.ShapeGeometry(sh);
}
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function mesh(g, m, x = 0, y = 0, z = 0, opt = {}) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z);
  if (opt.ry) o.rotation.y = opt.ry; if (opt.rx) o.rotation.x = opt.rx; if (opt.rz) o.rotation.z = opt.rz;
  o.userData.edge = opt.edge === undefined ? 30 : opt.edge;
  if (opt.keep) o.userData.keep = 1;
  return o;
}
const DEEP = 3.2; // 台基向下延伸，坡地上也不悬空
function plinth(g, w, d, top) { g.add(mesh(box(w, top + DEEP, d), W.M.stone, 0, (top - DEEP) / 2, 0)); }

// 厅堂：本地坐标前方为 +z
function hall(o) {
  const { w, d, h = 3.2, rise = 2.2, over = 1.0, plat = 0.5, cols = 3, plaque, lanterns, openFront, sideWin = 1, noRoof } = o;
  const g = new THREE.Group(); const M = W.M;
  if (plat > 0.05) {
    plinth(g, w + 1.4, d + 1.4, plat);
    g.add(mesh(box(w + 1.5, 0.08, d + 1.5), M.stoneD, 0, plat - 0.04, 0, { edge: 30 })); // 阶条石
    g.add(mesh(box(Math.min(3.2, w * 0.4), plat * 0.5 + DEEP, 0.7), M.stone, 0, plat * 0.25 - DEEP / 2, d / 2 + 0.7 + 0.35)); // 踏步
  }
  const y0 = plat;
  g.add(mesh(box(w, h, 0.25), M.wall, 0, y0 + h / 2, -d / 2 + 0.12));
  g.add(mesh(box(0.25, h, d), M.wall, -w / 2 + 0.12, y0 + h / 2, 0));
  g.add(mesh(box(0.25, h, d), M.wall, w / 2 - 0.12, y0 + h / 2, 0));
  // 勒脚
  g.add(mesh(box(w + 0.06, 0.45, 0.3), M.stoneD, 0, y0 + 0.22, -d / 2 + 0.12, { edge: false }));
  for (const s of [-1, 1]) g.add(mesh(box(0.3, 0.45, d + 0.06), M.stoneD, s * (w / 2 - 0.12), y0 + 0.22, 0, { edge: false }));
  if (sideWin) for (const s of [-1, 1])
    g.add(mesh(new THREE.PlaneGeometry(d * 0.4, h * 0.35), M.lattice, s * (w / 2 + 0.01), y0 + h * 0.55, 0, { ry: s * Math.PI / 2, edge: false }));
  const fz = d / 2 - 0.9; // 前檐廊
  const bay = (w - 0.4) / cols;
  for (let i = 0; i <= cols; i++) {
    const x = -w / 2 + 0.2 + i * bay;
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, h, 10), M.wood, x, y0 + h / 2, d / 2 - 0.2, { edge: false }));
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 10), M.stone, x, y0 + 0.08, d / 2 - 0.2, { edge: 40 })); // 柱础
    if (!openFront && i < cols) g.add(mesh(new THREE.PlaneGeometry(bay - 0.3, h * 0.88), M.lattice, x + bay / 2, y0 + h * 0.44, fz, { edge: false }));
    if (i < cols) g.add(mesh(new THREE.PlaneGeometry(bay - 0.26, 0.42), M.gualuo, x + bay / 2, y0 + h - 0.47, d / 2 - 0.2, { edge: false }));
  }
  if (!openFront) g.add(mesh(box(w, h * 0.1, 0.2), M.wood, 0, y0 + h * 0.95, fz, { edge: false }));
  g.add(mesh(box(w + 0.1, 0.26, 0.26), M.wood, 0, y0 + h - 0.12, d / 2 - 0.2, { edge: 40 }));
  g.add(mesh(box(w + 0.1, 0.12, 0.2), M.woodL, 0, y0 + h - 0.32, d / 2 - 0.2, { edge: false }));
  if (!noRoof) {
    roofSet(g, w, d, rise, over, y0 + h);
    const rl = w + 2 * over;
    g.add(mesh(box(rl * 0.97, 0.26, 0.3), M.ridge, 0, y0 + h + rise + 0.06, 0, { edge: 40 }));
    for (const s of [-1, 1]) {
      g.add(mesh(box(0.26, 0.7, 0.28), M.ridge, s * rl * 0.485, y0 + h + rise + 0.36, 0, { rz: -s * 0.55, edge: 40 }));
      g.add(mesh(gableGeo(d, rise), M.wallD, s * (w / 2), y0 + h, 0, { ry: Math.PI / 2 * s, edge: false }));
    }
  }
  if (plaque) g.add(mesh(new THREE.PlaneGeometry(Math.min(3.2, w * 0.4), 0.9), plaqueMat(plaque), 0, y0 + h - 1.05, d / 2 - 0.02, { edge: false, keep: 1 }));
  if (lanterns) for (const s of [-1, 1]) addLantern(g, s * w * 0.32, y0 + h - 0.75, d / 2 + 0.2);
  g.userData.top = y0 + h + rise;
  return g;
}
function addLantern(g, x, y, z) {
  const l = mesh(new THREE.SphereGeometry(0.24, 14, 10), W.M.lantern, x, y, z, { edge: false, keep: 1 }); l.scale.y = 1.3; g.add(l);
  W.lanternMeshes.push(l);
}
function pavilion(o) {
  const { r = 2, h = 2.8, sides = 6, rise = 2.2, over = 0.9, plat = 0.45 } = o; const g = new THREE.Group(); const M = W.M;
  const rot = sides === 4 ? Math.PI / 4 : 0;
  const base = mesh(new THREE.CylinderGeometry(r + 0.5, r + 0.6, plat + DEEP, sides), M.stone, 0, (plat - DEEP) / 2, 0); base.rotation.y = rot; g.add(base);
  const cp = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + i / sides * Math.PI * 2 + Math.PI / 2; const cx = Math.cos(a) * r * 0.92, cz = Math.sin(a) * r * 0.92; cp.push([cx, cz]);
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, h, 10), M.wood, cx, plat + h / 2, cz, { edge: false }));
    g.add(mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.14, 10), M.stone, cx, plat + 0.07, cz, { edge: 40 }));
  }
  // 坐凳栏杆（留出一面作入口）与挂落
  for (let i = 0; i < sides; i++) {
    const [ax, az] = cp[i], [bx, bz] = cp[(i + 1) % sides]; const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
    const gl = mesh(new THREE.PlaneGeometry(len - 0.25, 0.36), M.gualuo, mx, plat + h - 0.3, mz, { edge: false }); gl.rotation.y = ang; g.add(gl);
    if (i === 0) continue;
    const bench = mesh(box(len - 0.2, 0.08, 0.42), M.woodL, mx * 0.97, plat + 0.5, mz * 0.97, { edge: 40 }); bench.rotation.y = ang; g.add(bench);
    const pan = mesh(box(len - 0.2, 0.42, 0.06), M.wood, mx, plat + 0.25, mz, { edge: false }); pan.rotation.y = ang; g.add(pan);
  }
  const pts = []; const R0 = r + over;
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(R0 * (1 - t) + 0.05, rise * (t * 0.55 + 0.45 * t * t) - (1 - t) * (1 - t) * 0.05 + (i === 0 ? 0.35 : 0))); }
  pts.reverse();
  const roof = mesh(new THREE.LatheGeometry(pts, sides), M.roof, 0, plat + h, 0, { edge: 30 }); roof.rotation.y = rot + Math.PI / 2; g.add(roof);
  const under = mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p.x * 0.985, p.y - 0.15)), sides), M.under, 0, plat + h, 0, { edge: false }); under.rotation.y = rot + Math.PI / 2; g.add(under);
  g.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), M.ridge, 0, plat + h + rise + 0.15, 0));
  g.add(mesh(new THREE.ConeGeometry(0.1, 0.5, 8), M.ridge, 0, plat + h + rise + 0.5, 0, { edge: false }));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.12, sides), M.woodL, 0, plat + h - 0.06, 0, { edge: 40 }));
  g.userData.top = plat + h + rise; return g;
}
function lou(o) {
  const { w, d, h1 = 3.2, h2 = 2.8, plaque, lanterns, openUpper } = o; const g = new THREE.Group(); const M = W.M;
  g.add(hall({ w, d, h: h1, cols: 4, lanterns, noRoof: 1 }));
  const yU = 0.5 + h1;
  // 腰檐
  for (const s of [-1, 1]) {
    g.add(mesh(halfRoof(w + 1.2, 1.6, 0.7, s), M.roof, 0, yU - 0.5, s * (d / 2 - 0.2), { edge: 35 }));
    g.add(mesh(halfRoof(w + 1.2, 1.6, 0.7, s), M.under, 0, yU - 0.62, s * (d / 2 - 0.2), { edge: false }));
  }
  g.add(mesh(box(w + 0.4, 0.3, d + 0.4), M.woodL, 0, yU + 0.15, 0, { edge: 40 }));
  const up = hall({ w: w - 1.2, d: d - 1.2, h: h2, rise: 2.0, over: 1.0, plat: 0.01, cols: 3, openFront: openUpper, plaque, sideWin: !openUpper });
  if (openUpper) up.children = up.children.filter(c => !(c.material === M.wall && c.geometry.type === 'BoxGeometry' && c.position.y > 0.5) && !(c.material === M.stoneD && c.position.y > 0.1 && c.position.y < 0.5));
  up.position.y = yU + 0.3; g.add(up);
  // 楼上栏杆（北、西两面；东面留给楼梯）
  const ry = yU + 0.3 + 0.62, hw = (w - 0.6) / 2, hd = (d - 1.2) / 2 + 0.25;
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
    const b = mesh(box(0.09, 0.09, len), M.wood, (x0 + x1) / 2, ry, (z0 + z1) / 2, { ry: a, edge: 40 }); g.add(b);
    const n = Math.max(2, Math.round(len / 0.45));
    for (let i = 0; i <= n; i++) g.add(mesh(box(0.05, 0.6, 0.05), M.wood, lerp(x0, x1, i / n), ry - 0.3, lerp(z0, z1, i / n), { edge: false }));
  };
  rail(-hw, hd, hw, hd); rail(-hw, -hd, -hw, hd); rail(-hw, -hd, hw * 0.1, -hd);
  g.userData.top = yU + 0.3 + h2 + 2.0; g.userData.upperY = yU + 0.3;
  return g;
}
function halfRoof(L, span, rise, s) {
  const nx = 10, ny = 4, pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny; const x = -L / 2 + u * L;
    const z = s * span * (1 - v); const y = rise * v; pos.push(x, y, z); uv.push(x / 1.6, v * span / 1.6);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d2 = c + 1; if (s > 0) idx.push(a, b, c, b, d2, c); else idx.push(a, c, b, b, c, d2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// 南楼石阶：沿东山墙外，北低南高
function nanlouStair(y0, y1) {
  const g = new THREE.Group(); const M = W.M; const S = STAIR;
  const n = S.n, rise = (y1 - y0) / n, run = (S.z1 - S.z0) / n;
  for (let i = 0; i < n; i++) {
    const top = y0 + rise * (i + 1);
    g.add(mesh(box(S.w, top - y0 + 1.2, run + 0.02), M.stone, S.x, (top + y0 - 1.2) / 2, S.z0 + run * (i + 0.5), { edge: 40 }));
  }
  // 平台与楼板相接
  g.add(mesh(box(S.x + S.w / 2 - S.landX0, 0.3, S.landZ1 - S.landZ0), M.woodL, (S.x + S.w / 2 + S.landX0) / 2, y1 - 0.15, (S.landZ0 + S.landZ1) / 2, { edge: 40 }));
  g.add(mesh(box(S.w, y1 - y0 + 1.2, S.landZ1 - S.z1 + 0.02), M.stone, S.x, (y1 + y0 - 1.2) / 2 - 0.3, (S.z1 + S.landZ1) / 2, { edge: 40 }));
  // 扶手（外侧）
  const rx = S.x + S.w / 2 - 0.08;
  const len = Math.hypot(S.z1 - S.z0, y1 - y0), ang = Math.atan2(y1 - y0, S.z1 - S.z0);
  const hr = mesh(box(0.08, 0.08, len), M.wood, rx, (y0 + y1) / 2 + 0.9, (S.z0 + S.z1) / 2, { edge: 40 }); hr.rotation.x = -ang; g.add(hr);
  for (let i = 0; i <= 6; i++) { const t = i / 6; g.add(mesh(box(0.07, 0.95, 0.07), M.wood, rx, y0 + (y1 - y0) * t + 0.47 + rise, S.z0 + (S.z1 - S.z0) * t, { edge: false })); }
  return g;
}
function corridor(pts) {
  const g = new THREE.Group(); const M = W.M;
  const vines = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    const n = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i < n; i++) {
      const tm = (i + 0.5) / n;
      const x = lerp(ax, bx, tm), z = lerp(az, bz, tm); const y = H(x, z);
      const seg = new THREE.Group(); seg.position.set(x, y, z); seg.rotation.y = ang;
      const sl = len / n;
      seg.add(mesh(box(2.4, 0.25 + 2.2, sl + 0.05), M.stone, 0, 0.12 - 1.1, 0, { edge: 40 }));
      for (const sx of [-1, 1]) {
        seg.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.45, 8), M.wood, sx * 1.05, 1.47, -sl / 2 + 0.1, { edge: false }));
        seg.add(mesh(box(0.06, 0.06, sl), M.wood, sx * 1.05, 0.72, 0, { edge: false }));
        seg.add(mesh(box(0.05, 0.05, sl), M.wood, sx * 1.05, 0.42, 0, { edge: false }));
        const gl = mesh(new THREE.PlaneGeometry(sl - 0.2, 0.3), M.gualuo, sx * 1.05, 2.45, 0, { ry: Math.PI / 2, edge: false }); seg.add(gl);
      }
      roofSet(seg, sl + 0.02, 2.2, 0.9, 0.35, 2.68, { curve: 0.2, up: 0.05, ry: Math.PI / 2, th: 0.1 });
      g.add(seg);
      for (let q = 0; q < 2; q++) vines.push({ x, y: y + 3.35, z, a: ang, off: rr(-sl / 2, sl / 2), side: rr(-0.9, 0.9) });
    }
  }
  W.vineSpots = vines;
  return g;
}
function gate() {
  const g = new THREE.Group(); const M = W.M;
  for (const s of [-1, 1]) { g.add(mesh(box(0.26, 3.0 + 1.5, 0.26), M.wood, s * 1.45, 1.5 - 0.75, 0)); g.add(mesh(box(0.5, 0.35, 0.5), M.stone, s * 1.45, 0.17, 0)); }
  roofSet(g, 3.4, 1.4, 0.8, 0.5, 3.0, { curve: 0.25, up: 0.15, top: M.thatch, th: 0.12 });
  g.add(mesh(box(3.3, 0.2, 0.3), M.wood, 0, 2.9, 0));
  const dg = box(1.35, 2.5, 0.08);
  g.add(mesh(dg.clone().translate(0.65, 0, 0), M.plank, -1.32, 1.3, 0.1, { ry: -1.1 }));
  g.add(mesh(dg.clone().translate(-0.65, 0, 0), M.plank, 1.32, 1.3, 0.1, { ry: 1.1 }));
  g.add(mesh(box(3.1, 0.12, 0.34), M.stone, 0, 0.06, 0));
  addLantern(g, -1.7, 2.3, -0.4); addLantern(g, 1.7, 2.3, -0.4);
  g.userData.top = 4.2; return g;
}
function archBridge(L = 9, W0 = 2.4, rise = 1.5) {
  const g = new THREE.Group(); const M = W.M;
  // 用 shape 自身绘出拱洞：沿拱反向绘制
  const shape = new THREE.Shape();
  shape.moveTo(-L / 2, -0.8);
  for (let i = 0; i <= 20; i++) { const t = i / 20; shape.lineTo(-L / 2 + t * L, rise * Math.sin(Math.PI * t) + 0.35); }
  shape.lineTo(L / 2, -0.8); shape.lineTo(1.9, -0.8);
  for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI; shape.lineTo(Math.cos(a) * 1.9, -0.8 + Math.sin(a) * 1.75); }
  shape.lineTo(-L / 2, -0.8);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W0, bevelEnabled: false });
  geo.translate(0, 0, -W0 / 2);
  g.add(mesh(geo, M.stone, 0, 0, 0, { edge: 30 }));
  // 栏板
  for (const s of [-1, 1]) {
    const p = new THREE.Shape(); p.moveTo(-L / 2, 0.35);
    for (let i = 0; i <= 20; i++) { const t = i / 20; p.lineTo(-L / 2 + t * L, rise * Math.sin(Math.PI * t) + 0.35); }
    for (let i = 20; i >= 0; i--) { const t = i / 20; p.lineTo(-L / 2 + t * L, rise * Math.sin(Math.PI * t) + 0.95); }
    const pg = new THREE.ExtrudeGeometry(p, { depth: 0.16, bevelEnabled: false }); pg.translate(0, 0, -0.08);
    g.add(mesh(pg, M.stoneD, 0, 0, s * (W0 / 2 - 0.08), { edge: 30 }));
  }
  return g;
}
function boat() {
  const g = new THREE.Group(); const M = W.M;
  const hull = new THREE.BoxGeometry(4.2, 0.6, 1.3, 8, 1, 1); const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); const f = 1 - Math.pow(Math.abs(x) / 2.1, 3) * 0.75; p.setZ(i, p.getZ(i) * f); if (p.getY(i) > 0) p.setY(i, p.getY(i) + Math.pow(Math.abs(x) / 2.1, 2) * 0.3); }
  hull.computeVertexNormals();
  g.add(mesh(hull, M.woodL, 0, 0.1, 0, { edge: 30 }));
  const c2 = mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.5, 12, 1, true, -Math.PI / 2, Math.PI), M.thatch, 0.2, 0.4, 0, { edge: 30 });
  c2.rotation.z = Math.PI / 2; g.add(c2);
  return g;
}
function rock(s = 1) {
  // 太湖石：圆润、多孔的轮廓，细线勾边
  const g = new THREE.IcosahedronGeometry(1, 3); const p = g.attributes.position; const seed = R() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * Math.sin(v.z * 3.3 + seed * 0.5);
    const holes = Math.max(0, Math.sin(v.x * 7 + seed) * Math.sin(v.y * 6.5) * Math.sin(v.z * 7.5 - seed) - 0.55) * 1.6;
    const k = 0.85 + 0.25 * n - holes;
    p.setXYZ(i, v.x * k * 0.85, v.y * k * 1.45, v.z * k * 0.8);
  }
  g.computeVertexNormals(); const m = mesh(g, W.M.rock, 0, 0, 0, { edge: 55 }); m.scale.setScalar(s); return m;
}
function plaqueMat(text) {
  const t = canvasTex(512, 144, (g, w, h) => {
    g.fillStyle = '#2d2824'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a88c55'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#d6b877'; g.font = '84px "Ma Shan Zheng", "STKaiti", "KaiTi", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 6);
  });
  return new THREE.MeshBasicMaterial({ map: t });
}

// 把一组建筑放到地面上
function place(obj, x, z, ry = 0, dy = 0) {
  obj.position.set(x, H(x, z) + dy, z); obj.rotation.y = ry; W.buildRoot.add(obj); return obj;
}

// ---------- characters ----------
function figure(opt) {
  const { robe = '#4f6470', jacket = '#34363c', scale = 1, beard = 1, cane = 1, sash } = opt;
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const Lm = c => new THREE.MeshLambertMaterial({ color: col(c) });
  const robeM = Lm(robe), jackM = jacket ? Lm(jacket) : robeM, skin = Lm('#e2cbb0'), black = Lm('#1f1d1c'), inkM = Lm('#2e2823'), white = Lm('#ece6da');
  const V = a => a.map(p => new THREE.Vector2(p[0], p[1]));
  const robeG = new THREE.LatheGeometry(V([[0.0, 0.0], [0.4, 0.0], [0.37, 0.25], [0.3, 0.78], [0.25, 1.0], [0.24, 1.25], [0.27, 1.38], [0.1, 1.47], [0.0, 1.48]]), 24);
  body.add(new THREE.Mesh(robeG, robeM));
  const hull = new THREE.Mesh(robeG, W.M.ink); hull.scale.set(1.022, 1.003, 1.022); body.add(hull);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.398, 0.012, 6, 32), inkM); hem.rotation.x = Math.PI / 2; hem.position.y = 0.05; body.add(hem);
  for (const s of [-1, 1]) { // 布鞋
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), black); shoe.position.set(s * 0.1, 0.045, 0.3); body.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.23), white); sole.position.set(s * 0.1, 0.012, 0.3); body.add(sole);
  }
  if (jacket) {
    const jg = new THREE.LatheGeometry(V([[0.0, 0.88], [0.3, 0.9], [0.285, 1.2], [0.305, 1.4], [0.12, 1.485], [0, 1.495]]), 24);
    body.add(new THREE.Mesh(jg, jackM));
    const jh = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 6, 32), inkM); jh.rotation.x = Math.PI / 2; jh.position.y = 0.9; body.add(jh);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), Lm('#b39a62')); b.position.set(0, 0.98 + i * 0.1, 0.29 + (i > 2 ? 0.008 : 0)); body.add(b); }
  }
  if (sash) { const sb = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 6, 28), Lm(sash)); sb.rotation.x = Math.PI / 2; sb.position.y = 1.02; body.add(sb); }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.29, 1.38, 0);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.115, 0.6, 12), jacket ? jackM : robeM); sl.position.y = -0.3; a.add(sl);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.05, 12), white); cuff.position.y = -0.585; a.add(cuff);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin); hd.position.y = -0.64; a.add(hd);
    a.rotation.z = s * 0.12; body.add(a); arms.push(a);
  }
  const head = new THREE.Group(); head.position.y = 1.6; body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), skin));
  const hullH = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), W.M.ink); hullH.scale.setScalar(1.035); head.add(hullH);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.136, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), black); cap.position.y = 0.012; head.add(cap);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.133, 0.008, 6, 28), inkM); brim.rotation.x = Math.PI / 2; brim.position.y = 0.012; head.add(brim);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), Lm('#a83a2a')); knot.position.y = 0.15; head.add(knot);
  const queue = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, 0.66, 8), black); queue.position.set(0, -0.32, -0.12); queue.rotation.x = 0.1; head.add(queue);
  if (beard) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.26, 10), Lm('#dcd7cc')); b.position.set(0, -0.16, 0.085); b.rotation.x = Math.PI + 0.25; head.add(b);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.12, 5), Lm('#dcd7cc')); m.position.set(s * 0.04, -0.05, 0.12); m.rotation.z = s * 1.1; head.add(m); }
  }
  if (cane) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.12, 8), Lm('#4a3322')); c.position.set(0.02, -0.26, 0.08); arms[1].add(c); }
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh && o.material !== W.M.ink) o.castShadow = true; });
  g.userData = { body, arms, head, phase: 0, lean: 0, look: 0, pose: { lean: 0, look: 0 } };
  return g;
}
// pose：lean 身体前倾（上楼）或后仰（下楼）；look 低头看脚下；step 为外部给定的步相（楼梯上逐级）
function animFigure(f, dt, walking, speed = 1, step = null) {
  const u = f.userData; const k = 1 - Math.exp(-dt * 5);
  u.lean += (u.pose.lean - u.lean) * k; u.look += (u.pose.look - u.look) * k;
  if (step !== null) u.phase = step; else u.phase += dt * (walking ? 6.2 * speed : 1.2);
  const s = Math.sin(u.phase);
  u.body.position.y = walking ? Math.abs(s) * (step !== null ? 0.02 : 0.03) : Math.sin(u.phase) * 0.006;
  u.body.rotation.z = walking ? s * 0.02 : 0;
  u.body.rotation.x = u.lean;
  u.arms[0].rotation.x = walking ? s * 0.3 : 0.05;
  u.arms[1].rotation.x = walking ? -s * 0.22 - u.lean * 0.8 : -0.08;
  u.head.rotation.x = u.look;
  u.head.rotation.y = walking ? 0 : Math.sin(u.phase * 0.4) * 0.12;
}

// ---------- vegetation（叶片卡片，工笔细描） ----------
function instanced(geo, mat, list, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  const o = new THREE.Object3D(); const c = new THREE.Color();
  list.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z); o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); o.scale.set(it.sx, it.sy, it.sz); o.updateMatrix();
    m.setMatrixAt(i, o.matrix); if (it.c) { c.set(it.c); m.setColorAt(i, c); }
  });
  m.castShadow = shadow; m.receiveShadow = false;
  if (mat.userData && mat.userData.depth) m.customDepthMaterial = mat.userData.depth;
  return m;
}
function freeSpot(x, z, pathM = 2.6, flatM = 1.5) {
  if (pathDist(x, z) < pathM) return false;
  for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r + flatM) return false;
  if (pondMask(x, z).rim > 0.05) return false;
  if (fieldAt(x, z)) return false;
  if (distSegList(x, z, CORRIDOR) < 2.8) return false;
  for (const k in SPOTS) { const c = SPOTS[k].cam; if (Math.hypot(x - c[0], z - c[1]) < 4.5) return false; }
  return true;
}
function distSegList(x, z, pts) { let d = 1e9; for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, distSeg(x, z, [pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]])); return d; }

function buildVegetation() {
  const M = W.M; const veg = W.vegRoot; const garden = W.gardenVeg;
  const card = cardGeo(3, true), cardV = cardGeo(2, false), cardTall = cardGeo(2, false, 2);
  const tints = ['#ffffff', '#f3f5ea', '#e8eedc', '#f8f2e2', '#e2e9d4'];
  const tint = () => tints[Math.floor(R() * tints.length)];
  const trunkG = new THREE.CylinderGeometry(0.1, 0.18, 1, 8);
  // --- 竹 ---
  const culms = [], bLeaves = [];
  const addBamboo = (x0, x1, z0, z1, n, pm) => {
    for (let i = 0; i < n; i++) {
      const x = rr(x0, x1), z = rr(z0, z1); if (!freeSpot(x, z, pm, 0.5)) continue;
      const y = H(x, z), h = rr(5.5, 8.5), tilt = rr(-0.07, 0.07), rz = rr(-0.07, 0.07);
      culms.push({ x, y: y + h / 2, z, rx: tilt, rz, sx: 1, sy: h, sz: 1, c: R() < 0.5 ? '#ffffff' : '#e9ecd8' });
      for (let k = 0; k < 4; k++) { const yy = y + h * (0.5 + k * 0.14); const s = rr(1.5, 2.2); bLeaves.push({ x: x - rz * (yy - y) + rr(-0.35, 0.35), y: yy, z: z + tilt * (yy - y) + rr(-0.35, 0.35), ry: R() * 6, sx: s, sy: s * 0.9, sz: s, c: tint() }); }
    }
  };
  addBamboo(BAMBOO_ZONE.x0, BAMBOO_ZONE.x1, BAMBOO_ZONE.z0, BAMBOO_ZONE.z1, 820, 2.5);
  addBamboo(-34, -14, -44, -38, 110, 2);
  garden.add(instanced(new THREE.CylinderGeometry(0.05, 0.065, 1, 8), M.culm, culms));
  garden.add(instanced(card, M.cBamboo, bLeaves));

  // --- 松（山脊） ---
  const pineT = [], pineP = [];
  for (let i = 0; i < 520; i++) {
    const x = rr(-175, 175), z = rr(-140, 140); const y = H(x, z);
    if (!(y > 9.5 || Math.abs(z) > 70) || !freeSpot(x, z, 3, 3)) continue;
    const s = rr(0.8, 1.4); const h = 4.6 * s, lean = rr(-0.18, 0.18);
    pineT.push({ x, y: y + h / 2, z, rz: lean, sx: s, sy: h, sz: s });
    for (let k = 0; k < 4; k++) { const yy = h * (0.5 + k * 0.15); pineP.push({ x: x - Math.sin(lean) * yy + rr(-0.5, 0.5) * s, y: y + yy, z: z + rr(-0.5, 0.5) * s, ry: R() * 6, sx: s * rr(2.4, 3.2) * (1 - k * 0.14), sy: s * 1.6, sz: s * rr(2.0, 2.8) * (1 - k * 0.14), c: tint() }); }
  }
  veg.add(instanced(trunkG, M.barkD, pineT));
  veg.add(instanced(cardGeo(3, false), M.cPine, pineP));

  // --- 阔叶树 ---
  const bt = [], bb = [], bc = [];
  for (let i = 0; i < 1400; i++) {
    const x = rr(-170, 170), z = rr(-120, 120); const y = H(x, z);
    if (y > 9.5 && R() < 0.6) continue;
    if (x > PLUM_ZONE.x0 - 2 && x < PLUM_ZONE.x1 + 2 && z > PLUM_ZONE.z0 - 2 && z < PLUM_ZONE.z1 + 2) continue;
    if (x > BAMBOO_ZONE.x0 - 1 && x < BAMBOO_ZONE.x1 + 1 && z > BAMBOO_ZONE.z0 - 1 && z < BAMBOO_ZONE.z1 + 1) continue;
    if (!freeSpot(x, z, 3.2, 2.5)) continue;
    const s = rr(0.85, 1.5); const h = 3.4 * s;
    bt.push({ x, y: y + h / 2, z, sx: s * 1.1, sy: h, sz: s * 1.1 });
    for (let k = 0; k < 2; k++) { const a = R() * 6.28; bb.push({ x: x + Math.cos(a) * 0.5 * s, y: y + h * 0.95, z: z + Math.sin(a) * 0.5 * s, ry: -a, rz: 0.7, sx: 0.5 * s, sy: 1.6 * s, sz: 0.5 * s }); }
    const n = 3 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) { const sc = s * rr(2.4, 3.2); bc.push({ x: x + rr(-1.0, 1.0) * s, y: y + h + rr(-0.2, 1.3) * s, z: z + rr(-1.0, 1.0) * s, ry: R() * 6, sx: sc, sy: sc * rr(0.8, 1.0), sz: sc, c: tint() }); }
    if (bt.length > 380) break;
  }
  veg.add(instanced(trunkG, M.bark, bt));
  veg.add(instanced(trunkG, M.bark, bb));
  veg.add(instanced(card, M.cLeaf, bc));

  // --- 梅林（香雪海）与桃杏 ---
  const pt = [], pw = [], pp = [];
  const plum = (x, z, pink) => {
    const y = H(x, z); const s = rr(0.8, 1.2);
    const lean = rr(-0.25, 0.25);
    pt.push({ x, y: y + 0.9 * s, z, rz: lean, sx: s * 0.9, sy: 1.8 * s, sz: s * 0.9 });
    const upv = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), eu = new THREE.Euler();
    const tx = x - Math.sin(lean) * 1.7 * s, ty = y + 1.7 * s;
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * 6.28 + R(), tilt = rr(0.5, 0.9), len = rr(0.9, 1.3) * s;
      const d = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)); q.setFromUnitVectors(upv, d); eu.setFromQuaternion(q);
      pt.push({ x: tx + d.x * len / 2, y: ty + d.y * len / 2, z: z + d.z * len / 2, rx: eu.x, ry: eu.y, rz: eu.z, sx: s * 0.4, sy: len, sz: s * 0.4 });
      const sc = s * rr(1.7, 2.2); (pink ? pp : pw).push({ x: tx + d.x * len * 1.05, y: ty + d.y * len + 0.2, z: z + d.z * len * 1.05, ry: R() * 6, sx: sc, sy: sc, sz: sc, c: '#ffffff' });
    }
    const sc0 = s * rr(1.8, 2.4); (pink ? pp : pw).push({ x: tx, y: ty + 0.7 * s, z, ry: R() * 6, sx: sc0, sy: sc0, sz: sc0, c: '#ffffff' });
  };
  let cnt = 0;
  for (let i = 0; i < 600 && cnt < 70; i++) { const x = rr(PLUM_ZONE.x0, PLUM_ZONE.x1), z = rr(PLUM_ZONE.z0, PLUM_ZONE.z1); if (!freeSpot(x, z, 2.2, 1)) continue; plum(x, z, false); cnt++; }
  const pinkSpots = [[34, -10], [47, -26], [12, -24], [-12, -22], [-50, 4], [-40, -18], [8, -10], [-4, -12], [26, -12], [40, -6], [-48, -16], [58, -6]];
  for (const [x, z] of pinkSpots) if (freeSpot(x, z, 2.2, 1)) plum(x, z, true);
  garden.add(instanced(new THREE.CylinderGeometry(0.07, 0.14, 1, 7), M.barkD, pt));
  garden.add(instanced(card, M.cPlum, pw));
  garden.add(instanced(card, M.cPeach, pp));

  // --- 四桐（仲春尚未展叶，只有新芽） ---
  const yard = FLATS.find(f => f.id === 'yard');
  const wt = [], wb = [], wbud = [];
  for (const [dx, dz] of [[-5, -6.5], [5, -6.5], [-5, 6.5], [5, 6.5]]) {
    const x = yard.x + dx + 3.5, z = yard.z + dz; const y = yard.y;
    wt.push({ x, y: y + 3.6, z, sx: 1.1, sy: 7.2, sz: 1.1, c: '#c8d0b8' });
    const upv = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), eu = new THREE.Euler();
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + R(); const tilt = rr(0.3, 0.7); const len = rr(2.2, 3.4); const yb = rr(4.8, 6.8);
      const d = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
      q.setFromUnitVectors(upv, d); eu.setFromQuaternion(q);
      wb.push({ x: x + d.x * len / 2, y: y + yb + d.y * len / 2, z: z + d.z * len / 2, rx: eu.x, ry: eu.y, rz: eu.z, sx: 0.35, sy: len, sz: 0.35, c: '#c8d0b8' });
      wbud.push({ x: x + d.x * len, y: y + yb + d.y * len, z: z + d.z * len, ry: R() * 6, sx: 1.0, sy: 0.8, sz: 1.0, c: '#ffffff' });
    }
  }
  garden.add(instanced(new THREE.CylinderGeometry(0.2, 0.3, 1, 10), M.bark, wt));
  garden.add(instanced(new THREE.CylinderGeometry(0.06, 0.12, 1, 6), M.bark, wb));
  garden.add(instanced(card, M.cBud, wbud));

  // --- 垂柳 ---
  const lt = [], lc = [];
  const willowSpots = [[-36, 12], [-30, -1.5], [-14, 14], [16, 3], [14, 14], [-2, 0.5], [-18, 15], [8, 16.2]];
  for (const [x, z] of willowSpots) {
    const y = H(x, z); const lean = rr(-0.15, 0.15);
    lt.push({ x, y: y + 2.3, z, rz: lean, sx: 1, sy: 4.6, sz: 1 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; lc.push({ x: x - Math.sin(lean) * 4.4 + Math.cos(a) * rr(0.6, 1.4), y: y + rr(3.0, 3.8), z: z + Math.sin(a) * rr(0.6, 1.4), ry: R() * 6, sx: rr(1.4, 1.9), sy: rr(1.6, 2.1), sz: rr(1.4, 1.9), c: tint() }); }
  }
  garden.add(instanced(trunkG, M.bark, lt));
  garden.add(instanced(cardTall, M.cWillow, lc));

  // --- 藤花廊上的紫藤 ---
  const wv = (W.vineSpots || []).map(v => ({ x: v.x + Math.sin(v.a) * v.off + Math.cos(v.a) * v.side, y: v.y, z: v.z + Math.cos(v.a) * v.off - Math.sin(v.a) * v.side, ry: R() * 6, sx: 1.4, sy: 1.0, sz: 1.4, c: '#ffffff' }));
  garden.add(instanced(card, M.cWisteria, wv));

  // 庭院太湖石
  const rocks = [[-33, 12, 1.1], [14, 2.5, 0.9], [34, -24, 1.2], [26, -30.5, 0.9], [-5, -34.5, 0.8], [-42, -1.5, 0.9], [-16, 12.8, 0.7], [9, 15.2, 0.8]];
  for (const [x, z, s] of rocks) { const r = rock(s); r.position.set(x, H(x, z) + 0.45 * s, z); W.buildRoot.add(r); }
  void cardV;
}
// ---------- terrain mesh ----------
function buildTerrain() {
  const size = 360, seg = 200;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const colors = new Float32Array(p.count * 3); const fcol = new Float32Array(p.count * 3);
  const C = {
    grass: col('#7f9265'), grass2: col('#97a070'), dark: col('#6f7d56'), rock: col('#a08f6a'),
    path: col('#c8b88f'), pave: col('#cbc0a4'), bed: col('#5d6b5e'), rape: col('#d6bf57'), wheat: col('#8fa05a'),
    paddy: col('#a4b3aa'), veg: col('#7c985c'), petal: col('#e3ddd2'), earth: col('#b3a27c'), field2: col('#a39a70')
  };
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); const y = H(x, z); p.setY(i, y);
    const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1));
    const n = 0.5 + 0.5 * Math.sin(x * 0.13 + Math.cos(z * 0.11) * 2) * Math.cos(z * 0.09);
    tmp.copy(C.grass).lerp(C.grass2, n);
    if (y > 9) tmp.lerp(C.dark, smooth(9, 16, y) * 0.8);
    tmp.lerp(C.rock, smooth(1.2, 3.2, sl) * 0.7);
    const pm = pondMask(x, z); tmp.lerp(C.bed, pm.m); tmp.lerp(C.earth, Math.max(0, pm.rim - pm.m) * 0.35);
    for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + 0.5) tmp.lerp(f.pave ? C.pave : C.earth, smooth(f.r + 0.5, f.r - 1, d) * 0.9); }
    if (x > PLUM_ZONE.x0 && x < PLUM_ZONE.x1 && z > PLUM_ZONE.z0 && z < PLUM_ZONE.z1) tmp.lerp(C.petal, 0.25 * (0.5 + 0.5 * Math.sin(x * 1.3 + z * 1.7)));
    const pd = pathDist(x, z); tmp.lerp(C.path, smooth(2.0, 1.0, pd) * 0.9);
    const f = fieldAt(x, z);
    if (f) { const st = 0.5 + 0.5 * Math.sin(z * 3.2); tmp2.copy(C[f.k]).lerp(C.earth, f.k === 'paddy' ? 0.1 : st * 0.25); tmp.copy(tmp2); }
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    // 平为田后的颜色：园区变为田垄
    const inGarden = Math.hypot((x - 5) / 95, (z + 2) / 55) < 1;
    if (inGarden && y < 14) {
      const st = 0.5 + 0.5 * Math.sin(z * 3.0 + Math.floor(x / 12) * 1.7);
      const k = Math.floor((x + 200) / 12) + Math.floor((z + 200) / 9) * 7;
      tmp2.copy([C.wheat, C.field2, C.veg, C.earth][k % 4]).lerp(C.earth, st * 0.3);
      if (pm.m > 0.1) tmp2.copy(C.paddy);
      fcol[i * 3] = tmp2.r; fcol[i * 3 + 1] = tmp2.g; fcol[i * 3 + 2] = tmp2.b;
    } else { fcol[i * 3] = tmp.r; fcol[i * 3 + 1] = tmp.g; fcol[i * 3 + 2] = tmp.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  W.T.grass.repeat.set(90, 90);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: W.T.grass }));
  m.receiveShadow = true;
  W.terrain = m; W.terrainCol0 = colors.slice(); W.terrainColF = fcol;
  return m;
}
function setFieldBlend(t) {
  const a = W.terrain.geometry.attributes.color; const c0 = W.terrainCol0, cf = W.terrainColF;
  for (let i = 0; i < a.array.length; i++) a.array[i] = c0[i] + (cf[i] - c0[i]) * t;
  a.needsUpdate = true;
}

// ---------- water ----------
function buildWater(T) {
  const g = new THREE.PlaneGeometry(64, 26); g.rotateX(-Math.PI / 2);
  T.waterN.repeat.set(4, 2);
  T.water.repeat.set(5, 2);
  const m = new THREE.MeshPhongMaterial({ color: col('#ffffff'), map: T.water, specular: col('#d8d2c0'), shininess: 30, normalMap: T.waterN, normalScale: new THREE.Vector2(0.18, 0.18), transparent: true, opacity: 0.94 });
  const w = new THREE.Mesh(g, m); w.position.set(-9, WATER_Y, 7.5); w.receiveShadow = true;
  W.water = w; return w;
}

// ---------- landmarks & distant city ----------
function azDir(az) { const a = az * Math.PI / 180; return [Math.sin(a), -Math.cos(a)]; }
function buildDistant(T) {
  const root = new THREE.Group();
  const Lm = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: col(c) }, o));
  // 远山环
  T.mountains.repeat.set(2, 1);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(620, 620, 170, 96, 1, true), new THREE.MeshBasicMaterial({ map: T.mountains, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  ring.position.y = 55; root.add(ring); W.mountRing = ring;
  const outer = new THREE.Mesh(new THREE.RingGeometry(179, 900, 72, 1), Lm('#98a077')); outer.rotation.x = -Math.PI / 2; outer.position.y = OUTER_Y - 0.4; outer.receiveShadow = false; root.add(outer);
  const lmMat = Lm('#6f7f7b');
  for (const L of LANDMARKS) {
    const [dx, dz] = azDir(L.az); const x = dx * L.d, z = dz * L.d;
    let top = 6;
    if (L.kind === 'mount') {
      const g = new THREE.IcosahedronGeometry(1, 3); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y > 0 ? y * (1 + 0.25 * Math.sin(p.getX(i) * 5)) : y); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, lmMat); m.scale.set(150, 58, 70); m.position.set(x, OUTER_Y - 10, z); m.rotation.y = -L.az * Math.PI / 180; root.add(m); top = 50;
    } else if (L.kind === 'hill') {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), Lm('#7d8b78')); m.scale.set(40, 16, 26); m.position.set(x, OUTER_Y - 3, z); root.add(m); top = 16;
    } else if (L.kind === 'lake') {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshLambertMaterial({ color: col('#b5c2bb') })); m.rotation.x = -Math.PI / 2; m.scale.set(L.name === '后湖' ? 60 : 30, L.name === '后湖' ? 40 : 18, 1); m.position.set(x, OUTER_Y + 0.15, z); root.add(m); top = 4;
    } else if (L.kind === 'temple') {
      const hm = hall({ w: 10, d: 7, h: 3.5, rise: 2.4, cols: 3 }); hm.position.set(x, groundAt(x, z), z); hm.scale.setScalar(1.3); root.add(hm);
      top = 12;
    } else if (L.kind === 'pagoda') {
      const t = pagoda(); t.position.set(x, OUTER_Y, z); root.add(t); W.pagoda = t; top = 46;
    }
    L.pos = new THREE.Vector3(x, top + 6, z);
  }
  // 城中屋宇
  const walls = [], roofs = [];
  for (let i = 0; i < 1400 && walls.length < 650; i++) {
    const az = rr(-40, 230), d = rr(95, 260); const [dx, dz] = azDir(az); const x = dx * d, z = dz * d;
    if (Math.hypot(x, z) < 90) continue;
    let bad = false; for (const L of LANDMARKS) if ((L.kind === 'lake' || L.kind === 'hill') && Math.hypot(x - L.pos.x, z - L.pos.z) < (L.name === '后湖' ? 70 : 40)) bad = true; if (bad) continue;
    if (fieldAt(x, z)) continue;
    const y = groundAt(x, z); const w = rr(4, 8), dd = rr(4, 6), h = rr(2.2, 3.2), ry = Math.round(R() * 4) * Math.PI / 2 + rr(-0.1, 0.1);
    walls.push({ x, y: y + h / 2 - 1.2, z, ry, sx: w, sy: h + 2.4, sz: dd });
    roofs.push({ x, y: y + h + 0.9, z, ry: ry, sx: w * 1.1, sy: 1.8, sz: dd * 0.62 });
  }
  root.add(instanced(new THREE.BoxGeometry(1, 1, 1), Lm('#e3dccb'), walls, false));
  root.add(instanced(roofPrism(), Lm('#5c6066'), roofs, false));
  return root;
}
function roofPrism() {
  const sh = new THREE.Shape(); sh.moveTo(-0.5, -0.5); sh.lineTo(0.5, -0.5); sh.lineTo(0, 0.5); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2); return g;
}
function pagoda() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: col('#efeade'), emissive: col('#ffcf80'), emissiveIntensity: 0 });
  const eave = new THREE.MeshLambertMaterial({ color: col('#6e8b5a') });
  const gold = new THREE.MeshLambertMaterial({ color: col('#c9a43f') });
  let y = 0; let r = 7.2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10, 2.5, 8), new THREE.MeshLambertMaterial({ color: col('#c8c0ad') })); base.position.y = 1.25; g.add(base); y = 2.5;
  for (let i = 0; i < 9; i++) {
    const h = 4.2 - i * 0.12;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 8), white); b.position.y = y + h / 2; g.add(b);
    const e = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.42, 1.1, 8), i % 2 ? gold : eave); e.position.y = y + h + 0.3; g.add(e);
    y += h + 0.8; r *= 0.91;
  }
  const sp = new THREE.Mesh(new THREE.ConeGeometry(1.3, 7, 8), gold); sp.position.y = y + 3.5; g.add(sp);
  g.userData.white = white;
  return g;
}

// ---------- 场景装配 ----------
function buildGarden() {
  const M = W.M;
  FLATS.forEach(f => { f.y = baseH(f.x, f.z); if (f.id === 'xiting') f.y = WATER_Y + 0.35; });
  // 让平台彼此不冲突：诗世界、大院略微压平
  const fy = id => FLATS.find(f => f.id === id).y;
  // 柴门（门朝北）
  place(gate(), 78, -30.5, 0);
  // 短篱
  const fence = [];
  const fpath = [[78, -30], [75.5, -27], [70, -25], [64, -23], [57, -21.5]];
  for (let k = 0; k < fpath.length - 1; k++) {
    const [ax, az] = fpath[k], [bx, bz] = fpath[k + 1]; const len = Math.hypot(bx - ax, bz - az); const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let t = 0; t < len; t += 0.45) for (const s of [-1, 1]) {
      const x = ax + (bx - ax) * t / len + nx * s * 2.1, z = az + (bz - az) * t / len + nz * s * 2.1; const h = rr(0.9, 1.15);
      fence.push({ x, y: H(x, z) + h / 2, z, rz: rr(-0.05, 0.05), sx: 1, sy: h, sz: 1, c: '#a28d5f' });
    }
  }
  W.gardenVeg.add(instanced(new THREE.CylinderGeometry(0.035, 0.04, 1, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }), fence));
  // 大院三楹（面东）
  place(hall({ w: 12, d: 7, h: 3.3, rise: 2.3, cols: 3, plaque: '', lanterns: 0 }), 30.5, -18, Math.PI / 2);
  // 大院两侧矮墙
  const yard = FLATS.find(f => f.id === 'yard');
  for (const s of [-1, 1]) { const wl = mesh(box(15, 1.6 + 2, 0.35), M.wall, 0, 0.8 - 1, 0); const gg = new THREE.Group(); gg.add(wl); gg.add(mesh(box(15.4, 0.25, 0.7), M.ridge, 0, 1.7, 0)); place(gg, yard.x + 1, yard.z + s * 8.6, 0); }
  // 小仓山房
  const sf = place(hall({ w: 16, d: 9, h: 3.8, rise: 2.8, cols: 5, plaque: '小仓山房', lanterns: 1 }), 22, -38, 0);
  // 书仓：亭、轩、楼、阁
  place(pavilion({ r: 2.1, sides: 6 }), -9, -38.5);
  place(hall({ w: 7, d: 5, h: 3.0, rise: 1.9, cols: 3, plaque: '书仓' }), 6.5, -46, 0);
  place(lou({ w: 7, d: 6, h1: 3.0, h2: 2.6 }), -8.5, -47.5, 0);
  const ge = pavilion({ r: 1.8, sides: 4, h: 2.6, rise: 1.8 }); const gg2 = new THREE.Group(); const gbase = mesh(box(4.2, 2.6, 4.2), M.wall, 0, 1.3, 0); gg2.add(gbase); ge.position.y = 2.6; gg2.add(ge); gg2.userData.top = 2.6 + ge.userData.top;
  place(gg2, 7, -37.5, 0);
  // 小眠斋
  place(hall({ w: 7, d: 5, h: 3.0, rise: 1.9, cols: 3, plaque: '小眠斋' }), -22, -35, 0);
  // 藤花廊
  W.buildRoot.add(corridor(CORRIDOR));
  // 诗世界（面东）
  place(hall({ w: 10, d: 6, h: 3.3, rise: 2.2, cols: 4, plaque: '诗世界', lanterns: 0 }), -45.5, -6, Math.PI / 2);
  // 溪亭
  place(pavilion({ r: 1.6, sides: 4, h: 2.5, rise: 1.7 }), -37, 3);
  // 渡鹤桥
  const br = archBridge(BRIDGE.L, 2.4, BRIDGE.rise); br.position.set(BRIDGE.x, WATER_Y - 0.1, BRIDGE.z); br.rotation.y = Math.PI / 2; W.buildRoot.add(br);
  // 小船
  const bt = boat(); bt.position.set(9, WATER_Y + 0.05, 10); bt.rotation.y = 0.5; W.buildRoot.add(bt); W.boat = bt;
  // 厨下（面西）
  const kg = hall({ w: 8, d: 5, h: 3.0, rise: 1.9, cols: 3 });
  kg.add(mesh(box(0.8, 2.2, 0.8), M.wall, 2.4, 4.6, -1.2));
  place(kg, 54, 6, -Math.PI / 2);
  W.chimney = new THREE.Vector3(55.2, 0, 8.4); W.chimney.y = FLATS.find(f => f.id === 'kitchen').y + 5.8;
  // 南楼（面北，上层四面开敞）
  const nl = lou({ w: 9, d: 7, h1: 3.2, h2: 2.9, openUpper: 1 });
  place(nl, 18, 46, Math.PI);
  W.nanlouUpper = fy('nanlou') + nl.userData.upperY + 0.02;
  W.stairY0 = fy('nanlou'); W.stairY1 = fy('nanlou') + nl.userData.upperY;
  W.buildRoot.add(nanlouStair(W.stairY0, W.stairY1));
  // 菜畦边的农舍
  place(hall({ w: 6, d: 4.5, h: 2.6, rise: 1.6, cols: 2, sideWin: 0 }), -64, 34, Math.PI);
  // 标签锚点
  W.labelAt = {
    chaimen: [78, 5.2, -30.5], zhujing: [61, 9, -24], dayuan: [30.5, 8, -18], shanfang: [22, 9.5, -38], shucang: [-1, 11, -45],
    xiaomian: [-22, 7, -35], tenghua: [-30.5, 5, -21], shishijie: [-45.5, 7.5, -6], shuanghu: [-10, 5, 7], xiangxue: [31, 7, 17], chuxia: [54, 7, 6], nanlou: [18, 13, 46]
  };
  for (const k in W.labelAt) { const v = W.labelAt[k]; W.labelAt[k] = new THREE.Vector3(v[0], H(v[0], v[2]) + v[1], v[2]); }
  void sf;
}

// 将建筑按材质合并，并生成白描线
function mergeBuildings() {
  const root = W.buildRoot; root.updateMatrixWorld(true);
  const byMat = new Map(); const edges = []; const keep = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.keep) { keep.push(o); return; }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (!g.attributes.uv) { g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
    if (o.userData.edge) { const e = new THREE.EdgesGeometry(o.geometry, o.userData.edge); e.applyMatrix4(o.matrixWorld); edges.push(e); }
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(list, false);
    const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; out.add(m);
  }
  const eg = THREE.BufferGeometryUtils.mergeBufferGeometries(edges, false);
  const lines = new THREE.LineSegments(eg, W.M.line); out.add(lines); W.buildLines = lines;
  for (const k of keep) { const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3(); k.matrixWorld.decompose(wp, wq, ws); k.parent.remove(k); k.position.copy(wp); k.quaternion.copy(wq); k.scale.copy(ws); out.add(k); }
  W.scene.remove(root); W.buildRoot = out; W.garden.add(out);
}

// ---------- particles ----------
function buildParticles(T) {
  // 落梅
  const n = 260, pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { const x = rr(PLUM_ZONE.x0, PLUM_ZONE.x1), z = rr(PLUM_ZONE.z0, PLUM_ZONE.z1); pos[i * 3] = x; pos[i * 3 + 1] = H(x, z) + rr(0, 4); pos[i * 3 + 2] = z; vel.push(rr(0.25, 0.55)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: col('#f3e6e6'), size: 0.16, map: T.soft, transparent: true, depthWrite: false });
  const pts = new THREE.Points(g, pm); W.petals = { pts, vel }; W.gardenVeg.add(pts);
  // 炊烟
  const sm = []; const smM = new THREE.SpriteMaterial({ map: T.soft, color: col('#d8d4cc'), transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(smM.clone()); s.userData.t = i / 16; W.garden.add(s); sm.push(s); }
  W.smoke = sm;
  // 燕子
  const bm = new THREE.MeshBasicMaterial({ color: col('#2a2622'), side: THREE.DoubleSide });
  W.birds = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    for (const s of [-1, 1]) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, s * 0.55, 0, -0.18], 3)); const w = new THREE.Mesh(wg, bm); b.add(w); b.userData[s] = w; }
    const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.1, -0.12, 0, -0.45, 0.12, 0, -0.45], 3)); b.add(new THREE.Mesh(tail, bm));
    b.userData.p = { cx: rr(-25, 20), cz: rr(-5, 20), r: rr(8, 16), h: rr(4, 9), sp: rr(0.5, 0.9) * (R() < 0.5 ? 1 : -1), ph: R() * 6 };
    b.scale.setScalar(1.1); W.garden.add(b); W.birds.push(b);
  }
}
function updateParticles(dt, time) {
  if (W.petals) {
    const a = W.petals.pts.geometry.attributes.position; const v = W.petals.vel;
    for (let i = 0; i < v.length; i++) {
      let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      y -= v[i] * dt; x += Math.sin(time * 1.3 + i) * dt * 0.4; z += Math.cos(time * 0.9 + i * 0.7) * dt * 0.3;
      if (y < H(x, z) + 0.05) { x = rr(PLUM_ZONE.x0, PLUM_ZONE.x1); z = rr(PLUM_ZONE.z0, PLUM_ZONE.z1); y = H(x, z) + rr(2.5, 4); }
      a.setXYZ(i, x, y, z);
    }
    a.needsUpdate = true;
  }
  if (W.smoke) for (const s of W.smoke) {
    const u = s.userData; u.t = (u.t + dt * 0.08) % 1; const t = u.t;
    s.position.set(W.chimney.x + Math.sin(t * 5 + time * 0.3) * 0.6 * t + t * 2.5, W.chimney.y + t * 9, W.chimney.z - t * 1.2);
    s.scale.setScalar(0.8 + t * 3.2); s.material.opacity = (1 - t) * 0.32 * W.smokeLevel;
  }
  for (const b of W.birds || []) {
    const p = b.userData.p; const a = time * p.sp + p.ph;
    b.position.set(p.cx + Math.cos(a) * p.r, H(p.cx, p.cz) * 0 + WATER_Y + p.h + Math.sin(a * 2) * 1.2, p.cz + Math.sin(a) * p.r);
    b.rotation.y = -a + (p.sp > 0 ? Math.PI : 0);
    const f = Math.sin(time * 14 + p.ph) * 0.6; b.userData[-1].rotation.z = f; b.userData[1].rotation.z = -f;
    b.visible = W.birdsOn;
  }
  if (W.water) { const m = W.water.material; m.normalMap.offset.set(time * 0.01, time * 0.006); m.map.offset.set(time * 0.004, Math.sin(time * 0.2) * 0.01); }
}

function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600 || matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xe9e0ca, 70, 520);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  W.renderer = renderer; W.scene = scene; W.camera = camera; W.mobile = mobile;
  W.lanternMeshes = []; W.smokeLevel = 1; W.birdsOn = true;
  const T = makeTextures(); W.T = T; W.M = makeMaterials(T);
  W.M.wisteria = new THREE.MeshLambertMaterial({ color: col('#9a86b4') });
  W.M.vine = new THREE.MeshLambertMaterial({ color: col('#7c9258') });
  buildPathSegs(); buildFields();
  FLATS.forEach(f => { f.y = baseH(f.x, f.z); if (f.id === 'xiting') f.y = WATER_Y + 0.35; });
  W.garden = new THREE.Group(); scene.add(W.garden);
  W.gardenVeg = new THREE.Group(); W.garden.add(W.gardenVeg);
  W.vegRoot = new THREE.Group(); scene.add(W.vegRoot);
  W.buildRoot = new THREE.Group(); scene.add(W.buildRoot);
  scene.add(buildTerrain());
  scene.add(buildWater(T));
  buildGarden();
  buildVegetation();
  mergeBuildings();
  scene.add(buildDistant(T));
  buildParticles(T);
  // 灯光
  const hemi = new THREE.HemisphereLight(0xefe8d8, 0x8c8466, 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 0.9);
  sun.castShadow = true; const sm = mobile ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera; sc.left = -110; sc.right = 110; sc.top = 90; sc.bottom = -90; sc.near = 10; sc.far = 420; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.4;
  scene.add(sun); scene.add(sun.target);
  W.hemi = hemi; W.sun = sun;
  // 人物
  W.yuan = figure({ robe: '#4f6470', jacket: '#34363c', beard: 1, cane: 1 });
  W.tong = figure({ robe: '#5e7760', jacket: null, scale: 0.74, beard: 0, cane: 0 });
  // 书童的书匣 / 灯笼
  const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.18), new THREE.MeshLambertMaterial({ color: col('#6b4631') })); boxM.position.set(0, -0.62, 0.12); W.tong.userData.arms[1].add(boxM); W.tong.userData.box = boxM;
  const lan = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), W.M.lantern); lan.scale.y = 1.3; lan.position.set(0, -0.95, 0.1); lan.visible = false; W.tong.userData.arms[0].add(lan); W.tong.userData.lantern = lan;
  const pl = new THREE.PointLight(0xffa860, 0, 16, 1.6); pl.position.set(0, -0.9, 0.2); W.tong.userData.arms[0].add(pl); W.tongLight = pl;
  W.garden.add(W.yuan); W.garden.add(W.tong);
  return W;
}
