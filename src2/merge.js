function mergeBuildings() {
  const root = W.buildRoot; root.updateMatrixWorld(true);
  const byMat = new Map(); const edges = []; const keep = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.keep) { keep.push(o); return; }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (!g.attributes.uv) { g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
    if (o.userData.edge) { const e = new THREE.EdgesGeometry(o.geometry, o.userData.edge); e.applyMatrix4(o.matrixWorld); edges.push(e); }
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(list, false);
    const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; out.add(m);
  }
  const eg = THREE.BufferGeometryUtils.mergeBufferGeometries(edges, false);
  const lines = new THREE.LineSegments(eg, W.M.line); out.add(lines); W.buildLines = lines;
  for (const k of keep) { const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3(); k.matrixWorld.decompose(wp, wq, ws); k.parent.remove(k); k.position.copy(wp); k.quaternion.copy(wq); k.scale.copy(ws); out.add(k); }
  W.scene.remove(root); W.buildRoot = out; W.garden.add(out);
}

