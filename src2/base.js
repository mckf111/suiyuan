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
  // 园区边缘与园外远地平顺相接
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 130 && MOUNTS.length) h = lerp(h, farH(x, z), smooth(130, 176, e));
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

