// ============ 贴图与材质 ============
// 实拍贴图来自 Poly Haven（CC0），其余叶片、花、格扇等为程序绘制
const TEX_FILES = ['grey_roof_tiles', 'worn_mossy_plasterwall', 'grey_stone_path', 'japanese_stone_wall', 'leafy_grass', 'stony_dirt_path',
  'forest_ground_04', 'ganges_river_pebbles', 'weathered_brown_planks', 'hinoki_planks', 'chinese_hackberry_bark', 'sakura_bark', 'mossy_rock'];
function loadTextures(onProgress) {
  const T = {}; const loader = new THREE.TextureLoader(); const jobs = [];
  let done = 0; const total = TEX_FILES.length * 3;
  for (const n of TEX_FILES) for (const m of ['diff', 'nor', 'rough']) {
    jobs.push(new Promise(res => loader.load(`tex/${n}_${m}.webp`, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = W.maxAniso || 4;
      if (m === 'diff') t.colorSpace = THREE.SRGBColorSpace;
      T[`${n}_${m}`] = t; done++; onProgress && onProgress(done / total); res();
    }, undefined, () => { done++; onProgress && onProgress(done / total); res(); })));
  }
  return Promise.all(jobs).then(() => T);
}
function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = W.maxAniso || 4; return t;
}
function leafShape(g, x, y, ang, len, wid) {
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c;
  const tx = x + c * len, ty = y + s * len, mx = x + c * len * 0.42, my = y + s * len * 0.42;
  g.beginPath(); g.moveTo(x, y);
  g.bezierCurveTo(mx + nx * wid, my + ny * wid, tx - c * len * 0.15 + nx * wid * 0.4, ty - s * len * 0.15 + ny * wid * 0.4, tx, ty);
  g.bezierCurveTo(tx - c * len * 0.15 - nx * wid * 0.4, ty - s * len * 0.15 - ny * wid * 0.4, mx - nx * wid, my - ny * wid, x, y);
  g.closePath();
}
function makeCanvasTextures() {
  const T = {}; const r = rng(4242); const pick = a => a[Math.floor(r() * a.length)];
  const shade = (g, x, y, rad, c0, c1) => { const gr = g.createLinearGradient(x - rad, y - rad, x + rad, y + rad); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
  // 阔叶一簇（樟、朴之类）
  T.leaf = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,52,36,0.9)'; g.lineWidth = 3;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(256, 470); g.quadraticCurveTo(256 + (r() - 0.5) * 120, 330, 256 + (r() - 0.5) * 380, 90 + r() * 200); g.stroke(); }
    const pal = [['#3f6a22', '#2b4d16'], ['#4f7a2a', '#365d1e'], ['#5f8a33', '#426b24'], ['#355a1d', '#233f12'], ['#6c9638', '#4b7426']];
    const L = []; for (let i = 0; i < 300; i++) { const rad = Math.pow(r(), 0.4) * 215; const a = r() * 6.283; L.push([256 + Math.cos(a) * rad, 256 + Math.sin(a) * rad * 0.9, r() * 6.283]); }
    L.sort((a, b) => a[1] - b[1]);
    for (const [x, y, a] of L) {
      const len = 36 + r() * 18, wid = 12 + r() * 6; const [c0, c1] = pick(pal);
      leafShape(g, x, y, a, len, wid); g.fillStyle = shade(g, x, y, len, c0, c1); g.fill();
      g.strokeStyle = 'rgba(30,45,20,0.35)'; g.lineWidth = 0.8; g.stroke();
      g.strokeStyle = 'rgba(200,220,150,0.25)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len * 0.8, y + Math.sin(a) * len * 0.8); g.stroke();
    }
  });
  // 梅花、桃杏花一簇：细枝上开五瓣花
  const blossom = (petal, petal2, heart) => canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.lineCap = 'round';
    const tips = [];
    for (let k = 0; k < 6; k++) {
      let x = 256 + (r() - 0.5) * 60, y = 500, a = -Math.PI / 2 + (r() - 0.5) * 1.8, lw = 7;
      g.strokeStyle = '#3d2c24';
      for (let s = 0; s < 6; s++) { a += (r() - 0.5) * 0.8; const l = 34 + r() * 30; const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny; tips.push([x, y]); lw = Math.max(1.6, lw - 1); }
    }
    for (const [tx, ty] of tips) for (let q = 0; q < 3; q++) {
      const x = tx + (r() - 0.5) * 40, y = ty + (r() - 0.5) * 40, rad = 9 + r() * 5;
      if (r() < 0.2) { g.fillStyle = petal2; g.beginPath(); g.ellipse(x, y, 4.5, 6, r() * 3, 0, 7); g.fill(); continue; }
      const rot = r() * 6.283;
      for (let p = 0; p < 5; p++) {
        const a = rot + p / 5 * 6.283; const px = x + Math.cos(a) * rad * 0.62, py = y + Math.sin(a) * rad * 0.62;
        const gr = g.createRadialGradient(x, y, 1, px, py, rad * 0.75); gr.addColorStop(0, petal2); gr.addColorStop(1, petal);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad * 0.58, 0, 7); g.fill();
      }
      g.fillStyle = heart; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(190,150,60,0.9)'; g.lineWidth = 0.8;
      for (let s = 0; s < 8; s++) { const a = s / 8 * 6.283; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); }
    }
  });
  T.plum = blossom('#fbf7f2', '#efd9dc', '#c9a13d');
  T.peach = blossom('#f5bfcb', '#e48ea3', '#c28a3a');
  // 竹叶：个字、介字
  T.bamboo = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const pal = [['#5f8743', '#3d6230'], ['#6f9a4d', '#4a7236'], ['#7aa458', '#557c3b'], ['#557a3c', '#36552a']];
    for (let k = 0; k < 14; k++) {
      const ox = 60 + r() * 392, oy = 60 + r() * 300;
      g.strokeStyle = 'rgba(80,90,40,0.95)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(ox - 40, oy - 50); g.quadraticCurveTo(ox - 14, oy - 20, ox, oy); g.stroke();
      const n = 3 + Math.floor(r() * 3), base = Math.PI / 2 + (r() - 0.5) * 0.9;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.4 + (r() - 0.5) * 0.15, len = 80 + r() * 40;
        const [c0, c1] = pick(pal); leafShape(g, ox, oy, a, len, 9 + r() * 3); g.fillStyle = shade(g, ox, oy, len, c0, c1); g.fill();
        g.strokeStyle = 'rgba(220,235,180,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a) * len * 0.85, oy + Math.sin(a) * len * 0.85); g.stroke();
      }
    }
  });
  // 松针一簇
  T.pine = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const cx = 60 + r() * 392, cy = 150 + r() * 250;
      g.strokeStyle = '#4b3a2c'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 60, cy + 20); g.quadraticCurveTo(cx - 20, cy + 6, cx, cy); g.stroke();
      for (let i = 0; i < 70; i++) {
        const a = Math.PI + 0.1 + r() * (Math.PI - 0.2); const l = 30 + r() * 26;
        g.strokeStyle = pick(['#2f4a2c', '#3b5a33', '#46693a', '#2a4128']); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx + (r() - 0.5) * 8, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.85); g.stroke();
      }
    }
  });
  // 垂柳枝条
  T.willow = canvasTex(256, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 22; k++) {
      const x0 = 10 + r() * 236, len = 600 + r() * 420, sway = (r() - 0.5) * 50;
      g.strokeStyle = 'rgba(110,120,60,0.95)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + sway, len * 0.5, x0 + sway * 0.6, len); g.stroke();
      for (let t = 0.04; t < 1; t += 0.022) {
        const x = x0 + sway * 2 * t * (1 - t) + sway * 0.6 * t * t, y = len * t;
        leafShape(g, x, y, Math.PI / 2 + (r() < 0.5 ? 0.5 : -0.5), 16 + r() * 6, 3.5);
        g.fillStyle = pick(['#a3b85c', '#b4c46a', '#93aa52', '#c0cc7c']); g.fill();
      }
    }
  });
  // 梧桐新芽、紫藤花苞、油菜花
  T.bud = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#6a5a44'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(128, 250); g.lineTo(20 + r() * 216, 20 + r() * 200); g.stroke(); }
    for (let i = 0; i < 60; i++) { const x = 20 + r() * 216, y = 20 + r() * 200; leafShape(g, x, y, r() * 7, 24, 11); g.fillStyle = pick(['#8fb04a', '#a4c25a', '#7ea03c']); g.fill(); }
  });
  T.wisteria = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#5a4a36'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(80, 0, 170, 80, 256, 30); g.stroke();
    for (let i = 0; i < 26; i++) { const x = 10 + r() * 236, y = 30 + r() * 40; leafShape(g, x, y, Math.PI / 2 + (r() - 0.5), 26, 8); g.fillStyle = pick(['#7f9a5a', '#90aa66']); g.fill(); }
    for (let i = 0; i < 9; i++) { const x = 16 + r() * 224; let y = 50 + r() * 20; for (let k = 0; k < 9; k++) { g.fillStyle = k < 3 ? '#8e79ad' : '#b3a2cf'; g.beginPath(); g.ellipse(x + (r() - 0.5) * 5, y, 6 - k * 0.45, 4.5 - k * 0.3, 0, 0, 7); g.fill(); y += 11; } }
  });
  T.rape = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = 20 + r() * 88, y = 10 + r() * 60; g.fillStyle = pick(['#f2d43a', '#e8c52a', '#f7e06a']); g.beginPath(); g.arc(x, y, 4 + r() * 3, 0, 7); g.fill(); }
    g.strokeStyle = '#6f8d3a'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(64 + (r() - 0.5) * 30, 128); g.lineTo(40 + r() * 48, 50); g.stroke(); }
  });
  // 格扇：步步锦，糊纸
  T.lattice = canvasTex(512, 1024, (g, w, h) => {
    const top = 28, bot = h * 0.64;
    g.fillStyle = '#efe9da'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, bot); gr.addColorStop(0, 'rgba(210,196,160,0.25)'); gr.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, bot);
    g.strokeStyle = '#4e3121'; g.lineWidth = 6;
    const cw = 74, ch = 58;
    for (let y = top; y < bot - 8; y += ch) for (let x = 24; x < w - 24; x += cw) {
      const k = ((x / cw | 0) + (y / ch | 0)) % 2;
      g.strokeRect(x, y, cw, ch);
      g.beginPath(); if (k) { g.moveTo(x + cw * 0.3, y); g.lineTo(x + cw * 0.3, y + ch * 0.55); g.lineTo(x + cw, y + ch * 0.55); } else { g.moveTo(x, y + ch * 0.45); g.lineTo(x + cw * 0.7, y + ch * 0.45); g.lineTo(x + cw * 0.7, y + ch); } g.stroke();
    }
    g.fillStyle = '#5a3624'; g.fillRect(0, bot, w, h - bot);
    g.fillStyle = '#65402b'; g.fillRect(24, bot + 20, w - 48, 70); g.fillRect(24, bot + 112, w - 48, h - bot - 140);
    g.strokeStyle = 'rgba(30,18,10,0.8)'; g.lineWidth = 3; g.strokeRect(40, bot + 32, w - 80, 46); g.strokeRect(46, bot + 130, w - 92, h - bot - 176);
    g.beginPath(); g.ellipse(w / 2, bot + 112 + (h - bot - 140) / 2, 70, 46, 0, 0, 7); g.stroke();
    g.lineWidth = 22; g.strokeStyle = '#3f2618'; g.strokeRect(0, 0, w, h);
  });
  T.gualuo = canvasTex(1024, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#4e3121'; g.fillStyle = '#4e3121'; g.lineWidth = 6;
    g.fillRect(0, 0, w, 14);
    for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, 60); g.lineTo(x + 44, 60); g.lineTo(x + 44, 32); g.lineTo(x + 20, 32); g.lineTo(x + 20, 44); g.stroke(); }
    g.beginPath(); g.moveTo(0, 60); g.lineTo(w, 60); g.stroke();
    for (let x = 32; x < w; x += 128) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 96); g.lineTo(x + 16, 112); g.stroke(); }
  }, true);
  T.rafter = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7b5a42'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,40,28,.35)'; g.lineWidth = 2; for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y + 1); g.lineTo(w, y + 1); g.stroke(); }
    for (let x = 8; x < w; x += 32) { const gr = g.createLinearGradient(x, 0, x + 14, 0); gr.addColorStop(0, '#4a3122'); gr.addColorStop(0.5, '#6a4632'); gr.addColorStop(1, '#4a3122'); g.fillStyle = gr; g.fillRect(x, 0, 14, h); }
  }, true);
  T.soft = canvasTex(64, 64, (g, w, h) => { const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); });
  T.petal = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 34, 20, 27, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(32, 4, 9, 0, 7); g.fill(); });
  // 水面法线：多频正弦叠成的细波
  T.waterN = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w * Math.PI * 2, v = y / h * Math.PI * 2;
      const dx = Math.cos(u * 3 + v) * 0.45 + Math.cos(u * 7 - v * 2) * 0.3 + Math.cos(u * 13 + v * 5) * 0.15 + Math.cos(u * 2 - v * 9) * 0.1;
      const dy = Math.cos(v * 4 - u) * 0.45 + Math.cos(v * 9 + u * 3) * 0.3 + Math.sin(v * 12 - u * 4) * 0.15 + Math.sin(v * 3 + u * 8) * 0.1;
      const i = (y * w + x) * 4; img.data[i] = 128 + dx * 55; img.data[i + 1] = 128 + dy * 55; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, true, false);
  // 竹竿：青黄相间，竹节一圈白粉
  T.culm = canvasTex(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5f7a3a'); gr.addColorStop(0.5, '#8aa257'); gr.addColorStop(1, '#5f7a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${40 + r() * 60},${70 + r() * 50},${30 + r() * 20},0.25)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 8 + r() * 30); }
    for (let y = 0; y < h; y += 256) { g.fillStyle = 'rgba(230,232,210,0.85)'; g.fillRect(0, y, w, 5); g.fillStyle = 'rgba(60,70,30,0.9)'; g.fillRect(0, y + 5, w, 3); g.fillStyle = 'rgba(200,210,170,0.4)'; g.fillRect(0, y + 8, w, 10); }
  }, true);
  // 野花：二月兰、蒲公英、荠菜花，一丛丛
  T.flowers = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const x0 = 30 + r() * 196, top = 40 + r() * 110; const kind = r();
      g.strokeStyle = '#5c7a36'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0 + (r() - 0.5) * 20, 256); g.quadraticCurveTo(x0 + (r() - 0.5) * 30, (256 + top) / 2, x0, top); g.stroke();
      leafShape(g, x0, 220 + r() * 20, -Math.PI / 2 + (r() < 0.5 ? 0.9 : -0.9), 30, 7); g.fillStyle = '#6a8a3e'; g.fill();
      if (kind < 0.55) { for (let p = 0; p < 6; p++) { const px = x0 + (r() - 0.5) * 26, py = top + (r() - 0.5) * 22; for (let q = 0; q < 4; q++) { const a = q / 4 * 6.283 + r(); g.fillStyle = r() < 0.5 ? '#9b86c9' : '#8a73bb'; g.beginPath(); g.ellipse(px + Math.cos(a) * 4, py + Math.sin(a) * 4, 4, 2.6, a, 0, 7); g.fill(); } g.fillStyle = '#f0e2a0'; g.beginPath(); g.arc(px, py, 1.3, 0, 7); g.fill(); } }
      else if (kind < 0.8) { for (let q = 0; q < 16; q++) { const a = q / 16 * 6.283; g.strokeStyle = '#f2c928'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, top); g.lineTo(x0 + Math.cos(a) * 9, top + Math.sin(a) * 6); g.stroke(); } g.fillStyle = '#e8a91c'; g.beginPath(); g.arc(x0, top, 3, 0, 7); g.fill(); }
      else { for (let p = 0; p < 10; p++) { g.fillStyle = '#f7f6ee'; g.beginPath(); g.arc(x0 + (r() - 0.5) * 16, top + (r() - 0.5) * 16, 2.2, 0, 7); g.fill(); } }
    }
  });
  return T;
}

function makeMaterials(P, C) {
  const M = {};
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const pbr = (n, extra = {}) => Object.assign({ map: P[n + '_diff'], normalMap: P[n + '_nor'], roughnessMap: P[n + '_rough'] }, extra);
  M.wall = boxUV(S(pbr('worn_mossy_plasterwall', { color: new THREE.Color(1.45, 1.42, 1.36), roughness: 1 })), 1 / 3.2, 'wall');
  M.wallD = boxUV(S(pbr('worn_mossy_plasterwall', { color: new THREE.Color(1.4, 1.37, 1.3), roughness: 1, side: THREE.DoubleSide })), 1 / 3.2, 'wallD');
  M.wallY = boxUV(S(pbr('worn_mossy_plasterwall', { color: new THREE.Color(1.5, 1.05, 0.5), roughness: 1 })), 1 / 3.2, 'wallY');
  M.wood = boxUV(S(pbr('hinoki_planks', { color: col('#7c4b35'), roughness: 0.62, normalScale: new THREE.Vector2(0.4, 0.4) })), 1 / 1.4, 'wood');
  M.woodL = boxUV(S(pbr('weathered_brown_planks', { color: col('#b99b80'), roughness: 0.85 })), 1 / 1.6, 'woodL');
  M.plank = boxUV(S(pbr('weathered_brown_planks', { color: col('#a07a5c'), roughness: 0.85, side: THREE.DoubleSide })), 1 / 1.4, 'plank');
  M.roof = hook(S(pbr('grey_roof_tiles', { color: col('#b9bcc0'), roughness: 0.9, side: THREE.DoubleSide, normalScale: new THREE.Vector2(1.3, 1.3) })), 'roof');
  M.under = hook(S({ map: C.rafter, roughness: 0.9, side: THREE.DoubleSide }), 'under');
  M.ridge = boxUV(S(pbr('grey_roof_tiles', { color: col('#6b6e72'), roughness: 0.9 })), 1 / 1.2, 'ridge');
  M.stone = boxUV(S(pbr('japanese_stone_wall', { color: col('#d6d0c4'), roughness: 0.95 })), 1 / 2.2, 'stone');
  M.stoneD = boxUV(S(pbr('grey_stone_path', { color: col('#c8c3b8'), roughness: 0.95 })), 1 / 2.5, 'stoneD');
  M.lattice = hook(S({ map: C.lattice, roughness: 0.8, side: THREE.DoubleSide, emissive: col('#ffb466'), emissiveMap: C.lattice, emissiveIntensity: 0 }), 'lattice');
  M.gualuo = hook(S({ map: C.gualuo, roughness: 0.7, side: THREE.DoubleSide, alphaTest: 0.5 }), 'gualuo');
  M.thatch = boxUV(S(pbr('stony_dirt_path', { color: col('#c7ae7c'), roughness: 1, side: THREE.DoubleSide })), 1 / 1.5, 'thatch');
  M.rock = boxUV(S(pbr('mossy_rock', { color: col('#d4d4cc'), roughness: 0.95, normalScale: new THREE.Vector2(1.5, 1.5) })), 1 / 1.8, 'rock', mossEdit);

  M.lantern = hook(S({ color: col('#b23b28'), emissive: col('#ff8f45'), emissiveIntensity: 0, roughness: 0.7 }), 'lantern');
  M.line = new THREE.LineBasicMaterial({ color: col('#2e2823'), transparent: true, opacity: 0, fog: false });
  M.ink = new THREE.MeshBasicMaterial({ color: col('#3a2f26'), side: THREE.BackSide });
  M.barkS = boxUV(S(pbr('sakura_bark', { color: col('#8a7a70'), roughness: 0.9 })), 1 / 1.2, 'barkS');
  M.barkH = boxUV(S(pbr('chinese_hackberry_bark', { color: col('#b0aa98'), roughness: 0.9 })), 1 / 1.6, 'barkH');
  for (const k of ['wall', 'wallD', 'wood', 'woodL', 'plank', 'lattice', 'thatch', 'rock', 'barkS', 'barkH', 'under']) aoOn(M[k]);
  for (const k of ['wall', 'wallD', 'wood', 'woodL', 'plank', 'roof', 'under', 'ridge', 'stone', 'stoneD', 'lattice', 'gualuo', 'thatch', 'rock', 'lantern']) dissolveOn(M[k]);
  return M;
}
// 石头朝天的一面长苔
function mossEdit(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    #ifdef USE_FOG
    { vec3 wnM = inverseTransformDirection(normalize(vNormal), viewMatrix);
      float mz = svn(vSuiWP.xz * 1.3 + vSuiWP.y) - 0.5;
      float moss = smoothstep(0.35, 0.8, wnM.y + mz * 0.6);
      vec3 mc = mix(vec3(0.16, 0.24, 0.07), vec3(0.34, 0.4, 0.14), svn(vSuiWP.xz * 7.0 + vSuiWP.y * 3.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, mc, moss * 0.85);
      float wet = smoothstep(${(0.9 + 0.25).toFixed(2)}, ${(0.9 - 0.05).toFixed(2)}, vSuiWP.y);
      diffuseColor.rgb *= 1.0 - wet * 0.35; }
    #endif`);
}
