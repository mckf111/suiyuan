// ---------- characters ----------
function figure(opt) {
  const { robe = '#4f6470', jacket = '#34363c', scale = 1, beard = 1, cane = 1, sash } = opt;
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const Lm = (c, r = 0.85) => hook(new THREE.MeshStandardMaterial({ color: col(c), roughness: r }), 'fig');
  const robeM = Lm(robe), jackM = jacket ? Lm(jacket) : robeM, skin = Lm('#d9b99a', 0.6), black = Lm('#1f1d1c'), inkM = Lm('#2e2823'), white = Lm('#ece6da');
  const V = a => a.map(p => new THREE.Vector2(p[0], p[1]));
  const robeG = new THREE.LatheGeometry(V([[0.0, 0.0], [0.4, 0.0], [0.37, 0.25], [0.3, 0.78], [0.25, 1.0], [0.24, 1.25], [0.27, 1.38], [0.1, 1.47], [0.0, 1.48]]), 24);
  body.add(new THREE.Mesh(robeG, robeM));
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
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.136, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), black); cap.position.y = 0.028; head.add(cap);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.133, 0.008, 6, 28), inkM); brim.rotation.x = Math.PI / 2; brim.position.y = 0.028; head.add(brim);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), Lm('#a83a2a')); knot.position.y = 0.165; head.add(knot);
  const queue = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, 0.66, 8), black); queue.position.set(0, -0.32, -0.12); queue.rotation.x = 0.1; head.add(queue);
  // 五官：眼、眉、鼻、耳、口，远看不显，近看不再像人台
  { const eyeM = Lm('#1a1512'), browM = Lm(beard ? '#cfc8bb' : '#2a2420'), lipM = Lm('#9a5a4c');
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeM); e.scale.set(1.25, 0.72, 0.55); e.position.set(s * 0.042, -0.004, 0.119); head.add(e);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.009, 0.012), browM); br.position.set(s * 0.045, 0.017, 0.118); br.rotation.z = s * -0.12; br.rotation.y = s * 0.3; head.add(br);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), skin); ear.scale.set(0.42, 1, 0.7); ear.position.set(s * 0.127, 0.0, -0.005); head.add(ear);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), skin); nose.scale.set(0.85, 1.25, 1); nose.position.set(0, -0.034, 0.126); head.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.007, 0.008), lipM); mouth.position.set(0, -0.078, 0.108); head.add(mouth);
    head.userData.mouth = mouth; }
  if (beard) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.26, 10), Lm('#bdb6aa')); b.position.set(0, -0.16, 0.085); b.rotation.x = Math.PI + 0.25; head.add(b);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.12, 5), Lm('#bdb6aa')); m.position.set(s * 0.04, -0.05, 0.12); m.rotation.z = s * 1.1; head.add(m); }
  }
  if (cane) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.12, 8), Lm('#4a3322')); c.position.set(0.02, -0.26, 0.08); arms[1].add(c); }
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
  // 说话：微微点头，左手抬起比划
  u.talk = (u.talk || 0) + ((walking ? 0 : (u.talkT || 0)) - (u.talk || 0)) * (1 - Math.exp(-dt * 4));
  const tk = u.talk; u.tph = (u.tph || 0) + dt;
  u.arms[0].rotation.x = walking ? s * 0.3 : 0.05 - tk * (0.55 + 0.12 * Math.sin(u.tph * 1.7));
  u.arms[0].rotation.z = -0.12 - tk * 0.18 * (0.6 + 0.4 * Math.sin(u.tph * 1.1));
  u.arms[1].rotation.x = walking ? -s * 0.22 - u.lean * 0.8 : -0.08;
  u.head.rotation.x = u.look + tk * (0.04 * Math.sin(u.tph * 6.5) + 0.03 * Math.sin(u.tph * 2.3));
  u.head.rotation.y = walking ? 0 : Math.sin(u.phase * 0.4) * 0.12 * (1 - tk * 0.5);
  const mo = u.head.userData.mouth; if (mo) mo.scale.y = 1 + tk * 1.6 * Math.max(0, Math.sin(u.tph * 9) * Math.sin(u.tph * 3.1));
}

