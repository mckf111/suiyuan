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
    // 阶条石：沿台明四边一圈，顶面略高于台面，避免两个面重合打架（厨下闪烁）
    { const W2 = w + 1.5, D2 = d + 1.5, bw = 0.45, y = plat - 0.03;
      g.add(mesh(box(W2, 0.08, bw), M.stoneD, 0, y, D2 / 2 - bw / 2, { edge: 30 }));
      g.add(mesh(box(W2, 0.08, bw), M.stoneD, 0, y, -D2 / 2 + bw / 2, { edge: 30 }));
      for (const s of [-1, 1]) g.add(mesh(box(bw, 0.08, D2 - bw * 2), M.stoneD, s * (W2 / 2 - bw / 2), y, 0, { edge: 30 })); }
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
  g.add(mesh(dg.clone().translate(0.65, 0, 0), M.plank, -1.32, 1.3, 0.1, { ry: -1.52 }));
  g.add(mesh(dg.clone().translate(-0.65, 0, 0), M.plank, 1.32, 1.3, 0.1, { ry: 1.52 }));
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
function rock(s = 1, boulder = false) {
  // 太湖石：圆润、多孔的轮廓，细线勾边
  const g = new THREE.IcosahedronGeometry(1, 3); const p = g.attributes.position; const seed = R() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * Math.sin(v.z * 3.3 + seed * 0.5);
    const holes = boulder ? 0 : Math.max(0, Math.sin(v.x * 7 + seed) * Math.sin(v.y * 6.5) * Math.sin(v.z * 7.5 - seed) - 0.55) * 1.6;
    const k = (boulder ? 0.92 + 0.12 * n + 0.04 * Math.sin(v.x * 9 + v.z * 7 + seed) : 0.85 + 0.25 * n) - holes;
    if (boulder) p.setXYZ(i, v.x * k * 1.25, Math.max(v.y, -0.35) * k * 0.72, v.z * k * 1.0);
    else p.setXYZ(i, v.x * k * 0.85, v.y * k * 1.45, v.z * k * 0.8);
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
  obj.position.set(x, H(x, z) + dy, z); obj.rotation.y = ry; W.buildRoot.add(obj);
  obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); const sh = 0.9;
  (W.occ = W.occ || []).push({ x0: b.min.x + sh, x1: b.max.x - sh, z0: b.min.z + sh, z1: b.max.z - sh, r: 2.2, k: 0.25 });
  return obj;
}

