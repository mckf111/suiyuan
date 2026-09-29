// ============ 装配：渲染器、光照、一日天色、粒子 ============
// 一日之中的天色（线性色彩，未经色调映射）
const DAY = [
  { t: 0.0, el: 13, az: 100, sun: [1.0, 0.83, 0.64], si: 2.6, top: [0.12, 0.3, 0.72], hor: [0.62, 0.72, 0.84], haze: [0.62, 0.7, 0.8], hsun: [1.0, 0.84, 0.66], cloud: [1.15, 1.02, 0.92], fog: 0.0016, mist: 0.55, amb: 0.9 },
  { t: 0.45, el: 52, az: 160, sun: [1.0, 0.96, 0.9], si: 3.1, top: [0.08, 0.26, 0.72], hor: [0.55, 0.68, 0.86], haze: [0.56, 0.66, 0.82], hsun: [0.95, 0.9, 0.8], cloud: [1.25, 1.24, 1.2], fog: 0.0009, mist: 0.15, amb: 1.0 },
  { t: 0.84, el: 11, az: 246, sun: [1.0, 0.7, 0.42], si: 2.7, top: [0.2, 0.3, 0.55], hor: [0.9, 0.72, 0.55], haze: [0.8, 0.7, 0.6], hsun: [1.0, 0.68, 0.4], cloud: [1.25, 0.9, 0.7], fog: 0.0013, mist: 0.3, amb: 0.8 },
  { t: 1.0, el: 1.5, az: 262, sun: [1.0, 0.45, 0.25], si: 1.0, top: [0.08, 0.1, 0.2], hor: [0.62, 0.38, 0.3], haze: [0.36, 0.3, 0.32], hsun: [0.95, 0.5, 0.3], cloud: [0.7, 0.42, 0.36], fog: 0.004, mist: 0.9, amb: 0.45 }
];
// 尾声：记忆里褪了色的园子
const MEMORY = { el: 38, az: 150, sun: [1.0, 0.94, 0.84], si: 2.4, top: [0.5, 0.5, 0.5], hor: [0.8, 0.77, 0.7], haze: [0.8, 0.77, 0.7], hsun: [0.95, 0.9, 0.8], cloud: [1.1, 1.08, 1.02], fog: 0.0035, mist: 1.2, amb: 1.0 };
const _v3 = new THREE.Vector3();
function lerpArr(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
function dayAt(t, mem) {
  let i = 0; while (i < DAY.length - 2 && t > DAY[i + 1].t) i++;
  const a = DAY[i], b = DAY[i + 1]; const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const o = {};
  for (const key in a) o[key] = Array.isArray(a[key]) ? lerpArr(a[key], b[key], k) : a[key] + (b[key] - a[key]) * k;
  if (mem > 0) for (const key in MEMORY) o[key] = Array.isArray(MEMORY[key]) ? lerpArr(o[key], MEMORY[key], mem) : o[key] + (MEMORY[key] - o[key]) * mem;
  return o;
}
let envStamp = -1;
function setDaylight(tod, mem) {
  const d = dayAt(tod, mem);
  const el = d.el * Math.PI / 180, az = d.az * Math.PI / 180;
  const sd = U.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  const vis = smooth(-1, 6, d.el);
  U.uSunCol.value.set(...d.sun).multiplyScalar(d.si);
  U.uSkyTop.value.set(...d.top); U.uSkyHor.value.set(...d.hor); U.uHazeCol.value.set(...d.haze); U.uHazeSun.value.set(...d.hsun); U.uCloudCol.value.set(...d.cloud);
  U.uFog.value.x = d.fog * (W.lmClear ? 0.5 : 1); U.uFog.value.w = 0.00016 * (W.lmClear ? 0.45 : 1); U.uMem.value = mem; U.uMist.value = d.mist; U.uSunVis.value = vis;
  U.uNight.value = smooth(0.86, 1.0, tod) * (1 - mem);
  W.sun.color.setRGB(...d.sun); W.sun.intensity = d.si * vis;
  W.hemi.color.setRGB(...lerpArr(d.top, d.hor, 0.5)); W.hemi.groundColor.setRGB(0.32, 0.3, 0.22); W.hemi.intensity = 0.55 * d.amb;
  W.scene.environmentIntensity = 0.55 * d.amb;
  W.sunDir = sd;
  // 天色变化够大时重算环境光
  const stamp = Math.round(tod * 10) + (mem > 0.5 ? 100 : 0);
  if (stamp !== envStamp && W.pmrem && (W.envFree || envStamp < 0)) {
    W.envFree = false;
    envStamp = stamp;
    if (W.envRT) W.envRT.dispose();
    W.envRT = W.pmrem.fromScene(W.envScene, 0.02, 0.1, 100, { size: 128 }); W.scene.environment = W.envRT.texture;
  }
}
// 阴影跟着镜头走，只照亮眼前一块，清晰度更高
function updateShadowCam() {
  const c = W.camera; const s = W.sun;
  c.getWorldDirection(_v3);
  const h = Math.max(1, c.position.y - groundAt(c.position.x, c.position.z));
  const span = Math.min(170, Math.max(34, h * 1.4 + 26));
  const f = c.position.clone().addScaledVector(_v3.setY(0).normalize(), span * 0.55);
  f.y = groundAt(f.x, f.z);
  const sc = s.shadow.camera; sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 600; sc.updateProjectionMatrix();
  // 按阴影贴图像素对齐，避免走动时阴影边缘闪烁
  const texel = span * 2 / s.shadow.mapSize.x;
  f.x = Math.round(f.x / texel) * texel; f.z = Math.round(f.z / texel) * texel;
  s.target.position.copy(f); s.position.copy(f).addScaledVector(W.sunDir || U.uSunDir.value, 300);
  s.target.updateMatrixWorld();
}

// ---------- 粒子：落梅、炊烟、燕子 ----------
function buildParticles(C) {
  const n = W.mobile ? 160 : 320;
  const pg = new THREE.PlaneGeometry(0.07, 0.08);
  const pm = hook(new THREE.MeshStandardMaterial({ map: C.petal, color: col('#fbf3f1'), side: THREE.DoubleSide, alphaTest: 0.4, roughness: 0.7 }), 'petal');
  const im = new THREE.InstancedMesh(pg, pm, n); im.frustumCulled = false;
  const P = [];
  for (let i = 0; i < n; i++) { const x = rr(PLUM_ZONE.x0, PLUM_ZONE.x1), z = rr(PLUM_ZONE.z0, PLUM_ZONE.z1); P.push({ x, y: H(x, z) + rr(0, 4), z, v: rr(0.25, 0.5), a: R() * 6, b: R() * 6, w: rr(1.5, 4) }); }
  W.petals = { im, P }; W.gardenVeg.add(im);
  const sm = []; const smM = hook(new THREE.SpriteMaterial({ map: C.soft, color: col('#dcd8d0'), transparent: true, opacity: 0.35, depthWrite: false }), 'smoke');
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(smM.clone()); hook(s.material, 'smoke'); s.userData.t = i / 16; W.garden.add(s); sm.push(s); }
  W.smoke = sm;
  const bm = hook(new THREE.MeshStandardMaterial({ color: col('#222024'), side: THREE.DoubleSide, roughness: 0.6 }), 'bird');
  W.birds = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    for (const s of [-1, 1]) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, s * 0.55, 0, -0.18], 3)); wg.computeVertexNormals(); const w = new THREE.Mesh(wg, bm); b.add(w); b.userData[s] = w; }
    const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.1, -0.12, 0, -0.45, 0.12, 0, -0.45], 3)); tail.computeVertexNormals(); b.add(new THREE.Mesh(tail, bm));
    b.userData.p = { cx: rr(-25, 20), cz: rr(-5, 20), r: rr(8, 16), h: rr(4, 9), sp: rr(0.5, 0.9) * (R() < 0.5 ? 1 : -1), ph: R() * 6 };
    b.scale.setScalar(1.1); W.garden.add(b); W.birds.push(b);
  }
}
const _po = new THREE.Object3D();
function updateParticles(dt, time) {
  U.uTime.value = time;
  if (W.petals) {
    const { im, P } = W.petals;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.y -= p.v * dt; p.x += (Math.sin(time * 1.3 + i) * 0.4 + U.uWind.value.x * 0.5) * dt; p.z += (Math.cos(time * 0.9 + i * 0.7) * 0.3 + U.uWind.value.y * 0.5) * dt;
      p.a += dt * p.w; p.b += dt * p.w * 0.7;
      if (p.y < H(p.x, p.z) + 0.03) { p.x = rr(PLUM_ZONE.x0, PLUM_ZONE.x1); p.z = rr(PLUM_ZONE.z0, PLUM_ZONE.z1); p.y = H(p.x, p.z) + rr(2.5, 4.5); }
      _po.position.set(p.x, p.y, p.z); _po.rotation.set(p.a, p.b, p.a * 0.5); _po.updateMatrix(); im.setMatrixAt(i, _po.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  }
  if (W.smoke) for (const s of W.smoke) {
    const u = s.userData; u.t = (u.t + dt * 0.08) % 1; const t = u.t;
    s.position.set(W.chimney.x + Math.sin(t * 5 + time * 0.3) * 0.6 * t + t * 2.5, W.chimney.y + t * 9, W.chimney.z - t * 1.2);
    s.scale.setScalar(0.8 + t * 3.2); s.material.opacity = (1 - t) * 0.3 * W.smokeLevel;
  }
  for (const b of W.birds || []) {
    const p = b.userData.p; const a = time * p.sp + p.ph;
    b.position.set(p.cx + Math.cos(a) * p.r, WATER_Y + p.h + Math.sin(a * 2) * 1.2, p.cz + Math.sin(a) * p.r);
    b.rotation.y = -a + (p.sp > 0 ? Math.PI : 0);
    const f = Math.sin(time * 14 + p.ph) * 0.6; b.userData[-1].rotation.z = f; b.userData[1].rotation.z = -f;
    b.visible = W.birdsOn;
  }
  // 风：时强时弱
  U.uWind.value.z = 0.7 + 0.3 * Math.sin(time * 0.13) + 0.15 * Math.sin(time * 0.37);
  if (W.sky) W.sky.position.copy(W.camera.position);
  updateLod(W.camera.position);
  // 阴影隔帧更新一次，省一半开销
  W.shadowTick = (W.shadowTick || 0) + 1; if (W.shadowTick % 2 === 0 || W.shadowForce) { W.renderer.shadowMap.needsUpdate = true; W.shadowForce = false; }
  updateShadowCam();
}

// 所有材质都接上共享的天色与雾
function ensureHooked(root) {
  root.traverse(o => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (!m.userData.hooked && !m.isShaderMaterial) hook(m, 'auto');
  });
}

async function initWorld(canvas, onProgress) {
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600 || matchMedia('(pointer:coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  patchAtmosphere();
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xffffff, 1, 2);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 4200);
  W.renderer = renderer; W.scene = scene; W.camera = camera; W.mobile = mobile;
  W.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  W.lanternMeshes = []; W.smokeLevel = 1; W.birdsOn = true;
  const P = await loadTextures(p => onProgress && onProgress(p * 0.8));
  const C = makeCanvasTextures(); W.T = C;
  W.M = makeMaterials(P, C); W.FM = makeFloraMaterials(P, C);
  const step = async (p) => { onProgress && onProgress(p); await new Promise(r => setTimeout(r, 0)); };
  setupFar();
  buildPathSegs(); buildFields();
  FLATS.forEach(f => { f.y = baseH(f.x, f.z); if (f.id === 'xiting') f.y = WATER_Y + 0.35; });
  { const N = 512, a = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) a[j * N + i] = H(-180 + (i + 0.5) / N * 360, -180 + (j + 0.5) / N * 360);
    const ht = new THREE.DataTexture(a, N, N, THREE.RedFormat, THREE.FloatType); ht.minFilter = ht.magFilter = THREE.NearestFilter; ht.needsUpdate = true; U.tHeight.value = ht; }
  W.garden = new THREE.Group(); scene.add(W.garden);
  W.gardenVeg = new THREE.Group(); W.garden.add(W.gardenVeg);
  W.vegRoot = new THREE.Group(); scene.add(W.vegRoot);
  W.buildRoot = new THREE.Group(); scene.add(W.buildRoot);
  scene.add(buildSky());
  scene.add(buildTerrain(P)); await step(0.83);
  scene.add(buildFarLand(P)); scene.add(buildFarWater());
  scene.add(buildWater(C));
  buildGarden(); await step(0.86);
  scene.add(buildDistant());
  scene.add(buildCityHouses());
  W.impostors = buildImpostors(scatterFarTrees()); scene.add(W.impostors); scene.add(buildTomb()); await step(0.9);
  buildPlants(); await step(0.95);
  mergeBuildings(); applyGroundAO();
  buildParticles(C);
  // 灯光
  const hemi = new THREE.HemisphereLight(0xbcd0e8, 0x4d4a38, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 3);
  sun.castShadow = true; const sm = mobile ? 1536 : 2048; sun.shadow.mapSize.set(sm, sm);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2;
  scene.add(sun); scene.add(sun.target);
  W.hemi = hemi; W.sun = sun;
  // 人物
  W.yuan = figure({ robe: '#56697a', jacket: '#3a3b40', beard: 1, cane: 1 });
  W.tong = figure({ robe: '#667f64', jacket: null, scale: 0.74, beard: 0, cane: 0, sash: '#3d4a3a' });
  const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.18), W.M.wood); boxM.position.set(0, -0.62, 0.12); boxM.castShadow = true; W.tong.userData.arms[1].add(boxM); W.tong.userData.box = boxM;
  const lan = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), W.M.lantern); lan.scale.y = 1.3; lan.position.set(0, -0.95, 0.1); lan.visible = false; W.tong.userData.arms[0].add(lan); W.tong.userData.lantern = lan;
  const pl = new THREE.PointLight(0xffa860, 0, 16, 1.6); pl.position.set(0, -0.9, 0.2); W.tong.userData.arms[0].add(pl); W.tongLight = pl;
  W.garden.add(W.yuan); W.garden.add(W.tong);
  ensureHooked(scene);
  W.pmrem = new THREE.PMREMGenerator(renderer);
  setDaylight(0, 0);
  await step(1);
  return W;
}
