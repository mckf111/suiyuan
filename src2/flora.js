// ============ 植物：程序生长的树、竹、草、野花 ============
// 树干按枝序逐段生长，叶片是贴图卡片；卡片法线朝树冠外，看上去是一团蓬松的树冠而不是一堆纸片
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);

// ---------- 风：枝梢摆动（树皮、叶卡、草、阴影共用） ----------
const SWAY_VERT = /* glsl */`
  vec4 mvPosition = vec4(transformed, 1.0);
  float sPh = aPh;
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    sPh += dot(instanceMatrix[3].xz, vec2(0.37, 0.71));
  #endif
  vec4 sW = modelMatrix * mvPosition;
  sW.xyz += suiSway(sW.xyz, aFlex, sPh);
  sW.xyz += vec3(sin(uTime * 5.3 + sPh * 7.0), sin(uTime * 4.1 + sPh * 5.0) * 0.6, cos(uTime * 4.7 + sPh * 3.0)) * aFlut * uWind.z;
  mvPosition = viewMatrix * sW;
  gl_Position = projectionMatrix * mvPosition;
`;
function swayEdit(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aFlex;\nattribute float aPh;\nattribute float aFlut;')
    .replace('#include <project_vertex>', SWAY_VERT);
}
// 叶卡：两面都朝外受光；逆光时透出一点亮绿
function foliageEdit(sh) {
  swayEdit(sh);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.split('normal *= faceDirection;').join('').split('normal = normal * faceDirection;').join(''))
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_FOG
      { vec3 vd = normalize(vSuiWP - cameraPosition);
        float bl = pow(max(dot(vd, uSunDir), 0.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSunCol * (0.05 + 0.32 * bl) * uSunVis * uLeafGlow; }
      #endif`)
    .replace('#include <common>', '#include <common>\nuniform float uLeafGlow;');
}
function swayMat(mat, key, foliage) {
  mat.userData.u = Object.assign(mat.userData.u || {}, { uLeafGlow: { value: 1 } });
  return hook(mat, key, foliage ? foliageEdit : swayEdit);
}
function swayDepth(map, key) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: map ? 0.5 : 0 });
  return hook(d, 'dep' + key, swayEdit);
}

// ---------- 几何工具 ----------
class GeoBuf {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.flex = []; this.ph = []; this.flut = []; this.col = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  v(p, nr, u, v, flex, ph = 0, flut = 0, c) { this.pos.push(p.x, p.y, p.z); this.nor.push(nr.x, nr.y, nr.z); this.uv.push(u, v); this.flex.push(flex); this.ph.push(ph); this.flut.push(flut); if (c) this.col.push(c[0], c[1], c[2]); }
  geo() {
    const g = new THREE.BufferGeometry(); const F = THREE.Float32BufferAttribute;
    g.setAttribute('position', new F(this.pos, 3)); g.setAttribute('normal', new F(this.nor, 3)); g.setAttribute('uv', new F(this.uv, 2));
    g.setAttribute('aFlex', new F(this.flex, 1)); g.setAttribute('aPh', new F(this.ph, 1)); g.setAttribute('aFlut', new F(this.flut, 1));
    if (this.col.length) g.setAttribute('color', new F(this.col, 3));
    g.setIndex(this.idx); g.computeBoundingSphere(); return g;
  }
}
// 沿折线生成圆管（平行移动标架，避免扭转）
function tube(B, pts, rads, flexs, sides, vScale = 1) {
  const base = B.n; let nrm = null; let prevT = null; let vAcc = 0;
  const q = new THREE.Quaternion();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    if (!nrm) { nrm = Math.abs(t.y) < 0.95 ? V3(0, 1, 0).cross(t).normalize() : V3(1, 0, 0).cross(t).normalize(); }
    else { q.setFromUnitVectors(prevT, t); nrm.applyQuaternion(q); }
    prevT = t; const bin = t.clone().cross(nrm);
    if (i > 0) vAcc += pts[i].distanceTo(pts[i - 1]);
    for (let s = 0; s <= sides; s++) {
      const an = s / sides * Math.PI * 2; const d = nrm.clone().multiplyScalar(Math.cos(an)).addScaledVector(bin, Math.sin(an));
      B.v(pts[i].clone().addScaledVector(d, rads[i]), d, s / sides, vAcc * vScale, flexs[i]);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < sides; s++) {
    const a = base + i * (sides + 1) + s, b = a + sides + 1;
    B.idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
}
// 一张叶卡：中心、朝向、大小；法线用树冠球面法线
function card(B, c, right, up, w, h, nrm, flex, ph, flut, uv = [0, 0, 1, 1], anchorBottom = false, ao = null) {
  const base = B.n; const cc = ao === null ? null : [ao, ao, ao];
  const o = anchorBottom ? 0 : -0.5;
  const P = (sx, sy) => c.clone().addScaledVector(right, sx * w).addScaledVector(up, (sy + o) * h);
  const [u0, v0, u1, v1] = uv;
  const fl = anchorBottom ? [flex, flex, flex + 0.5 * h, flex + 0.5 * h] : [flex, flex, flex, flex];
  const ft = anchorBottom ? [0, 0, flut, flut] : [flut, flut, flut, flut];
  const lo = cc && anchorBottom ? cc.map(v => v * 0.75) : cc;
  B.v(P(-0.5, 0), nrm, u0, v0, fl[0], ph, ft[0], lo); B.v(P(0.5, 0), nrm, u1, v0, fl[1], ph, ft[1], lo);
  B.v(P(-0.5, 1), nrm, u0, v1, fl[2], ph, ft[2], cc); B.v(P(0.5, 1), nrm, u1, v1, fl[3], ph, ft[3], cc);
  B.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
}
function randUnit(r) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); return V3(s * Math.cos(a), u, s * Math.sin(a)); }
function perp(d) { const p = Math.abs(d.y) < 0.9 ? V3(0, 1, 0).cross(d) : V3(1, 0, 0).cross(d); return p.normalize(); }

// ---------- 树种 ----------
// L 主干长, R 主干粗, D 枝序数, kids 每段分枝数, spread 分枝张角, lenK 子枝长比, up 向光性, twist 弯曲, droop 下垂
const SPECIES = {
  broad: { L: [3.2, 4.6], R: 0.3, D: 3, kids: [4, 3, 3], spread: [0.75, 0.8, 0.9], lenK: [0.62, 0.62, 0.55], up: 0.12, twist: 0.28, droop: 0.02, start: 0.45,
    leaf: 'leaf', cs: 2.3, cn: 3, cSpread: 1.1, bark: 'barkH', sides: [8, 6, 4, 3], hueVar: 0.08 },
  camphor: { L: [2.4, 3.2], R: 0.34, D: 3, kids: [5, 3, 3], spread: [0.95, 0.85, 0.9], lenK: [0.7, 0.62, 0.55], up: 0.06, twist: 0.3, droop: 0.04, start: 0.5,
    leaf: 'leaf', cs: 2.4, cn: 4, cSpread: 1.2, bark: 'barkH', sides: [8, 6, 4, 3], hueVar: 0.05 },
  plum: { L: [1.0, 1.6], R: 0.15, D: 4, kids: [3, 3, 2, 2], spread: [0.8, 0.75, 0.7, 0.6], lenK: [0.85, 0.7, 0.6, 0.55], up: 0.1, twist: 0.55, droop: 0.0, start: 0.35,
    leaf: 'plum', cs: 0.95, cn: 2, cSpread: 0.35, bark: 'barkS', sides: [7, 5, 4, 3, 3], hueVar: 0.02 },
  peach: { L: [1.1, 1.5], R: 0.14, D: 4, kids: [3, 3, 2, 2], spread: [0.7, 0.7, 0.65, 0.6], lenK: [0.85, 0.72, 0.62, 0.55], up: 0.14, twist: 0.4, droop: 0.0, start: 0.4,
    leaf: 'peach', cs: 1.0, cn: 2, cSpread: 0.35, bark: 'barkS', sides: [7, 5, 4, 3, 3], hueVar: 0.02 },
  willow: { L: [2.6, 3.2], R: 0.24, D: 2, kids: [5, 4], spread: [0.8, 0.7], lenK: [0.75, 0.6], up: 0.1, twist: 0.3, droop: 0.12, start: 0.55,
    leaf: 'willow', cs: 0.9, cn: 4, cSpread: 0.4, bark: 'barkH', sides: [8, 5, 4], hang: 1, hueVar: 0.04 },
  wutong: { L: [5.5, 6.5], R: 0.22, D: 2, kids: [5, 3], spread: [0.55, 0.6], lenK: [0.5, 0.55], up: 0.25, twist: 0.12, droop: 0, start: 0.7,
    leaf: 'bud', cs: 1.3, cn: 6, cSpread: 0.7, bark: 'barkW', sides: [9, 6, 4], hueVar: 0.03 },
  pine: { L: [5.0, 7.0], R: 0.26, D: 2, kids: [7, 3], spread: [1.25, 0.7], lenK: [0.36, 0.5], up: -0.02, twist: 0.35, droop: 0.02, start: 0.35,
    leaf: 'pine', cs: 2.0, cn: 6, cSpread: 0.8, bark: 'barkP', sides: [8, 5, 4], flat: 1, hueVar: 0.04 }
};

function growTree(sp, seed) {
  const r = rng(seed); const B = new GeoBuf(); const C = new GeoBuf();
  const L0 = sp.L[0] + (sp.L[1] - sp.L[0]) * r();
  const leaves = []; let top = 0;
  function branch(p0, dir, len, rad, depth, flex0) {
    const n = depth === 0 ? 7 : depth === 1 ? 5 : 3;
    const pts = [p0.clone()], rads = [rad], flexs = [flex0]; let d = dir.clone(); let p = p0.clone();
    const radEnd = rad * (depth === sp.D ? 0.25 : 0.62);
    for (let i = 1; i <= n; i++) {
      d.addScaledVector(randUnit(r), sp.twist * (depth === 0 ? 0.35 : 1) / n * 2).addScaledVector(UP, sp.up / n * 2);
      d.y -= sp.droop * depth / n * 2; d.normalize();
      p = p.clone().addScaledVector(d, len / n); pts.push(p); rads.push(lerp(rad, radEnd, i / n));
      flexs.push(flex0 + (len * i / n) * (0.04 + depth * 0.03));
    }
    top = Math.max(top, p.y);
    const sides = sp.sides[Math.min(depth, sp.sides.length - 1)];
    if (rad > 0.012) tube(B, pts, rads, flexs, sides, 1 / Math.max(0.6, rad * 5));
    if (depth < sp.D) {
      const k = sp.kids[depth]; const ga = r() * 6.283;
      for (let j = 0; j < k; j++) {
        const t = sp.start + (1 - sp.start) * (k === 1 ? 1 : j / (k - 1)) * 0.95 + r() * 0.05;
        const idx = Math.min(pts.length - 1, Math.round(t * n)); const at = pts[idx];
        const dd = pts[Math.min(pts.length - 1, idx + 1)].clone().sub(pts[Math.max(0, idx - 1)]).normalize();
        const side = perp(dd).applyAxisAngle(dd, ga + j * 2.39996);
        let cd = dd.clone().multiplyScalar(Math.cos(sp.spread[depth])).addScaledVector(side, Math.sin(sp.spread[depth])).normalize();
        if (sp.flat && depth === 0) { cd.y = cd.y * 0.35 - 0.05; cd.normalize(); }
        const cl = len * sp.lenK[depth] * (0.75 + r() * 0.5) * (sp.flat && depth === 0 ? (1.25 - t * 0.9) * 1.6 : 1);
        branch(at, cd, cl, rads[idx] * (0.55 + r() * 0.15), depth + 1, flexs[idx]);
      }
      if (sp.flat || depth >= sp.D - 1) leaves.push({ p: pts[pts.length - 1], d, flex: flexs[flexs.length - 1], depth });
      if (depth >= sp.D - 1) for (let i = 1; i < pts.length - 1; i++) if (r() < 0.5) leaves.push({ p: pts[i], d, flex: flexs[i], depth });
    } else leaves.push({ p, d, flex: flexs[flexs.length - 1], depth });
  }
  const lean = randUnit(r); lean.y = 0; lean.multiplyScalar(sp === SPECIES.plum || sp === SPECIES.peach ? 0.35 : 0.08); lean.y = 1; lean.normalize();
  // 根部略放大，让树干落地有“生根”的感觉
  B.v(V3(0, -0.4, 0), V3(0, -1, 0), 0, 0, 0);
  branch(V3(0, -0.4, 0), lean, L0 + 0.4, sp.R, 0, 0);
  // 树冠中心，用来算叶卡法线
  const ctr = V3(); leaves.forEach(l => ctr.add(l.p)); ctr.multiplyScalar(1 / Math.max(1, leaves.length));
  let rad = 0.5; leaves.forEach(l => rad = Math.max(rad, l.p.distanceTo(ctr)));
  for (const l of leaves) {
    const cnt = sp.cn;
    for (let k = 0; k < cnt; k++) {
      const c = l.p.clone().addScaledVector(randUnit(r), sp.cSpread * r());
      const s = sp.cs * (0.7 + r() * 0.6);
      let nrm = c.clone().sub(ctr); const outward = nrm.length() / rad; nrm.normalize().lerp(UP, 0.35).normalize();
      if (sp.hang) {
        // 柳：从枝梢垂下的长条
        const az = r() * 6.283; const right = V3(Math.cos(az), 0, Math.sin(az));
        const len = 2.2 + r() * 2.2; const top2 = c.clone().add(V3(0, 0.1, 0));
        const bot = top2.clone().add(V3(0, -len, 0));
        card(C, bot, right, UP.clone(), s, len, nrm, l.flex + 0.2, r() * 6, 0.05, [0, 0, 1, 1], true, 0.55 + 0.45 * Math.min(1, outward));
        // anchorBottom 的柔度反过来：上端连着枝，下端摆得多
        const b = C.n - 4; C.flex[b] = C.flex[b + 1] = l.flex + len * 0.35; C.flex[b + 2] = C.flex[b + 3] = l.flex; C.flut[b] = C.flut[b + 1] = 0.08; C.flut[b + 2] = C.flut[b + 3] = 0;
        continue;
      }
      let right, up;
      if (sp.flat) { right = randUnit(r); right.y *= 0.3; right.normalize(); const f = randUnit(r).lerp(UP, 0.35).normalize(); up = f.clone().cross(right).normalize(); nrm = UP.clone().lerp(nrm, 0.6).normalize(); }
      else { const f = randUnit(r).lerp(nrm, 0.4).normalize(); right = perp(f); up = f.clone().cross(right).normalize(); }
      const ao = Math.min(1, 0.35 + 0.55 * Math.min(1, outward) + 0.25 * Math.max(0, (c.y - ctr.y) / rad));
      card(C, c, right, up, s, s, nrm, l.flex, r() * 6, 0.02 + 0.02 * outward, [0, 0, 1, 1], false, ao);
    }
  }
  return { bark: B.geo(), cards: C.geo(), top, ctr, rad };
}

// ---------- 竹 ----------
function culmGeo(seed) {
  const r = rng(seed); const B = new GeoBuf(); const C = new GeoBuf();
  const Hh = 6 + r() * 3.5, rad = 0.035 + r() * 0.02, bend = 0.04 + r() * 0.12; const az = r() * 6.283;
  const bd = V3(Math.cos(az), 0, Math.sin(az));
  const n = 12, pts = [], rads = [], flexs = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(V3(0, t * Hh - 0.3, 0).addScaledVector(bd, bend * Hh * t * t)); rads.push(rad * (1 - t * 0.55)); flexs.push(Math.pow(t, 1.8) * Hh * 0.13); }
  tube(B, pts, rads, flexs, 5, 1 / 0.9);
  for (let i = 0; i < 18; i++) {
    const t = 0.42 + r() * 0.56; const k = Math.min(n - 1, Math.floor(t * n)); const f = t * n - k;
    const at = pts[k].clone().lerp(pts[k + 1], f); const fl = lerp(flexs[k], flexs[k + 1], f);
    const a2 = r() * 6.283; const out = V3(Math.cos(a2), -0.35 - r() * 0.3, Math.sin(a2)).normalize();
    const c = at.clone().addScaledVector(out, 0.45 + r() * 0.35);
    const s = 1.0 + r() * 0.55; const right = perp(out); const up = out.clone().cross(right).normalize();
    const nrm = V3(Math.cos(a2), 0.6, Math.sin(a2)).normalize();
    card(C, c, right, out.clone().lerp(up, 0.3).normalize(), s, s * 0.9, nrm, fl + 0.2, r() * 6, 0.05, [0, 0, 1, 1], false, 0.55 + 0.45 * t);
  }
  return { bark: B.geo(), cards: C.geo(), top: Hh };
}

// ---------- 草丛与野花 ----------
function grassClumpGeo(seed, tall = 1, tint = [0.06, 0.11, 0.025], tip = [0.24, 0.32, 0.08]) {
  const r = rng(seed); const B = new GeoBuf();
  for (let b = 0; b < 10; b++) {
    const a = r() * 6.283, rr0 = Math.sqrt(r()) * 0.28; const bx = Math.cos(a) * rr0, bz = Math.sin(a) * rr0;
    const h = (0.14 + r() * 0.26) * tall, w = 0.02 + r() * 0.016; const la = r() * 6.283, lean = 0.15 + r() * 0.45;
    const dir = V3(Math.cos(la), 0, Math.sin(la)); const side = V3(-dir.z, 0, dir.x);
    const segs = 4; const base = B.n;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs; const p = V3(bx, t * h, bz).addScaledVector(dir, lean * h * t * t);
      const ww = w * (1 - t * 0.85); const c = [lerp(tint[0], tip[0], t), lerp(tint[1], tip[1], t), lerp(tint[2], tip[2], t)];
      const nr = V3(0, 1, 0).addScaledVector(dir, 0.25).normalize();
      B.v(p.clone().addScaledVector(side, -ww), nr, 0, t, t * t * 0.35 * tall, a, t * 0.012, c);
      B.v(p.clone().addScaledVector(side, ww), nr, 1, t, t * t * 0.35 * tall, a, t * 0.012, c);
    }
    for (let s = 0; s < segs; s++) { const q = base + s * 2; B.idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  return B.geo();
}
function crossCardGeo(w, h, n = 2) {
  const B = new GeoBuf();
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI; const right = V3(Math.cos(a), 0, Math.sin(a)); card(B, V3(0, 0, 0), right, UP.clone(), w, h, V3(0, 1, 0), 0, i, 0.01, [0, 0, 1, 1], true, 1); }
  return B.geo();
}

// ---------- 实例化 ----------
const _o = new THREE.Object3D(), _c = new THREE.Color();
function instancedFrom(geo, mat, list, opt = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); m.count = list.length;
  list.forEach((it, i) => {
    _o.position.set(it.x, it.y, it.z); _o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    const s = it.s || 1; _o.scale.set(it.sx || s, it.sy || s, it.sz || s); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix);
    if (it.c) { _c.set(it.c); if (it.cm) _c.multiplyScalar(it.cm); m.setColorAt(i, _c); }
  });
  m.castShadow = opt.shadow !== false; m.receiveShadow = opt.receive !== false;
  if (opt.depth) m.customDepthMaterial = opt.depth;
  m.computeBoundingSphere();
  return m;
}
// 按网格切块，视锥外的块整块跳过
function tiledInstances(geo, mat, list, tile, opt = {}) {
  const buckets = new Map(); const g = new THREE.Group();
  for (const it of list) { const k = Math.floor(it.x / tile) + ',' + Math.floor(it.z / tile); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); }
  for (const L of buckets.values()) g.add(instancedFrom(geo, mat, L, opt));
  return g;
}

// ---------- 植物材质 ----------
function makeFloraMaterials(P, C) {
  const M = {};
  const S = o => new THREE.MeshStandardMaterial(o);
  const bark = (n, color, key) => swayMat(boxlessBark(S({ map: P[n + '_diff'], normalMap: P[n + '_nor'], roughness: 0.95, color: col(color) })), key);
  function boxlessBark(m) { return m; }
  M.barkH = bark('chinese_hackberry_bark', '#9b958a', 'fbH');
  M.barkS = bark('sakura_bark', '#b4a494', 'fbS');
  M.barkW = bark('chinese_hackberry_bark', '#9aa58a', 'fbW');
  M.barkP = bark('sakura_bark', '#8a6a58', 'fbP');
  for (const k of ['barkH', 'barkS', 'barkW', 'barkP']) aoOn(M[k]);
  M.culm = aoOn(swayMat(S({ map: C.culm, roughness: 0.55, color: col('#ffffff') }), 'fCulm'));
  const leaf = (t, key, extra = {}) => swayMat(S(Object.assign({ map: t, vertexColors: true, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.78 }, extra)), key, true);
  M.leaf = leaf(C.leaf, 'fLeaf'); M.plum = leaf(C.plum, 'fPlum', { roughness: 0.7 }); M.peach = leaf(C.peach, 'fPeach', { roughness: 0.7 });
  M.willow = leaf(C.willow, 'fWillow'); M.bud = leaf(C.bud, 'fBud'); M.pine = leaf(C.pine, 'fPine', { roughness: 0.85 });
  M.bamboo = leaf(C.bamboo, 'fBamboo'); M.wisteria = leaf(C.wisteria, 'fWist');
  M.flower = leaf(C.flowers, 'fFlower', { roughness: 0.8 }); M.rape = leaf(C.rape, 'fRape', { roughness: 0.8 });
  M.plum.userData.u.uLeafGlow.value = 0.5; M.peach.userData.u.uLeafGlow.value = 0.6;
  M.grass = swayMat(S({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92 }), 'fGrass', true);
  M.grass.userData.u.uLeafGlow.value = 0.35;
  for (const k of ['leaf', 'plum', 'peach', 'willow', 'bud', 'pine', 'bamboo', 'wisteria', 'flower', 'rape']) M[k].userData.depth = swayDepth(M[k].map, k);
  M.barkDepth = swayDepth(null, 'bark');
  return M;
}
