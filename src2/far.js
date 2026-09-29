// ============ 远景：天空、山林、城中屋宇、地标 ============
function azDir(az) { const a = az * Math.PI / 180; return [Math.sin(a), -Math.cos(a)]; }

// ---------- 天空 ----------
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`;
const SKY_FRAG = /* glsl */`
#include <common>
varying vec3 vDir;
void main(){
  vec3 rd = normalize(vDir);
  float h = rd.y;
  float s = max(dot(rd, uSunDir), 0.0);
  vec3 sky = mix(uSkyHor, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.5));
  sky += uHazeSun * pow(s, 5.0) * 0.18 * uSunVis;
  // 云：平铺在高处的一层积云，随风慢慢移动
  if (h > 0.0) {
    vec2 cp = rd.xz / (h + 0.12) * 1.1 + uTime * vec2(0.006, 0.003);
    float c = sfbm(cp * 1.4) * 0.65 + sfbm(cp * 3.7 + 3.1) * 0.35;
    float cov = smoothstep(0.42, 0.85, c) * smoothstep(0.0, 0.25, h);
    float thick = smoothstep(0.5, 0.9, c);
    vec3 lit = uCloudCol * (0.9 + 0.5 * pow(s, 4.0));
    vec3 shade = mix(uSkyHor, uSkyTop, 0.35) * 0.95;
    vec3 cc = mix(lit, shade, thick * 0.45);
    sky = mix(sky, cc, cov * 0.75);
  }
  // 贴近地平线的薄霭，与地面的雾同色
  sky = mix(sky, hazeTint(normalize(vec3(rd.x, max(h, 0.0), rd.z))), exp(-max(h, 0.0) * 9.0) * 0.9);
  sky += uSunCol * smoothstep(0.99965, 0.9999, s) * 6.0 * uSunVis;
  sky += uSunCol * pow(s, 400.0) * 0.8 * uSunVis;
  gl_FragColor = vec4(suiGrade(sky), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function skyMaterial() {
  return new THREE.ShaderMaterial({ uniforms: U, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false });
}
function buildSky() {
  const g = new THREE.SphereGeometry(3900, 48, 24); const mat = skyMaterial();
  const sky = new THREE.Mesh(g, mat); sky.frustumCulled = false; sky.renderOrder = -10;
  W.sky = sky;
  // 供环境光照用的另一份天空
  W.envScene = new THREE.Scene(); const s2 = new THREE.Mesh(g, mat); s2.scale.setScalar(0.01); W.envScene.add(s2);
  return sky;
}

// ---------- 山林：一团团树冠 ----------
function lumpGeo(kind, seed) {
  const r = rng(seed);
  let g;
  if (kind === 'cone') { g = new THREE.ConeGeometry(1, 2.4, 7, 3); g.translate(0, 1.2, 0); }
  else { g = new THREE.IcosahedronGeometry(1, kind === 'fine' ? 2 : 1); }
  g = g.toNonIndexed ? g : g;
  const p = g.attributes.position; const cols = []; const v = V3();
  const off = [r() * 10, r() * 10, r() * 10];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (kind !== 'cone') {
      const k = 1 + 0.22 * Math.sin(v.x * 3.1 + off[0]) * Math.sin(v.y * 2.9 + off[1]) * Math.sin(v.z * 3.3 + off[2]);
      v.multiplyScalar(k); v.y = v.y > -0.3 ? v.y * 0.9 : -0.3 + (v.y + 0.3) * 0.3; v.y += 0.8;
    }
    p.setXYZ(i, v.x, v.y, v.z);
    const t = Math.max(0, Math.min(1, v.y / 2)); const c = 0.55 + 0.45 * t;
    cols.push(c, c, c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  // 球面法线，让树冠受光柔和
  const nr = g.attributes.normal; const ctr = kind === 'cone' ? V3(0, 1.0, 0) : V3(0, 0.8, 0);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(ctr).normalize(); const n0 = V3().fromBufferAttribute(nr, i); n0.lerp(v, 0.6).normalize(); nr.setXYZ(i, n0.x, n0.y, n0.z); }
  return g;
}
function lumpMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  return hook(m, 'lump', sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position * 3.0;\n#ifdef USE_INSTANCING\nvLP += instanceMatrix[3].xyz * 0.13;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <normal_fragment_maps>', `{ float a = svn(vLP.xy * 1.7 + vLP.z) , b = svn(vLP.zy * 1.7 - vLP.x);
         normal = normalize(normal + vec3(a - 0.5, b - 0.5, (a - b)) * 0.9); diffuseColor.rgb *= 0.8 + 0.4 * a; }`);
  });
}
function buildLumps(list, name) {
  const g = new THREE.Group(); const mat = lumpMaterial();
  const kinds = { round: lumpGeo('round', 11), round2: lumpGeo('round', 23), cone: lumpGeo('cone', 5), fine: lumpGeo('fine', 7) };
  const by = {}; for (const it of list) (by[it.k] = by[it.k] || []).push(it);
  for (const k in by) g.add(tiledInstances(kinds[k], mat, by[k], 260, { shadow: false }));
  g.name = name; return g;
}
// 在远地的山坡、城中空地上撒树
function scatterFarTrees() {
  const out = []; const r = rng(99);
  const N = W.mobile ? 7000 : 18000;
  const pal = ['#ffffff', '#f1f4e6', '#e2e8d2', '#fff6e4', '#d9e2c6', '#eef0dc'];
  for (let i = 0; i < N * 5 && out.length < N; i++) {
    const a = r() * Math.PI * 2, d = 140 + Math.pow(r(), 1.35) * 1200; const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const inside = Math.abs(x) < 179 && Math.abs(z) < 179;
    if (inside && Math.abs(x - 5) < 120 && Math.abs(z) < 84) continue;
    const y = inside ? H(x, z) : farH(x, z);
    if (!inside && lakeMask(x, z) > 0.02) continue;
    if (inside && (fieldAt(x, z) || pondMask(x, z).rim > 0.1)) continue;
    const hill = y > OUTER_Y + 3.5;
    const grove = smooth(0.55, 0.72, vnoise(x * 0.012, z * 0.012));
    const dens = hill ? 0.95 : 0.05 + 0.6 * grove;
    if (r() > dens) continue;
    const conifer = hill ? r() < 0.4 : r() < 0.08;
    const hgt = (conifer ? 9 : 8) * (0.7 + r() * 0.6);
    out.push({ x, y: y - 0.3, z, ry: r() * 6.28, sx: hgt * (conifer ? 0.55 : 0.95), sy: hgt, sz: hgt * (conifer ? 0.55 : 0.95), k: conifer ? 'conifer' : 'broad', c: pal[Math.floor(r() * pal.length)] });
  }
  return out;
}
// 远处的树：画好的树冠贴在十字交叉的面片上，比几何团块自然，开销也小
function impostorTex(kind) {
  const r = rng(kind === 'broad' ? 31 : 57);
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    g.strokeStyle = '#3b2f25'; g.lineCap = 'round';
    if (kind === 'broad') {
      g.lineWidth = 16; g.beginPath(); g.moveTo(256, 512); g.lineTo(254, 330); g.stroke();
      g.lineWidth = 7; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(255, 360); g.quadraticCurveTo(256 + (r() - 0.5) * 120, 280, 256 + (r() - 0.5) * 300, 150 + r() * 140); g.stroke(); }
      const blobs = [];
      for (let i = 0; i < 900; i++) {
        const a = r() * 6.283, q = Math.sqrt(r()); const x = 256 + Math.cos(a) * q * 215, y = 215 + Math.sin(a) * q * 170 * (Math.sin(a) > 0 ? 1.0 : 1.12);
        blobs.push([x, y, 8 + r() * 18]);
      }
      blobs.sort((a, b) => b[1] - a[1] + (a[0] - b[0]) * 0.3);
      for (const [x, y, rad] of blobs) {
        const nx = (x - 256) / 215, ny = (y - 215) / 180; const lit = Math.max(0, Math.min(1, 0.55 - nx * 0.28 - ny * 0.42 + (r() - 0.5) * 0.25));
        const c0 = [40 + lit * 70, 62 + lit * 85, 26 + lit * 34];
        g.fillStyle = `rgb(${c0[0] | 0},${c0[1] | 0},${c0[2] | 0})`;
        g.beginPath(); g.ellipse(x, y, rad, rad * 0.8, r() * 3, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 90; i++) { const a = r() * 6.283; const q = 0.8 + r() * 0.3; g.beginPath(); g.arc(256 + Math.cos(a) * q * 215, 215 + Math.sin(a) * q * 180, 6 + r() * 14, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    } else {
      g.lineWidth = 10; g.beginPath(); g.moveTo(256, 512); g.lineTo(256, 40); g.stroke();
      for (let t = 0; t < 1; t += 0.012) {
        const y = 470 - t * 440; const half = (1 - t) * 150 + 12;
        for (let k = 0; k < 7; k++) {
          const x = 256 + (r() - 0.5) * 2 * half; const lit = Math.max(0, Math.min(1, 0.5 - (x - 256) / half * 0.3 + t * 0.25 + (r() - 0.5) * 0.3));
          g.fillStyle = `rgb(${(26 + lit * 50) | 0},${(44 + lit * 64) | 0},${(24 + lit * 30) | 0})`;
          g.beginPath(); g.ellipse(x, y + (r() - 0.5) * 10, 10 + r() * 14, 5 + r() * 5, (r() - 0.5) * 0.6, 0, 7); g.fill();
        }
      }
    }
    void gr;
  });
}
const IMP_MATS = {};
function impostorMat(kind) {
  if (IMP_MATS[kind]) return IMP_MATS[kind];
  const m = swayMat(new THREE.MeshStandardMaterial({ map: impostorTex(kind), vertexColors: true, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85 }), 'imp' + kind, true);
  m.userData.u.uLeafGlow.value = 0.35; return (IMP_MATS[kind] = m);
}
function buildImpostors(list) {
  const g = new THREE.Group(); g.name = 'impostors';
  for (const kind of ['broad', 'conifer']) {
    const L = list.filter(it => it.k === kind); if (!L.length) continue;
    const m = impostorMat(kind);
    const geo = crossCardGeo(1, 1, 3);
    g.add(tiledInstances(geo, m, L, 320, { shadow: false }));
  }
  return g;
}
// ---------- 城中屋宇（江南合院） ----------
function houseGeos(w, d, h, rise, over) {
  const walls = new THREE.BoxGeometry(w, h + 2, d); walls.translate(0, h / 2 - 1, 0);
  // 山墙三角
  const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rise * 0.95); sh.closePath();
  const gab = new THREE.ExtrudeGeometry(sh, { depth: w - 0.02, bevelEnabled: false }); gab.rotateY(Math.PI / 2); gab.translate(-(w - 0.02) / 2, h, 0);
  const wallG = THREE.BufferGeometryUtils.mergeBufferGeometries([walls.toNonIndexed(), gab.toNonIndexed()].map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }));
  const P = { L: w + over * 0.6, S: d / 2 + over, rise, curve: 0.25, up: 0.08 }; const nx = 6, ny = 3; const pos = [], uv = [], idx = [];
  for (const s of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const [x, y, z] = roofPt(s, i / nx, j / ny, P); pos.push(x, y + h, z); uv.push(x / 1.6, j / ny * P.S / 1.6); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d2 = c + 1; if (s > 0) idx.push(a, b, c, b, d2, c); else idx.push(a, c, b, b, c, d2); }
  }
  const roof = new THREE.BufferGeometry(); roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roof.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); roof.setIndex(idx); roof.computeVertexNormals();
  const ridge = new THREE.BoxGeometry(P.L * 0.98, 0.3, 0.35); ridge.translate(0, h + rise + 0.05, 0);
  return { wall: wallG, roof, ridge };
}
function buildCityHouses() {
  const M = W.M; const r = rng(77);
  const T = [houseGeos(11, 6.5, 3.4, 2.2, 0.9), houseGeos(7.5, 4.6, 2.9, 1.6, 0.7), houseGeos(9, 5.5, 5.8, 2.0, 0.8), houseGeos(6, 4.2, 2.6, 1.4, 0.6)];
  const lists = T.map(() => []); const walls = [];
  const N = W.mobile ? 700 : 1600; let placed = 0;
  const rot = 0.12; const cs = Math.cos(rot), sn = Math.sin(rot);
  for (let gx = -860; gx <= 860 && placed < N; gx += 24) for (let gz = -860; gz <= 860 && placed < N; gz += 20) {
    const x = gx * cs - gz * sn + (r() - 0.5) * 3, z = gx * sn + gz * cs + (r() - 0.5) * 3; const d = Math.hypot(x, z);
    if (d < 120 || d > 820) continue;
    if (Math.abs(x) < 179 && Math.abs(z) < 179 && (Math.abs(x - 5) < 120 && Math.abs(z) < 85)) continue;
    let az = Math.atan2(x, -z) * 180 / Math.PI; if (az < 0) az += 360;
    const south = az > 80 && az < 230 ? 1 : az > 30 && az < 80 ? 0.55 : 0.18;
    const dens = south * smooth(820, 250, d) * (0.6 + 0.4 * vnoise(x * 0.01, z * 0.01)) * 0.8;
    if (r() > dens) continue;
    const inside = Math.abs(x) < 179 && Math.abs(z) < 179;
    const y0 = inside ? H(x, z) : farH(x, z); if (y0 > OUTER_Y + 5 || y0 < OUTER_Y - 1) continue;
    if (!inside && lakeMask(x, z) > 0.01) continue;
    if (inside && (fieldAt(x, z) || pondMask(x, z).rim > 0.05)) continue;
    let bad = false; for (const L of LANDMARKS) if (L.pos && Math.hypot(x - L.pos.x, z - L.pos.z) < 70) bad = true; if (bad) continue;
    placed++;
    const ry = rot + (r() < 0.1 ? Math.PI / 2 : 0);
    const put = (k, lx, lz, lr) => { const c = Math.cos(ry), s = Math.sin(ry); const px = x + lx * c + lz * s, pz = z - lx * s + lz * c; lists[k].push({ x: px, y: (inside ? H(px, pz) : farH(px, pz)), z: pz, ry: ry + lr, s: 0.92 + r() * 0.16, c: r() < 0.5 ? '#ffffff' : '#ece6da' }); };
    put(r() < 0.2 ? 2 : 0, 0, -5.5, 0);
    if (r() < 0.8) put(1, -6.5, 0.5, Math.PI / 2);
    if (r() < 0.8) put(1, 6.5, 0.5, -Math.PI / 2);
    if (r() < 0.7) put(3, 0, 6.8, 0);
    // 院墙
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const [lx, lz, len, lr] of [[0, 9.2, 20, 0], [-10, 0, 18, Math.PI / 2], [10, 0, 18, Math.PI / 2]]) {
      if (r() < 0.35) continue;
      const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
      walls.push({ x: px, y: (inside ? H(px, pz) : farH(px, pz)) + 0.4, z: pz, ry: ry + lr, sx: len, sy: 3.2, sz: 0.35 });
    }
  }
  const g = new THREE.Group();
  T.forEach((t, k) => {
    if (!lists[k].length) return;
    g.add(instancedFrom(t.wall, M.wall, lists[k], { shadow: true })); g.add(instancedFrom(t.roof, M.roof, lists[k], { shadow: true })); g.add(instancedFrom(t.ridge, M.ridge, lists[k], { shadow: false }));
  });
  if (walls.length) g.add(instancedFrom(new THREE.BoxGeometry(1, 1, 1), M.wall, walls, { shadow: false }));
  W.cityHouses = g; return g;
}

// ---------- 大报恩寺琉璃塔 ----------
function pagoda() {
  const g = new THREE.Group();
  const white = hook(new THREE.MeshStandardMaterial({ color: col('#f1ede2'), roughness: 0.35, emissive: col('#ffcf80'), emissiveIntensity: 0 }), 'pgW');
  const eave = hook(new THREE.MeshStandardMaterial({ color: col('#3f6a45'), roughness: 0.3 }), 'pgE');
  const gold = hook(new THREE.MeshStandardMaterial({ color: col('#c9a13f'), roughness: 0.35, metalness: 0.6 }), 'pgG');
  const red = hook(new THREE.MeshStandardMaterial({ color: col('#8c3a2a'), roughness: 0.6 }), 'pgR');
  let y = 0; let r = 7.0;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(10, 10.6, 3, 8), W.M.stone); base.position.y = 1.5; g.add(base); y = 3;
  for (let i = 0; i < 9; i++) {
    const h = 4.1 - i * 0.12;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 8), white); b.position.y = y + h / 2; b.rotation.y = Math.PI / 8; g.add(b);
    const door = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.005, r * 1.025, h * 0.5, 8, 1, true), red); door.position.y = y + h * 0.4; door.rotation.y = Math.PI / 8; door.scale.set(1, 1, 1); g.add(door);
    // 腰檐：外沿微微起翘
    const pts = []; const R0 = r * 1.45;
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new THREE.Vector2(R0 * (1 - t) + r * 0.95 * t, 1.3 * (t * 0.6 + 0.4 * t * t) + (1 - t) * (1 - t) * 0.25)); }
    const e = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 8), eave); e.position.y = y + h - 0.2; e.rotation.y = Math.PI / 8; g.add(e);
    const e2 = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 * 0.98, 0.2, 8), gold); e2.position.y = y + h - 0.1; e2.rotation.y = Math.PI / 8; g.add(e2);
    y += h + 0.9; r *= 0.9;
  }
  const sp = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7.5, 8), gold); sp.position.y = y + 3.7; g.add(sp);
  for (let k = 0; k < 5; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1 - k * 0.13, 0.18, 6, 16), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y + 1.2 + k * 1.1; g.add(ring); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.white = white;
  return g;
}

function buildDistant() {
  const root = new THREE.Group();
  for (const L of LANDMARKS) {
    const [dx, dz] = azDir(L.az); const x = dx * L.d, z = dz * L.d;
    const y = groundAt(x, z); let top = y + 6;
    if (L.kind === 'mount') top = Math.max(y, farH(x, z)) + 25;
    else if (L.kind === 'hill') top = y + 12;
    else if (L.kind === 'lake') {
      top = FARWATER_Y + 6;
      if (L.name === '莫愁湖') { const [px, pz] = polar(L.az, L.d - 100); const lh = hall({ w: 10, d: 7, h: 4, rise: 2.6, cols: 3 }); const up = hall({ w: 8, d: 5.5, h: 3.2, rise: 2.4, cols: 3 }); up.position.y = 4.6; lh.add(up); lh.position.set(px, farH(px, pz), pz); lh.rotation.y = Math.atan2(-px, -pz); lh.scale.setScalar(1.6); root.add(lh); }
    }
    else if (L.kind === 'temple') {
      const tg = new THREE.Group();
      const a = hall({ w: 12, d: 8, h: 4, rise: 2.8, cols: 5 }); tg.add(a);
      const b = hall({ w: 9, d: 6, h: 3.4, rise: 2.3, cols: 3 }); b.position.set(0, 0, -14); tg.add(b);
      const c = hall({ w: 7, d: 5, h: 3.0, rise: 2.0, cols: 3 }); c.position.set(0, 0, 11); tg.add(c);
      tg.position.set(x, y, z); tg.rotation.y = Math.atan2(-x, -z); tg.scale.setScalar(2.0); root.add(tg); top = y + 22;
      // 鸡鸣寺的黄墙
      if (L.name === '鸡鸣寺') tg.traverse(o => { if (o.isMesh && o.material === W.M.wall) o.material = W.M.wallY; });
    } else if (L.kind === 'pagoda') {
      const t = pagoda(); t.position.set(x, y, z); t.scale.setScalar(1.8); root.add(t); W.pagoda = t; top = y + 108;
      const hl = hall({ w: 14, d: 9, h: 4.5, rise: 3.2, cols: 5 }); hl.position.set(x + 4, y, z - 26); hl.rotation.y = Math.atan2(-x, -z); root.add(hl);
    }
    L.pos = new THREE.Vector3(x, top, z);
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return root;
}
