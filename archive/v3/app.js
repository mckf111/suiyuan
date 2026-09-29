// ============ 交互与导览 ============
const $ = s => document.querySelector(s);
const UI = {
  dlg: $('#dlg'), who: $('#dlg-who'), text: $('#dlg-text'), meta: $('#dlg-meta'), choices: $('#dlg-choices'), more: $('#dlg-more'),
  notes: $('#notes'), notesBody: $('#notes-body'), route: $('#route'), routeList: $('#route-list'),
  walk: $('#walk'), walkTo: $('#walk-to'), prog: $('#prog'), labels: $('#labels'), intro: $('#intro'), enter: $('#enter'),
  epi: $('#epi'), end: $('#end'), sky: $('#sky'), toast: $('#toast'),
  bNotes: $('#b-notes'), bRoute: $('#b-route'), bFree: $('#b-free'), bMusic: $('#b-music'), bVoice: $('#b-voice'), bAuto: $('#b-auto'), replay: $('#b-replay')
};
// 配音开关：关闭时页面不加载任何音频，也不显示“声”“重听”按钮
const VOICE_ENABLED = false;
const WHO = { yuan: '袁枚', tong: '书童', ke: '你', pang: '旁白' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const G = {
  state: 'intro', si: 0, queue: [], qi: 0, asked: new Set(), phase: 'lines', typing: null,
  walk: null, tween: null, tod: 0, todTarget: 0, memory: 0, memoryTarget: 0,
  visited: new Set(), free: false, stage: 0, epiStep: -1, voiceOn: VOICE_ENABLED, auto: VOICE_ENABLED, curLine: null,
  fx: { build: 1, lines: 0.4, veg: 1, field: 0, water: 1, city: 0, pagoda: 1, figs: 1 },
  fxT: { build: 1, lines: 0.4, veg: 1, field: 0, water: 1, city: 0, pagoda: 1, figs: 1 },
  lastField: 0
};

// ---------- 调色：一日光影 ----------
const PAL = [
  { t: 0.0, top: '#c4cdc5', hor: '#eae1cb', sun: '#fff0d4', si: 0.95, el: 18, az: 105, hs: '#eee6d4', hg: '#8d8567', hi: 0.72, far: 520 },
  { t: 0.45, top: '#b9cac7', hor: '#efe7d2', sun: '#fff7e8', si: 1.05, el: 55, az: 165, hs: '#f0e9d8', hg: '#8d8567', hi: 0.78, far: 540 },
  { t: 0.84, top: '#bdb49c', hor: '#eed09e', sun: '#ffd49a', si: 0.95, el: 13, az: 245, hs: '#f0dcc0', hg: '#86795c', hi: 0.62, far: 520 },
  { t: 1.0, top: '#58607a', hor: '#c99a78', sun: '#e79a66', si: 0.32, el: 4, az: 262, hs: '#8c8aa0', hg: '#4f4a44', hi: 0.44, far: 380 }
];
const MEM = { top: '#cfc8b6', hor: '#e6ddc8', sun: '#fff4e2', si: 0.85, el: 42, az: 150, hs: '#efe8d8', hg: '#8d8567', hi: 0.8, far: 560 };
const cA = new THREE.Color(), cB = new THREE.Color();
function mixHex(a, b, t) { cA.set(a); cB.set(b); return cA.lerp(cB, t).clone(); }
function palette(t) {
  let i = 0; while (i < PAL.length - 2 && t > PAL[i + 1].t) i++;
  const a = PAL[i], b = PAL[i + 1]; const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const o = {};
  for (const key of ['top', 'hor', 'sun', 'hs', 'hg']) o[key] = mixHex(a[key], b[key], k);
  for (const key of ['si', 'el', 'az', 'hi', 'far']) o[key] = lerp(a[key], b[key], k);
  if (G.memory > 0) {
    const m = G.memory;
    for (const key of ['top', 'hor', 'sun', 'hs', 'hg']) o[key].lerp(cB.set(MEM[key]), m);
    for (const key of ['si', 'el', 'az', 'hi', 'far']) o[key] = lerp(o[key], MEM[key], m);
  }
  return o;
}
function applyPalette() {
  const p = palette(G.tod);
  W.scene.fog.color.copy(p.hor); W.scene.fog.far = p.far;
  UI.sky.style.background = `linear-gradient(to bottom, #${p.top.getHexString()} 0%, #${p.hor.getHexString()} 58%, #${p.hor.getHexString()} 100%)`;
  const el = p.el * Math.PI / 180, az = p.az * Math.PI / 180;
  W.sun.position.set(Math.sin(az) * Math.cos(el) * 220, Math.sin(el) * 220, -Math.cos(az) * Math.cos(el) * 220);
  W.sun.color.copy(p.sun); W.sun.intensity = p.si;
  W.hemi.color.copy(p.hs); W.hemi.groundColor.copy(p.hg); W.hemi.intensity = p.hi;
  W.mountRing.material.color.set('#ffffff').lerp(p.hor, 0.35);
  const night = smooth(0.86, 1.0, G.tod) * (1 - G.memory);
  W.M.lantern.emissiveIntensity = night * 1.8;
  W.tongLight.intensity = night * 1.4;
  W.tong.userData.lantern.visible = night > 0.05; W.tong.userData.box.visible = night <= 0.05;
  W.birdsOn = G.tod < 0.9 && G.fx.veg > 0.5;
  if (G.state === 'talk' || G.state === 'walk') Sound.setBirds(G.tod < 0.8 ? 1 : G.tod < 0.92 ? 0.3 : 0);
}

// ---------- 镜头 ----------
let controls;
const tmpV = new THREE.Vector3();
function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
function stationView(id) {
  const s = SPOTS[id];
  if (s.high) { return { pos: new THREE.Vector3(s.cam[0], W.nanlouUpper + 1.62, s.cam[1]), target: v3(s.look) }; }
  const pos = new THREE.Vector3(s.cam[0], walkY(s.cam[0], s.cam[1]) + 1.65, s.cam[1]);
  const target = new THREE.Vector3(s.look[0], H(s.look[0], s.look[2]) + s.look[1], s.look[2]);
  return { pos, target };
}
function tweenTo(pos, target, dur = 1.6, done) {
  G.tween = { p0: W.camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), k: 0, dur: reduceMotion ? 0.01 : dur, done };
  controls.enabled = false;
}
function stepTween(dt) {
  const tw = G.tween; if (!tw) return;
  tw.k = Math.min(1, tw.k + dt / tw.dur); const e = tw.k < 0.5 ? 2 * tw.k * tw.k : 1 - Math.pow(-2 * tw.k + 2, 2) / 2;
  W.camera.position.lerpVectors(tw.p0, tw.p1, e); controls.target.lerpVectors(tw.t0, tw.t1, e); W.camera.lookAt(controls.target);
  if (tw.k >= 1) { G.tween = null; controls.enabled = true; if (tw.done) tw.done(); }
}
function setTourControls() {
  controls.enablePan = false; controls.minDistance = 1.5; controls.maxDistance = 45; controls.maxPolarAngle = Math.PI * 0.56; controls.rotateSpeed = 0.5;
}
function setFreeControls() {
  controls.enablePan = true; controls.minDistance = 8; controls.maxDistance = 330; controls.maxPolarAngle = Math.PI * 0.47; controls.rotateSpeed = 0.6;
}

// ---------- 人物站位 ----------
function standAt(id, faceCam = true) {
  const s = SPOTS[id]; const [x, z] = s.P;
  const y = s.high ? W.nanlouUpper : walkY(x, z);
  W.yuan.position.set(x, y, z);
  const view = stationView(id);
  const face = faceCam ? view.pos : view.target;
  W.yuan.rotation.y = Math.atan2(face.x - x, face.z - z);
  // 书童站在一侧
  const side = new THREE.Vector3(face.x - x, 0, face.z - z).normalize();
  const px = x - side.z * 1.25 - side.x * 0.6, pz = z + side.x * 1.25 - side.z * 0.6;
  W.tong.position.set(px, s.high ? W.nanlouUpper : walkY(px, pz), pz);
  W.tong.rotation.y = Math.atan2(face.x - px, face.z - pz);
}
function turnYuanTo(p) { W.yuan.rotation.y = Math.atan2(p.x - W.yuan.position.x, p.z - W.yuan.position.z); }

// ---------- 对白与配音 ----------
function chip(tag) { const T = TAGS[tag]; return T ? `<span class="chip chip-${tag}" title="${T.desc}">${T.name}</span>` : ''; }
function srcText(key) { const s = SRC[key]; return s ? s.t : ''; }
let lineTok = 0, autoT = null;
function clearAuto() { clearTimeout(autoT); autoT = null; }
function readTime(t) { return Math.max(2.6, t.length * 0.2); }
function showLine(L) {
  clearAuto();
  UI.dlg.hidden = false; UI.choices.innerHTML = ''; UI.choices.hidden = true;
  UI.who.textContent = WHO[L.who] || ''; UI.who.dataset.who = L.who;
  const txt = L.q ? `「${L.t}」` : L.t;
  UI.text.classList.toggle('quote', !!L.q);
  UI.meta.innerHTML = `${chip(L.tag)}${L.src ? `<span class="src">${srcText(L.src)}</span>` : ''}`;
  UI.more.hidden = false; UI.replay.hidden = !VOICE_ENABLED || !L.v || !G.voiceOn;
  G.curLine = L; typeText(txt);
  if (L.look) lookFor(L.look);
  if (L.who === 'yuan' && !L.look) turnYuanTo(W.camera.position);
  const tok = ++lineTok;
  const done = () => { if (tok !== lineTok) return; scheduleAuto(tok, 0.9); };
  if (G.voiceOn && L.v) Sound.say(L.v, done, 400);
  else scheduleAuto(tok, readTime(L.t));
}
function scheduleAuto(tok, sec) {
  clearAuto(); if (!G.auto) return;
  autoT = setTimeout(() => {
    if (tok !== lineTok || G.state !== 'talk' || G.free) return;
    if (G.phase === 'ask' || G.phase === 'done') return;
    finishTyping(); nextLine();
  }, sec * 1000);
}
function replayLine() { const L = G.curLine; if (!L || !L.v) return; const tok = ++lineTok; clearAuto(); Sound.say(L.v, () => { if (tok === lineTok) scheduleAuto(tok, 0.9); }, 0); }
function typeText(t) {
  if (G.typing) clearInterval(G.typing.id);
  if (reduceMotion) { UI.text.textContent = t; G.typing = null; return; }
  let i = 0; UI.text.textContent = '';
  const id = setInterval(() => { i += 1; UI.text.textContent = t.slice(0, i); if (i >= t.length) { clearInterval(id); G.typing = null; } }, 34);
  G.typing = { id, t };
}
function finishTyping() { if (G.typing) { clearInterval(G.typing.id); UI.text.textContent = G.typing.t; G.typing = null; return true; } return false; }

function lookFor(look) {
  const st = STATIONS[G.si]; const view = stationView(st.id);
  if (look.garden) { tweenTo(view.pos, view.target, 1.6); showLandmarks(false); return; }
  const a = look.az * Math.PI / 180; const dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
  const L = LANDMARKS.find(l => l.az === look.az);
  const tgt = L ? L.pos.clone().setY(L.pos.y * 0.5) : view.pos.clone().add(dir.multiplyScalar(80));
  const tgtClose = view.pos.clone().add(tgt.clone().sub(view.pos).normalize().multiplyScalar(30));
  tweenTo(view.pos, tgtClose, 1.8); showLandmarks(true, look.az);
}
function stationKeys(st) {
  const k = []; st.lines.forEach(L => k.push(L.v)); (st.ask || []).forEach(a => { k.push(a.v); a.a.forEach(L => k.push(L.v)); }); (st.outro || []).forEach(L => k.push(L.v)); return k;
}
function startStation(i) {
  G.si = i; const st = STATIONS[i]; G.visited.add(i); G.walk = null; UI.walk.hidden = true;
  G.state = 'talk'; G.asked = new Set(); G.phase = 'lines'; G.queue = st.lines.slice(); G.qi = 0;
  G.todTarget = st.time; Sound.setMode(st.mode, st.id === 'nanlou' ? 1.4 : st.id === 'mubie' ? 0.6 : 1);
  W.yuan.userData.pose.lean = 0; W.yuan.userData.pose.look = 0; W.tong.userData.pose.lean = 0; W.tong.userData.pose.look = 0;
  standAt(st.id);
  const v = stationView(st.id);
  tweenTo(v.pos, v.target, 1.8, () => {});
  updateProg(); renderRoute(); if (!UI.notes.hidden) renderNotes(i);
  showLandmarks(false);
  if (VOICE_ENABLED) Sound.preload(stationKeys(st)); if (VOICE_ENABLED && STATIONS[i + 1]) setTimeout(() => Sound.preload(stationKeys(STATIONS[i + 1])), 3000);
  nextLine();
}
function nextLine() {
  if (G.qi < G.queue.length) { showLine(G.queue[G.qi++]); return; }
  const st = STATIONS[G.si];
  if (G.phase === 'lines' || G.phase === 'answer') {
    if (st.ask && G.asked.size < st.ask.length) { G.phase = 'ask'; showChoices(); return; }
    if (st.outro && G.phase !== 'outro') { G.phase = 'outro'; G.queue = st.outro.slice(); G.qi = 0; nextLine(); return; }
  } else if (G.phase === 'ask') { return; }
  showGo();
}
function showChoices() {
  const st = STATIONS[G.si]; UI.more.hidden = true; UI.choices.hidden = false; UI.choices.innerHTML = ''; clearAuto();
  st.ask.forEach((a, k) => {
    const b = document.createElement('button'); b.className = 'choice'; b.type = 'button';
    b.innerHTML = `<span class="ck">问</span>${a.q}`; b.disabled = G.asked.has(k);
    b.onclick = e => { e.stopPropagation(); G.asked.add(k); G.phase = 'answer'; G.queue = [{ who: 'ke', t: a.q, tag: 'xu', v: a.v }, ...a.a]; G.qi = 0; nextLine(); };
    UI.choices.appendChild(b);
  });
  const go = document.createElement('button'); go.className = 'choice ghost'; go.type = 'button';
  go.textContent = '不问了，接着走';
  go.onclick = e => { e.stopPropagation(); G.asked = new Set(st.ask.map((_, k) => k)); G.phase = 'answer'; nextLine(); };
  UI.choices.appendChild(go);
  const f = UI.choices.querySelector('button:not(:disabled)'); if (f && !W.mobile) f.focus({ preventScroll: true });
}
function showGo() {
  G.phase = 'done'; UI.more.hidden = true; UI.choices.hidden = false; UI.choices.innerHTML = '';
  const last = G.si === STATIONS.length - 1;
  const b = document.createElement('button'); b.className = 'choice go'; b.type = 'button';
  b.innerHTML = last ? '尾声 · 随园之后' : `随袁枚往 <b>${STATIONS[G.si + 1].name}</b>`;
  const go = () => { clearAuto(); last ? startEpilogue() : startWalk(G.si); };
  b.onclick = e => { e.stopPropagation(); go(); };
  UI.choices.appendChild(b);
  if (!W.mobile) b.focus({ preventScroll: true });
  // 自动模式：等这句话说完，再停三秒，自己往前走
  if (G.auto) {
    const si = G.si;
    const wait = () => { if (G.state !== 'talk' || G.si !== si || G.phase !== 'done' || G.free || !G.auto) return; if (Sound.speaking()) { autoT = setTimeout(wait, 500); return; } autoT = setTimeout(() => { if (G.state === 'talk' && G.si === si && G.phase === 'done' && !G.free && G.auto) go(); }, 3000); };
    autoT = setTimeout(wait, 600);
  }
}
// 点击：第一下补全文字（声音照常），第二下淡出声音、进入下一句
function advance() {
  if (G.state !== 'talk') return;
  if (finishTyping()) return;
  if (G.phase === 'ask' || G.phase === 'done') return;
  clearAuto(); Sound.hush(0.3);
  nextLine();
}

// ---------- 行走（折线路径，楼梯逐级） ----------
function buildWalkPath(pts) {
  const P = pts.map(p => ({ x: p[0], z: p[1], tag: p[2] || null }));
  const seg = []; let L = 0;
  const isUp = t => t === 'up' || t === 'st';
  for (let k = 0; k < P.length - 1; k++) {
    const a = P[k], b = P[k + 1]; const len = Math.hypot(b.x - a.x, b.z - a.z); if (len < 1e-3) continue;
    const stair = (a.tag === 'sb' && b.tag === 'st') || (a.tag === 'st' && b.tag === 'sb');
    seg.push({ a, b, len, s0: L, stair, up: !stair && isUp(a.tag) && isUp(b.tag), dir: stair ? (b.tag === 'st' ? 1 : -1) : 0 });
    L += len;
  }
  return { seg, L };
}
function pathAt(path, s) {
  s = Math.max(0, Math.min(path.L, s));
  let sg = path.seg[path.seg.length - 1];
  for (const q of path.seg) if (s <= q.s0 + q.len) { sg = q; break; }
  const t = (s - sg.s0) / sg.len; const x = lerp(sg.a.x, sg.b.x, t), z = lerp(sg.a.z, sg.b.z, t);
  const y = sg.stair ? stairY(z) : sg.up ? W.nanlouUpper : walkY(x, z);
  return { x, y, z, dx: (sg.b.x - sg.a.x) / sg.len, dz: (sg.b.z - sg.a.z) / sg.len, sg, t };
}
function yawTo(obj, dx, dz, k) {
  const tgt = Math.atan2(dx, dz); let d = tgt - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * k;
}
function startWalk(i) {
  Sound.hush(0.6); clearAuto();
  const path = buildWalkPath(routePts(i));
  G.walk = { i, path, s: 0, t: 0 };
  G.state = 'walk'; UI.dlg.hidden = true; UI.walk.hidden = false; UI.walkTo.textContent = STATIONS[i + 1].name;
  controls.enabled = false; G.tween = null; showLandmarks(false);
  G.todTarget = lerp(STATIONS[i].time, STATIONS[i + 1].time, 0.5);
}
function poseFor(fig, p) {
  const u = fig.userData.pose;
  if (p.sg.stair) { if (p.sg.dir > 0) { u.lean = 0.14; u.look = 0.12; } else { u.lean = -0.06; u.look = 0.32; } }
  else { u.lean = 0.03; u.look = 0; }
}
function stepWalk(dt) {
  const w = G.walk; if (!w) return;
  w.t += dt;
  const here = pathAt(w.path, w.s);
  let v = here.sg.stair ? 0.62 : 3.2;
  v *= Math.min(1, 0.25 + w.t / 1.0);                       // 起步
  v *= Math.min(1, 0.2 + (w.path.L - w.s) / 2.5);            // 收步
  if (reduceMotion) v = 6;
  w.s = Math.min(w.path.L, w.s + v * dt); w.speed = v;
  const p = pathAt(w.path, w.s);
  W.yuan.position.set(p.x, p.y, p.z); yawTo(W.yuan, p.dx, p.dz, 1 - Math.exp(-dt * 7)); poseFor(W.yuan, p);
  const pb = pathAt(w.path, w.s - 1.8);
  W.tong.position.set(pb.x - pb.dz * 0.55, pb.y, pb.z + pb.dx * 0.55); yawTo(W.tong, pb.dx, pb.dz, 1 - Math.exp(-dt * 7)); poseFor(W.tong, pb);
  const pc = pathAt(w.path, w.s - 5.0);
  const want = new THREE.Vector3(pc.x + pc.dz * 0.9, pc.y + 1.9, pc.z - pc.dx * 0.9);
  const k = 1 - Math.exp(-dt * 3.2);
  W.camera.position.lerp(want, k);
  const look = new THREE.Vector3(p.x + p.dx * 5, p.y + 1.3, p.z + p.dz * 5);
  controls.target.lerp(look, k); W.camera.lookAt(controls.target);
  if (w.s >= w.path.L - 1e-3) endWalk();
}
// 楼梯上的步相：每上一级迈一步
function stairPhase(fig) { const p = fig.position; if (Math.abs(p.x - STAIR.x) > STAIR.w || p.z < STAIR.z0 - 0.3 || p.z > STAIR.z1 + 0.3 || p.y < W.stairY0 + 0.05) return null; return (p.z - STAIR.z0) / (STAIR.z1 - STAIR.z0) * STAIR.n * Math.PI; }
function endWalk() { const i = G.walk.i; G.walk = null; UI.walk.hidden = true; startStation(i + 1); }

// ---------- 地标标签（南楼） ----------
let lmEls = [];
function showLandmarks(on, az) { lmEls.forEach(o => { o.el.hidden = !on; o.el.classList.toggle('hot', on && o.L.az === az); }); }

// ---------- 标签 ----------
let labelEls = {};
function buildLabels() {
  for (const st of STATIONS) {
    if (!W.labelAt[st.id]) continue;
    const b = document.createElement('div'); b.className = 'lbl'; b.setAttribute('role', 'button'); b.tabIndex = -1; b.textContent = st.name.replace(/ · /g, '');
    b.onclick = () => { if (G.free) flyToStation(STATIONS.indexOf(st)); };
    b.onkeydown = e => { if (e.key === 'Enter' && G.free) flyToStation(STATIONS.indexOf(st)); };
    UI.labels.appendChild(b); labelEls[st.id] = b;
  }
  lmEls = LANDMARKS.map(L => { const s = document.createElement('span'); s.className = 'lm'; s.textContent = L.name; s.hidden = true; UI.labels.appendChild(s); return { el: s, L }; });
}
function updateLabels() {
  const w = window.innerWidth, h = window.innerHeight;
  const show = G.state !== 'intro' && G.state !== 'epi' && G.state !== 'end';
  for (const id in labelEls) {
    const el = labelEls[id]; const p = W.labelAt[id];
    const cur = STATIONS[G.si] && STATIONS[G.si].id === id;
    const dist = W.camera.position.distanceTo(p);
    const vis = show && G.free; void dist;
    if (!vis) { el.hidden = true; continue; }
    tmpV.copy(p).project(W.camera);
    if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) { el.hidden = true; continue; }
    el.hidden = false; el.tabIndex = G.free ? 0 : -1; el.classList.toggle('cur', cur); el.classList.toggle('seen', G.visited.has(STATIONS.findIndex(s => s.id === id)));
    el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  }
  for (const o of lmEls) {
    if (o.el.hidden) continue;
    tmpV.copy(o.L.pos).project(W.camera);
    if (tmpV.z > 1) { o.el.style.opacity = 0; continue; }
    o.el.style.opacity = 1;
    o.el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  }
}

// ---------- 自由漫游 ----------
function toggleFree(force) {
  const on = force !== undefined ? force : !G.free;
  if (G.state === 'epi' || G.state === 'intro') return;
  if (on === G.free) return;
  G.free = on; document.body.classList.toggle('free', on);
  UI.bFree.textContent = on ? '回袁枚处' : '漫游'; UI.bFree.setAttribute('aria-pressed', on);
  if (on) {
    G.prevState = G.state; clearAuto(); Sound.hush(0.5); if (G.walk) { endWalkSilently(); }
    UI.dlg.hidden = true; setFreeControls();
    tweenTo(new THREE.Vector3(70, 105, 125), new THREE.Vector3(0, 2, -6), 2.2);
    showLandmarks(false); toast('拖动旋转，滚轮或双指缩放。点园中的景名可飞过去看注解。');
  } else {
    setTourControls(); if (G.state === 'end') { showEnd(); return; }
    UI.dlg.hidden = false; const v = stationView(STATIONS[G.si].id); tweenTo(v.pos, v.target, 2.0);
  }
}
function endWalkSilently() { const i = G.walk.i; G.walk = null; UI.walk.hidden = true; G.si = i + 1; G.visited.add(i + 1); standAt(STATIONS[i + 1].id); G.state = 'talk'; G.queue = STATIONS[i + 1].lines.slice(); G.qi = 0; G.phase = 'lines'; G.asked = new Set(); G.todTarget = STATIONS[i + 1].time; setTimeout(nextLine, 0); }
function flyToStation(i) {
  const v = stationView(STATIONS[i].id);
  const dir = v.pos.clone().sub(v.target).setY(0).normalize();
  const pos = v.target.clone().add(dir.multiplyScalar(18)).add(new THREE.Vector3(0, 10, 0));
  tweenTo(pos, v.target, 1.8); openNotes(i);
}

// ---------- 注解面板 ----------
function renderNotes(i) {
  const st = STATIONS[i];
  const rows = st.notes.map(n => `<li>${chip(n.tag)}<p>${n.t}</p>${n.src && SRC[n.src] ? `<a class="srcl" href="${SRC[n.src].u || '#'}" target="_blank" rel="noopener">${SRC[n.src].t}</a>` : ''}</li>`).join('');
  UI.notesBody.innerHTML = `<p class="eyebrow">第 ${i + 1} 处 · 注解</p><h2>${st.name}</h2><ul class="nlist">${rows}</ul>${legend()}`;
  UI.notesBody.querySelectorAll('a.srcl[href="#"]').forEach(a => a.replaceWith(Object.assign(document.createElement('span'), { className: 'srcl', textContent: a.textContent })));
}
function legend() { return `<div class="legend"><p class="eyebrow">证据分级</p>${Object.keys(TAGS).map(k => `<div>${chip(k)}<span>${TAGS[k].desc}</span></div>`).join('')}</div>`; }
function renderAllSources() {
  const rows = Object.values(SRC).map(s => `<li>${s.u ? `<a class="srcl" href="${s.u}" target="_blank" rel="noopener">${s.t}</a>` : `<span class="srcl">${s.t}</span>`}</li>`).join('');
  UI.notesBody.innerHTML = `<p class="eyebrow">全部出处</p><h2>本页所据</h2><p class="lead">诗文原句取自袁枚本人著作；园林格局主要依据袁起《随园图》与《随园图记》；随园的兴废据方志、报刊文章与研究者转述。部分引文系转引，已在各条注解中说明。</p><ul class="slist">${rows}</ul>${legend()}`;
}
function openNotes(i = G.si, all = false) {
  closePanels(); all ? renderAllSources() : renderNotes(i); UI.notes.hidden = false; document.body.classList.add('panel-open');
  UI.bNotes.setAttribute('aria-expanded', 'true');
}
function openRoute() { closePanels(); renderRoute(); UI.route.hidden = false; document.body.classList.add('panel-open'); UI.bRoute.setAttribute('aria-expanded', 'true'); }
function closePanels() { UI.notes.hidden = true; UI.route.hidden = true; document.body.classList.remove('panel-open'); UI.bNotes.setAttribute('aria-expanded', 'false'); UI.bRoute.setAttribute('aria-expanded', 'false'); }
function renderRoute() {
  UI.routeList.innerHTML = STATIONS.map((s, i) => {
    const st = i === G.si ? 'cur' : G.visited.has(i) ? 'seen' : '';
    return `<li class="${st}"><button type="button" data-i="${i}"><span class="n">${i + 1}</span><span class="nm">${s.name}</span><span class="stt">${st === 'cur' ? '此处' : st === 'seen' ? '已游' : ''}</span></button></li>`;
  }).join('');
  UI.routeList.querySelectorAll('button').forEach(b => b.onclick = () => {
    const i = +b.dataset.i; closePanels();
    if (G.state === 'epi' || G.state === 'end') resetGarden();
    if (G.free) { G.free = false; document.body.classList.remove('free'); UI.bFree.textContent = '漫游'; setTourControls(); }
    G.walk = null; UI.walk.hidden = true; UI.epi.hidden = true; UI.end.hidden = true; Sound.hush(0.3); clearAuto();
    for (let k = 0; k < i; k++) G.visited.add(k);
    G.tod = STATIONS[i].time; startStation(i);
  });
}
function updateProg() { const st = STATIONS[G.si]; UI.prog.innerHTML = `<i>第 </i>${G.si + 1}<i> 处</i> / ${STATIONS.length} · ${st.name}`; }

// ---------- 尾声 ----------
function startEpilogue() {
  G.state = 'epi'; UI.dlg.hidden = true; closePanels(); showLandmarks(false);
  G.memoryTarget = 1; Sound.setEnding(true); Sound.setMode('yu', 0.5);
  tweenTo(new THREE.Vector3(62, 88, 118), new THREE.Vector3(5, 2, -6), 3.2);
  if (VOICE_ENABLED) Sound.preload(EPILOGUE.flatMap(E => [E.vt, E.vq, E.va]));
  G.epiStep = -1; UI.epi.hidden = false; epiNext();
}
const STAGE_FX = [
  { build: 1, lines: 0.4, veg: 1, field: 0, water: 1, city: 0, pagoda: 1, figs: 1 },
  { build: 1, lines: 0.4, veg: 1, field: 0, water: 1, city: 0, pagoda: 1, figs: 0 },
  { build: 0, lines: 0, veg: 0, field: 1, water: 0, city: 0, pagoda: 0, figs: 0 },
  { build: 0, lines: 0.85, veg: 0, field: 1, water: 0, city: 0, pagoda: 0, figs: 0 },
  { build: 0, lines: 0.22, veg: 0, field: 1, water: 0, city: 1, pagoda: 0, figs: 0 },
  { build: 0, lines: 0, veg: 0, field: 1, water: 0, city: 1, pagoda: 0, figs: 0 }
];
function epiNext() {
  clearAuto(); Sound.hush(0.4);
  G.epiStep++;
  if (G.epiStep >= EPILOGUE.length) { UI.epi.hidden = true; showEnd(); return; }
  const E = EPILOGUE[G.epiStep];
  Object.assign(G.fxT, STAGE_FX[E.stage]);
  $('#epi-year').textContent = E.year; $('#epi-ad').textContent = E.ad;
  $('#epi-text').textContent = E.t;
  $('#epi-q').hidden = !E.q; if (E.q) $('#epi-q').textContent = `「${E.q}」`;
  $('#epi-after').hidden = !E.after; if (E.after) $('#epi-after').textContent = E.after;
  $('#epi-meta').innerHTML = `${chip(E.tag)}<span class="src">${srcText(E.src)}</span>`;
  $('#epi-dots').innerHTML = EPILOGUE.map((_, k) => `<i class="${k <= G.epiStep ? 'on' : ''}"></i>`).join('');
  $('#epi-next').textContent = G.epiStep === EPILOGUE.length - 1 ? '合上画卷' : '下一幕';
  if (E.stage === 3) toast('只剩袁起画中的白描。');
  // 旁白依次读出：正文、引文、补记；自动模式下读完进入下一幕
  const seq = [E.vt, E.vq, E.va].filter(Boolean); const step = G.epiStep; const tok = ++lineTok;
  const next = k => {
    if (tok !== lineTok || G.epiStep !== step || G.state !== 'epi') return;
    if (k < seq.length && G.voiceOn) { Sound.say(seq[k], () => next(k + 1), k === 0 ? 900 : 250); return; }
    if (G.auto) autoT = setTimeout(() => { if (tok === lineTok && G.epiStep === step && G.state === 'epi') epiNext(); }, G.voiceOn ? 2200 : readTime(E.t + (E.q || '') + (E.after || '')) * 1000);
  };
  next(0);
}
function showEnd() { G.state = 'end'; UI.end.hidden = false; UI.dlg.hidden = true; }
function resetGarden() {
  Object.assign(G.fxT, STAGE_FX[0]); Object.assign(G.fx, STAGE_FX[0]); G.memory = G.memoryTarget = 0; G.lastField = -1;
  Sound.setEnding(false); Sound.setBirds(1); UI.end.hidden = true; UI.epi.hidden = true;
}
function applyFx(dt) {
  const k = 1 - Math.exp(-dt * 1.1);
  for (const key in G.fx) G.fx[key] += (G.fxT[key] - G.fx[key]) * k;
  const f = G.fx;
  for (const m of W.buildMeshes) { m.material.transparent = f.build < 0.995; m.material.opacity = f.build; m.visible = f.build > 0.01; }
  for (const m of W.keepMeshes) m.visible = f.build > 0.5;
  W.M.line.opacity = f.lines; W.buildLines.visible = f.lines > 0.01;
  W.gardenVeg.scale.y = Math.max(0.001, f.veg); W.gardenVeg.visible = f.veg > 0.01;
  W.water.material.opacity = 0.9 * f.water; W.water.visible = f.water > 0.02;
  W.city.scale.y = Math.max(0.001, f.city); W.city.visible = f.city > 0.01;
  W.pagoda.scale.y = Math.max(0.001, f.pagoda); W.pagoda.visible = f.pagoda > 0.01;
  W.yuan.visible = W.tong.visible = f.figs > 0.5;
  if (Math.abs(f.field - G.lastField) > 0.004) { setFieldBlend(f.field); G.lastField = f.field; }
  G.memory += (G.memoryTarget - G.memory) * k;
}

// ---------- 民国后的道路与楼房 ----------
function buildCity() {
  const g = new THREE.Group();
  const road = (pts, w) => {
    const pos = [], idx = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const [x, z] = pts[i]; const [nx, nz] = pts[Math.min(n - 1, i + 1)]; const [px, pz] = pts[Math.max(0, i - 1)];
      const dx = nx - px, dz = nz - pz, l = Math.hypot(dx, dz); const ox = -dz / l * w / 2, oz = dx / l * w / 2;
      pos.push(x + ox, groundAt(x + ox, z + oz) + 0.25, z + oz, x - ox, groundAt(x - ox, z - oz) + 0.25, z - oz);
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col('#7c7870'), side: THREE.DoubleSide })); m.receiveShadow = true; g.add(m);
  };
  const ew = []; for (let x = -175; x <= 175; x += 3) ew.push([x, -1 + Math.sin(x * 0.01) * 3]); road(ew, 7);
  const ns = []; for (let z = -175; z <= 175; z += 3) ns.push([-62 + Math.sin(z * 0.012) * 2, z]); road(ns, 6);
  const blocks = [];
  for (let i = 0; i < 400 && blocks.length < 70; i++) {
    const x = rr(-55, 95), z = rr(-45, 42); if (Math.abs(z + 1) < 8) continue; if (H(x, z) > 13) continue;
    let ok = true; for (const b of blocks) if (Math.abs(b.x - x) < (b.sx + 10) / 2 && Math.abs(b.z - z) < (b.sz + 8) / 2) ok = false; if (!ok) continue;
    const sx = rr(7, 13), sz = rr(5, 9), sy = rr(4, 9);
    blocks.push({ x, y: H(x, z) + sy / 2, z, sx, sy, sz, ry: rr(-0.05, 0.05), c: R() < 0.5 ? '#d9d4c8' : '#c2bcae' });
  }
  const bm = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), blocks, true);
  // 楼房自地面向上长出
  g.add(bm);
  g.visible = false; g.scale.y = 0.001;
  return g;
}

// ---------- 提示 ----------
let toastT = null;
function toast(msg) { UI.toast.textContent = msg; UI.toast.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => UI.toast.hidden = true, 4200); }

// ---------- 启动 ----------
function boot() {
  const canvas = $('#gl');
  initWorld(canvas);
  W.buildMeshes = []; W.keepMeshes = [];
  W.buildRoot.children.forEach(o => { if (o.isMesh) (o.userData.keep ? W.keepMeshes : W.buildMeshes).push(o); });
  W.city = buildCity(); W.scene.add(W.city);
  controls = new THREE.OrbitControls(W.camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08; setTourControls(); controls.enabled = false;
  W.camera.position.set(95, 70, 95); controls.target.set(5, 4, -8); W.camera.lookAt(controls.target);
  buildLabels();
  standAt('chaimen');
  resize(); window.addEventListener('resize', resize);
  let last = performance.now(), time = 0;
  const intro = { a: 0.8 };
  function frame(now) {
    const dt = Math.min(window.__DTMAX || 0.05, (now - last) / 1000); last = now; time += dt;
    if (G.state === 'intro') {
      intro.a += dt * (reduceMotion ? 0 : 0.035);
      W.camera.position.set(Math.cos(intro.a) * 120 + 5, 62, Math.sin(intro.a) * 95 - 5); W.camera.lookAt(5, 3, -8); controls.target.set(5, 3, -8);
    }
    stepTween(dt);
    if (G.state === 'walk') stepWalk(dt);
    else if (controls.enabled) controls.update();
    G.tod += (G.todTarget - G.tod) * (1 - Math.exp(-dt * 0.8));
    applyFx(dt); applyPalette();
    const walking = G.state === 'walk', sp = walking && G.walk ? (G.walk.speed || 3.2) / 3.2 : 1;
    animFigure(W.yuan, dt, walking, sp, walking ? stairPhase(W.yuan) : null); animFigure(W.tong, dt, walking, sp * 1.1, walking ? stairPhase(W.tong) : null);
    clampCam();
    updateParticles(dt, time);
    const pd = W.camera.position.distanceTo(tmpV.set(-10, 1, 7)); Sound.setWater(0.07 * smooth(55, 8, pd) * G.fx.water);
    W.renderer.render(W.scene, W.camera);
    updateLabels();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  UI.enter.disabled = false; UI.enter.textContent = '入园';
}
// 镜头不钻地：任何模式下都不低于地面
function clampCam() {
  const c = W.camera.position; const g = groundAt(c.x, c.z) + (G.free ? 3 : 0.8);
  if (c.y < g) c.y = g;
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  W.renderer.setSize(w, h, false); W.camera.aspect = w / h; W.camera.fov = w < h ? 68 : 55; W.camera.updateProjectionMatrix();
}

// ---------- 事件 ----------
UI.enter.onclick = () => {
  Sound.start(); UI.intro.hidden = true; document.body.classList.add('touring');
  const v = stationView('chaimen'); W.camera.position.set(v.pos.x + 4, v.pos.y + 22, v.pos.z - 26);
  G.tod = 0; G.todTarget = 0; startStation(0);
};
UI.dlg.addEventListener('click', e => { if (e.target.closest('button')) return; advance(); });
UI.bNotes.onclick = () => UI.notes.hidden ? openNotes(G.si) : closePanels();
UI.bRoute.onclick = () => UI.route.hidden ? openRoute() : closePanels();
UI.bFree.onclick = () => toggleFree();
if (!VOICE_ENABLED) { UI.bVoice.hidden = true; UI.replay.hidden = true; UI.bAuto.textContent = '自动 · 关'; UI.bAuto.setAttribute('aria-pressed', 'false'); }
UI.bVoice.onclick = () => { G.voiceOn = !G.voiceOn; Sound.setVoice(G.voiceOn); UI.bVoice.textContent = G.voiceOn ? '声 · 开' : '声 · 关'; UI.bVoice.setAttribute('aria-pressed', G.voiceOn); UI.replay.hidden = !G.voiceOn; };
UI.bAuto.onclick = e => { e.stopPropagation(); G.auto = !G.auto; UI.bAuto.textContent = G.auto ? '自动 · 开' : '自动 · 关'; UI.bAuto.setAttribute('aria-pressed', G.auto); if (G.auto && G.state === 'talk' && !Sound.speaking() && !G.typing && (G.phase === 'lines' || G.phase === 'answer' || G.phase === 'outro')) scheduleAuto(lineTok, 1.2); else if (!G.auto) clearAuto(); };
UI.replay.onclick = e => { e.stopPropagation(); replayLine(); };
UI.bMusic.onclick = () => { const on = Sound.toggle(); UI.bMusic.textContent = on ? '乐 · 开' : '乐 · 关'; UI.bMusic.setAttribute('aria-pressed', on); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closePanels);
$('#walk-skip').onclick = () => { if (G.walk) { G.walk.k = 1; stepWalk(0); } };
$('#epi-next').onclick = epiNext;
$('#end-again').onclick = () => { resetGarden(); G.visited = new Set(); G.tod = 0; G.todTarget = 0; startStation(0); };
$('#end-free').onclick = () => { resetGarden(); G.state = 'talk'; G.si = STATIONS.length - 1; G.todTarget = 0.45; toggleFree(true); };
$('#end-src').onclick = () => openNotes(0, true);
$('#intro-src').onclick = () => openNotes(0, true);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePanels(); return; }
  if (G.state === 'intro') return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); if (G.state === 'epi') epiNext(); else advance(); }
  if (e.key === 'ArrowRight' && G.state === 'talk') advance();
  if (/^[1-3]$/.test(e.key) && G.phase === 'ask') { const b = UI.choices.querySelectorAll('button')[+e.key - 1]; if (b && !b.disabled) b.click(); }
});
// 点袁枚
const ray = new THREE.Raycaster(); let downAt = null;
$('#gl').addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
$('#gl').addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 || G.state !== 'talk') return;
  const m = new THREE.Vector2(e.clientX / window.innerWidth * 2 - 1, -e.clientY / window.innerHeight * 2 + 1);
  ray.setFromCamera(m, W.camera);
  if (ray.intersectObject(W.yuan, true).length) toast('袁枚曾嫌罗聘为他画的小像不像，题了一段诙谐的长跋寄还。今天也没人知道他长什么样。');
  else if (G.state === 'talk' && !G.free) advance();
});
document.addEventListener('visibilitychange', () => document.hidden ? Sound.suspend() : Sound.resume());

// 等字体就绪后再建场景（匾额需要毛笔字体）
(function start() {
  if (typeof THREE === 'undefined' || !THREE.OrbitControls || !THREE.BufferGeometryUtils) { UI.enter.textContent = '三维引擎未能加载，请检查网络后刷新'; return; }
  const test = document.createElement('canvas'); if (!(test.getContext('webgl') || test.getContext('experimental-webgl'))) { UI.enter.textContent = '此浏览器不支持 WebGL，无法显示三维场景'; return; }
  const fontReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('84px "Ma Shan Zheng"', '小仓山房书眠斋诗世界'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
  fontReady.then(() => setTimeout(boot, 30));
})();
