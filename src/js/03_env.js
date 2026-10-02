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
  names.forEach((n, t) => {
    const sg = t ? -1 : 1, P = (x, z) => [x * sg, z * sg], ry = r => r + (t ? Math.PI : 0);
    let [x, z] = P(-18, 43.96); sign(n.tea, 9, 2.2, x, CL + 5.2, z, ry(Math.PI), t ? '#7a1512' : '#141210', t ? '#f3d98a' : '#e8c15a');
    [x, z] = P(8, 51.9); sign(n.tea, 14, 3, x, CL + 6.5, z, ry(Math.PI), t ? '#7a1512' : '#141210', t ? '#f3d98a' : '#e8c15a');
    [x, z] = P(-4.96, 21.5); sign(n.house, 5, 1.1, x, CL + 1.75, z, ry(Math.PI / 2), t ? '#7a1512' : '#c8202a', t ? '#f3d98a' : '#ffffff');
    [x, z] = P(3.5, 26.65); sign(n.stall, 2.2, 0.6, x, CL + 0.7, z, ry(0), '#7a1d18', '#ffe39a');
    [x, z] = P(-14.96, 23); sign(n.mansion, 2.6, 0.38, x, CL + 2.4, z, ry(Math.PI / 2));
    n.shops.forEach(([nm, zc, bg, fg]) => { [x, z] = P(25.96, zc); sign(nm, 7, 0.9, x, CL + 2.05, z, ry(-Math.PI / 2), bg, fg); });
    // paifang: the name on both faces, a green tiled roof
    [x, z] = P(0, 31.52); sign('獵德', 3.4, 0.95, x, CL + 4.0, z, ry(0)); [x, z] = P(0, 30.48); sign('獵德', 3.4, 0.95, x, CL + 4.0, z, ry(Math.PI));
    [x, z] = P(0, 31); boxAt(x - 5.7, x + 5.7, CL + 4.6, CL + 4.82, z - 1.1, z + 1.1, M.green); boxAt(x - 2.4, x + 2.4, CL + 4.82, CL + 5.5, z - 0.4, z + 0.4, M.stone); boxAt(x - 3.1, x + 3.1, CL + 5.5, CL + 5.72, z - 1.0, z + 1.0, M.green);
    // arcade colonnade: plinth and capital on every column, a beam with corner brackets between them, ceiling joists (visual only)
    for (let i = 0; i < 8; i++) {
      const c = 8.3 + i * (35.7 - 8.3) / 7, [cx, cz] = P(20.6, c);
      boxAt(cx - 0.42, cx + 0.42, CL, CL + 0.32, cz - 0.42, cz + 0.42, M.cstone); boxAt(cx - 0.36, cx + 0.36, CL + 0.32, CL + 0.4, cz - 0.36, cz + 0.36, M.cstone);
      boxAt(cx - 0.38, cx + 0.38, CL + 3.02, CL + 3.12, cz - 0.38, cz + 0.38, M.white); boxAt(cx - 0.44, cx + 0.44, CL + 3.12, CL + 3.39, cz - 0.44, cz + 0.44, M.white);
      const [jx, jz] = P(23.45, c); boxAt(jx - 2.55, jx + 2.55, CL + 3.22, CL + 3.39, jz - 0.12, jz + 0.12, M.plaster);
      if (i < 7) { const d = (35.7 - 8.3) / 7, [mx, mz] = P(20.6, c + d / 2);
        boxAt(mx - 0.16, mx + 0.16, CL + 3.08, CL + 3.39, mz - d / 2 + 0.3, mz + d / 2 - 0.3, M.plaster);
        for (const e of [-1, 1]) for (let q = 0; q < 3; q++) { const [bx, bz] = P(20.6, c + d / 2 + e * (d / 2 - 0.44 - q * 0.22)); boxAt(bx - 0.14, bx + 0.14, CL + 2.84 + q * 0.08, CL + 3.08, bz - 0.11, bz + 0.11, M.plaster); } }
    }
    // arcade: balustrade on the street side of the upper deck (visual only)
    [x, z] = P(20.45, 22); boxAt(x - 0.12, x + 0.12, CL + 4.55, CL + 4.7, z - 14, z + 14, M.white); for (let i = 0; i < 28; i++) { const [bx, bz] = P(20.45, 8.5 + i); boxAt(bx - 0.06, bx + 0.06, CL + 3.8, CL + 4.55, bz - 0.06, bz + 0.06, M.white); }
    // dragon boat: head toward the tower, tail, drum
    const bm = t ? M.green : M.red;
    [x, z] = P(8.0, 0.8); boxAt(x - 0.45, x + 0.45, 1.3, 1.75, z - 0.22, z + 0.22, bm); [x, z] = P(8.45, 0.8); boxAt(x - 0.12, x + 0.12, 0.7, 1.4, z - 0.12, z + 0.12, bm);
    [x, z] = P(12, 0.8); add(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 14), M.red, x, 0.95, z);
    [x, z] = P(17.7, 0.8); boxAt(x - 0.1, x + 0.1, 0.7, 1.5, z - 0.1, z + 0.1, bm);
    // mansion: main hall roof ridge (out of bounds block), gate jambs
    [x, z] = P(-24.5, 23); boxAt(x - 1.9, x + 1.9, CL + 4.4, CL + 4.65, z - 7.4, z + 7.4, std(0x666b70)); boxAt(x - 1.0, x + 1.0, CL + 4.65, CL + 5.2, z - 7.0, z + 7.0, std(0x73787d)); boxAt(x - 0.25, x + 0.25, CL + 5.2, CL + 5.5, z - 7.2, z + 7.2, std(0x5b6166));
  });
  // Zhenhai Tower: green eaves round each storey, hip roof, name board
  [[2.5, 1.95], [2.5, 3.85], [1.0, 5.6], [0.85, 7.0]].forEach(([r, y]) => boxAt(-r - 0.4, r + 0.4, CL + y, CL + y + 0.12, -r - 0.4, r + 0.4, M.green));
  { const roof = new THREE.ConeGeometry(1.8, 1.2, 4); roof.rotateY(Math.PI / 4); add(roof, M.green, 0, CL + 8.2 + 0.6, 0); }
  sign('鎮海樓', 1.6, 0.5, 0, CL + 5.05, 1.02, 0); sign('鎮海樓', 1.6, 0.5, 0, CL + 5.05, -1.02, Math.PI);
  // rows of shop-houses outside the walls, a far skyline
  const wt = TEX.windows; const pal = [0xead7a6, 0xe9b9ac, 0xb9d9c2, 0xefe7d6, 0xbccfe1, 0xe4a670, 0xd9d3c6];
  let k = 0;
  for (let z = -ZH - 10; z < ZH + 10; z += 8) for (const sx of [-1, 1]) {
    if (z + 8 > -3.5 && z < 3.5) continue;
    const h = 11 + (k % 3) * 2.5, t = wt.clone(); t.repeat.set(2, 3); t.needsUpdate = true;
    boxAt(sx > 0 ? XH + 1.5 : -XH - 11.5, sx > 0 ? XH + 11.5 : -XH - 1.5, CL, CL + h, z, z + 7.9, std(pal[k++ % pal.length], { map: t }));
  }
  for (const sz of [-1, 1]) { const t = wt.clone(); t.repeat.set(12, 3); t.needsUpdate = true; boxAt(-XH - 11.5, XH + 11.5, CL, CL + 14, sz > 0 ? ZH + 1.5 : -ZH - 11.5, sz > 0 ? ZH + 11.5 : -ZH - 1.5, std(pal[sz > 0 ? 0 : 5], { map: t })); }
  deco.updateMatrixWorld(true);
}
