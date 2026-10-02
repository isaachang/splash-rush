/* ======================================================= SKY / SEA / ENV */
const SKY_VS = `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vD;
void main(){
  vec3 d = normalize(vD); float h = d.y;
  vec3 c = mix(mix(hor, mid, smoothstep(0.0, 0.2, h)), top, smoothstep(0.18, 0.75, h));
  if (h < 0.0) c = mix(hor, vec3(0.42, 0.7, 0.88), smoothstep(0.0, -0.25, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2a76f0') }, mid: { value: new THREE.Color('#79c4ff') }, hor: { value: new THREE.Color('#e6f6ff') }, sunDir: { value: new THREE.Vector3(38, 70, 24).normalize() } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS
  });
}
function buildSkyEnv() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMaterial());
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky); WORLD.sky = sky;
  // environment map for glossy reflections
  const envScene = new THREE.Scene();
  const es = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial()); envScene.add(es);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(49, 32), new THREE.MeshBasicMaterial({ color: 0x8a9bb0 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -3; envScene.add(ground);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  pm.dispose();
}
function buildSea() {
  if (MAP_ID === 'skate') return buildPlaza();
  if (MAP_ID === 'canton') return buildCantonGround();
  const m = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, sunDir: { value: new THREE.Vector3(38, 70, 24).normalize() },
      deep: { value: new THREE.Color('#0b5fb8') }, shallow: { value: new THREE.Color('#1fc3e0') }, skyC: { value: new THREE.Color('#bfe6ff') },
      fogC: { value: new THREE.Color(0xc4e6ff) }, noiseMap: { value: TEX.noise }
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time; uniform vec3 sunDir, deep, shallow, skyC, fogC; uniform sampler2D noiseMap; varying vec3 vW;
    void main(){
      vec2 p = vW.xz; vec2 g = vec2(0.0);
      vec2 D[4]; D[0]=normalize(vec2(1.0,0.3)); D[1]=normalize(vec2(-0.4,1.0)); D[2]=normalize(vec2(0.7,-0.8)); D[3]=normalize(vec2(-1.0,-0.2));
      float K[4]; K[0]=0.08; K[1]=0.15; K[2]=0.33; K[3]=0.6; float A[4]; A[0]=0.5; A[1]=0.25; A[2]=0.1; A[3]=0.05;
      for(int i=0;i<4;i++){ float ph = dot(D[i], p)*K[i] + time*(0.6+K[i]*2.0); g += D[i]*A[i]*K[i]*cos(ph)*2.2; }
      vec2 nt = texture2D(noiseMap, p*0.05 + vec2(time*0.01, time*0.013)).rg - 0.5;
      vec2 nt2 = texture2D(noiseMap, p*0.013 - vec2(time*0.004, 0.0)).rg - 0.5;
      g += (nt*0.35 + nt2*0.25);
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 v = normalize(cameraPosition - vW);
      float fr = pow(1.0 - max(dot(n, v), 0.0), 4.0);
      float depthT = clamp(0.5 + g.x*0.5, 0.0, 1.0);
      vec3 col = mix(deep, shallow, depthT*0.55);
      col = mix(col, skyC, clamp(fr*0.9, 0.0, 0.85));
      vec3 hdir = normalize(normalize(sunDir) + v);
      col += vec3(1.0,0.95,0.8) * pow(max(dot(n, hdir), 0.0), 220.0) * 2.5;
      float dPier = max(abs(vW.x)-30.0, abs(vW.z)-48.0);
      float foam = smoothstep(4.0, 0.0, dPier) * smoothstep(0.45, 0.7, texture2D(noiseMap, p*0.2 + time*0.03).r + 0.2*sin(time*2.0 + dPier*2.0));
      col = mix(col, vec3(0.95,0.98,1.0), foam*0.8);
      float dist = length(cameraPosition - vW);
      col = mix(col, fogC, smoothstep(160.0, 650.0, dist));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), m);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -3.2; scene.add(sea); WORLD.sea = sea;
}

/* ================================================================ DECOR */
function buildDecor() {
  if (MAP_ID === 'skate') return buildDecorSkate();
  if (MAP_ID === 'canton') return buildDecorCanton();
  const deco = new THREE.Group(); scene.add(deco);
  const stoneM = new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.9, color: 0xd8dde6 });
  // pier body
  const pierTex = TEX.stone.clone(); pierTex.repeat.set(12, 1.5); pierTex.needsUpdate = true;
  const pier = new THREE.Mesh(new THREE.BoxGeometry(XH * 2 + 3.2, 8, ZH * 2 + 3.2), new THREE.MeshStandardMaterial({ map: pierTex, roughness: 0.9, color: 0xc2c8d4 }));
  pier.position.y = -4.02; pier.receiveShadow = true; deco.add(pier);
  const band = new THREE.Mesh(new THREE.BoxGeometry(XH * 2 + 3.4, 0.5, ZH * 2 + 3.4), new THREE.MeshStandardMaterial({ color: 0xffc629, roughness: 0.5 }));
  band.position.y = -2.6; deco.add(band);
  // tyres on pier sides
  const tyreG = new THREE.TorusGeometry(0.6, 0.25, 8, 16), tyreM = new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.8 });
  for (let z = -40; z <= 40; z += 10) [-1, 1].forEach(sx => { const t = new THREE.Mesh(tyreG, tyreM); t.position.set(sx * (XH + 1.75), -1.6, z); t.rotation.y = Math.PI / 2; deco.add(t); });
  // glass railings + posts on perimeter walls
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfefff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  const railM = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.4, metalness: 0.6 });
  const addRail = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ang = Math.atan2(z1 - z0, x1 - x0);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.1), glass); g.position.set(cx, 2.15, cz); g.rotation.y = -ang; deco.add(g);
    const top = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.12), railM); top.position.set(cx, 2.72, cz); top.rotation.y = -ang; deco.add(top);
  };
  const off = 0.75;
  addRail(-XH - off, -ZH - off, XH + off, -ZH - off); addRail(-XH - off, ZH + off, XH + off, ZH + off);
  addRail(-XH - off, -ZH - off, -XH - off, ZH + off); addRail(XH + off, -ZH - off, XH + off, ZH + off);
  const postG = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6); const posts = [];
  for (let x = -XH; x <= XH; x += 4) posts.push([x, -ZH - off], [x, ZH + off]);
  for (let z = -ZH; z <= ZH; z += 4) posts.push([-XH - off, z], [XH + off, z]);
  const pim = new THREE.InstancedMesh(postG, railM, posts.length); const dm = new THREE.Object3D();
  posts.forEach(([x, z], i) => { dm.position.set(x, 2.15, z); dm.updateMatrix(); pim.setMatrixAt(i, dm.matrix); }); deco.add(pim);
  // light towers at corners
  const poleM = new THREE.MeshStandardMaterial({ color: 0x3a3f4d, metalness: 0.7, roughness: 0.35 });
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d8, emissiveIntensity: 1.6 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const g = new THREE.Group(); g.position.set(sx * (XH + 2.2), 0, sz * (ZH + 2.2));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 16, 10), poleM); pole.position.y = 8; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.5), poleM); head.position.y = 16.4; g.add(head);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), lampM); l.position.set(-1.05 + i * 1.05, 16.05 + j * 0.7, 0.28); g.add(l); }
    g.lookAt(0, 0, 0); g.rotation.x = 0; g.rotation.z = 0; deco.add(g);
    head.rotation.x = 0.35;
  });
  // bunting flags strung between towers along long sides
  const flagCols = ['#ff4f6d', '#ffd23a', '#3fd0ff', '#ffffff', '#7cff5a', '#b06bff'];
  const flagG = new THREE.BufferGeometry(); flagG.setAttribute('position', new THREE.Float32BufferAttribute([-0.35, 0, 0, 0.35, 0, 0, 0, -0.7, 0], 3)); flagG.computeVertexNormals();
  const flags = []; const lines = [[-(XH + 2.2), -(ZH + 2.2), -(XH + 2.2), ZH + 2.2], [XH + 2.2, -(ZH + 2.2), XH + 2.2, ZH + 2.2]];
  lines.forEach(([x0, z0, x1, z1], li) => {
    const n = li === 2 ? 44 : 70; const hT = li === 2 ? 14 : 13;
    for (let i = 1; i < n; i++) { const t = i / n; const sag = Math.sin(t * Math.PI) * (li === 2 ? 3.5 : 4.5); flags.push({ x: lerp(x0, x1, t), y: hT - sag, z: lerp(z0, z1, t), ang: Math.atan2(z1 - z0, x1 - x0), c: flagCols[i % flagCols.length], ph: Math.random() * 6 }); }
  });
  // (middle line spans across the field high above — only place if both ends have towers) -> use two side lines only
  const useFlags = flags.filter(f => Math.abs(f.x) > XH + 1);
  const fim = new THREE.InstancedMesh(flagG, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), useFlags.length);
  useFlags.forEach((f, i) => { dm.position.set(f.x, f.y, f.z); dm.rotation.set(0, -f.ang, 0); dm.updateMatrix(); fim.setMatrixAt(i, dm.matrix); fim.setColorAt(i, new THREE.Color(f.c)); });
  deco.add(fim); WORLD.flags = { mesh: fim, list: useFlags };
  // city skyline (instanced)
  const bld = []; const bCols = ['#ffd9c2', '#c2e3ff', '#ffe9a8', '#d7c9ff', '#b9f0d8', '#ffc4d6', '#f4f4f4', '#9fd6ff'];
  for (let i = 0; i < 90; i++) {
    const side = i % 3; let x, z;
    if (side === 0) { x = rand(95, 260); z = rand(-260, 260); } else if (side === 1) { x = rand(-260, 260); z = rand(-300, -170); } else { x = rand(-280, -130); z = rand(-150, 260); }
    const w = rand(10, 26), d = rand(10, 26), h = rand(18, 95) * (Math.hypot(x, z) > 200 ? 1.3 : 1);
    bld.push({ x, z, w, d, h, c: pick(bCols) });
  }
  const bim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: TEX.windows, roughness: 0.6, metalness: 0.1 }), bld.length);
  bld.forEach((b, i) => { dm.position.set(b.x, b.h / 2 - 3, b.z); dm.rotation.set(0, 0, 0); dm.scale.set(b.w, b.h, b.d); dm.updateMatrix(); bim.setMatrixAt(i, dm.matrix); bim.setColorAt(i, new THREE.Color(b.c)); });
  deco.add(bim);
  // islands under the city
  [[170, 0, 190, 560], [0, -235, 560, 150], [-205, 55, 170, 430]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), stoneM); m.position.set(x, -5, z); deco.add(m); });
  // billboard
  const bbTex = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1a1440'); gr.addColorStop(1, '#3b1b6e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const blob = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); for (let a = 0; a <= 6.3; a += 0.3) { const rr = r * (1 + 0.18 * Math.sin(a * 5) + 0.1 * Math.sin(a * 9)); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
    blob(200, 160, 140, '#ff7a00'); blob(820, 360, 170, '#3346ff'); blob(620, 120, 60, '#ff2d95'); blob(160, 420, 50, '#22d64a');
    g.font = '900 150px Arial Black, sans-serif'; g.textAlign = 'center'; g.lineWidth = 18; g.strokeStyle = '#111'; g.fillStyle = '#fff';
    g.save(); g.translate(w / 2, 250); g.rotate(-0.06); g.strokeText('SPLASH', 0, 0); g.fillText('SPLASH', 0, 0); g.strokeText('RUSH!', 0, 150); g.fillStyle = '#ffe45c'; g.fillText('RUSH!', 0, 150); g.restore();
  }, false);
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), new THREE.MeshStandardMaterial({ map: bbTex, emissive: 0xffffff, emissiveMap: bbTex, emissiveIntensity: 0.55, roughness: 0.4 }));
  bb.position.set(88, 42, -10); bb.rotation.y = -Math.PI / 2; deco.add(bb);
  const bbFrame = new THREE.Mesh(new THREE.BoxGeometry(2, 36, 68), poleM); bbFrame.position.set(89.2, 42, -10); deco.add(bbFrame);
  const bbLeg = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 2), poleM); bbLeg.position.set(89.2, 12, -10); deco.add(bbLeg);
  // cranes
  const craneM = new THREE.MeshStandardMaterial({ color: 0xe84a3a, roughness: 0.5, metalness: 0.3 });
  const craneW = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  [[-60, -95, 0.6], [62, 100, -2.4]].forEach(([x, z, r]) => {
    const g = new THREE.Group(); g.position.set(x, -3, z); g.rotation.y = r;
    [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(1, 34, 1), craneM); l.position.set(a, 17, b); g.add(l); });
    for (let y = 4; y < 34; y += 5) { const c = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 9), y % 10 ? craneW : craneM); c.position.y = y; g.add(c); }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 60), craneM); boom.position.set(0, 35, 18); g.add(boom);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), craneW); cab.position.set(0, 37, -2); g.add(cab);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 20), railM); cable.position.set(0, 25, 42); g.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 9), new THREE.MeshStandardMaterial({ map: TEX.contB })); hook.position.set(0, 14, 42); g.add(hook);
    deco.add(g);
  });
  // lighthouse
  const lhTex = canvasTex(64, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e8403a'; g.fillRect(0, i * 32, w, 32); } }, false);
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 34, 20), new THREE.MeshStandardMaterial({ map: lhTex, roughness: 0.6 })); lh.position.set(-110, 14, -120); deco.add(lh);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 4, 16), new THREE.MeshStandardMaterial({ color: 0xfff7d0, emissive: 0xffe9a0, emissiveIntensity: 1.2 })); lhTop.position.set(-110, 33, -120); deco.add(lhTop);
  const lhCap = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 16), craneM); lhCap.position.set(-110, 37, -120); deco.add(lhCap);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(12, 1), stoneM); rock.position.set(-110, -6, -120); rock.scale.y = 0.5; deco.add(rock);
  // buoys
  const buoyM = [new THREE.MeshStandardMaterial({ color: 0xff4040, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group(); const a = i / 12 * Math.PI * 2; const r = rand(48, 75);
    g.position.set(Math.cos(a) * r * 0.8, -3, Math.sin(a) * r * 1.15);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 1.6, 12), buoyM[0]); b.position.y = 0.5; g.add(b);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 12), buoyM[1]); b2.position.y = 1.5; g.add(b2);
    g.userData.ph = Math.random() * 6; deco.add(g); WORLD.buoys.push(g);
  }
  // clouds (instanced puffs)
  const puffs = [];
  for (let c = 0; c < 16; c++) {
    const a = rand(0, Math.PI * 2), r = rand(260, 520), cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = rand(70, 150), s = rand(10, 22);
    for (let k = 0; k < 7; k++) puffs.push([cx + rand(-2.2, 2.2) * s, cy + rand(-0.3, 0.5) * s, cz + rand(-1, 1) * s, s * rand(0.6, 1.15)]);
  }
  const cim = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde9ff, emissiveIntensity: 0.45, roughness: 1, fog: false }), puffs.length);
  puffs.forEach(([x, y, z, s], i) => { dm.position.set(x, y, z); dm.scale.set(s, s * 0.7, s); dm.rotation.set(0, 0, 0); dm.updateMatrix(); cim.setMatrixAt(i, dm.matrix); });
  deco.add(cim);
  deco.traverse(o => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  WORLD.buoys.forEach(b => { b.traverse(o => o.matrixAutoUpdate = true); });
  deco.updateMatrixWorld(true);
}
function updateWorld(t, dt) {
  if (WORLD.sea) WORLD.sea.material.uniforms.time.value = t;
  if (WORLD.sky) WORLD.sky.position.copy(camera.position);
  WORLD.buoys.forEach(b => { b.position.y = -3.1 + Math.sin(t * 1.3 + b.userData.ph) * 0.3; b.rotation.z = Math.sin(t * 0.9 + b.userData.ph) * 0.12; b.updateMatrix(); });
  const pulse = 0.6 + Math.sin(t * 3) * 0.25;
  WORLD.spawnFx.forEach((m, i) => { m.material.opacity = (i % 2 ? 0.2 : 0.85) * pulse; });
}

/* ================================================= SKATEPARK SURROUNDINGS
   City plaza around the park: paving and lawns, the yellow coping rail on
   the park wall, palms in the planters, grandstands, floodlights, billboards
   (our own brand: SPLASH RUSH), an elevated highway and the skyline.       */
function buildPlaza() {
  const pave = TEX.concrete.clone(); pave.repeat.set(90, 90); pave.needsUpdate = true;
  // paving round the park, with the park's outline cut out (the bowls sink below street level)
  const sh = new THREE.Shape([[-700, -700], [700, -700], [700, 700], [-700, 700]].map(([x, y]) => new THREE.Vector2(x, y)));
  if (TERR.on) sh.holes.push(new THREE.Path(TERR.outline.map(([x, z]) => new THREE.Vector2(x, -z))));
  const pg = new THREE.ShapeGeometry(sh); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1400 + 0.5, uv.getY(i) / 1400 + 0.5);
  const g = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: pave, color: 0xe6dccb, roughness: 0.95 }));
  g.rotation.x = -Math.PI / 2; g.position.y = SL - 0.03; g.receiveShadow = true; scene.add(g);
  const lawnT = TEX.grass.clone(); lawnT.repeat.set(20, 20); lawnT.needsUpdate = true; const lawnM = new THREE.MeshStandardMaterial({ map: lawnT, roughness: 1 });
  [[-XH - 14, 0, 16, ZH * 2 + 30], [XH + 14, 0, 16, ZH * 2 + 30], [0, -ZH - 12, XH * 2 + 44, 12], [0, ZH + 12, XH * 2 + 44, 12]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lawnM); m.rotation.x = -Math.PI / 2; m.position.set(x, SL - 0.01, z); m.receiveShadow = true; scene.add(m); });
}
function buildDecorSkate() {
  const deco = new THREE.Group(); scene.add(deco);
  const dm = new THREE.Object3D();
  const railM = new THREE.MeshStandardMaterial({ color: 0xffc629, roughness: 0.35, metalness: 0.4 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.5, metalness: 0.5 });
  const poleM = new THREE.MeshStandardMaterial({ color: 0x3a3f4d, metalness: 0.7, roughness: 0.35 });
  // palms on the out-of-bounds planters and gardens
  const palms = [];
  PALMS.forEach(([x, z, k]) => { const s = SOLIDS.find(o => o.oob && inRect(o, x, z)); palms.push([x, s ? s.h : groundAt(x, z), z, k]); });
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 }), leafM = new THREE.MeshStandardMaterial({ color: 0x3e9a47, roughness: 0.8, side: THREE.DoubleSide });
  const tim = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1, 7), trunkM, palms.length);
  const leafG = new THREE.ConeGeometry(0.55, 3.2, 4, 1, true); leafG.translate(0, 1.6, 0); leafG.rotateZ(Math.PI / 2.4);
  const lim = new THREE.InstancedMesh(leafG, leafM, palms.length * 6);
  palms.forEach(([x, y, z, k], i) => {
    const hT = 4.2 * k;
    // collision for shots: trunk up to the crown, then a flatter disc for the fronds (not paintable)
    const tr = { t: 'box', tree: true, x, z, y0: y, yc: y + hT - 0.35 * k, y1: y + hT + 0.9 * k, r: 0.3 * k, rc: 1.7 * k };
    Object.assign(tr, { x0: x - tr.rc, x1: x + tr.rc, z0: z - tr.rc, z1: z + tr.rc, h: tr.y1 }); TREES.push(tr); TREE_Y0 = Math.min(TREE_Y0, y); dm.position.set(x, y + hT / 2, z); dm.scale.set(k, hT, k); dm.rotation.set(0, 0, 0); dm.updateMatrix(); tim.setMatrixAt(i, dm.matrix);   // upright, so the crown sits on the trunk
    for (let j = 0; j < 6; j++) { dm.position.set(x, y + hT, z); dm.scale.set(k, k, k); dm.rotation.set(0, j / 6 * Math.PI * 2 + i, 0); dm.updateMatrix(); lim.setMatrixAt(i * 6 + j, dm.matrix); }
  });
  tim.castShadow = lim.castShadow = true; deco.add(tim, lim);
  // grandstands at the four corners, outside the park
  const seatM = [0xff5a7a, 0x3fb6ff, 0xffd23a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], k) => {
    const g = new THREE.Group(); g.position.set(sx * (XH + 9), SL, sz * (ZH - 6)); g.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    for (let r = 0; r < 6; r++) { const b = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6 + r * 0.6, 1.4), darkM); b.position.set(0, (0.6 + r * 0.6) / 2, r * 1.4); g.add(b); const st = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.18, 0.5), seatM[(r + k) % 3]); st.position.set(0, 0.7 + r * 0.6, r * 1.4 - 0.3); g.add(st); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.3, 9), darkM); roof.position.set(0, 6.4, 3.5); roof.rotation.x = -0.12; g.add(roof);
    [-7, 7].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.4, 0.3), poleM); p.position.set(x, 3.2, 8); g.add(p); });
    deco.add(g);
  });
  // floodlights at the corners
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d8, emissiveIntensity: 1.6 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const g = new THREE.Group(); g.position.set(sx * (XH + 4), SL, sz * (ZH + 3));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 18, 10), poleM); pole.position.y = 9; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.5), poleM); head.position.y = 18.4; head.rotation.x = 0.35; g.add(head);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), lampM); l.position.set(-1.05 + i * 1.05, 17.8 + j * 0.62, 0.3); g.add(l); }
    g.lookAt(0, SL, 0); g.rotation.x = 0; g.rotation.z = 0; deco.add(g);
  });
  // billboards: SPLASH RUSH brand boards around the park
  const board = (w, h, draw) => canvasTex(1024, Math.round(1024 * h / w), draw, false);
  const blob = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); for (let a = 0; a <= 6.3; a += 0.3) { const rr = r * (1 + 0.18 * Math.sin(a * 5) + 0.1 * Math.sin(a * 9)); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
  const title = (g, w, h, t1, t2, bg0, bg1, c2) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, bg0); gr.addColorStop(1, bg1); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blob(g, w * 0.15, h * 0.3, h * 0.32, '#ff7a00'); blob(g, w * 0.85, h * 0.7, h * 0.38, '#3346ff'); blob(g, w * 0.62, h * 0.2, h * 0.12, '#ff2d95');
    g.font = `900 ${Math.round(h * 0.34)}px Arial Black, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = h * 0.05; g.strokeStyle = '#111';
    g.save(); g.translate(w / 2, h * 0.42); g.rotate(-0.05); g.strokeText(t1, 0, 0); g.fillStyle = '#fff'; g.fillText(t1, 0, 0);
    g.font = `900 ${Math.round(h * 0.2)}px Arial Black, sans-serif`; g.strokeText(t2, 0, h * 0.32); g.fillStyle = c2; g.fillText(t2, 0, h * 0.32); g.restore();
  };
  const boards = [
    [board(16, 8, (g, w, h) => title(g, w, h, 'SPLASH RUSH', 'SKATEPARK', '#1a1440', '#3b1b6e', '#ffe45c')), 16, 8, -XH - 6, 20, Math.PI / 2],
    [board(16, 8, (g, w, h) => title(g, w, h, 'SPLASH RUSH', 'INK · SKATE · WIN', '#102c3a', '#1f5b6e', '#7cff5a')), 16, 8, XH + 6, -20, -Math.PI / 2],
    [board(14, 7, (g, w, h) => title(g, w, h, 'RUSH!', 'SPLASH RUSH', '#3a0f2a', '#6e1b4a', '#3fd0ff')), 14, 7, 12, ZH + 7, Math.PI],
    [board(14, 7, (g, w, h) => title(g, w, h, 'INK UP!', 'SPLASH RUSH', '#2a2a10', '#5e5a14', '#ff8fb1')), 14, 7, -12, -ZH - 7, 0],
  ];
  boards.forEach(([t, w, h, x, z, ry]) => {
    const g = new THREE.Group(); g.position.set(x, SL, z); g.rotation.y = ry;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.5 })); p.position.y = 5 + h / 2; g.add(p);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.4), darkM); fr.position.set(0, 5 + h / 2, -0.25); g.add(fr);
    [-w / 3, w / 3].forEach(px => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), poleM); l.position.set(px, 2.5, -0.3); g.add(l); });
    deco.add(g);
  });
  // elevated highway behind the park
  const hwM = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.8 });
  const hw = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 700), hwM); hw.position.set(95, 22, 0); deco.add(hw);
  for (let z = -330; z <= 330; z += 30) { const p = new THREE.Mesh(new THREE.BoxGeometry(3, 22, 3), hwM); p.position.set(95, 11, z); deco.add(p); }
  const trussM = new THREE.MeshStandardMaterial({ color: 0x8e96a4, roughness: 0.6, metalness: 0.4 });
  [-6.5, 6.5].forEach(dx => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 700), trussM); t.position.set(95 + dx, 25, 0); deco.add(t); for (let z = -340; z <= 340; z += 8) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 0.3), trussM); d.position.set(95 + dx, 25, z); d.rotation.x = 0.8; deco.add(d); } });
  // city skyline + clouds
  const bld = []; const bCols = ['#ffd9c2', '#c2e3ff', '#ffe9a8', '#d7c9ff', '#b9f0d8', '#ffc4d6', '#f4f4f4', '#9fd6ff'];
  for (let i = 0; i < 110; i++) { const a = rand(0, Math.PI * 2), r = rand(140, 330); bld.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 1.2, w: rand(12, 28), d: rand(12, 28), h: rand(20, 110), c: pick(bCols) }); }
  const bim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: TEX.windows, roughness: 0.6, metalness: 0.1 }), bld.length);
  bld.forEach((b, i) => { dm.position.set(b.x, b.h / 2 + SL, b.z); dm.rotation.set(0, 0, 0); dm.scale.set(b.w, b.h, b.d); dm.updateMatrix(); bim.setMatrixAt(i, dm.matrix); bim.setColorAt(i, new THREE.Color(b.c)); });
  deco.add(bim);
  const puffs = [];
  for (let c = 0; c < 16; c++) { const a = rand(0, Math.PI * 2), r = rand(260, 520), cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = rand(80, 150), s = rand(10, 22); for (let k = 0; k < 7; k++) puffs.push([cx + rand(-2.2, 2.2) * s, cy + rand(-0.3, 0.5) * s, cz + rand(-1, 1) * s, s * rand(0.6, 1.15)]); }
  const cim = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde9ff, emissiveIntensity: 0.45, roughness: 1, fog: false }), puffs.length);
  puffs.forEach(([x, y, z, s], i) => { dm.position.set(x, y, z); dm.scale.set(s, s * 0.7, s); dm.rotation.set(0, 0, 0); dm.updateMatrix(); cim.setMatrixAt(i, dm.matrix); });
  deco.add(cim);
  deco.traverse(o => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  deco.updateMatrixWorld(true);
}

/* ================================================= 西關大屋 SURROUNDINGS (grey-box pass)
   Shallow canal water, the streets outside the walls, rows of shop-houses round the map, the trees,
   and just enough dressing to tell the landmarks apart: name boards, the tower's upper storeys, the
   paifang roof, the dragon boats' heads. The detailed look comes in the art pass.                    */
function buildCantonGround() {
  // shallow water over the canal bed (visual only: you wade through it): slow ripples, sky glints, the bed and its ink show through
  const wm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, noiseMap: { value: TEX.noise } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time; uniform sampler2D noiseMap; varying vec3 vW;
    void main(){
      vec2 p = vW.xz;
      float a = texture2D(noiseMap, p * 0.11 + vec2(time * 0.020, time * 0.006)).r, b = texture2D(noiseMap, p * 0.23 - vec2(time * 0.013, -time * 0.017)).r;
      float n = a * 0.6 + b * 0.4;
      vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
      vec3 col = mix(vec3(0.33, 0.56, 0.52), vec3(0.74, 0.88, 0.90), fr * 0.8);
      float glint = smoothstep(0.66, 0.72, n) * (0.25 + 0.75 * fr);
      float edge = smoothstep(3.1, 3.5, abs(vW.z));                       // a paler line where the water meets the banks
      col += glint * 0.5 + edge * 0.10;
      gl_FragColor = vec4(col, clamp(0.26 + fr * 0.4 + glint * 0.3 + (n - 0.5) * 0.12 + edge * 0.12, 0.0, 0.85));
    }` });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(XH * 2 + 240, 7), wm); w.rotation.x = -Math.PI / 2; w.position.y = 0.22; w.renderOrder = 1; scene.add(w); WORLD.sea = w;
  // the city outside: paving at street level with the canal running on through it
  const pave = TEX.granite.clone(); pave.repeat.set(200, 99); pave.needsUpdate = true;
  const pm = new THREE.MeshStandardMaterial({ map: pave, roughness: 0.95 });
  [[3.56, 400], [-400, -3.56]].forEach(([z0, z1]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(800, 3, z1 - z0), pm); m.position.set(0, CL - 1.53, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(800, 7), new THREE.MeshStandardMaterial({ color: 0x6f766f, roughness: 1 })); bed.rotation.x = -Math.PI / 2; bed.position.y = -0.02; scene.add(bed);
}
function cantonSign(text, w, h, bg = '#141210', fg = '#e8c15a') {
  const t = canvasTex(256, Math.round(256 * h / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, cw - 12, ch - 12);
    let px = ch * 0.62; g.font = `900 ${px}px "Songti TC","Songti SC","Noto Serif CJK TC","Noto Serif CJK SC",serif`;
    while (((g.measureText(text) || {}).width || 0) > cw - 36 && px > 8) { px -= 2; g.font = `900 ${px}px "Songti TC","Songti SC","Noto Serif CJK TC","Noto Serif CJK SC",serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 2);
  }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  return m;
}
// decor textures of the 西關大屋 map, drawn the first time the map is built
function cantonTex() {
  if (TEX.manchu) return;
  const rr = (a, b) => a + (b - a) * Math.random(), FONT = '"Songti TC","Songti SC","Noto Serif CJK TC","Noto Serif CJK SC",serif';
  // 滿洲窗: coloured glass in a dark wood lattice
  const manchu = (g, x0, y0, w, h, n = 4, m = 4) => {
    g.fillStyle = '#5a2f1c'; g.fillRect(x0, y0, w, h);
    const fr = Math.max(2, Math.min(w, h) * 0.03), cw = (w - fr) / n, ch = (h - fr) / m;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const ex = i === 0 || i === n - 1, ey = j === 0 || j === m - 1;
      g.fillStyle = ex && ey ? '#c53a2b' : ex ? '#2f66b0' : ey ? '#3a8f55' : (i + j) % 2 ? '#dfe9e6' : '#e9c64a';
      g.fillRect(x0 + fr + i * cw, y0 + fr + j * ch, cw - fr, ch - fr);
      if (!ex && !ey) { g.strokeStyle = 'rgba(90,47,28,.55)'; g.lineWidth = 1; g.beginPath(); const cx = x0 + fr + i * cw + (cw - fr) / 2, cy = y0 + fr + j * ch + (ch - fr) / 2; g.moveTo(cx, cy - (ch - fr) / 2); g.lineTo(cx + (cw - fr) / 2, cy); g.lineTo(cx, cy + (ch - fr) / 2); g.lineTo(cx - (cw - fr) / 2, cy); g.closePath(); g.stroke(); }
    }
  };
  TEX._manchu = manchu; TEX._font = FONT;
  TEX.manchu = canvasTex(256, 256, (g, w, h) => manchu(g, 0, 0, w, h, 6, 6), false);
  TEX.roofTile = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5d6266'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#4b5054'); gr.addColorStop(0.5, '#8a9095'); gr.addColorStop(1, '#4b5054'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, y, w, 3); } });
  TEX.greenTile = canvasTex(128, 128, (g, w, h) => { for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#1b5f42'); gr.addColorStop(0.5, '#46a474'); gr.addColorStop(1, '#1b5f42'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y, w, 3); } });
  // a qilou bay: 4 m wide, 12.8 m tall — shopfront, two upper floors of shuttered windows with manchu fanlights, a parapet
  const FAC = [['#ead7a6', '#fbf4e1', '#3d7f5a'], ['#e9b9ac', '#fff3ec', '#2f6b85'], ['#b9d9c2', '#f4fbf5', '#7a4a2a'], ['#efe7d6', '#ffffff', '#386e9a'], ['#bccfe1', '#f6fafd', '#3b6f4f'], ['#e4a670', '#fff1e2', '#2c5c74'], ['#b0604a', '#e9dcc8', '#2f5a43'], ['#d9d3c6', '#fbfaf6', '#8a3b2b']];
  TEX.facade = FAC.map(([base, trim, shut], k) => canvasTex(256, 820, (g, w, h) => {
    const px = w / 4, Y = m => h - m * px;
    g.fillStyle = base; g.fillRect(0, 0, w, h); speckle(g, w, h, 1500, 0.06);
    g.fillStyle = trim; g.fillRect(0, Y(12.2), 14, 7.8 * px); g.fillRect(w - 14, Y(12.2), 14, 7.8 * px);
    [[4.4, 0.35], [7.8, 0.25], [11.2, 0.4]].forEach(([y, t]) => { g.fillStyle = trim; g.fillRect(0, Y(y + t), w, t * px); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, Y(y), w, 3); });
    if (k % 2 === 0) { g.fillStyle = trim; g.beginPath(); g.moveTo(10, Y(11.6)); g.quadraticCurveTo(w / 2, Y(13.6), w - 10, Y(11.6)); g.lineTo(w - 10, Y(11.2)); g.lineTo(10, Y(11.2)); g.fill(); g.fillStyle = base; g.beginPath(); g.arc(w / 2, Y(11.75), 0.35 * px, 0, Math.PI * 2); g.fill(); }
    else { g.fillStyle = trim; for (let x = 18; x < w - 18; x += 14) g.fillRect(x, Y(12.3), 8, 0.9 * px); g.fillRect(10, Y(12.5), w - 20, 6); }
    [4.9, 8.3].forEach(y0 => {
      [0.55, 2.35].forEach(x0 => { const X = x0 * px, W = 1.1 * px, H = 2.5 * px, top = Y(y0 + 2.5);
        g.fillStyle = trim; g.fillRect(X - 5, top - 5, W + 10, H + 10); g.fillStyle = '#26303a'; g.fillRect(X, top + 0.8 * px, W, H - 0.8 * px); manchu(g, X, top, W, 0.8 * px, 3, 2);
        for (let s2 = 0; s2 < 2; s2++) { const sx = s2 ? X + W * 0.62 : X; g.fillStyle = shut; g.fillRect(sx, top + 0.85 * px, W * 0.38, H - 0.85 * px); g.fillStyle = 'rgba(0,0,0,.25)'; for (let l = 0; l < 14; l++) g.fillRect(sx, top + 0.95 * px + l * 6, W * 0.38, 1.5); } });
      g.fillStyle = 'rgba(30,30,30,.85)'; for (let x = 0.4 * px; x < w - 0.4 * px; x += 7) g.fillRect(x, Y(y0 + 0.9), 2, 0.9 * px); g.fillRect(0.4 * px, Y(y0 + 0.95), w - 0.8 * px, 3); });
    g.fillStyle = '#2a2622'; g.fillRect(16, Y(3.4), w - 32, 3.4 * px); g.fillStyle = 'rgba(255,214,140,.45)'; g.fillRect(24, Y(3.0), w - 48, 2.2 * px);
    g.fillStyle = '#3a312a'; for (let x = 24; x < w - 24; x += 18) g.fillRect(x, Y(3.0), 3, 2.2 * px); g.fillStyle = '#1d2a22'; g.fillRect(16, Y(4.25), w - 32, 0.75 * px);
  }));
  // the stone arch under a bridge side (7 m span, CL tall): transparent opening, solid spandrels at the two top corners, a ring of voussoirs
  TEX.archFace = canvasTex(512, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h); const px = w / 7;
    g.fillStyle = '#7d7566'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, 0.95 * px); g.quadraticCurveTo(w / 2, -0.25 * px, 0, 0.95 * px); g.closePath(); g.fill();
    g.strokeStyle = '#a2987f'; g.lineWidth = 0.2 * px; g.beginPath(); g.moveTo(0, 0.95 * px); g.quadraticCurveTo(w / 2, -0.25 * px, w, 0.95 * px); g.stroke();
    g.fillStyle = '#7d7566'; g.fillRect(0, 0, w, 0.32 * px); g.fillStyle = '#a2987f'; g.fillRect(0, 0.26 * px, w, 0.07 * px);
  }, false);
}
// the tea house facade (16 x 9 m): three floors of manchu windows over a row of shopfront doors
function cantonTeaFace() {
  return canvasTex(1024, 576, (g, w, h) => {
    g.fillStyle = '#e9d9b4'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, 0.05);
    for (let fl = 0; fl < 2; fl++) for (let c = 0; c < 8; c++) { const x = 28 + c * 124, y = 70 + fl * 150; g.fillStyle = '#f8f0dc'; g.fillRect(x - 6, y - 6, 104, 122); TEX._manchu(g, x, y, 92, 110, 4, 5); g.fillStyle = '#2f6a48'; g.fillRect(x - 6, y + 118, 104, 14); g.fillStyle = '#f8f0dc'; for (let q = 0; q < 6; q++) g.fillRect(x + q * 17, y + 118, 6, 14); }
    g.fillStyle = '#f8f0dc'; for (const y of [48, 206, 356]) g.fillRect(0, y, w, 8);
    g.fillStyle = '#3a2a1e'; g.fillRect(0, 372, w, h - 372);
    for (let c = 0; c < 6; c++) { const x = 20 + c * 168; g.fillStyle = '#7a5a34'; g.fillRect(x + 12, 392, 136, h - 392); g.fillStyle = '#f4ecd8'; g.fillRect(x, 372, 10, h - 372); g.fillStyle = '#b3201a'; g.fillRect(x - 6, 372, 5, h - 372); g.fillRect(x + 11, 372, 5, h - 372); }
  }, false);
}
// the mansion's main hall front (14 x 4.4 m): grey brick, a stone base, the sliding-bar door in the middle, two manchu windows each side
function cantonHallFace() {
  return canvasTex(1024, 322, (g, w, h) => {
    const px = w / 14; g.fillStyle = '#b4b6b0'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < h / 9; r++) for (let c = -1; c < w / 30 + 1; c++) { const k = 0.9 + Math.random() * 0.2; g.fillStyle = `rgb(${98 * k | 0},${112 * k | 0},${124 * k | 0})`; g.fillRect(c * 30 + (r % 2) * 15 + 1, r * 9 + 1, 28, 7); }
    g.fillStyle = '#b9b09c'; g.fillRect(0, h - 0.5 * px, w, 0.5 * px); g.fillRect(0, 0, w, 0.3 * px);
    [1.6, 4.0, 10.0, 12.4].forEach(c => { g.fillStyle = '#e4dccb'; g.fillRect((c - 0.75) * px, h - 3.3 * px, 1.5 * px, 2.3 * px); TEX._manchu(g, (c - 0.62) * px, h - 3.18 * px, 1.24 * px, 2.06 * px, 4, 6); });
    g.fillStyle = '#d6cdb8'; g.fillRect(5.6 * px, h - 3.6 * px, 2.8 * px, 3.6 * px); g.fillStyle = '#1e1512'; g.fillRect(5.9 * px, h - 3.3 * px, 2.2 * px, 3.3 * px);
    g.fillStyle = '#6e2f1c'; for (let b = 0; b < 11; b++) g.fillRect(5.9 * px, h - 3.2 * px + b * 0.3 * px, 2.2 * px, 0.11 * px);          // 趟櫳: the sliding bars
    g.fillStyle = '#4a1f14'; g.fillRect(5.9 * px, h - 3.3 * px, 0.14 * px, 3.3 * px); g.fillRect(7.96 * px, h - 3.3 * px, 0.14 * px, 3.3 * px);
  }, false);
}
function buildDecorCanton() {
  const deco = new THREE.Group(); scene.add(deco);
  const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, o || {}));
  const M = { stone: std(0xe9e2d2, { map: TEX.stone }), green: std(0x2f8f62, { roughness: 0.5 }), red: std(0xb5503f), wood: std(0x6e3220), bark: std(0x857565, { roughness: 0.95 }), leaf: std(0x3f6f38, { flatShading: true }), flower: std(0xe4402a, { emissive: 0x3a0800 }), gold: std(0xd8a640, { metalness: 0.5, roughness: 0.4 }), white: std(0xf4f1e8), cstone: std(0xffffff, { map: TEX.cstone }), plaster: std(0xffffff, { map: TEX.plaster }) };
  const add = (geo, mat, x, y, z, ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; deco.add(m); return m; };
  const boxAt = (x0, x1, y0, y1, z0, z1, mat) => add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const sign = (text, w, h, x, y, z, ry, bg, fg, two) => { const m = cantonSign(text, w, h, bg, fg); m.position.set(x, y, z); m.rotation.y = ry; deco.add(m); if (two) { const b = m.clone(); b.rotation.y = ry + Math.PI; deco.add(b); } };
  // ---- trees: trunk and crown stop shots, the trunk stops people (same rules as the skatepark's palms)
  CANTON_TREES.forEach(([tx, tz, ph, kind]) => [1, -1].forEach(sg => {
    const x = tx * sg, z = tz * sg, y = CL + ph, ban = kind === 'banyan', hT = ban ? 4.4 : 6.6;
    const tr = { t: 'box', tree: true, x, z, y0: y, yc: y + hT - 0.4, y1: y + hT + (ban ? 2.4 : 0.8), r: ban ? 0.75 : 0.32, rc: ban ? 3.6 : 1.5 };
    Object.assign(tr, { x0: x - tr.rc, x1: x + tr.rc, z0: z - tr.rc, z1: z + tr.rc, h: tr.y1 }); TREES.push(tr); TREE_Y0 = Math.min(TREE_Y0, y);
    add(new THREE.CylinderGeometry(tr.r * 0.65, tr.r, hT, 9), M.bark, x, y + hT / 2, z);
    if (ban) for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, r = i ? 2.4 : 0; const g = new THREE.IcosahedronGeometry(2.3, 1); g.scale(1, 0.6, 1); add(g, M.leaf, x + Math.cos(a) * r, y + hT + 1.0, z + Math.sin(a) * r); }
    else for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 0.5 + (i % 5) * 0.28; add(new THREE.IcosahedronGeometry(0.22, 0), M.flower, x + Math.cos(a) * r, y + hT - 2.6 + (i % 7) * 0.5, z + Math.sin(a) * r); }
  }));
  // ---- landmarks and shops, different on the two halves (team 0 at +z, team 1 at -z)
  const names = [
    { tea: '陶陶居', house: '吳系茶餐廳', stall: '蘿蔔牛雜', mansion: '泰華樓', shops: [['黃振龍涼茶', 12, '#0f5a3a', '#f6d443'], ['源記腸粉', 21, '#fffdf4', '#c0261c'], ['南信牛奶甜品專家', 31, '#a3171a', '#f1cf6b']] },
    { tea: '蓮香樓', house: '廣州酒家', stall: '雞公欖', mansion: '小畫舫齋', shops: [['西關明記腸粉', 13, '#f5c518', '#b3201a'], ['陳添記', 22, '#f7f1dc', '#b3201a'], ['皇上皇臘味', 31, '#c11a1f', '#f6d24a']] },
  ];
  cantonTex();
  const tx = (t, ru, rv) => { const c = t.clone(); c.repeat.set(ru, rv); c.needsUpdate = true; return c; };
  Object.assign(M, { roof: std(0xffffff, { map: TEX.roofTile }), groof: std(0xffffff, { map: TEX.greenTile, roughness: 0.45 }), dwood: std(0x4a1f14, { roughness: 0.6 }), dark: std(0x1c1a1c, { roughness: 0.9 }), cream: std(0xe9dcc0), manchu: std(0xffffff, { map: TEX.manchu, emissive: 0x332a18, roughness: 0.35 }), redwall: std(0xffffff, { map: TEX.sandstone }) });
  // a tiled roof skirt / hip roof: a frustum from the eave rectangle up to a smaller rectangle (inset 0 at the top = a ridge or a point)
  const frustum = (grp, x0, x1, z0, z1, y0, y1, ix, iz, mat) => {
    const A = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], B = [[x0 + ix, y1, z0 + iz], [x1 - ix, y1, z0 + iz], [x1 - ix, y1, z1 - iz], [x0 + ix, y1, z1 - iz]], pos = [], uv = [];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, L = Math.hypot(A[j][0] - A[i][0], A[j][2] - A[i][2]), sl = Math.hypot(y1 - y0, i % 2 ? ix : iz), d = (L - Math.hypot(B[j][0] - B[i][0], B[j][2] - B[i][2])) / 2;
      [[A[j], [L, 0]], [A[i], [0, 0]], [B[i], [d, sl]], [A[j], [L, 0]], [B[i], [d, sl]], [B[j], [L - d, sl]]].forEach(([q, u]) => { pos.push(...q); uv.push(u[0] / 1.2, u[1] / 1.2); }); }
    [B[0], B[3], B[2], B[0], B[2], B[1], A[0], A[1], A[2], A[0], A[2], A[3]].forEach(q => { pos.push(...q); uv.push(q[0] / 1.2, q[2] / 1.2); });   // top, and the soffit seen from the street
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; grp.add(m); return m;
  };
  const face = (grp, tex, w, h, x, y, z, ry, o) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, Object.assign({ map: tex }, o || {}))); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; grp.add(m); return m; };
  names.forEach((n, t) => {
    const sg = t ? -1 : 1, P = (x, z) => [x * sg, z * sg], ry = r => r + (t ? Math.PI : 0);
    // everything below is written for team 0's half (+z); team 1's copy is the same group turned 180°
    const G = new THREE.Group(); G.rotation.y = t ? Math.PI : 0; deco.add(G);
    const bx = (x0, x1, y0, y1, z0, z1, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; G.add(m); return m; };
    const tm = std(t ? 0x2f8f62 : 0xb5362a, { roughness: 0.5 });                       // the team half's accent colour (dragon boat)
    let [x, z] = P(-18, 43.9); sign(n.tea, 9, 1.9, x, CL + 3.45, z, ry(Math.PI), t ? '#7a1512' : '#141210', t ? '#f3d98a' : '#e8c15a');
    [x, z] = P(-4.96, 21.5); sign(n.house, 5, 1.1, x, CL + 1.75, z, ry(Math.PI / 2), t ? '#7a1512' : '#c8202a', t ? '#f3d98a' : '#ffffff');
    [x, z] = P(3.5, 26.65); sign(n.stall, 2.2, 0.6, x, CL + 0.7, z, ry(0), '#7a1d18', '#ffe39a');
    [x, z] = P(-14.93, 23); sign(n.mansion, 2.6, 0.5, x, CL + 2.72, z, ry(Math.PI / 2));
    n.shops.forEach(([nm, zc, bg, fg]) => { [x, z] = P(25.96, zc); sign(nm, 7, 0.9, x, CL + 2.05, z, ry(-Math.PI / 2), bg, fg); });

    // ---- tea house at the spawn end (out of bounds block): manchu-window facades on its two open sides, a parapet, a green pavilion on the roof
    const tf = cantonTeaFace();
    face(G, tx(tf, 1, 1), 16, 9, -18, CL + 4.5, 43.98, Math.PI); face(G, tx(tf, 0.5, 1), 8, 9, -9.98, CL + 4.5, 48, Math.PI / 2);
    bx(-26, -9.8, CL + 9, CL + 9.5, 43.8, 52, M.cream);
    bx(-20, -16, CL + 9.5, CL + 11.2, 46, 50, M.cream); frustum(G, -21, -15, 45, 51, CL + 10.6, CL + 11.3, 1.4, 1.4, M.groof); bx(-19.2, -16.8, CL + 11.3, CL + 12.3, 46.8, 49.2, M.cream); frustum(G, -20.3, -15.7, 45.7, 50.3, CL + 12.3, CL + 13.9, 2.3, 2.3, M.groof);
    { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.gold); b.position.set(-18, CL + 14.05, 48); G.add(b); }

    // ---- 獵德 paifang: three tiled roofs (the middle one higher), brackets under the beam, drum stones at the posts
    [x, z] = P(0, 31.52); sign('獵德', 3.4, 0.95, x, CL + 4.0, z, ry(0)); [x, z] = P(0, 30.48); sign('獵德', 3.4, 0.95, x, CL + 4.0, z, ry(Math.PI));
    frustum(G, -6.0, -2.2, 29.9, 32.1, CL + 4.62, CL + 5.25, 0.5, 0.95, M.groof); frustum(G, 2.2, 6.0, 29.9, 32.1, CL + 4.62, CL + 5.25, 0.5, 0.95, M.groof);
    bx(-2.3, 2.3, CL + 4.6, CL + 5.45, 30.6, 31.4, M.cstone); frustum(G, -3.2, 3.2, 29.8, 32.2, CL + 5.45, CL + 6.3, 0.7, 1.05, M.groof);
    [[-2.2, CL + 5.25], [2.2, CL + 5.25], [0, CL + 6.3]].forEach(([rx, ry2], i) => bx(rx - (i < 2 ? 1.5 : 2.5), rx + (i < 2 ? 1.5 : 2.5), ry2, ry2 + 0.16, 30.9, 31.1, M.groof));
    [-4, 4].forEach(px => { bx(px - 0.55, px + 0.55, CL, CL + 0.5, 30.3, 31.7, M.cstone); [-1, 1].forEach(e => bx(px + e * 0.9 - 0.45, px + e * 0.9 + 0.45, CL + 3.0, CL + 3.4, 30.8, 31.2, M.cstone)); });

    // ---- stone bridge: posts on the parapets, an arch under each side, a string course
    [14.15, 17.85].forEach(px => { for (let i = 0; i < 5; i++) { const pz = -3.3 + i * 1.65; bx(px - 0.2, px + 0.2, CL + 0.5, CL + 0.78, pz - 0.2, pz + 0.2, M.cstone); bx(px - 0.13, px + 0.13, CL + 0.78, CL + 0.9, pz - 0.13, pz + 0.13, M.cstone); } });
    [[13.99, -Math.PI / 2], [18.01, Math.PI / 2]].forEach(([px, r]) => face(G, TEX.archFace, 7, CL, px, CL / 2, 0, r, { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));

    // ---- dragon boat (head toward the tower): neck and head, horns, eyes, a curled tail, the drum, a red parasol, flags
    { const neck = bx(-0.2, 0.2, 0, 1.25, -0.2, 0.2, tm); neck.position.set(8.25, 1.1, 0.8); neck.rotation.z = 0.55;
      bx(7.25, 8.2, 1.45, 1.95, 0.55, 1.05, tm); bx(7.06, 7.3, 1.45, 1.72, 0.62, 0.98, M.gold);
      [0.6, 1.0].forEach(hz => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 6), M.gold); h.position.set(7.95, 2.15, hz); h.rotation.z = -0.35; G.add(h); });
      [0.54, 1.06].forEach(ez => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.white); e.position.set(7.6, 1.78, ez); G.add(e); });
      const tail = bx(-0.14, 0.14, 0, 1.3, -0.16, 0.16, tm); tail.position.set(18.15, 1.15, 0.8); tail.rotation.z = -0.5; bx(18.4, 18.6, 1.6, 2.1, 0.55, 1.05, M.gold);
      bx(8.5, 18, 0.7, 0.76, 0.2, 0.3, M.gold); bx(8.5, 18, 0.7, 0.76, 1.3, 1.4, M.gold);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 14), M.red); drum.position.set(12, 0.95, 0.8); drum.castShadow = true; G.add(drum);
      const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 14), M.white); skin.position.set(12, 1.21, 0.8); G.add(skin);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), M.gold); pole.position.set(10.3, 1.85, 0.8); G.add(pole);
      const par = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.5, 14), std(0xe9c64a, { side: THREE.DoubleSide })); par.position.set(10.3, 3.1, 0.8); par.castShadow = true; G.add(par);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.22, 14, 1, true), std(0xb5362a, { side: THREE.DoubleSide })); rim.position.set(10.3, 2.75, 0.8); G.add(rim);
      [9.2, 13.6, 15.4].forEach((fx, i) => { const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), M.gold); p2.position.set(fx, 1.55, 0.8); G.add(p2); bx(fx, fx + 0.6, 1.95, 2.4, 0.78, 0.82, i % 2 ? M.gold : M.red); }); }

    // ---- Xiguan mansion: the hall at the back (out of bounds) with manchu windows and a sliding-bar door, a grey tiled roof between two wok-ear gables;
    //      the open gate with its two door leaves swung back, manchu windows on the street wall
    face(G, cantonHallFace(), 14, 4.4, -22.98, CL + 2.2, 23, Math.PI / 2);
    { const sh = new THREE.Shape(); sh.moveTo(-2.3, 0); sh.lineTo(0, 1.5); sh.lineTo(2.3, 0); sh.lineTo(-2.3, 0);
      const rg = new THREE.ExtrudeGeometry(sh, { depth: 13.4, bevelEnabled: false }); const uvr = rg.attributes.uv; for (let i = 0; i < uvr.count; i++) uvr.setXY(i, uvr.getX(i) / 1.2, uvr.getY(i) / 1.2);
      const r = new THREE.Mesh(rg, M.roof); r.position.set(-24.3, CL + 4.4, 16.3); r.castShadow = true; G.add(r);
      bx(-24.45, -24.15, CL + 5.85, CL + 6.05, 16.2, 29.8, std(0x4d5357));
      const wk = new THREE.Shape(); wk.moveTo(-2.4, 0); wk.lineTo(-2.4, 2.3); wk.quadraticCurveTo(-1.5, 2.3, -1.25, 3.0); wk.absarc(0, 3.0, 1.25, Math.PI, 0, true); wk.quadraticCurveTo(1.5, 2.3, 2.4, 2.3); wk.lineTo(2.4, 0); wk.lineTo(-2.4, 0);
      [15.95, 29.75].forEach(gz => { const w = new THREE.Mesh(new THREE.ExtrudeGeometry(wk, { depth: 0.3, bevelEnabled: false }), std(0x5d666c)); w.position.set(-24.4, CL + 2.6, gz); w.castShadow = true; G.add(w);
        const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(wk, { depth: 0.42, bevelEnabled: false }), std(0x2c2f33)); cap.scale.set(1.04, 1.03, 1); cap.position.set(-24.4, CL + 2.6, gz - 0.06); cap.renderOrder = -1; G.add(cap); w.position.z = gz - 0.07; w.scale.z = 1.5; }); }
    bx(-16.12, -14.88, CL, CL + 2.2, 20.7, 21, M.cstone); bx(-16.12, -14.88, CL, CL + 2.2, 25, 25.3, M.cstone);                // gate jambs
    bx(-17.9, -16.05, CL + 0.05, CL + 2.1, 20.82, 20.94, M.dwood); bx(-17.9, -16.05, CL + 0.05, CL + 2.1, 25.06, 25.18, M.dwood);  // door leaves, open
    [18.5, 27.5].forEach(wz => { bx(-14.99, -14.93, CL + 0.75, CL + 2.25, wz - 0.75, wz + 0.75, M.cream); const w = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 1.26), M.manchu); w.position.set(-14.92, CL + 1.5, wz); w.rotation.y = Math.PI / 2; G.add(w); });
  });

  // ---- 鎮海樓: red walls on the old city wall, green tiled eaves round every storey, dark window openings, a hip roof, the name board
  [[2.5, 2.0, 0.75], [2.5, 4.0, 0.75], [1.0, 6.0, 0.6]].forEach(([r, y, o]) => { frustum(deco, -r - o, r + o, -r - o, r + o, CL + y - 0.28, CL + y + 0.12, o + 0.02, o + 0.02, M.groof); boxAt(-r - 0.06, r + 0.06, CL + y - 0.5, CL + y - 0.28, -r - 0.06, r + 0.06, M.cream); });
  frustum(deco, -1.75, 1.75, -1.75, 1.75, CL + 8.2, CL + 9.5, 1.55, 1.75, M.groof); boxAt(-0.3, 0.3, CL + 9.45, CL + 9.62, -0.09, 0.09, M.groof); boxAt(-1.06, 1.06, CL + 7.9, CL + 8.2, -1.06, 1.06, M.cream);
  [[2.51, 0], [-2.51, Math.PI], [0, -1], [0, 1]].forEach(([px, r], i) => { for (const st of [[2.35, 3.35], [0, 0]]) for (const off of [-1.5, 0, 1.5]) { if (!st[1]) continue; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, st[1] - st[0]), M.dark); if (i < 2) { m.position.set(px, CL + (st[0] + st[1]) / 2, off); m.rotation.y = r ? -Math.PI / 2 : Math.PI / 2; } else { m.position.set(off, CL + (st[0] + st[1]) / 2, r * 2.51); m.rotation.y = r > 0 ? 0 : Math.PI; } deco.add(m); }
    for (const off of [-0.45, 0.45]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), M.dark); if (i < 2) { m.position.set(px > 0 ? 1.01 : -1.01, CL + 6.9, off); m.rotation.y = px > 0 ? Math.PI / 2 : -Math.PI / 2; } else { m.position.set(off, CL + 6.9, r * 1.01); m.rotation.y = r > 0 ? 0 : Math.PI; } deco.add(m); } });
  sign('鎮海樓', 1.7, 0.55, 0, CL + 5.0, 1.02, 0); sign('鎮海樓', 1.7, 0.55, 0, CL + 5.0, -1.02, Math.PI);
  // centre deck: posts on its two parapets
  [-6.85, 6.85].forEach(px => { for (let i = 0; i < 5; i++) { const pz = -3.3 + i * 1.65; boxAt(px - 0.2, px + 0.2, CL + 0.5, CL + 0.78, pz - 0.2, pz + 0.2, M.cstone); boxAt(px - 0.13, px + 0.13, CL + 0.78, CL + 0.9, pz - 0.13, pz + 0.13, M.cstone); } });

  // ---- rows of qilou shop-houses outside the walls (a facade texture per 4 m bay), plain towers further off
  let k = 0;
  for (let z = -ZH - 10; z < ZH + 10; z += 8) for (const sx of [-1, 1]) {
    if (z + 8 > -3.5 && z < 3.5) continue;
    const f = TEX.facade[k++ % TEX.facade.length];
    boxAt(sx > 0 ? XH + 1.5 : -XH - 11.5, sx > 0 ? XH + 11.5 : -XH - 1.5, CL, CL + 12.8, z, z + 7.9, std(0xffffff, { map: tx(f, 2, 1) }));
  }
  for (const sz of [-1, 1]) for (let i = 0; i < 8; i++) { const x0 = -XH - 11.5 + i * (XH * 2 + 23) / 8; boxAt(x0, x0 + (XH * 2 + 23) / 8 - 0.1, CL, CL + 12.8, sz > 0 ? ZH + 1.5 : -ZH - 11.5, sz > 0 ? ZH + 11.5 : -ZH - 1.5, std(0xffffff, { map: tx(TEX.facade[(i * 3 + (sz > 0 ? 1 : 4)) % TEX.facade.length], 2, 1) })); }
  const wt = TEX.windows, pal = [0xead7a6, 0xe9b9ac, 0xb9d9c2, 0xefe7d6, 0xbccfe1];
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + 0.3, r = 95 + (i % 3) * 18, h = 26 + (i * 7 % 5) * 7; boxAt(Math.cos(a) * r - 7, Math.cos(a) * r + 7, CL, CL + h, Math.sin(a) * r * 1.3 - 7, Math.sin(a) * r * 1.3 + 7, std(pal[i % 5], { map: tx(wt, 3, 6) })); }
  deco.updateMatrixWorld(true);
}
