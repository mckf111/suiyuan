// ============ 园中栽植 ============
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

// 一个树种若干变体，各自实例化
function forest(kind, n, seed0, list, parent, opt = {}) {
  const sp = SPECIES[kind]; const M = W.FM;
  const tpls = []; for (let i = 0; i < n; i++) tpls.push(growTree(sp, seed0 + i * 31));
  const per = tpls.map(() => []);
  const occ = W.occ = W.occ || [];
  for (const it of list) { const rr0 = (kind === 'pine' || kind === 'broad' || kind === 'camphor' ? 2.8 : kind === 'willow' ? 2.2 : 1.4) * (it.s || 1); occ.push({ x0: it.x, x1: it.x, z0: it.z, z1: it.z, r: rr0, k: 0.22 }); }
  list.forEach((it, i) => per[it.v !== undefined ? it.v % n : i % n].push(it));
  if (opt.lod) {
    // 远近分级：每个变体一组实例，近处的树放进“长成的树”，远处的换成画出的树冠；每隔片刻重排一次，绘制次数不变
    const imat = impostorMat(kind === 'pine' ? 'conifer' : 'broad'); const igeo = W.impGeo = W.impGeo || crossCardGeo(1, 1, 3);
    const sets = tpls.map((t, i) => {
      if (!per[i].length) return null;
      const bark = instancedFrom(t.bark, M[sp.bark], per[i].map(p => Object.assign({}, p, { c: undefined })), { depth: M.barkDepth });
      const cards = instancedFrom(t.cards, M[sp.leaf], per[i], { depth: M[sp.leaf].userData.depth, receive: true });
      parent.add(bark); parent.add(cards);
      return { t, items: per[i], bark, cards, hgt: t.top + 0.4, wid: Math.max(2.5, t.rad * 2.1) };
    }).filter(Boolean);
    const all = sets.flatMap(st => st.items.map(it => ({ x: it.x, y: it.y - 0.3, z: it.z, ry: it.ry, sx: st.wid * it.s, sy: st.hgt * it.s, sz: st.wid * it.s, c: it.c })));
    const imp = instancedFrom(igeo, imat, all, { shadow: false }); imp.count = 0; parent.add(imp);
    (W.lodForests = W.lodForests || []).push({ sets, imp });
    return tpls;
  }
  tpls.forEach((t, i) => {
    if (!per[i].length) return;
    parent.add(instancedFrom(t.bark, M[sp.bark], per[i].map(p => Object.assign({}, p, { c: undefined })), { depth: M.barkDepth }));
    parent.add(instancedFrom(t.cards, M[sp.leaf], per[i], { depth: M[sp.leaf].userData.depth, receive: true }));
  });
  return tpls;
}
const LEAF_TINTS = { broad: ['#ffffff', '#f0f6e0', '#e6efd2', '#fbf6e2'], camphor: ['#e8f0dc', '#dfe9cf', '#f2f4e4'], pine: ['#ffffff', '#e8eee0'], willow: ['#ffffff', '#f4f7e2'], plum: ['#ffffff'], peach: ['#ffffff', '#fff2f4'], wutong: ['#ffffff'] };
function tintOf(kind, r) { const a = LEAF_TINTS[kind] || ['#ffffff']; return a[Math.floor(r() * a.length)]; }

function buildPlants() {
  const G = W.gardenVeg, V = W.vegRoot, M = W.FM; const r = rng(515);
  const mob = W.mobile;
  // ---- 竹 ----
  const culms = [];
  const addBamboo = (x0, x1, z0, z1, n, pm) => {
    for (let i = 0; i < n; i++) {
      const x = rr(x0, x1), z = rr(z0, z1); if (!freeSpot(x, z, pm, 0.5)) continue;
      culms.push({ x, y: H(x, z), z, ry: r() * 6.28, s: 0.85 + r() * 0.35, c: r() < 0.5 ? '#ffffff' : '#eef2dc', v: Math.floor(r() * 8) });
    }
  };
  addBamboo(BAMBOO_ZONE.x0, BAMBOO_ZONE.x1, BAMBOO_ZONE.z0, BAMBOO_ZONE.z1, mob ? 520 : 900, 2.3);
  addBamboo(-34, -14, -45, -38.5, mob ? 70 : 130, 2);
  const ctpl = []; for (let i = 0; i < 8; i++) ctpl.push(culmGeo(900 + i * 17));
  ctpl.forEach((t, i) => {
    const L = culms.filter(c => c.v === i); if (!L.length) return;
    G.add(instancedFrom(t.bark, M.culm, L.map(p => Object.assign({}, p, { c: undefined })), { depth: M.barkDepth }));
    G.add(instancedFrom(t.cards, M.bamboo, L, { depth: M.bamboo.userData.depth }));
  });

  // ---- 园周山上的松与阔叶（近处用长成的树） ----
  const pines = [], broads = [], camph = [];
  for (let i = 0; i < 6000 && pines.length + broads.length + camph.length < (mob ? 170 : 330); i++) {
    const x = rr(-118, 122), z = rr(-82, 82); const y = H(x, z);
    if (x > PLUM_ZONE.x0 - 3 && x < PLUM_ZONE.x1 + 3 && z > PLUM_ZONE.z0 - 3 && z < PLUM_ZONE.z1 + 3) continue;
    if (x > BAMBOO_ZONE.x0 - 1 && x < BAMBOO_ZONE.x1 + 1 && z > BAMBOO_ZONE.z0 - 1 && z < BAMBOO_ZONE.z1 + 1) continue;
    if (!freeSpot(x, z, 3.4, 3)) continue;
    const ridge = y > 9.5 || Math.abs(z) > 62;
    const core = Math.abs(x - 5) < 70 && Math.abs(z) < 50;
    if (core && r() < 0.55) continue;
    const it = { x, y, z, ry: r() * 6.28, s: 0.85 + r() * 0.45 };
    // 南楼要能远眺：视线范围内的树不能高过楼上人的眼睛
    { const nx = SPOTS.nanlou.P[0], nz = SPOTS.nanlou.P[1]; const dN = Math.hypot(x - nx, z - nz);
      if (dN < 45) continue;
      if (dN < 220) { const eye = FLATS.find(f => f.id === 'nanlou').y + 5.6; const lim = eye - 1.5 + dN * 0.012 - y; const tall = ridge ? 9 : 11;
        if (tall * it.s > lim) { it.s = lim / tall; if (it.s < 0.55) continue; } } }
    if (ridge && r() < 0.55) { it.c = tintOf('pine', r); pines.push(it); }
    else if (r() < 0.35) { it.c = tintOf('camphor', r); it.s *= 1.1; camph.push(it); }
    else { it.c = tintOf('broad', r); broads.push(it); }
  }
  forest('pine', 4, 300, pines, V, { lod: 1 });
  forest('broad', 4, 500, broads, V, { lod: 1 });
  forest('camphor', 3, 700, camph, V, { lod: 1 });

  // ---- 香雪海：梅林；园中各处点缀桃杏 ----
  const plums = [], peaches = [];
  for (let i = 0; i < 900 && plums.length < (mob ? 55 : 80); i++) { const x = rr(PLUM_ZONE.x0, PLUM_ZONE.x1), z = rr(PLUM_ZONE.z0, PLUM_ZONE.z1); if (!freeSpot(x, z, 2.0, 1)) continue; if (plums.some(p => Math.hypot(p.x - x, p.z - z) < 2.6)) continue; plums.push({ x, y: H(x, z), z, ry: r() * 6.28, s: 0.85 + r() * 0.4, c: '#ffffff' }); }
  const pinkSpots = [[34, -10], [47, -26], [12, -24], [-12, -22], [-50, 4], [-40, -18], [8, -10], [-4, -12], [26, -12], [40, -6], [-48, -16], [58, -6], [-2, 22], [-18, 20]];
  for (const [x, z] of pinkSpots) if (freeSpot(x, z, 2.2, 1)) peaches.push({ x, y: H(x, z), z, ry: r() * 6.28, s: 0.9 + r() * 0.3, c: tintOf('peach', r) });
  forest('plum', 4, 1100, plums, G);
  forest('peach', 3, 1300, peaches, G);

  // ---- 大院四桐 ----
  const yard = FLATS.find(f => f.id === 'yard');
  const wt = [[-5, -6.5], [5, -6.5], [-5, 6.5], [5, 6.5]].map(([dx, dz], i) => ({ x: yard.x + dx + 3.5, y: yard.y, z: yard.z + dz, ry: i * 1.7, s: 1.0 + i * 0.04, c: '#ffffff' }));
  forest('wutong', 2, 1500, wt, G);

  // ---- 垂柳 ----
  const willows = [[-36, 12], [-30, -1.5], [-14, 14], [16, 3], [14, 14], [-2, 0.5], [-18, 15], [8, 16.2]].map(([x, z]) => ({ x, y: H(x, z), z, ry: r() * 6.28, s: 0.95 + r() * 0.2, c: tintOf('willow', r) }));
  forest('willow', 3, 1700, willows, G);

  // ---- 藤花廊上的紫藤（从廊顶垂下） ----
  const wg = crossCardGeo(1.3, 1.1, 2); wg.translate(0, -1.0, 0);
  const wa = wg.attributes.aFlex; const wp = wg.attributes.position; for (let i = 0; i < wa.count; i++) wa.setX(i, 0.1 + Math.max(0, -wp.getY(i)) * 0.3);
  const wv = (W.vineSpots || []).map(v => ({ x: v.x + Math.sin(v.a) * v.off + Math.cos(v.a) * v.side, y: v.y - 0.05, z: v.z + Math.cos(v.a) * v.off - Math.sin(v.a) * v.side, ry: r() * 6, s: 0.9 + r() * 0.4, c: '#ffffff' }));
  G.add(instancedFrom(wg, M.wisteria, wv, { depth: M.wisteria.userData.depth }));
  const wtop = crossCardGeo(1.8, 0.5, 2); wtop.rotateX(0); // 廊顶上一层藤叶
  G.add(instancedFrom(wtop, M.wisteria, wv.map(v => ({ x: v.x, y: v.y - 0.25, z: v.z, ry: v.ry + 0.8, s: 1.2, c: '#e8f0dc' })), { depth: M.wisteria.userData.depth }));

  // ---- 太湖石 ----
  const rocks = [[-33, 12, 1.1], [14, 2.5, 0.9], [34, -24, 1.2], [26, -30.5, 0.9], [-5, -34.5, 0.8], [-42, -1.5, 0.9], [-16, 12.8, 0.7], [9, 15.2, 0.8], [-27, 1.6, 0.6], [2, 13.5, 0.55]];
  // 石头不挡路：离游线、人物站位都留出余地，放不下就往外挪
  const roomy = (x, z, rad) => pathDist(x, z) > rad + 1.3 && Object.values(SPOTS).every(sp => Math.hypot(x - sp.P[0], z - sp.P[1]) > rad + 2.4 && Math.hypot(x - sp.cam[0], z - sp.cam[1]) > rad + 1.5);
  const clear = (x, z, rad) => { if (roomy(x, z, rad)) return [x, z]; for (let d = 0.5; d < 6; d += 0.5) for (let a = 0; a < 6.28; a += 0.4) { const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d; if (roomy(nx, nz, rad) && pondMask(nx, nz).m < 0.1) return [nx, nz]; } return null; };
  for (const [x0, z0, s] of rocks) { const c = clear(x0, z0, s * 1.2); if (!c) continue; const [x, z] = c; const k = rock(s); k.position.set(x, H(x, z) + 0.45 * s, z); k.rotation.y = r() * 6; W.buildRoot.add(k); }
  // 池岸叠石：半浸在水里，顶上长苔
  for (const p of PONDS) {
    const per = Math.PI * (p.a + p.b); const n = Math.floor(per / 2.0); const s0Max = 1.4;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r() * 0.1; const d = 0.93 + r() * 0.1; const x = p.x + Math.cos(a) * p.a * d, z = p.z + Math.sin(a) * p.b * d;
      if (pathDist(x, z) < 1.4 + s0Max || r() < 0.18) continue;
      if (Math.abs(z - CHANNEL.z) < 3.2 && x > CHANNEL.x0 - 2 && x < CHANNEL.x1 + 2) continue;
      if (Math.abs(x - BRIDGE.x) < 3 && Math.abs(z - BRIDGE.z) < 7) continue;
      const s = 0.45 + r() * 0.65; const k = rock(s, true); k.position.set(x, WATER_Y - 0.15 + s * 0.12, z); k.rotation.y = r() * 6; k.rotation.z = (r() - 0.5) * 0.3; W.buildRoot.add(k);
    }
  }

  // ---- 草、野花、芦苇、田中作物 ----
  buildGround(G, r);
}

function buildGround(G, r) {
  const M = W.FM; const mob = W.mobile;
  const grassGeos = [grassClumpGeo(1), grassClumpGeo(2, 1.3), grassClumpGeo(3, 0.8, [0.08, 0.13, 0.03], [0.34, 0.36, 0.12])];
  const reedGeo = grassClumpGeo(4, 1.9, [0.06, 0.12, 0.03], [0.22, 0.3, 0.08]);
  const wheatGeo = grassClumpGeo(5, 1.5, [0.07, 0.15, 0.03], [0.2, 0.34, 0.07]);
  const grass = [[], [], []], reeds = [], wheat = [], flowers = [], rape = [];
  const N = mob ? 6000 : 13000; const pal = ['#ffffff', '#f2f0e0', '#e8eed6', '#fff6dc', '#dfe8c8'];
  let tries = 0;
  while (grass[0].length + grass[1].length + grass[2].length < N && tries++ < N * 8) {
    const x = rr(-95, 100), z = rr(-68, 66);
    const pd = pathDist(x, z); if (pd < 1.35) continue;
    const near = pd < 14 ? 1 : 0.25; if (r() > near) continue;
    if (!freeSpot(x, z, 1.35, -0.2)) { if (pondMask(x, z).rim > 0.05 || fieldAt(x, z)) continue; let onFlat = false; for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r - 0.3) onFlat = true; if (onFlat) continue; if (distSegList(x, z, CORRIDOR) < 1.4) continue; }
    const y = H(x, z); const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1)); if (sl > 3) continue;
    const k = r() < 0.6 ? 0 : r() < 0.6 ? 1 : 2;
    grass[k].push({ x, y: y - 0.02, z, ry: r() * 6.28, s: 0.7 + r() * 0.7, c: pal[Math.floor(r() * pal.length)] });
    if (r() < 0.09) flowers.push({ x: x + rr(-0.5, 0.5), y: y, z: z + rr(-0.5, 0.5), ry: r() * 6.28, s: 0.7 + r() * 0.6, c: '#ffffff' });
  }
  // 池边芦苇、菖蒲
  for (let i = 0; i < (mob ? 250 : 600); i++) {
    const p = PONDS[i % 2]; const a = r() * 6.28; const d = 0.85 + r() * 0.25; const x = p.x + Math.cos(a) * p.a * d, z = p.z + Math.sin(a) * p.b * d;
    if (pathDist(x, z) < 2) continue; if (Math.abs(x - BRIDGE.x) < 3 && Math.abs(z - BRIDGE.z) < 7) continue;
    reeds.push({ x, y: Math.max(H(x, z), WATER_Y - 0.3), z, ry: r() * 6.28, s: 0.6 + r() * 0.5, c: '#ffffff' });
  }
  // 田：油菜、麦
  for (const f of FIELDS) {
    if (Math.abs(f.x0) > 175 || Math.abs(f.z0) > 175) continue;
    const step = f.k === 'rape' ? (mob ? 0.9 : 0.6) : (mob ? 0.8 : 0.55);
    if (f.k !== 'rape' && f.k !== 'wheat') continue;
    for (let x = f.x0 + 0.4; x < f.x1 - 0.3; x += step) for (let z = f.z0 + 0.4; z < f.z1 - 0.3; z += step * 0.8) {
      const px = x + rr(-0.15, 0.15), pz = z + rr(-0.15, 0.15);
      (f.k === 'rape' ? rape : wheat).push({ x: px, y: H(px, pz) - 0.02, z: pz, ry: r() * 6.28, s: 0.8 + r() * 0.4, c: f.k === 'rape' ? (r() < 0.3 ? '#fff4c8' : '#ffffff') : pal[Math.floor(r() * 3)] });
    }
  }
  const gg = new THREE.Group(); gg.name = 'grass';
  grass.forEach((L, k) => gg.add(tiledInstances(grassGeos[k], M.grass, L, 52, { shadow: false })));
  gg.add(tiledInstances(crossCardGeo(0.34, 0.3, 2), M.flower, flowers, 30, { shadow: false }));
  G.add(gg);
  const cg = new THREE.Group(); cg.name = 'crops';
  cg.add(tiledInstances(reedGeo, M.grass, reeds, 30, { shadow: false }));
  cg.add(tiledInstances(wheatGeo, M.grass, wheat, 30, { shadow: false }));
  cg.add(tiledInstances(crossCardGeo(0.8, 0.95, 3), M.rape, rape, 30, { shadow: false }));
  W.vegRoot.add(cg);
  W.reflHide = [gg, cg, W.cityHouses, W.impostors].filter(Boolean);
}

const _lm = new THREE.Matrix4(), _lc = new THREE.Color(), _lo = new THREE.Object3D();
let lodT = 0, lodPos = null;
function updateLod(cam) {
  const now = performance.now();
  if (lodPos && now - lodT < 400 && cam.distanceTo(lodPos) < 4 && !W.lodForce) return; W.lodForce = false;
  lodT = now; lodPos = cam.clone();
  const lift = Math.max(0, cam.y - 20) * 0.8;
  for (const F of W.lodForests || []) {
    let ni = 0;
    for (const st of F.sets) {
      let nd = 0;
      for (const it of st.items) {
        const d = Math.hypot(cam.x - it.x, cam.z - it.z) + lift;
        if (d < (W.lodDist || 50)) {
          _lo.position.set(it.x, it.y, it.z); _lo.rotation.set(0, it.ry || 0, 0); _lo.scale.setScalar(it.s || 1); _lo.updateMatrix();
          st.bark.setMatrixAt(nd, _lo.matrix); st.cards.setMatrixAt(nd, _lo.matrix); if (it.c) { _lc.set(it.c); st.cards.setColorAt(nd, _lc); } nd++;
        } else {
          _lo.position.set(it.x, it.y - 0.3, it.z); _lo.rotation.set(0, it.ry || 0, 0); _lo.scale.set(st.wid * it.s, st.hgt * it.s, st.wid * it.s); _lo.updateMatrix();
          F.imp.setMatrixAt(ni, _lo.matrix); if (it.c) { _lc.set(it.c); F.imp.setColorAt(ni, _lc); } ni++;
        }
      }
      st.bark.count = nd; st.cards.count = nd;
      st.bark.instanceMatrix.needsUpdate = st.cards.instanceMatrix.needsUpdate = true; if (st.cards.instanceColor) st.cards.instanceColor.needsUpdate = true;
    }
    F.imp.count = ni; F.imp.instanceMatrix.needsUpdate = true; if (F.imp.instanceColor) F.imp.instanceColor.needsUpdate = true;
  }
}
