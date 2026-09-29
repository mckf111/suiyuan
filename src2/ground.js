// ============ 地面：园中地形、园外远地、水面 ============
// JS 侧的小噪声，用于远山和布点
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), u), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), u), v);
}
function fbm2(x, z, o = 4) { let a = 0.5, s = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x, z); x = x * 2.03 + 17.1; z = z * 2.03 - 9.3; a *= 0.5; } return s; }
function ridge2(x, z, o = 4) { let a = 0.5, s = 0; for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(vnoise(x, z) * 2 - 1)); x = x * 2.1 + 5.2; z = z * 2.1 + 1.3; a *= 0.5; } return s; }

// ---------- 园外：钟山、清凉山、雨花台、玄武湖、莫愁湖、长江 ----------
const FARWATER_Y = OUTER_Y - 0.7;
const MOUNTS = [];
const LAKES = [];
let RIVER = [];
function polar(az, d) { const [dx, dz] = azDir(az); return [dx * d, dz * d]; }
function setupFar() {
  // 方位取实测；距离压缩后，高度与宽度按同一比例缩放，从园中望去的视角大小与实景相当
  const add = (az, d, a, b, h, rot, sharp = 1) => { const [x, z] = polar(az, d); MOUNTS.push({ x, z, a, b, h, rot, sharp, seed: MOUNTS.length * 7.3 }); };
  add(74, 2350, 330, 190, 135, 0.3, 1.2);  // 钟山
  add(82, 2450, 260, 150, 85, 0.1, 1);
  add(66, 2250, 200, 120, 60, 0.5, 1);
  add(251, 740, 95, 70, 24, 0.4, 0.8);     // 清凉山（石头城）
  add(60, 1000, 60, 45, 16, 0, 0.7);       // 鸡笼山（鸡鸣寺）
  add(55, 930, 45, 35, 12, 0, 0.6);        // 北极阁
  add(172, 1970, 210, 110, 24, 1.2, 0.7);  // 雨花台
  add(165, 740, 38, 30, 6, 0, 0.5);        // 冶城（朝天宫）
  add(8, 1950, 420, 110, 48, -0.3, 1);     // 幕府山
  add(330, 1620, 80, 60, 22, 0, 0.8);      // 狮子山
  add(128, 2700, 420, 220, 90, 0.8, 1);    // 青龙山一带
  for (const L of LANDMARKS) if (L.kind === 'lake') { const [x, z] = polar(L.az, L.d); LAKES.push(L.name === '后湖' ? { x, z, a: 420, b: 300 } : { x, z, a: 140, b: 90 }); }
  RIVER = [[222, 2900], [236, 2300], [252, 1950], [282, 1800], [312, 1980], [338, 2350], [2, 2700], [25, 3100]].map(([a, d]) => polar(a, d));
}
function riverDist(x, z) { let d = 1e9; for (let k = 0; k < RIVER.length - 1; k++) d = Math.min(d, distSeg(x, z, [RIVER[k][0], RIVER[k][1], RIVER[k + 1][0], RIVER[k + 1][1]])); return d; }
function lakeMask(x, z) {
  let m = 0;
  for (const L of LAKES) { const d = Math.hypot((x - L.x) / L.a, (z - L.z) / L.b) + (vnoise(x * 0.01, z * 0.01) - 0.5) * 0.25; m = Math.max(m, smooth(1.05, 0.88, d)); }
  if (Math.hypot(x, z) > 1400) { const rd = riverDist(x, z) + (vnoise(x * 0.004, z * 0.004) - 0.5) * 60; m = Math.max(m, smooth(110, 85, rd)); }
  return m;
}
function farH(x, z) {
  const r = Math.hypot(x, z);
  let h = OUTER_Y + 1.6 * (fbm2(x * 0.008, z * 0.008, 3) - 0.5) * 2;
  for (const m of MOUNTS) {
    const c = Math.cos(m.rot), s = Math.sin(m.rot); const dx = x - m.x, dz = z - m.z;
    const u = (dx * c + dz * s) / m.a, v = (-dx * s + dz * c) / m.b; const d2 = u * u + v * v; if (d2 > 6) continue;
    const rg = ridge2(x * 0.006 + m.seed, z * 0.006, 5);
    h += m.h * Math.exp(-d2 * 1.1) * (0.5 + 0.65 * rg * m.sharp);
  }
  // 天边连绵的群山
  const far = smooth(2300, 2900, r);
  if (far > 0) h += far * (30 + 110 * ridge2(x * 0.0022, z * 0.0022, 5)) * (0.6 + 0.6 * fbm2(x * 0.0007, z * 0.0007, 2));
  const lm = lakeMask(x, z); if (lm > 0) h = lerp(h, FARWATER_Y - 2.5, lm);
  return h;
}

// ---------- 园中地形 ----------
function terrainAttribs(x, z, y) {
  const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1));
  const s1 = [0, 0, 0, 0], s2 = [0, 0]; // s1: 土路 铺地 岩 卵石  s2: 林下 落花
  const tint = [1, 1, 1];
  const pm = pondMask(x, z);
  s1[2] = smooth(1.6, 3.4, sl) * 0.85;
  s2[0] = Math.max(smooth(0.45, 0.9, pm.m) * 0.9, smooth(9, 16, y) * 0.35 * (0.5 + fbm2(x * 0.06, z * 0.06, 2)));
  s1[3] = Math.max(s1[3], smooth(0.35, 0.75, pm.rim) * (1 - smooth(0.4, 0.85, pm.m)));
  for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + 0.8) s1[f.pave ? 1 : 0] = Math.max(s1[f.pave ? 1 : 0], smooth(f.r + 0.8, f.r - 0.8, d)); }
  const pd = pathDist(x, z); const inCore = Math.abs(x - 5) < 80 && Math.abs(z) < 55;
  const pw = smooth(1.75, 1.05, pd);
  if (inCore) s1[3] = Math.max(s1[3], pw); else s1[0] = Math.max(s1[0], pw);
  s1[0] = Math.max(s1[0], smooth(2.6, 1.6, pd) * 0.45);
  if (x > PLUM_ZONE.x0 && x < PLUM_ZONE.x1 && z > PLUM_ZONE.z0 && z < PLUM_ZONE.z1) s2[1] = 0.8;
  const f = fieldAt(x, z);
  if (f) {
    s1.fill(0); s2[0] = 0;
    if (f.k === 'paddy') { s2[0] = 1; tint[0] = 0.8; tint[1] = 0.85; tint[2] = 0.8; }
    else if (f.k === 'rape') { tint[0] = 1.0; tint[1] = 1.05; tint[2] = 0.7; }
    else if (f.k === 'wheat') { tint[0] = 0.85; tint[1] = 1.15; tint[2] = 0.7; }
    else { s1[0] = 0.55 + 0.45 * Math.max(0, Math.sin(z * 3.2)); }
  }
  // 园毁之后：园区尽为田垄
  const inGarden = smooth(1.05, 0.9, Math.hypot((x - 5) / 95, (z + 2) / 55));
  let fc = [0.62, 0.55, 0.4];
  if (inGarden > 0) {
    const k = (Math.floor((x + 200) / 12) + Math.floor((z + 200) / 9) * 7) % 4;
    fc = [[0.55, 0.62, 0.36], [0.64, 0.57, 0.42], [0.5, 0.6, 0.34], [0.6, 0.52, 0.38]][k];
    const st = 0.8 + 0.2 * Math.sin(z * 3.0 + Math.floor(x / 12) * 1.7); fc = fc.map(v => v * st);
    if (pm.m > 0.1) fc = [0.42, 0.45, 0.42];
  }
  return { s1, s2, tint, fc: [...fc, inGarden * (y < 14 ? 1 : 0.3)] };
}

const TERRAIN_FRAG_PARS = /* glsl */`
uniform sampler2D tG, tGn, tD, tDn, tP, tPn, tR, tRn, tB, tBn, tF;
uniform float uWet;
varying vec3 vTWP; varying vec3 vTWN; varying vec4 vS1; varying vec2 vS2; varying vec3 vTint; varying vec4 vFc;
vec3 tri(sampler2D t, vec2 p){ return texture2D(t, p).rgb; }
`;
const TERRAIN_MAP = `
  vec2 tp = vTWP.xz;
  float mac = sfbm(tp * 0.035);
  float mac2 = sfbm(tp * 0.11 + 7.0);
  // 草地：两个尺度混采，去掉重复感
  vec3 gA = tri(tG, tp * 0.33); vec3 gB = tri(tG, tp * 0.083 + 0.37);
  vec3 grass = mix(gA, gB, 0.45 + 0.25 * (mac2 - 0.5));
  grass *= mix(vec3(0.66, 0.84, 0.48), vec3(0.98, 1.0, 0.66), smoothstep(0.25, 0.75, mac)) * vec3(0.92, 1.02, 0.76);
  grass = mix(grass, vec3(dot(grass, vec3(0.3, 0.59, 0.11))), 0.1);
  vec3 dirt = tri(tD, tp * 0.28);
  vec3 pave = tri(tP, tp * 0.22);
  vec3 rock = tri(tR, tp * 0.12) * vec3(0.9, 0.92, 0.88);
  vec3 peb = tri(tB, tp * 0.45) * vec3(0.95, 0.94, 0.9);
  vec3 forest = tri(tF, tp * 0.25) * vec3(0.9, 0.9, 0.85);
  // 用贴图亮度做高度混合，交界处更自然
  float nz = svn(tp * 1.7) * 0.35;
  vec4 w1 = clamp((vS1 - 0.5 + nz) * 3.0 + 0.5, 0.0, 1.0) * step(0.02, vS1);
  vec2 w2 = clamp((vS2 - 0.5 + nz) * 2.5 + 0.5, 0.0, 1.0) * step(0.02, vS2);
  vec3 alb = grass;
  alb = mix(alb, forest, w2.x);
  alb = mix(alb, dirt, w1.x);
  alb = mix(alb, rock, w1.z);
  alb = mix(alb, peb, w1.w);
  alb = mix(alb, pave, w1.y);
  alb *= vTint;
  // 水下：越深越绿，水底有晃动的光斑
  float uw = ${WATER_Y.toFixed(2)} - vTWP.y;
  if (uw > 0.0) {
    alb *= mix(vec3(0.92, 0.95, 0.9), vec3(0.42, 0.56, 0.44), smoothstep(0.0, 1.6, uw));
    float cs = suiCaustic(tp * 0.9) * 0.7 + suiCaustic(tp * 1.7 + 3.0) * 0.4;
    alb += vec3(0.75, 0.85, 0.7) * cs * 0.55 * exp(-uw * 0.9) * uSunVis * smoothstep(0.0, 0.15, uw) * (1.0 - uFieldBlend * vFc.a);
  }
  // 梅林下的落瓣
  float pet = smoothstep(0.78, 0.84, svn(tp * 9.0) * 0.7 + svn(tp * 23.0) * 0.4) * w2.y;
  alb = mix(alb, vec3(0.93, 0.9, 0.88), pet);
  // 园毁为田
  float fb = uFieldBlend * vFc.a;
  vec3 furrow = vFc.rgb * (0.75 + 0.5 * dirt);
  alb = mix(alb, furrow, fb);
  diffuseColor.rgb *= alb;
  float tRough = mix(0.95, 0.9, w1.y);
  tRough = mix(tRough, 0.55, w2.x * step(0.9, vS2.x) * uWet);
`;
const TERRAIN_NORMAL = /* glsl */`
  {
    vec2 nG = texture2D(tGn, tp * 0.33).xy * 2.0 - 1.0;
    vec2 nD = texture2D(tDn, tp * 0.28).xy * 2.0 - 1.0;
    vec2 nP = texture2D(tPn, tp * 0.22).xy * 2.0 - 1.0;
    vec2 nR = texture2D(tRn, tp * 0.12).xy * 2.0 - 1.0;
    vec2 nB = texture2D(tBn, tp * 0.45).xy * 2.0 - 1.0;
    vec2 tn = nG * 0.6;
    tn = mix(tn, nD, w1.x); tn = mix(tn, nR * 1.3, w1.z); tn = mix(tn, nB, w1.w); tn = mix(tn, nP * 1.2, w1.y);
    tn *= (1.0 - uFieldBlend * vFc.a * 0.6);
    vec3 wn = normalize(vTWN);
    vec3 T = normalize(vec3(1.0, 0.0, 0.0) - wn * wn.x); vec3 Bt = normalize(cross(T, wn));
    vec3 pn = normalize(wn + T * tn.x - Bt * tn.y);
    normal = normalize((viewMatrix * vec4(pn, 0.0)).xyz);
  }
`;
function terrainMaterial(P) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  m.userData.u = {
    tG: { value: P.leafy_grass_diff }, tGn: { value: P.leafy_grass_nor }, tD: { value: P.stony_dirt_path_diff }, tDn: { value: P.stony_dirt_path_nor },
    tP: { value: P.grey_stone_path_diff }, tPn: { value: P.grey_stone_path_nor }, tR: { value: P.mossy_rock_diff }, tRn: { value: P.mossy_rock_nor },
    tB: { value: P.ganges_river_pebbles_diff }, tBn: { value: P.ganges_river_pebbles_nor }, tF: { value: P.forest_ground_04_diff }, uWet: { value: 1 }
  };
  return hook(m, 'terrain', sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aS1; attribute vec2 aS2; attribute vec3 aTint; attribute vec4 aFc;\nvarying vec3 vTWP; varying vec3 vTWN; varying vec4 vS1; varying vec2 vS2; varying vec3 vTint; varying vec4 vFc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTWP = (modelMatrix * vec4(position, 1.0)).xyz; vTWN = normalize(mat3(modelMatrix) * normal); vS1 = aS1; vS2 = aS2; vTint = aTint; vFc = aFc;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + TERRAIN_FRAG_PARS)
      .replace('#include <map_fragment>', TERRAIN_MAP)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * tRough;')
      .replace('#include <normal_fragment_maps>', TERRAIN_NORMAL);
  });
}
function buildTerrain(P) {
  const size = 360, seg = W.mobile ? 180 : 260;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const n = p.count;
  const s1 = new Float32Array(n * 4), s2 = new Float32Array(n * 2), tint = new Float32Array(n * 3), fc = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), z = p.getZ(i); const y = H(x, z); p.setY(i, y);
    const a = terrainAttribs(x, z, y);
    s1.set(a.s1, i * 4); s2.set(a.s2, i * 2); tint.set(a.tint, i * 3); fc.set(a.fc, i * 4);
  }
  g.setAttribute('aS1', new THREE.BufferAttribute(s1, 4)); g.setAttribute('aS2', new THREE.BufferAttribute(s2, 2));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3)); g.setAttribute('aFc', new THREE.BufferAttribute(fc, 4));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, terrainMaterial(P)); m.receiveShadow = true;
  W.terrain = m; return m;
}
function setFieldBlend(t) { U.uFieldBlend.value = t; }

// ---------- 园外远地 ----------
const FAR_FRAG = /* glsl */`
  vec2 tp = vFWP.xz;
  float slope = 1.0 - clamp(vFWN.y, 0.0, 1.0);
  float hgt = vFWP.y;
  float mac = sfbm(tp * 0.006);
  // 平地：田、菜畦、草地拼成的块
  vec2 cell = floor(tp / vec2(26.0, 17.0));
  float ck = sh12(cell);
  vec3 plain = mix(vec3(0.36, 0.44, 0.2), vec3(0.5, 0.52, 0.26), ck);
  plain = mix(plain, vec3(0.78, 0.68, 0.18), step(0.82, ck) * 0.9);   // 油菜
  plain = mix(plain, vec3(0.45, 0.4, 0.3), step(0.7, ck) * step(ck, 0.82) * 0.6);
  vec2 cf = fract(tp / vec2(26.0, 17.0));
  plain *= 0.85 + 0.15 * smoothstep(0.0, 0.06, min(min(cf.x, 1.0 - cf.x), min(cf.y, 1.0 - cf.y)));
  plain *= texture2D(tG, tp * 0.05).rgb * 2.2;
  // 山林：一团团树冠
  float cr = svn(tp * 0.22) * 0.6 + svn(tp * 0.55) * 0.3 + svn(tp * 1.3) * 0.1;
  vec3 wood = mix(vec3(0.08, 0.13, 0.05), vec3(0.24, 0.3, 0.12), cr);
  wood = mix(wood, vec3(0.32, 0.4, 0.16), smoothstep(0.7, 0.9, svn(tp * 0.05 + 3.0)) * 0.6);
  wood = mix(wood, vec3(0.15, 0.2, 0.1), smoothstep(400.0, 1600.0, length(vFWP - cameraPosition)) * 0.5);
  wood = mix(wood, vec3(0.34, 0.33, 0.22), smoothstep(0.62, 0.8, mac) * 0.4);
  float woodW = smoothstep(${(OUTER_Y + 2.5).toFixed(1)}, ${(OUTER_Y + 7).toFixed(1)}, hgt + (mac - 0.5) * 8.0);
  woodW = max(woodW, smoothstep(0.62, 0.72, svn(tp * 0.02)) * 0.9);
  vec3 alb = mix(plain, wood, woodW);
  // 城中屋宇：灰瓦粉墙、街巷纵横（远处用图案代替逐栋建模）
  float dcam = length(vFWP - cameraPosition);
  float azr = degrees(atan(tp.x, -tp.y)); azr += azr < 0.0 ? 360.0 : 0.0;
  float rr0 = length(tp);
  float cityW = smoothstep(55.0, 85.0, azr) * smoothstep(235.0, 205.0, azr) * smoothstep(1900.0, 1200.0, rr0) * smoothstep(600.0, 800.0, rr0);
  cityW = max(cityW, smoothstep(40.0, 70.0, azr) * smoothstep(250.0, 230.0, azr) * smoothstep(1300.0, 900.0, rr0) * smoothstep(650.0, 850.0, rr0) * 0.7);
  cityW *= (1.0 - woodW) * smoothstep(${(FARWATER_Y + 0.6).toFixed(1)}, ${(FARWATER_Y + 1.4).toFixed(1)}, hgt) * smoothstep(0.35, 0.15, slope);
  if (cityW > 0.01) {
    vec2 cc = tp / vec2(15.0, 11.0); vec2 ci = floor(cc), cff = fract(cc); float hsh = sh12(ci);
    vec3 roof = mix(vec3(0.13, 0.14, 0.15), vec3(0.22, 0.22, 0.23), hsh);
    roof = mix(roof, vec3(0.72, 0.7, 0.64), step(0.8, cff.y));
    roof = mix(roof, vec3(0.36, 0.33, 0.28), step(cff.x, 0.09) + step(0.93, sh12(vec2(ci.y, 7.0))) * step(cff.y, 0.12));
    roof = mix(roof, vec3(0.28, 0.36, 0.18), step(0.86, hsh));
    vec3 avg = vec3(0.28, 0.28, 0.27);
    roof = mix(roof, avg, smoothstep(700.0, 1600.0, dcam));
    alb = mix(alb, roof, cityW);
  }
  alb = mix(alb, vec3(0.42, 0.4, 0.34), smoothstep(0.55, 0.8, slope) * 0.5);
  alb = mix(alb, vec3(0.42, 0.38, 0.3), smoothstep(${(FARWATER_Y + 1.2).toFixed(1)}, ${(FARWATER_Y + 0.2).toFixed(1)}, hgt));
  diffuseColor.rgb *= alb;
  float fRough = 0.95;
  fWoodW = woodW; fCr = cr;
`;
function buildFarLand(P) {
  const rings = W.mobile ? 90 : 130, segs = W.mobile ? 240 : 360; const r0 = 170, r1 = 3100;
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings; const r = r0 * Math.pow(r1 / r0, t);
    for (let j = 0; j <= segs; j++) { const a = j / segs * Math.PI * 2; const x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, farH(x, z), z); }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  m.userData.u = { tG: { value: P.leafy_grass_diff } };
  hook(m, 'farland', sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFWP; varying vec3 vFWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFWP = (modelMatrix * vec4(position, 1.0)).xyz; vFWN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tG; varying vec3 vFWP; varying vec3 vFWN;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (abs(vFWP.x) < 178.5 && abs(vFWP.z) < 178.5) discard;\n float fWoodW = 0.0, fCr = 0.0;')
      .replace('#include <map_fragment>', FAR_FRAG)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = fRough;')
      .replace('#include <normal_fragment_maps>', `
        { vec2 q = vFWP.xz; float e = 0.6;
          float c0 = svn(q * 0.22) * 0.6 + svn(q * 0.55) * 0.3;
          float cx = svn((q + vec2(e, 0.0)) * 0.22) * 0.6 + svn((q + vec2(e, 0.0)) * 0.55) * 0.3;
          float cz = svn((q + vec2(0.0, e)) * 0.22) * 0.6 + svn((q + vec2(0.0, e)) * 0.55) * 0.3;
          vec3 wn = normalize(vFWN); vec3 pn = normalize(wn - vec3(cx - c0, 0.0, cz - c0) * 9.0 * fWoodW);
          normal = normalize((viewMatrix * vec4(pn, 0.0)).xyz); }`);
  });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; return mesh;
}
// 远处的水：江、湖，借天光反射
function buildFarWater() {
  const g = new THREE.RingGeometry(170, 3100, 160, 10); g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color: col('#4d6660'), roughness: 0.12, metalness: 0, envMapIntensity: 1.0 });
  hook(m, 'farwater', sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWW = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWW;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (abs(vWW.x) < 178.5 && abs(vWW.z) < 178.5) discard;')
      .replace('#include <normal_fragment_maps>', `{ vec2 q = vWW.xz * 0.08 + uTime * vec2(0.05, 0.03);
          vec3 pn = normalize(vec3((svn(q) - 0.5) * 0.12, 1.0, (svn(q + 5.3) - 0.5) * 0.12)); normal = normalize((viewMatrix * vec4(pn, 0.0)).xyz); }`);
  });
  const w = new THREE.Mesh(g, m); w.position.y = FARWATER_Y; w.receiveShadow = false; return w;
}

// ---------- 园中池水：平面反射 ----------
const WATER_VERT = /* glsl */`
#include <common>
uniform mat4 textureMatrix;
varying vec4 vRUv; varying vec3 vWP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
  vRUv = textureMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FRAG = /* glsl */`
#include <common>
uniform sampler2D tDiffuse, tNormal, tDepth;
uniform vec3 color; uniform float uReflect, uOpacity; uniform vec4 uDepthRect;
varying vec4 vRUv; varying vec3 vWP;
void main(){
  vec2 q = vWP.xz;
  vec3 n1 = texture2D(tNormal, q * 0.09 + uTime * vec2(0.012, 0.007)).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(tNormal, q * 0.21 - uTime * vec2(0.009, 0.015)).xyz * 2.0 - 1.0;
  vec2 nn = (n1.xy + n2.xy * 0.6) * (0.5 + 0.3 * uWind.z) * mix(1.0, 0.35, smoothstep(10.0, 60.0, length(cameraPosition - vWP)));
  vec3 N = normalize(vec3(nn.x * 0.12, 1.0, nn.y * 0.12));
  vec3 V = normalize(cameraPosition - vWP);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  fres = mix(0.1, 1.0, fres);
  vec4 ru = vRUv; ru.xy += nn * 0.012 * ru.w;
  vec3 refl = texture2DProj(tDiffuse, ru).rgb;
  // 深浅：岸边清浅见底，中间幽绿
  vec2 duv = (q - uDepthRect.xy) / uDepthRect.zw;
  float dep = texture2D(tDepth, duv).r;
  vec3 deep = color * (uSunCol * 0.16 * uSunVis + uSkyTop * 0.3 + 0.03);
  float absorb = 1.0 - exp(-dep * 1.6 / max(V.y, 0.3));
  // 倒影略压暗、提一点饱和，水色才清不发灰
  vec3 rl = refl * uReflect; float rlum = dot(rl, vec3(0.299, 0.587, 0.114)); rl = max(mix(vec3(rlum), rl, 1.3), 0.0) * 0.9;
  vec3 c = mix(deep, rl, fres);
  float a = clamp(max(absorb * 0.92, fres), 0.0, 1.0);
  vec3 H2 = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H2), 0.0), 420.0) * 2.2 * uSunVis;
  c += uSunCol * spec; a = min(1.0, a + spec);
  float edge = smoothstep(0.0, 0.06, dep);
  c = suiGrade(suiAtmos(c, vWP));
  gl_FragColor = vec4(c, a * uOpacity * edge);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function depthTexture(rect, res = 128) {
  const [x0, z0, w, d] = rect; const data = new Uint8Array(res * res * 4);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = x0 + (i + 0.5) / res * w, z = z0 + (j + 0.5) / res * d; const dep = Math.max(0, WATER_Y - H(x, z));
    const v = Math.min(255, dep / 1.5 * 255); const k = (j * res + i) * 4; data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, res, res); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
function buildWater(C) {
  const rect = [-41, -6, 64, 26];
  const g = new THREE.PlaneGeometry(rect[2], rect[3]);
  const cx = rect[0] + rect[2] / 2, cz = rect[1] + rect[3] / 2;
  const depT = depthTexture(rect);
  C.waterN.wrapS = C.waterN.wrapT = THREE.RepeatWrapping; C.waterN.colorSpace = THREE.NoColorSpace;
  const uniforms = Object.assign({
    color: { value: col('#2f5a48') }, tDiffuse: { value: null }, textureMatrix: { value: null }, tNormal: { value: C.waterN }, tDepth: { value: depT },
    uReflect: { value: 1 }, uOpacity: { value: 1 }, uDepthRect: { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) }
  }, U);
  let w;
  if (!W.mobile) {
    w = new THREE.Reflector(g, { textureWidth: Math.round(innerWidth * 0.33), textureHeight: Math.round(innerHeight * 0.33), clipBias: 0.02, multisample: window.__NOMSAA ? 0 : 4,
      shader: { name: 'SuiWater', uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG } });
    // Reflector 会复制一份 uniform，这里接回共享的那一份
    const mu = w.material.uniforms; Object.assign(mu, U);
    for (const k of ['tNormal', 'tDepth', 'uDepthRect', 'uReflect', 'uOpacity']) mu[k] = uniforms[k];
    mu.color.value = uniforms.color.value; uniforms.tDiffuse = mu.tDiffuse; uniforms.textureMatrix = mu.textureMatrix;
    w.material.transparent = true; w.material.depthWrite = false;
    // 倒影里不画草和远处细物，省一半开销
    const orig = w.onBeforeRender.bind(w);
    w.onBeforeRender = (r, s, c) => { const hid = W.reflHide || []; const st = hid.map(o => o.visible); hid.forEach(o => o.visible = false); orig(r, s, c); hid.forEach((o, i) => o.visible = st[i]); };
  } else {
    // 手机：用环境光反射代替实时倒影
    w = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col('#2f5044'), roughness: 0.06, metalness: 0, transparent: true, opacity: 0.72 }));
    hook(w.material, 'pondM');
  }
  w.position.set(cx, WATER_Y, cz); w.rotation.x = -Math.PI / 2; w.renderOrder = 2;
  W.water = w; W.waterU = uniforms; return w;
}

// 地面接地暗影：建筑脚下、树冠下略暗
function applyGroundAO() {
  const g = W.terrain.geometry; const p = g.attributes.position; const t = g.attributes.aTint; const O = W.occ || [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); let ao = 1;
    for (const o of O) {
      if (x < o.x0 - o.r || x > o.x1 + o.r || z < o.z0 - o.r || z > o.z1 + o.r) continue;
      const dx = Math.max(o.x0 - x, 0, x - o.x1), dz = Math.max(o.z0 - z, 0, z - o.z1); const d = Math.hypot(dx, dz);
      ao *= 1 - o.k * smooth(o.r, 0, d);
    }
    if (ao < 1) { t.setXYZ(i, t.getX(i) * ao, t.getY(i) * ao, t.getZ(i) * ao); }
  }
  t.needsUpdate = true;
}
