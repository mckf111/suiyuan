function buildGarden() {
  const M = W.M;
  FLATS.forEach(f => { f.y = baseH(f.x, f.z); if (f.id === 'xiting') f.y = WATER_Y + 0.35; });
  // 让平台彼此不冲突：诗世界、大院略微压平
  const fy = id => FLATS.find(f => f.id === id).y;
  // 柴门（门朝北）
  place(gate(), 78, -30.5, 0);
  // 短篱
  const fence = [];
  const fpath = [[78, -30], [75.5, -27], [70, -25], [64, -23], [57, -21.5]];
  for (let k = 0; k < fpath.length - 1; k++) {
    const [ax, az] = fpath[k], [bx, bz] = fpath[k + 1]; const len = Math.hypot(bx - ax, bz - az); const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let t = 0; t < len; t += 0.45) for (const s of [-1, 1]) {
      const x = ax + (bx - ax) * t / len + nx * s * 2.1, z = az + (bz - az) * t / len + nz * s * 2.1; const h = rr(0.9, 1.15);
      fence.push({ x, y: H(x, z) + h / 2, z, rz: rr(-0.05, 0.05), sx: 1, sy: h, sz: 1, c: '#e0c890' });
    }
  }
  W.gardenVeg.add(instancedFrom(new THREE.CylinderGeometry(0.035, 0.04, 1, 6), W.FM.culm, fence));
  // 大院三楹（面东）
  place(hall({ w: 12, d: 7, h: 3.3, rise: 2.3, cols: 3, plaque: '', lanterns: 0 }), 30.5, -18, Math.PI / 2);
  // 大院两侧矮墙
  const yard = FLATS.find(f => f.id === 'yard');
  for (const s of [-1, 1]) { const wl = mesh(box(15, 1.6 + 2, 0.35), M.wall, 0, 0.8 - 1, 0); const gg = new THREE.Group(); gg.add(wl); gg.add(mesh(box(15.4, 0.25, 0.7), M.ridge, 0, 1.7, 0)); place(gg, yard.x + 1, yard.z + s * 8.6, 0); }
  // 小仓山房
  const sf = place(hall({ w: 16, d: 9, h: 3.8, rise: 2.8, cols: 5, plaque: '小仓山房', lanterns: 1 }), 22, -38, 0);
  // 书仓：亭、轩、楼、阁
  place(pavilion({ r: 2.1, sides: 6 }), -9, -38.5);
  place(hall({ w: 7, d: 5, h: 3.0, rise: 1.9, cols: 3, plaque: '书仓' }), 6.5, -46, 0);
  place(lou({ w: 7, d: 6, h1: 3.0, h2: 2.6 }), -8.5, -47.5, 0);
  const ge = pavilion({ r: 1.8, sides: 4, h: 2.6, rise: 1.8 }); const gg2 = new THREE.Group(); const gbase = mesh(box(4.2, 2.6, 4.2), M.wall, 0, 1.3, 0); gg2.add(gbase); ge.position.y = 2.6; gg2.add(ge); gg2.userData.top = 2.6 + ge.userData.top;
  place(gg2, 7, -37.5, 0);
  // 小眠斋
  place(hall({ w: 7, d: 5, h: 3.0, rise: 1.9, cols: 3, plaque: '小眠斋' }), -22, -35, 0);
  // 藤花廊
  W.buildRoot.add(corridor(CORRIDOR));
  // 诗世界（面东）
  place(hall({ w: 10, d: 6, h: 3.3, rise: 2.2, cols: 4, plaque: '诗世界', lanterns: 0 }), -45.5, -6, Math.PI / 2);
  // 溪亭
  place(pavilion({ r: 1.6, sides: 4, h: 2.5, rise: 1.7 }), -37, 3);
  // 渡鹤桥
  const br = archBridge(BRIDGE.L, 2.4, BRIDGE.rise); br.position.set(BRIDGE.x, WATER_Y - 0.1, BRIDGE.z); br.rotation.y = Math.PI / 2; W.buildRoot.add(br);
  // 小船
  const bt = boat(); bt.position.set(9, WATER_Y + 0.05, 10); bt.rotation.y = 0.5; W.buildRoot.add(bt); W.boat = bt;
  // 厨下（面西）
  const kg = hall({ w: 8, d: 5, h: 3.0, rise: 1.9, cols: 3 });
  kg.add(mesh(box(0.8, 2.2, 0.8), M.wall, 2.4, 4.6, -1.2));
  place(kg, 54, 6, -Math.PI / 2);
  W.chimney = new THREE.Vector3(55.2, 0, 8.4); W.chimney.y = FLATS.find(f => f.id === 'kitchen').y + 5.8;
  // 南楼（面北，上层四面开敞）
  const nl = lou({ w: 9, d: 7, h1: 3.2, h2: 2.9, openUpper: 1 });
  place(nl, 18, 46, Math.PI);
  W.nanlouUpper = fy('nanlou') + nl.userData.upperY + 0.02;
  W.stairY0 = fy('nanlou'); W.stairY1 = fy('nanlou') + nl.userData.upperY;
  W.buildRoot.add(nanlouStair(W.stairY0, W.stairY1));
  // 菜畦边的农舍
  place(hall({ w: 6, d: 4.5, h: 2.6, rise: 1.6, cols: 2, sideWin: 0 }), -64, 34, Math.PI);
  // 标签锚点
  W.labelAt = {
    chaimen: [78, 5.2, -30.5], zhujing: [61, 9, -24], dayuan: [30.5, 8, -18], shanfang: [22, 9.5, -38], shucang: [-1, 11, -45],
    xiaomian: [-22, 7, -35], tenghua: [-30.5, 5, -21], shishijie: [-45.5, 7.5, -6], shuanghu: [-10, 5, 7], xiangxue: [31, 7, 17], chuxia: [54, 7, 6], nanlou: [18, 13, 46]
  };
  for (const k in W.labelAt) { const v = W.labelAt[k]; W.labelAt[k] = new THREE.Vector3(v[0], H(v[0], v[2]) + v[1], v[2]); }
  void sf;
}


// ---------- 袁枚墓（百步坡，小仓山北麓，在园外） ----------
// 据南京市地方志办公室《五台山旁袁枚墓》：墓在五台山百步坡、干河沿南山坡上，与随园相邻而不在园内；1974 年兴建五台山体育馆时清理。
function buildTomb() {
  const M = W.M; const x = -6, z = -84; const y = H(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = 0;
  const tomb = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.rock); mound.scale.y = 0.62; tomb.add(mound);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.85, 0.7, 28, 1, true), M.stone); ring.position.y = 0.1; tomb.add(ring);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.6), M.stone); base.position.set(0, 0.18, 3.1); tomb.add(base);
  const stele = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.18), M.stoneD); stele.position.set(0, 1.1, 3.1); tomb.add(stele);
  const altar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.6), M.stone); altar.position.set(0, 0.22, 4.1); tomb.add(altar);
  for (let i = 0; i < 6; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.7), M.stoneD); st.position.set(0, -0.05 - i * 0.12, 5 + i * 0.75); tomb.add(st); }
  g.add(tomb);
  // 同治年间袁家在墓旁修的祠堂
  const shrine = hall({ w: 7, d: 5, h: 3.0, rise: 1.9, cols: 3 });
  shrine.position.set(8.5, H(x + 8.5, z + 1) - y, 1); shrine.rotation.y = -Math.PI / 2; g.add(shrine);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.visible = false; shrine.visible = false;
  W.tomb = g; W.shrine = shrine; W.tombLabelAt = new THREE.Vector3(x, y + 6, z);
  return g;
}
