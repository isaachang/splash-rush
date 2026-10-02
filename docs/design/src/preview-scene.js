/* Canton Arcade 3D preview: builds the map from GZ data, the surroundings, and orbit / walk controls */
const GZV = (() => {
  const M = GZ, Q = GQ, { T, rnd, rr } = GZT;
  const host = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#e9dfcf');
  scene.fog = new THREE.Fog(FOG, 160, 3400);
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 9000);
  const G = { map: new THREE.Group(), decor: new THREE.Group(), env: new THREE.Group(), ink: new THREE.Group(), grid: new THREE.Group(), water: new THREE.Group() };
  Object.values(G).forEach(g => scene.add(g));

  // ---------------- materials (all UVs are in metres; a material's texture repeats every su × sv metres)
  const mats = {};
  function std(name, map, su, sv, o = {}) {
    const p = Object.assign({ roughness: 0.85 }, o);
    if (map) { const t = map.clone(); t.needsUpdate = true; t.repeat.set(1 / su, 1 / (sv || su)); p.map = t; }
    const m = new THREE.MeshStandardMaterial(p); m.name = name; mats[name] = m; return m;
  }
  std('granite', T.granite, 4); std('stone', T.stone, 2.4, 2.4, { color: 0xf4f0e8 }); std('canal', T.canal, 6, 2.0);
  std('bed', T.granite, 4, 4, { color: 0x9a978c }); std('brick', T.brick, 2); std('terrace', T.terrace, 2.4);
  std('tiles', T.tiles, 2.0); std('greenTiles', T.greenTiles, 1.2); std('wood', T.wood, 1, 2); std('bamboo', T.bamboo, 1.4, 0.35);
  std('plaster', T.stone, 3, 3, { color: 0xf1e3c2 }); std('plasterW', T.stone, 3, 3, { color: 0xf6f1e6 });
  std('manchu', T.manchu, 1.2, 1.2, { emissive: 0x332211, roughness: 0.3 }); std('shopfront', T.shopfront, 8, 2.6);
  std('teahouse', T.teahouse, 36, 12.6);
  T.facade.forEach((t, i) => std('fac' + i, t, 4, 12.8));
  std('gable', T.stone, 3, 3, { color: 0x8c9296 });
  std('dark', null, 1, 1, { color: 0x2a2b30, roughness: 0.6, metalness: 0.4 });
  std('iron', null, 1, 1, { color: 0x30343a, roughness: 0.45, metalness: 0.6 });
  std('red', null, 1, 1, { color: 0xb3261e, roughness: 0.5 });
  std('gold', null, 1, 1, { color: 0xd8a640, roughness: 0.35, metalness: 0.7 });
  std('steel', null, 1, 1, { color: 0xc9ced3, roughness: 0.35, metalness: 0.15 });
  std('teal', null, 1, 1, { color: 0x2f7d6d, roughness: 0.6 });
  std('blue', null, 1, 1, { color: 0x2e5f9e, roughness: 0.55 });
  std('leaf', null, 1, 1, { color: 0x3f6f38, roughness: 0.9, flatShading: true });
  std('leafL', null, 1, 1, { color: 0x6c9a45, roughness: 0.9, flatShading: true });
  std('bark', null, 1, 1, { color: 0x857565, roughness: 0.95 });
  std('flower', null, 1, 1, { color: 0xe4402a, roughness: 0.6, emissive: 0x3a0800 });
  std('lantern', null, 1, 1, { color: 0xc8291c, roughness: 0.45, emissive: 0x4a0a00 });
  std('redwall', T.stone, 2.4, 2.4, { color: 0xb5503f }); std('redstone', T.canal, 4, 1.6, { color: 0xc98a78 });
  std('rock', T.rock, 5, 5); std('statue', null, 1, 1, { color: 0xd9d4c8, roughness: 0.9, flatShading: true });
  std('hull', null, 1, 1, { color: 0x4a2c1a, roughness: 0.7 }); std('sausage', null, 1, 1, { color: 0x9a2f24, roughness: 0.6 });
  std('doorRed', null, 1, 1, { color: 0x5a1a14, roughness: 0.6, side: THREE.DoubleSide }); std('woodDS', T.wood, 1, 2, { side: THREE.DoubleSide });
  std('yellow', null, 1, 1, { color: 0xf2c230, roughness: 0.6 }); std('white', null, 1, 1, { color: 0xf4f1e8, roughness: 0.7 });
  std('grass', null, 1, 1, { color: 0x6e9b4a, roughness: 1 });
  const water = new THREE.MeshStandardMaterial({ map: T.water, color: 0xa9bfb4, transparent: true, opacity: 0.8, roughness: 0.12, metalness: 0.15 });
  water.map.repeat.set(1 / 6, 1 / 6);

  // ---------------- geometry helpers
  function boxGeo(x0, x1, y0, y1, z0, z1) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0, g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
  }
  // m: one material or [side, top] or a 6-array (+x,-x,+y,-y,+z,-z)
  function box(group, x0, x1, y0, y1, z0, z1, m, o = {}) {
    let mm = m; if (Array.isArray(m) && m.length === 2) mm = [m[0], m[0], m[1], m[0], m[0], m[0]];
    const mesh = new THREE.Mesh(boxGeo(x0, x1, y0, y1, z0, z1), mm);
    mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; Object.assign(mesh.userData, o.ud || {});
    group.add(mesh); return mesh;
  }
  // a prism along an axis from a 2D profile [[u, y]...]: axis 'z' → u is world z, extruded along x from a0 to a1
  function prism(group, pts, axis, a0, a1, m, o = {}) {
    const sh = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(axis === 'z' ? -u : u, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: a1 - a0, bevelEnabled: false, curveSegments: 24 });
    if (axis === 'z') { g.rotateY(Math.PI / 2); g.translate(a0, 0, 0); } else { g.translate(0, 0, a0); }
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; Object.assign(mesh.userData, o.ud || {}); group.add(mesh); return mesh;
  }
  function cyl(group, x, y0, z, r0, r1, h, m, seg = 12) {
    const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(x, y0 + h / 2, z);
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function between(group, a, b, r, m, seg = 6) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const g = new THREE.CylinderGeometry(r, r, L, seg); g.translate(0, L / 2, 0);
    const mesh = new THREE.Mesh(g, m); mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); mesh.castShadow = true; group.add(mesh); return mesh;
  }
  function plane(group, w, h, m, pos, rotY = 0, ds = false) {
    const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; if (!m.userData.unit) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
    const mesh = new THREE.Mesh(g, m); mesh.position.copy(pos); mesh.rotation.y = rotY; group.add(mesh); if (ds) { const back = new THREE.Mesh(g, m); back.position.copy(pos); back.rotation.y = rotY + Math.PI; back.castShadow = true; group.add(back); } return mesh;
  }
  const signMat = (txt, bg, fg) => { const m = new THREE.MeshStandardMaterial({ map: T.sign(txt, bg, fg), roughness: 0.6 }); m.userData.unit = true; return m; };
  const plaqueMat = (txt) => { const m = new THREE.MeshStandardMaterial({ map: T.plaque(txt), roughness: 0.5 }); m.userData.unit = true; return m; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const H = s => ({ ud: { hy: s.t === 'ramp' ? Math.max(s.h0, s.h1) : s.h, solid: true } });

  // ---------------- ground, canal
  const { XH, ZH, CANAL } = M;
  [[CANAL.z1, ZH], [-ZH, CANAL.z0]].forEach(([z0, z1]) => box(G.map, -XH, XH, -0.3, 0, z0, z1, [mats.granite, mats.granite], { cast: false, ud: { hy: 0, solid: true } }));
  box(G.map, -200, 150, CANAL.bed - 0.2, CANAL.bed, CANAL.z0, CANAL.z1, mats.bed, { cast: false, ud: { hy: CANAL.bed, solid: true } });
  [CANAL.z0, CANAL.z1].forEach((z, k) => { const p = plane(G.map, 350, -CANAL.bed, mats.canal, V(-25, CANAL.bed / 2, z), k ? Math.PI : 0); p.receiveShadow = true; p.userData.hy = -1; p.userData.solid = true; });
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(350, CANAL.z1 - CANAL.z0, 1, 1), water);
  { const uv = waterMesh.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 350, uv.getY(i) * 7); }
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(-25, CANAL.shallow, 0); waterMesh.receiveShadow = true; G.water.add(waterMesh);

  // ---------------- solids
  const bridgesDone = new Set();
  const stairs = (s, m) => {
    const rise = Math.abs(s.h1 - s.h0), n = Math.max(2, Math.round(rise / 0.22)), up = s.h1 > s.h0;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, y = rise * (i + 1) / n;
      if (s.axis === 'z') { const za = up ? s.z0 + (s.z1 - s.z0) * t0 : s.z0 + (s.z1 - s.z0) * (1 - t1), zb = up ? s.z1 : s.z0 + (s.z1 - s.z0) * (1 - t0); box(G.map, s.x0, s.x1, 0, y, up ? za : s.z0, up ? s.z1 : zb, [m, m], H(s)); }
      else { const xa = up ? s.x0 + (s.x1 - s.x0) * t0 : s.x0, xb = up ? s.x1 : s.x0 + (s.x1 - s.x0) * (1 - t0); box(G.map, xa, xb, 0, y, s.z0, s.z1, [m, m], H(s)); }
    }
  };
  const ramp = (s, side, top) => {
    const pts = s.axis === 'z' ? [[s.z0, 0], [s.z1, 0], [s.z1, s.h1], [s.z0, s.h0]] : [[s.x0, 0], [s.x1, 0], [s.x1, s.h1], [s.x0, s.h0]];
    prism(G.map, pts, s.axis, s.axis === 'z' ? s.x0 : s.z0, s.axis === 'z' ? s.x1 : s.z1, [top, side], H(s));
  };
  const plinth = (s, h = 0.45) => box(G.map, s.x0 - 0.04, s.x1 + 0.04, s.y0 || 0, (s.y0 || 0) + h, s.z0 - 0.04, s.z1 + 0.04, mats.stone, { ud: { hy: s.h, solid: true } });
  const shrubs = (x0, x1, z0, z1, y, n) => { for (let i = 0; i < n; i++) { const g = new THREE.IcosahedronGeometry(rr(0.35, 0.6), 0); g.scale(1, 0.75, 1); const m = new THREE.Mesh(g, rnd() < 0.5 ? mats.leaf : mats.leafL); m.position.set(rr(x0 + 0.3, x1 - 0.3), y + 0.25, rr(z0 + 0.3, z1 - 0.3)); m.castShadow = true; G.decor.add(m); } };
  function steamerStack(x, z, y0, h) { const n = Math.max(1, Math.round(h / 0.22)); for (let i = 0; i < n; i++) cyl(G.decor, x, y0 + i * 0.22, z, 0.36, 0.36, 0.2, mats.bamboo, 14); cyl(G.decor, x, y0 + n * 0.22, z, 0.37, 0.3, 0.08, mats.bamboo, 14); }
  function wokEar(x0, x1, z0, z1, y0, y1) { wokEarAx('z', z0, z1, x0, x1, y0, y1, G.map); }
  // axis 'z': the gable spans z (a0..a1) and is t0..t1 thick in x; axis 'x': spans x, thick in z
  function wokEarAx(axis, a0, a1, t0, t1, y0, y1, group) {
    const L = a1 - a0, c = (a0 + a1) / 2, shoulder = y0 + (y1 - y0) * 0.45, pts = [];
    pts.push([a0, y0], [a0 - 0.18, shoulder]);
    for (let i = 0; i <= 24; i++) { const a = Math.PI - i / 24 * Math.PI; pts.push([c + Math.cos(a) * (L / 2 + 0.18), shoulder + Math.sin(a) * (y1 - shoulder)]); }
    pts.push([a1, y0]);
    prism(group, pts, axis, t0, t1, [mats.gable, mats.plasterW], { ud: { hy: y1, solid: true } });
    const tm = (t0 + t1) / 2, curve = new THREE.CatmullRomCurve3(pts.slice(2, -1).map(([u, y]) => axis === 'z' ? V(tm, y + 0.05, u) : V(u, y + 0.05, tm)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.14, 6), mats.dark); tube.castShadow = true; group.add(tube);
  }
  for (const s of M.solids) {
    const k = s.kind;
    if (k === 'bridge') {
      if (bridgesDone.has(s.x0)) continue; bridgesDone.add(s.x0);
      const pts = [[5.5, 0], [0, 0.8], [-5.5, 0], [-3.5, 0], [-3.5, CANAL.bed]];
      for (let i = 1; i < 24; i++) { const z = -3.5 + 7 * i / 24, u = z / 3.5; pts.push([z, CANAL.bed + 2.1 * Math.sqrt(Math.max(0, 1 - u * u))]); }
      pts.push([3.5, CANAL.bed], [3.5, 0]);
      prism(G.map, pts, 'z', s.x0, s.x1, [mats.stone, mats.stone], { ud: { hy: 0.8, solid: true } });
      // balustrades on both edges following the deck
      [s.x0 + 0.12, s.x1 - 0.12].forEach(x => {
        for (let z = -5.2; z <= 5.21; z += 0.8) { const y = 0.8 * (1 - Math.abs(z) / 5.5); box(G.decor, x - 0.1, x + 0.1, y, y + 0.85, z - 0.1, z + 0.1, mats.stone); }
        const a = V(x, 0.85, -5.5), b = V(x, 1.65, 0), c = V(x, 0.85, 5.5); between(G.decor, a, b, 0.09, mats.stone, 6); between(G.decor, b, c, 0.09, mats.stone, 6);
      });
      continue;
    }
    if (k === 'stair') { stairs(s, mats.stone); continue; }
    if (s.t === 'ramp') { ramp(s, mats.plaster, mats.terrace); continue; }
    if (s.t === 'fence') {   // 趟栊: odd number of round timber bars across the doorway, with an open half-door
      const n = 13; for (let i = 0; i < n; i++) { const y = 0.15 + i * (s.h - 0.3) / (n - 1); between(G.map, V((s.x0 + s.x1) / 2, y, s.z0), V((s.x0 + s.x1) / 2, y, s.z1), 0.05, mats.wood, 8).userData = { hy: s.h, solid: true }; }
      box(G.map, s.x0, s.x1, 0, s.h, s.z0 - 0.12, s.z0, mats.wood, { ud: { hy: s.h, solid: true } }); box(G.map, s.x0, s.x1, 0, s.h, s.z1, s.z1 + 0.12, mats.wood, { ud: { hy: s.h, solid: true } });
      continue;
    }
    const y0 = s.y0 || 0;
    switch (k) {
      case 'terrace': box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.fac3, mats.terrace], H(s)); break;
      case 'tank': box(G.map, s.x0, s.x1, 2.0, 2.2, s.z0, s.z1, mats.dark, H(s)); cyl(G.map, (s.x0 + s.x1) / 2, 2.2, (s.z0 + s.z1) / 2, 0.95, 0.95, s.h - 2.2, mats.steel, 20).userData = { hy: s.h, solid: true }; break;
      case 'teahouse': box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.plaster, mats.terrace], H(s)); break;
      case 'arcade': {
        box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, [mats.plaster, mats.terrace], H(s));
        // segmental arches between the columns on the street side, cornice line
        const ax = s.team ? s.x1 : s.x0;
        for (let i = 0; i < 7; i++) {
          const c0 = 8.6 + i * 3.914 + 0, c1 = c0 + 3.314; const za = s.team ? -c1 : c0, zb = s.team ? -c0 : c1;
          const pts = [[za, 2.6], [zb, 2.6], [zb, 2.2]]; for (let j = 1; j < 16; j++) { const t = j / 16; pts.push([zb + (za - zb) * t, 2.2 + 0.32 * Math.sin(t * Math.PI)]); } pts.push([za, 2.2]);
          prism(G.map, pts, 'z', ax - 0.15, ax + 0.15, mats.plasterW, { ud: { hy: 3, solid: true } });
        }
        box(G.map, ax - 0.2, ax + 0.2, 2.95, 3.05, s.z0, s.z1, mats.plasterW);
        break;
      }
      case 'balustrade': {
        const x = (s.x0 + s.x1) / 2;
        box(G.map, s.x0, s.x1, s.h - 0.12, s.h, s.z0, s.z1, mats.plasterW, H(s)); box(G.map, s.x0, s.x1, y0, y0 + 0.12, s.z0, s.z1, mats.plasterW, H(s));
        const vg = new THREE.LatheGeometry([[0.05, 0], [0.09, 0.1], [0.06, 0.25], [0.1, 0.45], [0.06, 0.62], [0.07, 0.66]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
        const n = Math.floor((s.z1 - s.z0) / 0.3), im = new THREE.InstancedMesh(vg, mats.plasterW, n), o = new THREE.Object3D();
        for (let i = 0; i < n; i++) { o.position.set(x, y0 + 0.12, s.z0 + 0.15 + i * 0.3); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
        im.castShadow = true; im.userData = { hy: s.h, solid: true }; G.map.add(im);
        break;
      }
      case 'column': {
        box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, mats.plasterW, H(s));
        box(G.map, s.x0 - 0.08, s.x1 + 0.08, 0, 0.35, s.z0 - 0.08, s.z1 + 0.08, mats.stone, H(s));
        box(G.map, s.x0 - 0.1, s.x1 + 0.1, s.h - 0.3, s.h - 0.15, s.z0 - 0.1, s.z1 + 0.1, mats.plasterW, H(s));
        break;
      }
      case 'brick': box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, [mats.brick, mats.terrace], H(s)); plinth(s, Math.min(0.5, s.h * 0.4)); break;
      case 'hall': {   // 正廳: blue brick, pitched grey-tile roof between two wok-ear gables (the rest is dressed below)
        box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, mats.brick, H(s)); plinth(s);
        prism(G.map, [[s.x0 - 0.4, s.h], [s.x1 + 0.4, s.h], [(s.x0 + s.x1) / 2, s.h + 1.9]], 'x', s.z0 + 0.3, s.z1 - 0.3, [mats.tiles, mats.brick], H(s));
        wokEarAx('x', s.x0 - 0.35, s.x1 + 0.35, s.z0 - 0.05, s.z0 + 0.4, s.h, s.h + 2.7, G.map); wokEarAx('x', s.x0 - 0.35, s.x1 + 0.35, s.z1 - 0.4, s.z1 + 0.05, s.h, s.h + 2.7, G.map);
        break;
      }
      case 'lintel': {
        if (s.zone === 'mansion') { box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, [mats.stone, mats.terrace], H(s)); const fx = s.team ? s.x0 - 0.01 : s.x1 + 0.01; plane(G.decor, 2.6, 0.38, plaqueMat(s.team ? '小畫舫齋' : '泰華樓'), V(fx, y0 + 0.2, (s.z0 + s.z1) / 2), s.team ? -Math.PI / 2 : Math.PI / 2); break; }
        // 獵德牌坊: granite beam, the name on both faces, two tiers of glazed green roof with upturned ends
        box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, mats.stone, H(s));
        [[s.z1 + 0.01, 0], [s.z0 - 0.01, Math.PI]].forEach(([z, ry]) => plane(G.decor, 3.4, 0.95, plaqueMat('獵德'), V(0, (y0 + s.h) / 2, z), ry));
        const zc = (s.z0 + s.z1) / 2;
        prism(G.map, [[s.z0 - 0.7, s.h], [s.z1 + 0.7, s.h], [zc, s.h + 0.8]], 'z', s.x0 - 0.6, s.x1 + 0.6, mats.greenTiles, H(s));
        box(G.map, -2.3, 2.3, s.h + 0.3, s.h + 1.0, s.z0 + 0.15, s.z1 - 0.15, mats.stone, H(s));
        prism(G.map, [[s.z0 - 0.6, s.h + 1.0], [s.z1 + 0.6, s.h + 1.0], [zc, s.h + 1.75]], 'z', -2.9, 2.9, mats.greenTiles, H(s));
        [[s.x0 - 0.6, s.h + 0.85], [s.x1 + 0.6, s.h + 0.85], [-2.9, s.h + 1.8], [2.9, s.h + 1.8]].forEach(([x, y]) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 6), mats.greenTiles); m.position.set(x, y, zc); m.rotation.z = x < 0 ? 0.6 : -0.6; G.map.add(m); });
        break;
      }
      case 'post': {
        box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, mats.stone, H(s)); box(G.map, s.x0 - 0.15, s.x1 + 0.15, 0, 0.6, s.z0 - 0.15, s.z1 + 0.15, mats.stone, H(s));
        [s.z0 - 0.3, s.z1 + 0.3].forEach(z => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16), mats.stone); d.rotation.z = Math.PI / 2; d.position.set((s.x0 + s.x1) / 2, 0.85, z); d.castShadow = true; G.decor.add(d); });   // drum stones
        break;
      }
      case 'planterbox': box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.stone, mats.grass], H(s)); shrubs(s.x0, s.x1, s.z0, s.z1, s.h, 6); break;
      case 'planter': box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.stone, mats.grass], H(s)); break;
      case 'planterwall': box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.stone, mats.grass], H(s)); shrubs(s.x0, s.x1, s.z0, s.z1, s.h, 5); break;
      case 'shop': {
        box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [s.team ? mats.fac2 : mats.fac6, mats.terrace], H(s));
        box(G.map, s.x0 - 0.1, s.x1 + 0.1, s.h - 0.15, s.h + 0.35, s.z0 - 0.1, s.z1 + 0.1, mats.plasterW, H(s));
        break;
      }
      case 'steamer': {
        box(G.map, s.x0, s.x1, 0, 0.02, s.z0, s.z1, mats.stone, H(s));
        if (s.team && s.h > 1) { box(G.decor, s.x0 + 0.05, s.x1 - 0.05, 0, 0.45, s.z0 + 0.05, s.z1 - 0.05, [mats.red, mats.gold]); box(G.decor, s.x0 + 0.15, s.x1 - 0.15, 0.45, 0.85, s.z0 + 0.15, s.z1 - 0.15, [mats.red, mats.gold]); box(G.decor, s.x0 + 0.3, s.x1 - 0.3, 0.85, s.h, s.z0 + 0.3, s.z1 - 0.3, [mats.red, mats.gold]); }   // stacked mooncake gift boxes
        else for (let x = s.x0 + 0.4; x < s.x1; x += 0.78) for (let z = s.z0 + 0.4; z < s.z1; z += 0.78) steamerStack(x, z, 0, s.h - 0.08);
        const m = new THREE.Mesh(boxGeo(s.x0, s.x1, 0, s.h, s.z0, s.z1), mats.bamboo); m.visible = false; m.userData = { hy: s.h, solid: true, proxy: true }; G.map.add(m);
        break;
      }
      case 'stall': {
        const zc = (s.z0 + s.z1) / 2;
        if (!s.team) {   // 牛雜檔: steel cart, a big simmering pot, skewers, red-and-white canopy
          box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.steel, mats.steel], H(s));
          cyl(G.decor, s.x0 + 0.8, s.h, zc, 0.45, 0.45, 0.35, mats.dark, 16); cyl(G.decor, s.x0 + 0.8, s.h + 0.3, zc, 0.4, 0.4, 0.06, mats.sausage, 16);
          for (let i = 0; i < 9; i++) between(G.decor, V(s.x0 + 1.7 + i * 0.12, s.h, zc - 0.2), V(s.x0 + 1.75 + i * 0.12, s.h + 0.42, zc + 0.15), 0.012, mats.bamboo, 4);
          [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].forEach(([x, z]) => cyl(G.decor, x, 0, z, 0.04, 0.04, 2.4, mats.iron, 6));
          for (let i = 0; i < 6; i++) box(G.decor, s.x0 - 0.3 + i * 0.6, s.x0 + 0.3 + i * 0.6, 2.4, 2.48, s.z0 - 0.4, s.z1 + 0.4, i % 2 ? mats.white : mats.red);
          plane(G.decor, 0.6, 1.9, signMat('蘿蔔牛雜', '#7a1d18', '#ffe39a'), V(s.x1 + 0.35, 1.6, zc), Math.PI / 2, true);
        } else {         // 雞公欖: the olive seller's counter with the paper rooster and a pole of streamers
          box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.teal, mats.wood], H(s));
          for (let i = 0; i < 4; i++) { cyl(G.decor, s.x0 + 0.5 + i * 0.45, s.h, zc, 0.14, 0.14, 0.3, mats.leafL, 10); cyl(G.decor, s.x0 + 0.5 + i * 0.45, s.h + 0.3, zc, 0.15, 0.15, 0.04, mats.red, 10); }
          const rx = s.x1 - 0.6, ry = s.h, bm = new THREE.MeshStandardMaterial({ color: 0xe0562c, roughness: 0.7, flatShading: true });
          const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), bm); body.scale.set(1.3, 0.95, 0.85); body.position.set(rx, ry + 0.55, zc); body.castShadow = true; G.decor.add(body);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mats.yellow); head.position.set(rx - 0.55, ry + 1.05, zc); G.decor.add(head); between(G.decor, V(rx - 0.4, ry + 0.7, zc), V(rx - 0.55, ry + 1.0, zc), 0.1, mats.yellow, 6);
          const comb = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), mats.red); comb.position.set(rx - 0.55, ry + 1.3, zc); G.decor.add(comb); const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), mats.gold); beak.rotation.z = Math.PI / 2; beak.position.set(rx - 0.78, ry + 1.05, zc); G.decor.add(beak);
          [mats.blue, mats.leafL, mats.red, mats.yellow, mats.dark].forEach((m, i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.75, 4), m); f.position.set(rx + 0.6, ry + 0.85 + i * 0.04, zc - 0.2 + i * 0.1); f.rotation.z = -0.9 + i * 0.12; G.decor.add(f); });
          between(G.decor, V(s.x0 + 0.1, 0, s.z1), V(s.x0 + 0.1, 2.9, s.z1), 0.03, mats.bamboo); [mats.red, mats.yellow, mats.leafL, mats.blue].forEach((m, i) => box(G.decor, s.x0 + 0.12, s.x0 + 0.16, 2.1 + i * 0.18, 2.24 + i * 0.18, s.z1 + 0.02, s.z1 + 0.5, m));
          plane(G.decor, 0.6, 1.5, signMat('雞公欖', '#1e3326', '#ffe39a'), V(s.x0 - 0.35, 1.5, zc), Math.PI / 2, true);
        }
        break;
      }
      case 'trike': {
        box(G.map, s.x0 + 0.1, s.x1 - 0.1, 0.5, s.h, s.z0, s.z0 + 1.6, [s.team ? mats.red : mats.blue, mats.wood], H(s));
        box(G.map, s.x0 + 0.1, s.x1 - 0.1, 0, 0.5, s.z0 + 0.2, s.z0 + 1.4, mats.dark, H(s));
        const wg = new THREE.TorusGeometry(0.32, 0.07, 8, 16);
        [[s.x0 + 0.05, s.z0 + 0.8], [s.x1 - 0.05, s.z0 + 0.8], [(s.x0 + s.x1) / 2, s.z1 - 0.3]].forEach(([x, z]) => { const w = new THREE.Mesh(wg, mats.dark); w.position.set(x, 0.38, z); w.rotation.y = Math.PI / 2; G.decor.add(w); });
        between(G.decor, V((s.x0 + s.x1) / 2, 0.4, s.z1 - 0.3), V((s.x0 + s.x1) / 2, 1.0, s.z0 + 1.7), 0.04, mats.iron);
        const hb = new THREE.Mesh(boxGeo(s.x0 + 0.4, s.x1 - 0.4, 1.0, 1.06, s.z0 + 1.68, s.z0 + 1.74), mats.iron); G.decor.add(hb);
        const m = new THREE.Mesh(boxGeo(s.x0, s.x1, 0, s.h, s.z0, s.z1), mats.dark); m.visible = false; m.userData = { hy: s.h, solid: true, proxy: true }; G.map.add(m);
        if (!s.team) steamerStack((s.x0 + s.x1) / 2, s.z0 + 0.8, s.h, 0.5);
        else for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.14, 0.22), 0), [mats.flower, mats.yellow, mats.white, mats.leafL][i % 4]); f.position.set(rr(s.x0 + 0.3, s.x1 - 0.3), s.h + rr(0.1, 0.4), rr(s.z0 + 0.2, s.z0 + 1.4)); G.decor.add(f); }   // flower-market trike
        break;
      }
      case 'landing': box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, mats.stone, H(s)); break;
      case 'deck': {
        box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, [mats.stone, mats.granite], H(s));
        [s.x0, s.x1].forEach(x => { for (let i = 0; i < 3; i++) { const z0 = -3.5 + i * 7 / 3 + 0.25, z1 = z0 + 7 / 3 - 0.5; prism(G.map, [[z0, y0], [z1, y0], [z1, y0 - 0.25], [(z0 + z1) / 2, y0 - 0.05], [z0, y0 - 0.25]], 'z', x - 0.12, x + 0.12, mats.stone); } });
        break;
      }
      case 'hall2': {   // the ancestral hall: blue-brick walls, granite base, red doors, a flat roof terrace with a glazed ridge parapet
        box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.brick, mats.terrace], H(s)); plinth(s, 0.9);
        box(G.map, s.x0 - 0.12, s.x1 + 0.12, s.h - 0.35, s.h - 0.1, s.z0 - 0.12, s.z1 + 0.12, mats.plasterW, H(s));
        [[s.z1 + 0.03, 0], [s.z0 - 0.03, Math.PI]].forEach(([z, ry], i) => {
          plane(G.map, 1.8, 2.6, mats.red, V(0, 1.3 + 0.9 - 0.9, z), ry).position.y = 1.3 + 0.0;
          plane(G.map, 2.2, 0.55, plaqueMat(i ? '浪氏书院' : '墨浪祠'), V(0, 3.15, z + (i ? -0.01 : 0.01)), ry);
          // a green-tiled eave over the door
          const zz = i ? s.z0 : s.z1, sg = i ? -1 : 1;
          prism(G.map, [[zz, 3.45], [zz + sg * 0.9, 3.05], [zz + sg * 0.9, 2.95], [zz, 3.3]].map(([z, y]) => [z, y]), 'z', -1.6, 1.6, mats.greenTiles);
          [-1.25, 1.25].forEach(x => box(G.map, x - 0.16, x + 0.16, 0, 3.05, zz + sg * 0.62 - 0.16, zz + sg * 0.62 + 0.16, mats.stone));
          box(G.map, s.x0, s.x1, s.h, s.h + 0.12, i ? s.z0 : s.z1 - 0.24, i ? s.z0 + 0.24 : s.z1, mats.greenTiles, H(s));
        });
        break;
      }
      case 'gable': wokEar(s.x0, s.x1, s.z0, s.z1, s.y0, s.h); break;
      case 'ridge': {   // glazed ridge across the roof terrace: green-tile base, a crest of coloured ceramic figures, curled fish at both ends
        box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, [mats.greenTiles, mats.greenTiles], H(s));
        box(G.map, s.x0, s.x1, y0, y0 + 0.18, s.z0 - 0.06, s.z1 + 0.06, mats.plasterW, H(s));
        const cols = [mats.flower, mats.gold, mats.blue, mats.greenTiles, mats.plasterW];
        for (let j = 0; j < 14; j++) { const x = s.x0 + 0.25 + j * (s.x1 - s.x0 - 0.5) / 13; const g = new THREE.CylinderGeometry(0.07, 0.1, rr(0.28, 0.45), 6); g.translate(0, 0.18, 0); const m = new THREE.Mesh(g, cols[j % 5]); m.position.set(x, s.h, 0); m.castShadow = true; G.map.add(m); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), cols[(j + 2) % 5]); hd.position.set(x, s.h + 0.42, 0); G.map.add(hd); }
        [s.x0 + 0.1, s.x1 - 0.1].forEach((x, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 8, 16, Math.PI * 1.4), mats.blue); t.position.set(x, s.h + 0.35, 0); t.rotation.set(0, Math.PI / 2, i ? 0.3 : Math.PI - 0.3); G.map.add(t); });
        break;
      }
      case 'zhl': {   // 鎮海樓 (the "five-storey tower"): red walls, a green glazed eave round every storey; the 4 m terrace is the high point
        box(G.map, s.x0, s.x1, 0, s.h, s.z0, s.z1, [mats.redwall, mats.terrace], H(s)); box(G.map, s.x0 - 0.06, s.x1 + 0.06, 0, 0.7, s.z0 - 0.06, s.z1 + 0.06, mats.redstone, H(s));
        [1.95, 3.8].forEach(y => { box(G.decor, s.x0 - 0.38, s.x1 + 0.38, y, y + 0.1, s.z0 - 0.38, s.z1 + 0.38, mats.greenTiles); box(G.decor, s.x0 - 0.12, s.x1 + 0.12, y - 0.14, y, s.z0 - 0.12, s.z1 + 0.12, mats.plasterW); });
        [[s.z1 + 0.02, 0, 'z'], [s.z0 - 0.02, Math.PI, 'z'], [s.x1 + 0.02, Math.PI / 2, 'x'], [s.x0 - 0.02, -Math.PI / 2, 'x']].forEach(([c, ry, ax]) => {
          [-1.5, 0, 1.5].forEach(d => { const p0 = ax === 'z' ? V(d, 2.95, c) : V(c, 2.95, d); plane(G.decor, 0.7, 1.1, mats.dark, p0, ry); if (d) { const p1 = ax === 'z' ? V(d, 1.2, c) : V(c, 1.2, d); plane(G.decor, 0.7, 1.1, mats.dark, p1, ry); } });
          const pd = ax === 'z' ? V(0, 0.95, c) : V(c, 0.95, 0); plane(G.decor, 1.3, 1.9, mats.doorRed, pd, ry);
        });
        break;
      }
      case 'citywall': {   // a stretch of the old city wall the tower stands on: big stone blocks, low battlements
        box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, [mats.redstone, mats.granite], H(s));
        break;
      }
      case 'zhltop': {   // the upper storeys and the hip roof (collision is the plain 2 x 2 box)
        const m = new THREE.Mesh(boxGeo(s.x0, s.x1, y0, s.h, s.z0, s.z1), mats.rock); m.visible = false; m.userData = { hy: s.h, solid: true, proxy: true }; G.map.add(m);
        box(G.decor, -1, 1, 4.0, 5.6, -1, 1, mats.redwall); box(G.decor, -1.42, 1.42, 5.55, 5.66, -1.42, 1.42, mats.greenTiles);
        box(G.decor, -0.85, 0.85, 5.66, 7.0, -0.85, 0.85, mats.redwall); box(G.decor, -1.25, 1.25, 6.95, 7.05, -1.25, 1.25, mats.greenTiles);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.15, 4), mats.greenTiles); roof.rotation.y = Math.PI / 4; roof.position.set(0, 7.05 + 0.57, 0); roof.castShadow = true; G.decor.add(roof);
        box(G.decor, -0.5, 0.5, 8.1, 8.22, -0.07, 0.07, mats.greenTiles);
        [[1.01, 0], [-1.01, Math.PI]].forEach(([z, ry]) => { plane(G.decor, 1.5, 0.5, plaqueMat('鎮海樓'), V(0, 5.05, z), ry); [-0.5, 0.5].forEach(x => plane(G.decor, 0.4, 0.7, mats.dark, V(x, 4.45, z), ry)); [-0.4, 0.4].forEach(x => plane(G.decor, 0.35, 0.6, mats.dark, V(x, 6.3, z * 0.86), ry)); });
        [[1.01, Math.PI / 2], [-1.01, -Math.PI / 2]].forEach(([x, ry]) => { [-0.5, 0.5].forEach(z => plane(G.decor, 0.4, 0.7, mats.dark, V(x, 4.6, z), ry)); });
        break;
      }
      case 'boat': { const m = new THREE.Mesh(boxGeo(s.x0, s.x1, y0, s.h, s.z0, s.z1), mats.rock); m.visible = false; m.userData = { hy: s.h, solid: true, proxy: true }; G.map.add(m); break; }
      default: box(G.map, s.x0, s.x1, y0, s.h, s.z0, s.z1, mats.plaster, H(s));
    }
  }
  // canal landing-step side walls are plain granite; railings of the canal exits (outside) are iron grilles
  [-XH, XH].forEach(x => { for (let z = CANAL.z0 + 0.3; z < CANAL.z1; z += 0.35) between(G.map, V(x, CANAL.bed, z), V(x, 0.2, z), 0.04, mats.iron, 5); });

  // ================= v2 dressing: real shops and landmarks. Visual only (collision comes from the solids above).
  // Everything is written in team-0 coordinates and placed for both halves; the two halves get DIFFERENT shops.
  const W2 = (t, x, y, z) => V(t ? -x : x, y, t ? -z : z);
  const RY = (t, r) => r + (t ? Math.PI : 0);
  const bx = (t, g, x0, x1, y0, y1, z0, z1, m, o) => t ? box(g, -x1, -x0, y0, y1, -z1, -z0, m, o) : box(g, x0, x1, y0, y1, z0, z1, m, o);
  const prismT = (t, g, pts, axis, a0, a1, m) => t ? prism(g, pts.map(([u, y]) => [-u, y]).reverse(), axis, -a1, -a0, m) : prism(g, pts, axis, a0, a1, m);
  const face = (tex, w, h, pos, ry, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.8 }, o)); m.userData.unit = true; const p = plane(G.decor, w, h, m, pos, ry); p.receiveShadow = true; return p; };
  const nrm = (ry, d) => V(Math.sin(ry) * d, 0, Math.cos(ry) * d);
  const manchuWin = (t, x, y, z, ry, w = 1.4, h = 1.5) => { const r = RY(t, ry), p = W2(t, x, y, z); plane(G.decor, w + 0.28, h + 0.28, mats.stone, p, r); plane(G.decor, w, h, mats.manchu, p.clone().add(nrm(r, 0.02)), r); };

  // ---- shops under the arcade: three per side, six different ones in all
  const ARC = [
    [['hzl', 8, 16, '黃振龍涼茶', '#0f5a3a', '#f6d443'], ['yuanji', 16, 26, '源記腸粉', '#fffdf4', '#c0261c'], ['nanxin', 26, 36, '南信甜品', '#a3171a', '#f1cf6b']],
    [['mingji', 8, 18, '明記腸粉', '#f5c518', '#b3201a'], ['chentianji', 18, 26, '陳添記魚皮', '#f7f1dc', '#b3201a'], ['hsh', 26, 36, '皇上皇臘味', '#c11a1f', '#f6d24a']],
  ];
  const PROP = {
    hzl: t => [10.5, 13.5].forEach(z => { const p = W2(t, 25.55, 0, z); cyl(G.decor, p.x, 0, p.z, 0.3, 0.3, 0.95, mats.teal, 10); [[0.3, 1.25], [0.19, 1.66]].forEach(([r, y]) => { const a = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mats.gold); a.position.set(p.x, y, p.z); a.castShadow = true; G.decor.add(a); }); cyl(G.decor, p.x, 1.8, p.z, 0.05, 0.07, 0.14, mats.gold, 8); }),
    yuanji: t => { bx(t, G.decor, 25.45, 25.95, 0, 1.15, 17.2, 18.8, mats.steel); [0, 1, 2].forEach(i => { const p = W2(t, 25.7, 1.15 + i * 0.12, 18); cyl(G.decor, p.x, p.y, p.z, 0.3, 0.3, 0.1, mats.bamboo, 12); }); },
    nanxin: t => { bx(t, G.decor, 25.5, 25.95, 0, 0.9, 27, 30, mats.red); const gm = new THREE.MeshStandardMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.35, roughness: 0.1 }); bx(t, G.decor, 25.5, 25.95, 0.9, 1.45, 27, 30, gm, { cast: false }); for (let i = 0; i < 6; i++) { const p = W2(t, 25.72, 0.92, 27.3 + i * 0.48); cyl(G.decor, p.x, p.y, p.z, 0.1, 0.15, 0.1, mats.plasterW, 10); } },
    mingji: t => [11, 15].forEach(z => { const p = W2(t, 25.3, 0, z); cyl(G.decor, p.x, 0, p.z, 0.05, 0.05, 0.72, mats.iron, 6); cyl(G.decor, p.x, 0.72, p.z, 0.45, 0.45, 0.05, mats.plasterW, 16); [-0.7, 0.7].forEach(d => { const q = W2(t, 25.3, 0, z + d); cyl(G.decor, q.x, 0, q.z, 0.16, 0.16, 0.45, mats.red, 10); }); }),
    chentianji: t => { bx(t, G.decor, 25.5, 25.95, 0, 1.0, 20.5, 23.5, mats.steel); for (let i = 0; i < 4; i++) { const p = W2(t, 25.72, 1.0, 20.9 + i * 0.7); cyl(G.decor, p.x, p.y, p.z, 0.22, 0.22, 0.04, mats.plasterW, 14); } },
    hsh: t => { between(G.decor, W2(t, 25.6, 1.72, 27), W2(t, 25.6, 1.72, 35), 0.025, mats.wood, 5); const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5), mats.sausage, 40), o = new THREE.Object3D(); for (let i = 0; i < 40; i++) { o.position.copy(W2(t, 25.6, 1.42 - (i % 3) * 0.03, 27.2 + i * 0.195)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } G.decor.add(im); },
  };
  [0, 1].forEach(t => ARC[t].forEach(([key, z0, z1, name, bg, fg]) => {
    const zc = (z0 + z1) / 2;
    face(T.shopFace(key, z1 - z0), z1 - z0, 2.6, W2(t, 25.97, 1.3, zc), RY(t, -Math.PI / 2));
    bx(t, G.decor, 25.6, 26, 0, 2.6, z1 - 0.12, z1 + 0.12, mats.plasterW);
    const sg = plane(G.decor, 0.8, Math.min(2.5, name.length * 0.5), signMat(name, bg, fg), W2(t, 19.9, 4.3, zc), 0, true); sg.castShadow = true;
    bx(t, G.decor, 20.21, 20.29, 3.0, 5.6, zc - 0.04, zc + 0.04, mats.iron);
    PROP[key](t);
  }));

  // ---- the small house in the middle street: 吳財記麵家 on one half, 順記冰室 on the other
  [['wuxi', '吳系茶餐廳', '#c8202a', '#ffffff'], ['gzjj', '廣州酒家', '#7a1512', '#f3d98a']].forEach(([key, name, bg, fg], t) => {
    face(T.shopFace(key, 7, 2.4), 7, 2.4, W2(t, -4.97, 1.2, 21.5), RY(t, Math.PI / 2));
    const m = new THREE.MeshStandardMaterial({ map: T.plaque(name, bg, fg), roughness: 0.6 }); m.userData.unit = true;
    plane(G.decor, 3.6, 0.9, m, W2(t, -5.0, 3.25, 21.5), RY(t, Math.PI / 2), true).castShadow = true;
    [20.2, 22.8].forEach(z => bx(t, G.decor, -5.06, -4.98, 2.75, 3.3, z - 0.03, z + 0.03, mats.iron));
  });

  // ---- tea houses behind the spawns: 陶陶居 (black-lacquer board, gold characters, the hexagonal 可觀亭 on the roof) and 蓮香樓
  const TEA = [
    { name: '陶陶居', o: { wall: '#e7dcc0', trim: '#f8f2e3', col: '#8e1f1a', board: '#141210', gold: '#e8c15a', rail: '#2a5a44', side: ['正宗粵菜', '星期美點'] } },
    { name: '蓮香樓', o: { wall: '#dcc9a6', trim: '#fff6e6', col: '#4a2416', board: '#7a1512', gold: '#f3d98a', rail: '#7a1512', side: ['蓮蓉月餅', '龍鳳禮餅'] } },
  ];
  TEA.forEach((c, t) => {
    face(T.teaFace(c.name, 16, 9, c.o), 16, 9, W2(t, -18, 4.5, 43.97), RY(t, Math.PI));
    face(T.teaFace(c.name, 8, 7, Object.assign({}, c.o, { side: null })), 8, 7, W2(t, -9.97, 5.5, 48), RY(t, Math.PI / 2));
    face(T.teaFace(c.name, 36, 12.6, c.o), 36, 12.6, W2(t, 8, 8.3, 51.97), RY(t, Math.PI));
    const p = W2(t, -18, 9, 48);
    if (!t) {   // 可觀亭: three tiers, six sides, green glazed tiles
      for (let i = 0; i < 3; i++) { const r = 2.7 - i * 0.65, y = p.y + i * 1.55; cyl(G.decor, p.x, y, p.z, r * 0.6, r * 0.6, 1.15, mats.plasterW, 6); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cyl(G.decor, p.x + Math.cos(a) * r * 0.6, y, p.z + Math.sin(a) * r * 0.6, 0.07, 0.07, 1.15, mats.red, 6); } const roof = new THREE.Mesh(new THREE.ConeGeometry(r, 0.8, 6), mats.greenTiles); roof.position.set(p.x, y + 1.15 + 0.4, p.z); roof.castShadow = true; G.decor.add(roof); }
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mats.gold); tip.position.set(p.x, p.y + 5.05, p.z); G.decor.add(tip);
    } else {    // 蓮香樓: a curved parapet with the name over the corner
      const q = W2(t, -18, 9, 44.3); const pts = [[-4, 9], [4, 9], [4, 9.6]]; for (let j = 1; j < 12; j++) { const u = j / 12; pts.push([4 - 8 * u, 9.6 + 1.5 * Math.sin(u * Math.PI)]); } pts.push([-4, 9.6]);
      prism(G.decor, pts.map(([x, y]) => [x + q.x, y]), 'x', q.z - 0.2, q.z + 0.2, mats.plasterW);
      const m = new THREE.MeshStandardMaterial({ map: T.plaque('蓮香樓', '#7a1512', '#f3d98a'), roughness: 0.6 }); m.userData.unit = true; plane(G.decor, 4.2, 1.2, m, V(q.x, 10.0, q.z + 0.22), 0);
    }
  });

  // ---- 西關大屋, dressed after the real thing: granite footing + blue brick (solids), then
  //      腳門 / 趟櫳 / 大門 at the gate, 滿洲窗, 青雲巷 gateways, a paved 天井 with side eaves, the 正廳 with its screen doors
  [0, 1].forEach(t => {
    [18.5, 27.5].forEach(z => manchuWin(t, -14.97, 1.55, z, Math.PI / 2));                       // street wall, either side of the gate
    [[11.97, Math.PI], [34.03, 0]].forEach(([z, ry]) => {                                        // the two wing ends
      [-18, -21.3].forEach(x => manchuWin(t, x, 1.55, z, ry, 1.2, 1.4));
      const r = RY(t, ry), p = W2(t, -24.4, 1.1, z); plane(G.decor, 1.5, 2.3, mats.stone, p.clone().add(V(0, 0.05, 0)), r); plane(G.decor, 1.1, 2.1, mats.dark, p.clone().add(nrm(r, 0.02)), r);
      const m = new THREE.MeshStandardMaterial({ map: T.plaque('青雲巷', '#d7d1c4', '#3a3a3a'), roughness: 0.8 }); m.userData.unit = true; plane(G.decor, 1.2, 0.36, m, W2(t, -24.4, 2.38, z).add(nrm(r, 0.03)), r);
    });
    // gate: granite jambs, four half-height 腳門 leaves folded outward, two big 大門 leaves swung into the yard
    bx(t, G.decor, -16.06, -14.94, 0, 2.2, 20.8, 21.0, mats.stone); bx(t, G.decor, -16.06, -14.94, 0, 2.2, 25.0, 25.2, mats.stone);
    [[21.05, -1], [24.95, 1]].forEach(([z, sgn]) => {
      [0, 1].forEach(i => plane(G.decor, 0.5, 1.25, mats.woodDS, W2(t, -14.72 + i * 0.36, 1.05, z + sgn * (-0.12 - i * 0.02)), RY(t, Math.PI / 2 + sgn * (i ? 0.25 : 1.25))));
      plane(G.decor, 1.9, 2.15, mats.doorRed, W2(t, -17.0, 1.08, z - sgn * 0.18), RY(t, 0));
      [0.55, 1.5].forEach(y => bx(t, G.decor, -17.9, -16.1, y, y + 0.06, z - sgn * 0.18 - 0.03, z - sgn * 0.18 + 0.03, mats.gold));
    });
    for (let i = 0; i < 13; i++) between(G.decor, W2(t, -15.5, 0.15 + i * 0.16, 24.35), W2(t, -15.5, 0.15 + i * 0.16, 24.98), 0.045, mats.wood, 6);   // 趟櫳 pushed open
    bx(t, G.decor, -15.6, -15.4, 0, 2.2, 24.3, 24.4, mats.wood);
    // 天井: darker paving, the fish vat and potted trees on the 花台
    bx(t, G.decor, -23, -16, 0.0, 0.025, 16, 30, mats.bed, { cast: false });
    { const p = W2(t, -19.2, 1.0, 22); cyl(G.decor, p.x, p.y, p.z, 0.42, 0.5, 0.55, mats.blue, 14); cyl(G.decor, p.x, p.y + 0.5, p.z, 0.47, 0.47, 0.06, mats.white, 14);
      [23.4, 24.3].forEach(z => { const q = W2(t, -19.3, 1.0, z); cyl(G.decor, q.x, q.y, q.z, 0.16, 0.22, 0.25, mats.sausage, 10); cyl(G.decor, q.x, q.y + 0.25, q.z, 0.04, 0.05, 0.5, mats.bark, 5); [[0.2, 0.75], [-0.18, 0.9], [0.05, 1.05]].forEach(([d, y]) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mats.leaf); l.scale.set(1.3, 0.5, 1.3); l.position.set(q.x + d, q.y + y, q.z + d * 0.5); G.decor.add(l); }); }); }
    // side eaves (廊) along both wings, on thin timber posts
    prismT(t, G.decor, [[16, 2.5], [17.15, 2.2], [17.15, 2.12], [16, 2.38]], 'z', -23, -16, mats.tiles);
    prismT(t, G.decor, [[30, 2.38], [28.85, 2.12], [28.85, 2.2], [30, 2.5]], 'z', -23, -16, mats.tiles);
    [[-22.3, 17.05], [-19.5, 17.05], [-16.7, 17.05], [-22.3, 28.95], [-19.5, 28.95], [-16.7, 28.95]].forEach(([x, z]) => { const p = W2(t, x, 0, z); cyl(G.decor, p.x, 0, p.z, 0.06, 0.06, 2.14, mats.wood, 6); });
    // 正廳 front: a row of manchu-glass screen doors, the open middle bay with the hall board, eave on two granite columns
    for (let i = 0; i < 10; i++) { const z = 16.9 + i * 1.3 + 0.2; if (z > 20.9 && z < 25.1) continue; plane(G.decor, 1.16, 2.5, mats.manchu, W2(t, -22.96, 1.3, z), RY(t, Math.PI / 2)); }
    plane(G.decor, 4.2, 2.7, mats.dark, W2(t, -22.96, 1.35, 23), RY(t, Math.PI / 2));
    { const m = new THREE.MeshStandardMaterial({ map: T.plaque('積厚流光', '#5a1512', '#e8c15a'), roughness: 0.6 }); m.userData.unit = true; plane(G.decor, 3.0, 0.75, m, W2(t, -22.93, 2.25, 23), RY(t, Math.PI / 2)); }
    plane(G.decor, 13.4, 0.5, mats.manchu, W2(t, -22.96, 3.0, 23), RY(t, Math.PI / 2));
    prismT(t, G.decor, [[-23, 3.75], [-21.85, 3.4], [-21.85, 3.32], [-23, 3.62]], 'x', 16.2, 29.8, mats.tiles);
    [20.6, 25.4].forEach(z => { const p = W2(t, -22.0, 0, z); cyl(G.decor, p.x, 0, p.z, 0.14, 0.16, 3.32, mats.stone, 10); });
  });

  // ---- 龍舟 moored in the canal: long narrow hull (the real ones are ~38 m × 1.2 m; this one is 10.5 m), dragon head and tail,
  //      drum, the ceremonial umbrella and flags. One red boat, one green boat.
  [0, 1].forEach(t => {
    const tm = t ? mats.greenTiles : mats.red, z = 0.8, y = -1.1;
    const pts = [[8.5, 0.8], [9.7, 0.26], [17.8, 0.26], [19, 0.8], [17.8, 1.34], [9.7, 1.34]].map(([x, zz]) => t ? [-x, -zz] : [x, zz]);
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, zz]) => new THREE.Vector2(x, zz))), { depth: 0.6, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, y, 0);
    const hull = new THREE.Mesh(g, [mats.wood, mats.hull]); hull.castShadow = true; hull.receiveShadow = true; G.decor.add(hull);
    bx(t, G.decor, 9.6, 17.9, y - 0.12, y - 0.04, 0.22, 0.28, tm); bx(t, G.decor, 9.6, 17.9, y - 0.12, y - 0.04, 1.32, 1.38, tm);
    for (let x = 10; x < 17.8; x += 0.95) bx(t, G.decor, x, x + 0.14, y, y + 0.1, 0.34, 1.26, mats.wood);
    // head at the inner end (toward the Five Rams), tail at the outer end
    between(G.decor, W2(t, 9.1, y, z), W2(t, 8.2, y + 0.95, z), 0.17, tm, 8);
    bx(t, G.decor, 7.55, 8.4, y + 0.8, y + 1.2, z - 0.2, z + 0.2, tm); bx(t, G.decor, 7.4, 7.75, y + 0.82, y + 0.98, z - 0.16, z + 0.16, mats.gold);
    [-0.14, 0.14].forEach(d => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 5), mats.gold); h.position.copy(W2(t, 8.3, y + 1.38, z + d)); h.rotation.z = t ? 0.5 : -0.5; G.decor.add(h); const ey = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mats.white); ey.position.copy(W2(t, 7.8, y + 1.1, z + d * 1.45)); G.decor.add(ey); });
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), mats.yellow); f.position.copy(W2(t, 8.5 + i * 0.13, y + 0.75 - i * 0.14, z)); G.decor.add(f); }
    between(G.decor, W2(t, 18.3, y, z), W2(t, 19.1, y + 0.8, z), 0.1, tm, 6);
    // drum, umbrella, flags (kept clear of the stone bridge above the outer half of the boat)
    { const p = W2(t, 12.4, y, z); cyl(G.decor, p.x, y + 0.1, p.z, 0.36, 0.36, 0.5, mats.red, 14); cyl(G.decor, p.x, y + 0.6, p.z, 0.37, 0.37, 0.03, mats.white, 14); }
    { const p = W2(t, 11.2, y, z); cyl(G.decor, p.x, y, p.z, 0.03, 0.03, 2.5, mats.bamboo, 6); const c = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 12), mats.yellow); c.position.set(p.x, y + 2.5, p.z); G.decor.add(c); cyl(G.decor, p.x, y + 2.0, p.z, 0.75, 0.75, 0.28, tm, 12); }
    [9.9, 10.5, 13.2].forEach((x, i) => { const p = W2(t, x, y, z); cyl(G.decor, p.x, y, p.z, 0.02, 0.02, 1.9, mats.bamboo, 5); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf2c230 : (t ? 0x2f9b62 : 0xc8291c), side: THREE.DoubleSide })); f.position.set(p.x + (t ? -0.36 : 0.36), y + 1.65, p.z); G.decor.add(f); });
  });

  // ---------------- trees
  function kapok(x, y, z, k) {
    const h = 6.8 * k; cyl(G.decor, x, y, z, 0.32 * k, 0.16 * k, h, mats.bark, 9);
    const fl = new THREE.IcosahedronGeometry(0.17, 0); const pos = [];
    [3.2, 4.4, 5.5].forEach((hy, tier) => { for (let b = 0; b < 5; b++) { const a = b / 5 * Math.PI * 2 + tier * 0.7, L = (2.3 - tier * 0.45) * k; const p0 = V(x, y + hy * k, z), p1 = V(x + Math.cos(a) * L, y + (hy + 0.5) * k, z + Math.sin(a) * L); between(G.decor, p0, p1, 0.07 * k, mats.bark, 5); for (let f = 0; f < 6; f++) { const t = rr(0.35, 1.05); pos.push(V(p0.x + (p1.x - p0.x) * t + rr(-0.25, 0.25), p0.y + (p1.y - p0.y) * t + rr(0, 0.35), p0.z + (p1.z - p0.z) * t + rr(-0.25, 0.25))); } } });
    for (let f = 0; f < 10; f++) pos.push(V(x + rr(-0.5, 0.5), y + h + rr(-0.2, 0.3), z + rr(-0.5, 0.5)));
    const im = new THREE.InstancedMesh(fl, mats.flower, pos.length), o = new THREE.Object3D();
    pos.forEach((p, i) => { o.position.copy(p); o.rotation.set(rnd() * 3, rnd() * 3, 0); o.scale.setScalar(rr(0.8, 1.4)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.castShadow = true; G.decor.add(im);
  }
  function banyan(x, y, z, k) {
    cyl(G.decor, x, y, z, 0.9, 0.55, 4.2, mats.bark, 10);
    for (let b = 0; b < 5; b++) { const a = b / 5 * Math.PI * 2; between(G.decor, V(x, y + 3.4, z), V(x + Math.cos(a) * 2.6, y + 4.8, z + Math.sin(a) * 2.6), 0.22, mats.bark, 6); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = i ? rr(2.0, 3.4) : 0; const g = new THREE.IcosahedronGeometry(rr(2.0, 2.8), 1); g.scale(1, 0.62, 1); const m = new THREE.Mesh(g, i % 3 ? mats.leaf : mats.leafL); m.position.set(x + Math.cos(a) * r, y + rr(5.0, 6.2), z + Math.sin(a) * r); m.castShadow = true; m.receiveShadow = true; G.decor.add(m); }
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = rr(1.0, 2.3), top = y + rr(4.0, 4.6); between(G.decor, V(x + Math.cos(a) * r, y, z + Math.sin(a) * r), V(x + Math.cos(a) * r * 1.1, top, z + Math.sin(a) * r * 1.1), rr(0.025, 0.06), mats.bark, 4); }
  }
  M.trees.forEach(t => t.kind === 'kapok' ? kapok(t.x, t.y, t.z, t.k) : banyan(t.x, t.y, t.z, t.k));

  // ---------------- street dressing: lantern strings, signs on the arcade, laundry on roofs, water tank stands
  const lanternG = new THREE.SphereGeometry(0.17, 12, 8); lanternG.scale(1, 1.25, 1);
  function lanterns(a, b, sag, n) {
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag, a.z + (b.z - a.z) * t)); }
    const c = new THREE.CatmullRomCurve3(pts); G.decor.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.015, 4), mats.iron));
    for (let i = 1; i < n; i++) { const p = c.getPoint(i / n); const m = new THREE.Mesh(lanternG, mats.lantern); m.position.set(p.x, p.y - 0.25, p.z); G.decor.add(m); }
  }
  function laundry(a, b) {
    between(G.decor, V(a.x, a.y, a.z), V(a.x, a.y + 1.9, a.z), 0.04, mats.bamboo); between(G.decor, V(b.x, b.y, b.z), V(b.x, b.y + 1.9, b.z), 0.04, mats.bamboo);
    between(G.decor, V(a.x, a.y + 1.85, a.z), V(b.x, b.y + 1.85, b.z), 0.025, mats.bamboo);
    const cols = [0xe8d9b5, 0x4a7fc1, 0xd85a4a, 0xf2f2f0, 0x6fae6a, 0xf0c64a]; const n = 5;
    for (let i = 1; i <= n; i++) { const t = i / (n + 1), w = rr(0.4, 0.75), h = rr(0.6, 1.0); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: cols[((i * 3 + Math.floor(a.x)) % cols.length + cols.length) % cols.length], side: THREE.DoubleSide, roughness: 0.9 })); m.position.set(a.x + (b.x - a.x) * t, a.y + 1.82 - h / 2, a.z + (b.z - a.z) * t); m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2; m.castShadow = true; G.decor.add(m); }
  }
  [1, -1].forEach(sg => {
    const P = (x, y, z) => V(sg * x, y, sg * z);
    lanterns(P(20.3, 4.4, 27.8), P(-5, 3.0, 24.5), 0.6, 8);
    lanterns(P(-4, 4.6, 31), P(-15.5, 3.2, 31), 0.4, 5);
    laundry(P(-24.5, 2.6, 31), P(-17, 2.6, 33));
    laundry(P(-24.5, 2.6, 13), P(-18, 2.6, 15));
    laundry(P(-8, 2.0, 50), P(-2, 2.0, 51));
    laundry(P(19, 2.0, 50.5), P(25, 2.0, 49));
  });

  // ---------------- surroundings: building rows round the park, the tea house behind each spawn, canal continuing outside
  function building(x0, x1, z0, z1, h, face, variant) {
    const len = face === 'x' ? z1 - z0 : x1 - x0;
    const sideMat = mats['fac' + variant];
    const fm = [mats.plaster, mats.plaster, mats.terrace, mats.plaster, mats.plaster, mats.plaster];
    const idx = { '+x': 0, '-x': 1, '+z': 4, '-z': 5 };
    face.split(',').forEach(f => fm[idx[f]] = sideMat);
    const b = box(G.env, x0, x1, 0, h, z0, z1, fm); b.castShadow = h < 20;
    // AC units and a water tank on some roofs
    if (rnd() < 0.5) cyl(G.env, (x0 + x1) / 2 + rr(-1, 1), h, (z0 + z1) / 2 + rr(-1, 1), 0.7, 0.7, 1.4, mats.steel, 12);
  }
  const ring = [];
  for (let z = -ZH; z < ZH; z += 8) { if (z + 8 > CANAL.z0 && z < CANAL.z1) continue; ring.push(['+x', z]); ring.push(['-x', z]); }
  ring.forEach(([side, z], i) => {
    const za = Math.max(z, -ZH), zb = Math.min(z + 8, ZH); if (zb - za < 2) return;
    const v = (i * 5 + (side === '+x' ? 1 : 3)) % 8, h = 12.8 + (i % 3 === 0 ? 3.2 : 0);
    if (side === '+x') building(XH, XH + 10, za, zb, h, '-x', v); else building(-XH - 10, -XH, za, zb, h, '+x', v);
  });
  // the canal gaps in the rows: an outside street bridge across each exit
  [[1], [-1]].forEach(([sx]) => {
    const pts = [[4.5, 0], [0, 0.7], [-4.5, 0], [-3.5, 0], [-3.5, -1.8]];
    for (let i = 1; i < 20; i++) { const z = -3.5 + 7 * i / 20, u = z / 3.5; pts.push([z, -1.8 + 2.4 * Math.sqrt(1 - u * u)]); }
    pts.push([3.5, -1.8], [3.5, 0]);
    prism(G.env, pts, 'z', sx > 0 ? XH + 4 : -XH - 9, sx > 0 ? XH + 9 : -XH - 4, mats.stone);
    building(sx > 0 ? XH + 12 : -XH - 22, sx > 0 ? XH + 22 : -XH - 12, -12, -4.5, 9.6, sx > 0 ? '-x' : '+x', 2);
    building(sx > 0 ? XH + 12 : -XH - 22, sx > 0 ? XH + 22 : -XH - 12, 4.5, 12, 12.8, sx > 0 ? '-x' : '+x', 5);
  });
  // street paving outside the park (with the canal cut through it)
  [[CANAL.z1, 700], [-700, CANAL.z0]].forEach(([z0, z1]) => { const m = box(G.env, -700, 150, -0.35, -0.02, z0, z1, mats.granite, { cast: false }); });
  // tea houses behind the spawn terraces, rows at the far ends
  [[1], [-1]].forEach(([s]) => {
    const z0 = s > 0 ? ZH : -ZH - 10, z1 = s > 0 ? ZH + 10 : -ZH;
    const b = box(G.env, -XH - 10, XH + 10, 0, 14, z0, z1, mats.plaster); b.castShadow = false;
    plane(G.env, 18, 12.8, mats.fac4, V(-s * 17, 6.4, s > 0 ? ZH - 0.02 : -ZH + 0.02), s > 0 ? Math.PI : 0);
    box(G.env, -XH - 10, XH + 10, 14, 14.4, z0 - 0.3, z1 + 0.3, mats.plasterW);
  });

  // old-town roofscape (instanced low houses, mostly pitched grey-tile roofs), thinning out with distance; the river side stays open
  {
    const houses = [], roofs = [], RIVER_X = 150, C = 11;
    for (let gx = -40; gx < 14; gx++) for (let gz = -40; gz < 40; gz++) {
      const x = gx * C + C / 2, z = gz * C + C / 2;
      if (x > RIVER_X - 14) continue;
      if (Math.abs(x) < XH + 24 && Math.abs(z) < ZH + 22) continue;
      if (Math.abs(z) < 9) continue;                                   // the canal keeps running out to the river
      if (gx % 6 === 0 || gz % 7 === 0) continue;                      // streets
      const d = Math.hypot(x, z); if (d > 430 || rnd() < 0.08 + d / 900) continue;
      const w = rr(7.5, 10.5), dd = rr(8.5, 10.5), h = rnd() < 0.86 ? rr(5, 11) : rr(14, 24);
      const px = x + rr(-0.6, 0.6), pz = z + rr(-0.6, 0.6);
      houses.push([px, pz, w, dd, h]); if (h < 13 && rnd() < 0.72) roofs.push([px, pz, w, dd, h]);
    }
    const hg = new THREE.BoxGeometry(1, 1, 1); hg.translate(0, 0.5, 0);
    const him = new THREE.InstancedMesh(hg, new THREE.MeshStandardMaterial({ roughness: 0.92 }), houses.length), o = new THREE.Object3D(), c = new THREE.Color();
    const pal = ['#e3d6b8', '#e2c4b9', '#e9e4d8', '#d4cfc4', '#c6d1d8', '#c7d8c9', '#c9c3b8', '#a96a55', '#d8cdb6'];
    houses.forEach(([x, z, w, d, h], i) => { o.position.set(x, 0, z); o.scale.set(w, h, d); o.rotation.set(0, 0, 0); o.updateMatrix(); him.setMatrixAt(i, o.matrix); him.setColorAt(i, c.set(pal[i % pal.length])); });
    him.receiveShadow = true; G.env.add(him);
    const rg = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.56, 0), new THREE.Vector2(0.56, 0), new THREE.Vector2(0, 0.4)]), { depth: 1, bevelEnabled: false }); rg.translate(0, 0, -0.5);
    const rim = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x666b70, roughness: 0.8 }), roofs.length);
    roofs.forEach(([x, z, w, d, h], i) => { o.position.set(x, h, z); o.scale.set(w, Math.min(w, 7) * 0.85, d + 0.6); o.updateMatrix(); rim.setMatrixAt(i, o.matrix); });
    G.env.add(rim);
    // a few wok-ear gables poking out of the roofscape
    const eg = new THREE.ExtrudeGeometry(new THREE.Shape([[-0.5, 0], [-0.55, 0.45], ...Array.from({ length: 13 }, (_, k) => { const a = Math.PI - k / 12 * Math.PI; return [Math.cos(a) * 0.55, 0.45 + Math.sin(a) * 0.55]; }), [0.5, 0]].map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.04, bevelEnabled: false });
    const ears = roofs.filter((_, i) => i % 9 === 0), eim = new THREE.InstancedMesh(eg, new THREE.MeshStandardMaterial({ color: 0x5b6166, roughness: 0.8 }), ears.length * 2);
    ears.forEach(([x, z, w, d, h], i) => [-1, 1].forEach((s, j) => { o.position.set(x, h, z + s * d / 2); o.scale.set(w, w * 0.55, w); o.updateMatrix(); eim.setMatrixAt(i * 2 + j, o.matrix); }));
    G.env.add(eim);
  }
  // the Pearl River to the east, the new-town skyline and the tower on the far bank, Baiyun hills to the north-west
  {
    const river = new THREE.Mesh(new THREE.PlaneGeometry(520, 9000), new THREE.MeshStandardMaterial({ color: 0x7d9f9b, roughness: 0.15, metalness: 0.25 }));
    river.rotation.x = -Math.PI / 2; river.position.set(150 + 260, -1.2, 0); G.env.add(river);
    box(G.env, 140, 152, -1.2, 0.3, -4500, 4500, mats.stone, { cast: false }); box(G.env, 668, 690, -1.2, 0.3, -4500, 4500, mats.stone, { cast: false });
    const far = new THREE.Mesh(new THREE.PlaneGeometry(4000, 9000), new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.set(690 + 2000, 0, 0); G.env.add(far);
    const sky = [], o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < 240; i++) {
      const x = rr(760, 1900), z = rr(-3600, 600), dc = Math.hypot(x - 1000, (z + 1700) * 0.7);
      const h = Math.max(40, rr(60, 330) * Math.max(0.35, 1.3 - dc / 1400)); sky.push([x, z, rr(28, 60), rr(28, 60), h]);
    }
    const sim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.55 }), sky.length);
    sky.forEach(([x, z, w, d, h], i) => { o.position.set(x, 0, z); o.scale.set(w, h, d); o.rotation.y = rr(-0.2, 0.2); o.updateMatrix(); sim.setMatrixAt(i, o.matrix); sim.setColorAt(i, c.set(['#a6b7c6', '#bfcad2', '#93a7b8', '#cfd3d4', '#b3bcc0'][i % 5])); });
    G.env.add(sim);
    // the tower: a twisted hyperboloid lattice round a core, mast on top (≈600 m)
    const tw = new THREE.Group(); tw.position.set(980, 0, -1900); G.env.add(tw);
    const tm = new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.45, metalness: 0.35 });
    const N = 24, sm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.8, 1.8, 1, 5).translate(0, 0.5, 0), tm, N * 2);
    for (let i = 0; i < N * 2; i++) {
      const a0 = i % N / N * Math.PI * 2, tw2 = i < N ? 1.7 : -1.7;
      const p0 = V(Math.cos(a0) * 80, 0, Math.sin(a0) * 55), p1 = V(Math.cos(a0 + tw2) * 27, 454, Math.sin(a0 + tw2) * 20);
      const d = p1.clone().sub(p0); o.position.copy(p0); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); o.scale.set(1, d.length(), 1); o.updateMatrix(); sm.setMatrixAt(i, o.matrix);
    }
    tw.add(sm);
    tw.add(new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 454, 18).translate(0, 227, 0), tm));
    // waist rings follow the narrowing lattice
    for (let k = 1; k <= 9; k++) {
      const y = k * 45.4, t = y / 454; let ra = 0, rb = 0;
      for (let j = 0; j < 64; j++) { const a0 = j / 64 * Math.PI * 2; const px = Math.cos(a0) * 80 * (1 - t) + Math.cos(a0 + 1.7) * 27 * t, pz = Math.sin(a0) * 55 * (1 - t) + Math.sin(a0 + 1.7) * 20 * t; ra = Math.max(ra, Math.abs(px)); rb = Math.max(rb, Math.abs(pz)); }
      const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 4, 48), tm); r.scale.set(ra, rb, 60); r.rotation.x = Math.PI / 2; r.position.y = y; tw.add(r);
    }
    tw.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 8, 146, 8).translate(0, 454 + 73, 0), tm));
    tw.rotation.y = 0.5;
    // hills
    const hm = new THREE.MeshStandardMaterial({ color: 0x86a08e, roughness: 1, flatShading: true });
    [[-1900, -1500, 650, 300], [-2400, -500, 850, 360], [-2300, 700, 700, 240], [-1500, -2500, 600, 220], [-900, 2400, 700, 200]].forEach(([x, z, r, h]) => { const g = new THREE.IcosahedronGeometry(1, 2); g.scale(r, h, r * 0.8); const m = new THREE.Mesh(g, hm); m.position.set(x, -30, z); G.env.add(m); });
  }
  // ---------------- sky, light
  {
    const sm = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color('#5c9fe0') }, mid: { value: new THREE.Color('#a9d0ee') }, hor: { value: new THREE.Color('#f1e6d2') }, sunDir: { value: V(0.55, 0.62, -0.55).normalize() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vD; void main(){ vec3 d = normalize(vD); float h = d.y; vec3 c = mix(mix(hor, mid, smoothstep(0.0, 0.22, h)), top, smoothstep(0.2, 0.8, h)); if (h < 0.0) c = hor; float s = max(dot(d, normalize(sunDir)), 0.0); c += vec3(1.0, 0.9, 0.7) * (pow(s, 900.0) * 5.0 + pow(s, 30.0) * 0.3 + pow(s, 5.0) * 0.12); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), sm); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky); G.skyMesh = sky;
  }
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0xb9a284, 1.05));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.position.set(55, 62, -55); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 260; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------------- overlays: height colouring, grid, ink test
  const HPAL = [[-1.0, '#3d7fb0'], [0.3, '#d9d3c6'], [0.75, '#c3d79a'], [1.5, '#93c17a'], [2.45, '#f2c94c'], [3.5, '#f2994a'], [99, '#e0574f']];
  const hColor = y => HPAL.find(([t]) => y < t)[1];
  const hMats = {}; const hMat = y => { const c = hColor(y); return hMats[c] || (hMats[c] = new THREE.MeshLambertMaterial({ color: c })); };
  G.map.traverse(o => { if (o.isMesh) { o.userData.orig = o.material; } });
  {
    const g = new THREE.Group();
    const minor = new THREE.LineBasicMaterial({ color: 0x1b1a2e, transparent: true, opacity: 0.22 }), major = new THREE.LineBasicMaterial({ color: 0x1b1a2e, transparent: true, opacity: 0.6 });
    const pts = [], ptsM = [];
    for (let x = -XH; x <= XH; x += 1) (x % 10 === 0 ? ptsM : pts).push(x, 0.03, -ZH, x, 0.03, ZH);
    for (let z = -ZH; z <= ZH; z += 1) (z % 10 === 0 ? ptsM : pts).push(-XH, 0.03, z, XH, 0.03, z);
    const mk = (p, m) => { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return new THREE.LineSegments(bg, m); };
    g.add(mk(pts, minor), mk(ptsM, major)); G.grid.add(g); G.grid.visible = false;
  }
  {
    const tex = T.ink(XH, ZH, (x, z) => { const s = Q.surfaces(x, z); return s.length && s[0] === 0 && !Q.inCanal(x, z); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * XH, 2 * ZH), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.25, metalness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = 0; m.position.y = 0.012; m.receiveShadow = true;
    // canvas y runs with +z; plane v runs with -z after rotation → flip
    G.ink.add(m); G.ink.visible = false;
  }

  // ---------------- state, controls
  const state = { mode: 'orbit', height: false, decor: true, deep: false, t: 0 };
  const orbit = { target: V(0, 0, 0), theta: 0.75, phi: 0.95, r: 120 };
  const fp = { pos: V(0, 2, 47), vel: V(0, 0, 0), yaw: 0, pitch: -0.05, keys: {}, squid: false, grounded: true };
  function placeOrbit() { const { target: t, theta, phi, r } = orbit; camera.position.set(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta)); camera.lookAt(t); }
  function placeFP() { const eye = fp.squid ? 0.45 : 1.55; camera.position.set(fp.pos.x, fp.pos.y + eye, fp.pos.z); camera.rotation.set(fp.pitch, fp.yaw, 0, 'YXZ'); }
  const el = renderer.domElement; let drag = null;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: 0 };
  });
  el.addEventListener('pointermove', e => {
    if (state.mode === 'fp' && document.pointerLockElement === el) { fp.yaw -= e.movementX * 0.0022; fp.pitch = Math.max(-1.45, Math.min(1.45, fp.pitch - e.movementY * 0.0022)); return; }
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (state.mode === 'fp') { fp.yaw -= dx * 0.004; fp.pitch = Math.max(-1.45, Math.min(1.45, fp.pitch - dy * 0.004)); return; }
    if (drag.b === 2 || drag.shift) { const s = orbit.r * 0.0016, f = V(Math.sin(orbit.theta), 0, Math.cos(orbit.theta)), r = V(f.z, 0, -f.x); orbit.target.addScaledVector(r, -dx * s).addScaledVector(f, -dy * s); orbit.target.x = Math.max(-80, Math.min(80, orbit.target.x)); orbit.target.z = Math.max(-110, Math.min(110, orbit.target.z)); }
    else { orbit.theta -= dx * 0.005; orbit.phi = Math.max(0.05, Math.min(1.5, orbit.phi - dy * 0.005)); }
  });
  el.addEventListener('pointerup', e => { if (state.mode === 'fp' && drag && drag.moved < 4 && el.requestPointerLock) { try { const p = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} } drag = null; });
  el.addEventListener('wheel', e => { if (state.mode !== 'orbit') return; e.preventDefault(); orbit.r = Math.max(8, Math.min(320, orbit.r * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  // pinch zoom on touch
  const touches = new Map(); let pinch0 = 0;
  el.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
  el.addEventListener('touchmove', e => { if (e.touches.length === 2 && state.mode === 'orbit') { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); orbit.r = Math.max(8, Math.min(320, orbit.r * pinch0 / d)); pinch0 = d; } }, { passive: true });
  const keyOn = e => { if (state.mode !== 'fp') return; const k = e.code; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) { fp.keys[k] = e.type === 'keydown'; e.preventDefault(); } };
  addEventListener('keydown', keyOn); addEventListener('keyup', keyOn);

  function stepFP(dt) {
    const K = fp.keys, f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    // no room to stand up here (under the centre deck, a low arch): stay a squid until there is
    const lowCeil = M.solids.some(so => so.t !== 'fence' && Q.inR(so, fp.pos.x, fp.pos.z, 0.3) && Q.bottom(so, fp.pos.x, fp.pos.z) > fp.pos.y + 0.01 && Q.bottom(so, fp.pos.x, fp.pos.z) < fp.pos.y + M.BODY_H);
    fp.squid = !!(K.ShiftLeft || K.ShiftRight) || lowCeil;
    const sp = fp.squid ? 5.0 : M.RUN, fx = -Math.sin(fp.yaw), fz = -Math.cos(fp.yaw);
    let vx = (fx * f + -fz * s), vz = (fz * f + fx * s); const L = Math.hypot(vx, vz) || 1; vx = vx / L * sp * (f || s ? 1 : 0); vz = vz / L * sp * (f || s ? 1 : 0);
    const p = fp.pos, r = fp.squid ? 0.25 : 0.35;
    const tryMove = (nx, nz) => {
      const st = fp.grounded ? M.STEP : 0.05;      // in the air you can't step up onto a ledge, only land on it
      if (Q.blocked(nx, nz, p.y, r, fp.squid, st)) return false;
      const sup = Q.support(nx, nz, p.y, st, fp.squid ? 0.5 : M.BODY_H); if (sup === -Infinity) return false;
      // head room under floating solids
      for (const so of M.solids) if (so.t !== 'fence' && Q.inR(so, nx, nz, r * 0.5)) { const b = Q.bottom(so, nx, nz); if (b > p.y + 0.01 && b < p.y + (fp.squid ? 0.5 : M.BODY_H) && Q.top(so, nx, nz) > p.y + st) return false; }
      p.x = nx; p.z = nz; return true;
    };
    tryMove(p.x + vx * dt, p.z) || 0; tryMove(p.x, p.z + vz * dt) || 0;
    if (K.Space && fp.grounded) { fp.vel.y = M.JUMP_V; fp.grounded = false; }
    fp.vel.y -= M.GRAV * dt; let ny = p.y + fp.vel.y * dt;
    if (fp.vel.y > 0) { for (const so of M.solids) if (so.t !== 'fence' && Q.inR(so, p.x, p.z)) { const b = Q.bottom(so, p.x, p.z); const head = fp.squid ? 0.5 : M.BODY_H; if (b >= p.y + head - 0.02 && b < ny + head) { ny = b - head; fp.vel.y = 0; } } }
    const head = fp.squid ? 0.5 : M.BODY_H, was = fp.grounded && fp.vel.y <= 0;
    let g = Q.support(p.x, p.z, Math.max(p.y, ny), was ? M.STEP : 0.05, head);   // grounded: follow steps and slopes up
    if (g === -Infinity) { g = Q.support(p.x, p.z, Math.max(p.y, ny), M.STEP, 0); if (g === -Infinity) { g = p.y; } }   // never fall out of the map
    if (ny <= g) { ny = g; fp.vel.y = 0; fp.grounded = true; } else fp.grounded = false;
    p.y = ny;
    if (state.deep && p.y < M.CANAL.deep - 0.2) { const sp0 = M.spawns[0]; p.set(sp0.x, sp0.y, sp0.z); fp.vel.set(0, 0, 0); hud('落水出局 → 回到出生点'); }
    if (p.y < -10) { const sp0 = M.spawns[0]; p.set(sp0.x, sp0.y, sp0.z); }
  }
  let hudT = 0; const hudEl = document.getElementById('vhud'); function hud(t) { if (hudEl) { hudEl.textContent = t; hudEl.classList.add('on'); hudT = 2.2; } }
  const readout = document.getElementById('vread');

  // ---------------- presets (fixed camera positions used for review screenshots)
  const PRESETS = {
    overview: { label: '全景', mode: 'orbit', target: [0, 0, -2], theta: 0.5, phi: 0.66, r: 96 },
    spawn: { label: '出生點', mode: 'fp', pos: [0, 2, 45.5], yaw: -0.08, pitch: -0.1 },
    teahouse: { label: '陶陶居', mode: 'fp', pos: [-9, 0, 30.5], yaw: 2.54, pitch: 0.2 },
    street: { label: '獵德牌坊', mode: 'fp', pos: [5.5, 0, 37.5], yaw: 0.1, pitch: 0.05 },
    centre: { label: '鎮海樓', mode: 'fp', pos: [-3.5, 0, 13], yaw: -0.26, pitch: 0.2 },
    shopsA: { label: '黃振龍 · 源記', mode: 'fp', pos: [12.5, 0, 15.5], yaw: -1.5, pitch: 0.04 },
    arcade: { label: '騎樓下', mode: 'fp', pos: [22.6, 0, 34.5], yaw: -0.12, pitch: 0.02 },
    shopsB: { label: '明記 · 陳添記 · 皇上皇', mode: 'fp', pos: [-12.5, 0, -19], yaw: 1.5, pitch: 0.04 },
    noodle: { label: '吳系茶餐廳', mode: 'fp', pos: [2.2, 0, 23.2], yaw: 1.42, pitch: 0.03 },
    ice: { label: '廣州酒家', mode: 'fp', pos: [-2.2, 0, -23.2], yaw: -1.72, pitch: 0.03 },
    mansion: { label: '西關大屋', mode: 'fp', pos: [-11.6, 0, 26.6], yaw: 0.78, pitch: 0.08 },
    yard: { label: '天井與正廳', mode: 'fp', pos: [-16.8, 0, 28.6], yaw: 0.72, pitch: 0.13 },
    boat: { label: '龍舟', mode: 'fp', pos: [5.2, 0, 6.2], yaw: -0.95, pitch: -0.3 },
    arcadeTop: { label: '騎樓二層', mode: 'fp', pos: [23.2, 3, 35], yaw: 0.2, pitch: -0.12 },
    lianxiang: { label: '蓮香樓（藍隊）', mode: 'fp', pos: [9, 0, -30.5], yaw: -0.6, pitch: 0.2 },
    plan: { label: '俯視', mode: 'orbit', target: [0, 0, 0], theta: 0.0001, phi: 0.06, r: 112 },
    hzl: { card: 1, mode: 'fp', pos: [20.9, 0, 12], yaw: -1.5708, pitch: 0.0 }, yuanji: { card: 1, mode: 'fp', pos: [20.9, 0, 21], yaw: -1.5708, pitch: 0.0 }, nanxin: { card: 1, mode: 'fp', pos: [20.9, 0, 31], yaw: -1.5708, pitch: 0.0 },
    mingji: { card: 1, mode: 'fp', pos: [-20.9, 0, -13], yaw: 1.5708, pitch: 0.0 }, chentianji: { card: 1, mode: 'fp', pos: [-20.9, 0, -22], yaw: 1.5708, pitch: 0.0 }, hsh: { card: 1, mode: 'fp', pos: [-20.9, 0, -31], yaw: 1.5708, pitch: 0.0 },
    niuza: { card: 1, mode: 'fp', pos: [3.5, 0, 30.4], yaw: 0, pitch: 0.02 }, jigonglan: { card: 1, mode: 'fp', pos: [-3.5, 0, -30.4], yaw: Math.PI, pitch: 0.02 },
  };
  function preset(name) {
    const P = PRESETS[name]; if (!P) return;
    setMode(P.mode);
    if (P.mode === 'orbit') { orbit.target.set(...P.target); orbit.theta = P.theta; orbit.phi = P.phi; orbit.r = P.r; placeOrbit(); }
    else { fp.pos.set(...P.pos); fp.yaw = P.yaw; fp.pitch = P.pitch; fp.vel.set(0, 0, 0); placeFP(); }
    render();
  }
  function setMode(m) {
    state.mode = m; host.classList.toggle('fp', m === 'fp');
    if (m === 'orbit' && document.pointerLockElement) document.exitPointerLock();
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  }
  function set(key, v) {
    state[key] = v;
    if (key === 'height') { G.map.traverse(o => { if (o.isMesh && o.userData.orig) { o.material = v ? hMat(o.userData.hy != null ? o.userData.hy : 0) : o.userData.orig; if (o.userData.proxy) o.visible = v; } }); G.decor.visible = !v && state.decor; }
    if (key === 'decor') G.decor.visible = v && !state.height;
    if (key === 'grid') G.grid.visible = v;
    if (key === 'ink') G.ink.visible = v;
    if (key === 'deep') waterMesh.position.y = v ? M.CANAL.deep : M.CANAL.shallow;
    if (key === 'env') G.env.visible = v;
    render();
  }

  // ---------------- loop
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(() => { resize(); render(); }).observe(host);
  function render() { G.skyMesh.position.copy(camera.position); renderer.render(scene, camera); }
  let last = performance.now(), visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible) {
      state.t += dt; water.map.offset.x = state.t * 0.02; water.map.offset.y = Math.sin(state.t * 0.3) * 0.01;
      if (state.mode === 'fp') { stepFP(dt); placeFP(); if (readout) readout.textContent = `x ${fp.pos.x.toFixed(1)}  z ${fp.pos.z.toFixed(1)}  脚下高度 ${fp.pos.y.toFixed(2)} m${fp.squid ? '  · 鱿鱼形态' : ''}`; }
      else { placeOrbit(); if (readout) readout.textContent = ''; }
      if (hudT > 0) { hudT -= dt; if (hudT <= 0 && hudEl) hudEl.classList.remove('on'); }
      render();
    }
    requestAnimationFrame(loop);
  }
  resize(); preset('overview'); requestAnimationFrame(loop);
  return { _fp: fp, _step: stepFP, preset, setMode, set, PRESETS, state, render, renderer, hColor, HPAL, shot: () => { render(); return renderer.domElement.toDataURL('image/jpeg', 0.9); } };
})();
