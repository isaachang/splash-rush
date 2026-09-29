/* ============================================================== FX */
const TEAM_HEX = ['#ff7a00', '#3346ff'];
function sndVol(p) { const d = camera.position.distanceTo(p); return Math.pow(clamp(1 - d / 42, 0, 1), 1.4); }
const _dm = new THREE.Object3D(), _col = new THREE.Color(), _v3a = new THREE.Vector3();
// stereo pan of a world position relative to the camera (-1 left .. 1 right)
const _camF = new THREE.Vector3();
function sndPan(p) {
  const dx = p.x - camera.position.x, dz = p.z - camera.position.z, l = Math.hypot(dx, dz); if (l < 0.5) return 0;
  camera.getWorldDirection(_camF); const rx = -_camF.z, rz = _camF.x;      // camera right vector on the ground plane
  return clamp((dx * rx + dz * rz) / l, -1, 1) * 0.8;
}
const Fx = {
  N: 1400, parts: [], mesh: null, rings: [], ringPool: [], beams: [],
  init() {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.12 }), this.N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, _col.set('#fff')); scene.add(this.mesh);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); this.ringPool.push(m);
    }
  },
  add(x, y, z, vx, vy, vz, s, life, col, grav = 20) {
    if (this.parts.length >= this.N) this.parts.shift();
    this.parts.push({ x, y, z, vx, vy, vz, s, life, max: life, col, grav });
  },
  burst(x, y, z, col, n, sp, size) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), u = rand(-0.2, 1), s = sp * rand(0.3, 1);
      this.add(x, y, z, Math.cos(a) * s * Math.sqrt(1 - u * u), Math.abs(u) * s + sp * 0.3, Math.sin(a) * s * Math.sqrt(1 - u * u), size * rand(0.5, 1.4), rand(0.4, 0.9), col);
    }
  },
  // directional burst in a cone around normal (nx,ny,nz): liquid crown
  burstDir(x, y, z, col, n, sp, size, nx, ny, nz, spread = 0.7) {
    for (let i = 0; i < n; i++) {
      let dx = nx + rand(-1, 1) * spread, dy = ny + rand(-1, 1) * spread, dz = nz + rand(-1, 1) * spread; const l = Math.hypot(dx, dy, dz) || 1;
      const s = sp * rand(0.35, 1); this.add(x, y, z, dx / l * s, dy / l * s, dz / l * s, size * rand(0.5, 1.3), rand(0.45, 0.9), col, 24);
    }
  },
  spark(x, y, z, col) { this.add(x + rand(-0.2, 0.2), y + rand(-0.2, 0.2), z + rand(-0.2, 0.2), rand(-1, 1), rand(0, 2), rand(-1, 1), rand(0.05, 0.1), rand(0.3, 0.5), col, 6); },
  wake(x, y, z, col) { this.add(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3), rand(-0.6, 0.6), rand(1.5, 3), rand(-0.6, 0.6), rand(0.05, 0.1), 0.35, col, 14); },
  beamPart(a, b, col, w, life, op) {
    let m = this.beams.find(m => !m.visible);
    if (!m) { if (this.beams.length > 18) m = this.beams[0]; else { m = new THREE.Mesh(GEO.beam, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false })); scene.add(m); this.beams.push(m); } }
    m.visible = true; m.material.color.set(col); m.position.copy(a); m.lookAt(b); m.userData = { t: 0, w, len: a.distanceTo(b), life, op };
    m.scale.set(w, w, m.userData.len); m.material.opacity = op;
  },
  // coloured beam + white core; big=true adds an outer glow and lingers longer (full-charge shot)
  beam(a, b, col, w, big = false) {
    const life = big ? 0.38 : 0.22;
    this.beamPart(a, b, col, w, life, 1);
    this.beamPart(a, b, '#ffffff', w * 0.4, life * 0.8, 1);
    if (big) this.beamPart(a, b, col, w * 2.2, life * 1.1, 0.35);
  },
  // quick expanding translucent ball (explosions)
  ball(x, y, z, col, r) {
    if (!this.balls) this.balls = [];
    let m = this.balls.find(m => !m.visible);
    if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false })); scene.add(m); this.balls.push(m); }
    m.visible = true; m.position.set(x, y, z); m.material.color.set(col); m.userData = { t: 0, r };
  },
  ring(x, y, z, col, r) {
    const m = this.ringPool.find(m => !m.visible) || this.ringPool[0];
    m.visible = true; m.position.set(x, y, z); m.material.color.set(col); m.userData = { t: 0, r }; this.rings.includes(m) || this.rings.push(m);
  },
  update(dt) {
    const P = this.parts; let n = 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.life -= dt; if (p.life <= 0) { P.splice(i, 1); continue; }
      const dr = Math.exp(-1.3 * dt);
      p.vy -= p.grav * dt; p.vx *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (Math.abs(p.x) < XH && Math.abs(p.z) < ZH) {
        const g = groundAt(p.x, p.z);
        if (p.y < g) { if (p.vy < -1.5 && !p.flat) { p.y = g + 0.02; p.flat = 1; p.vx = p.vy = p.vz = 0; p.grav = 0; p.life = Math.min(p.life, 0.25); p.max = 0.25; } else if (!p.flat) p.y = g; }
      }
    }
    for (let i = 0; i < P.length && n < this.N; i++) {
      const p = P[i], k = Math.min(1, p.life / p.max * 1.6), s = p.s * k;
      _dm.position.set(p.x, p.y, p.z); _dm.rotation.set(0, 0, 0);
      if (p.flat) { _dm.scale.set(s * 1.8, s * 0.25, s * 1.8); }
      else {
        const sp = Math.hypot(p.vx, p.vy, p.vz), st = 1 + Math.min(sp * 0.09, 1.6);
        if (sp > 0.5) _dm.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
        _dm.scale.set(s / Math.sqrt(st), s / Math.sqrt(st), s * st);
      }
      _dm.updateMatrix();
      this.mesh.setMatrixAt(n, _dm.matrix); this.mesh.setColorAt(n, _col.set(p.col)); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const m of this.beams) {
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / (u.life || 0.22);
      if (k >= 1) { m.visible = false; continue; }
      const w = u.w * (1 - k * 0.7); m.scale.set(w, w, u.len); m.material.opacity = (u.op ?? 1) * (1 - k * k);
    }
    if (this.balls) for (const m of this.balls) {
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / 0.22;
      if (k >= 1) { m.visible = false; continue; }
      m.scale.setScalar(u.r * (0.35 + 0.65 * (1 - Math.pow(1 - k, 2)))); m.material.opacity = 0.75 * (1 - k);
    }
    for (const m of this.rings) {
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / 0.45;
      if (k >= 1) { m.visible = false; continue; }
      const s = u.r * (0.3 + 0.7 * (1 - Math.pow(1 - k, 3))); m.scale.set(s, s, s); m.material.opacity = (1 - k) * 0.9;
    }
  },
  clear() { this.parts.length = 0; this.rings.forEach(r => r.visible = false); this.beams.forEach(b => b.visible = false); if (this.balls) this.balls.forEach(b => b.visible = false); }
};

/* ======================================================== PROJECTILES */
const CURL_FUSE = 1.2, CURL_CRUISE = 0.65;       // curling bomb: fuse, and how long it slides at full speed before braking
const Proj = {
  shots: [], bombs: [], mesh: null, N: 700,
  init() {
    // ink blobs: glossy, a bit emissive so they read against any background; 3 instances per bullet (stream look)
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ roughness: 0.08, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.22, envMapIntensity: 1.3 }), this.N * 3);
    this.pending = [];
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.setColorAt(0, _col.set('#fff'));
    scene.add(this.mesh);
    this.bombGeo = new THREE.SphereGeometry(0.2, 16, 12); this.bandGeo = new THREE.TorusGeometry(0.2, 0.035, 6, 20);
  },
  // Wo: ballistics override; extra: { style: 'shell', blast, hitR }
  shot(owner, o, dir, Wo, cap, extra) {
    if (this.shots.length > this.N - 10) this.shots.shift();
    const W = Wo || owner.weapon;
    if (Cover.list.length && owner.pos) { const cv = Cover.between(owner, o); if (cv) { Cover.hit(cv, W.dmg || 0, o, owner.team, rand(W.splat ? W.splat[0] : 1, W.splat ? W.splat[1] : 1)); return; } }   // muzzle poked past an enemy board: it still stops there
    const b = { owner, team: owner.team, W, p: o.clone(), rp: o.clone(), v: dir.multiplyScalar(W.speed), t: 0, dist: 0, nextDrop: rand(0.7, 1.1), kind: 'shot', r: rand(W.splat[0], W.splat[1]), wob: rand(0, 6.28) };
    if (extra) Object.assign(b, extra);
    this.shots.push(b);
  },
  // blaster shell explosion: paint + fx + falloff damage (walls block it); 'direct' already took its hit
  blastAt(owner, p, R, core, dmg, paintR, via, direct = null) {
    const team = owner.team, col = TEAM_HEX[team], g = groundBelow(p.x, p.z, p.y + 0.2, 0.2), low = p.y - g < R;
    if (low && Math.abs(p.x) < XH && Math.abs(p.z) < ZH) owner.addPaint(splatFloor(p.x, g, p.z, paintR * (1 - (p.y - g) / (R * 1.6)), team, 1.2, false));
    splatFloor(p.x, p.y, p.z, paintR * 0.85, team, 0.35, true);                 // walls right next to the blast
    // a clear explosion wherever it happens: expanding ink ball + white flash, a spray of drops that rain down and paint
    Fx.burst(p.x, p.y, p.z, col, 34 + R * 10, 7 + R * 2, 0.17); Fx.burstDir(p.x, p.y, p.z, '#ffffff', 10, 6, 0.09, 0, 1, 0, 1);
    Fx.ball(p.x, p.y, p.z, col, R * 0.95); Fx.ball(p.x, p.y, p.z, '#ffffff', R * 0.55);
    if (low) Fx.ring(p.x, g + 0.06, p.z, col, R * 1.9);
    else for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; this.spray(owner, p, new THREE.Vector3(Math.cos(a) * rand(2, 4), rand(-1, 2), Math.sin(a) * rand(2, 4)), rand(0.5, 0.75)); }
    const v = sndVol(p); if (v > 0.03) Sfx.blastBoom(v, sndPan(p), R);
    if (PLAYER && PLAYER.alive) { const d = PLAYER.pos.distanceTo(p); if (d < R + 5) G.shake(0.35 * (1 - d / (R + 5))); }
    for (const c of CHARS) {
      if (c.team === team || !c.alive || c === direct) continue;
      const ch = c.chest(), d = ch.distanceTo(p); if (d >= R) continue;
      if (segBlocked(p.x, p.y + 0.05, p.z, ch.x, ch.y, ch.z, 0.25)) continue;
      const dm = d < core ? dmg[0] : lerp(dmg[0], dmg[1], (d - core) / (R - core)), dir = ch.clone().sub(p).setY(0).normalize();
      if (c.damage(dm, owner, via)) c.onHit(dir, dm);
    }
  },
  // paint that lands in two beats: a smaller core now, the full splat a moment later (reads as "splashing open")
  splatLater(delay, fn) { this.pending.push({ t: delay, fn }); },
  // one physics step of a shooter bullet (shared by the real bullet and the aim predictor)
  stepShot(b, h) {
    const W = b.W; b.t += h;
    if (b.t > W.straight) { const dh = Math.exp(-W.dragH * h), dv = Math.exp(-W.dragV * h); b.v.x *= dh; b.v.z *= dh; b.v.y *= dv; b.v.y -= W.grav * h; }
    b.p.addScaledVector(b.v, h);
  },
  shotDamage(b) { const W = b.W, f = W.falloff; return b.t <= f[0] ? W.dmg : lerp(W.dmg, W.dmgFar, clamp((b.t - f[0]) / (f[1] - f[0]), 0, 1)); },
  // where would a shot fired now land?  (no spread)  -> {end, char, t}
  predict(owner, o, dir) {
    const b = { W: owner.weapon, p: o.clone(), v: dir.clone().multiplyScalar(owner.weapon.speed), t: 0 }, h = 1 / 240;
    while (b.t < 1.2) {
      this.stepShot(b, h);
      if (b.W.fuse && b.t >= b.W.fuse) return { end: b.p.clone(), t: b.t };                 // blaster shell airbursts here
      for (const e of CHARS) if (e.team !== owner.team && !e.submerged && this.hitChar(e, b.p, 0.14)) return { end: b.p.clone(), char: e, t: b.t };
      if (solidAt(b.p.x, b.p.y, b.p.z) || b.p.y < -3 || (Cover.list.length && Cover.at(owner.team, b.p.x, b.p.y, b.p.z))) return { end: b.p.clone(), t: b.t };
    }
    return { end: b.p.clone(), t: b.t };
  },
  drop(owner, p, vy) { this.shots.push({ owner, team: owner.team, p: p.clone(), v: new THREE.Vector3(rand(-0.15, 0.15), vy, rand(-0.15, 0.15)), t: 1, kind: 'drop', r: rand(0.3, 0.38) }); },
  // ballistic ink droplet that paints where it lands (big = splashes again on landing)
  spray(owner, p, v, r, big = false) { if (this.shots.length > this.N - 5) return; this.shots.push({ owner, team: owner.team, p: p.clone(), v: v.clone(), t: 1, kind: 'drop', r, sz: 0.045 + r * 0.13, big }); },
  // what did a straight ray / projectile hit?  -> floor (with height) or wall (with face)
  classify(s, prev, p) {
    if (s === true) return { type: 'floor', y: groundAt(p.x, p.z), n: new THREE.Vector3(0, 1, 0) };
    const tPrev = topAt(s, clamp(prev.x, s.x0, s.x1), clamp(prev.z, s.z0, s.z1));
    if (prev.y >= tPrev - 0.08) return { type: 'floor', y: topAt(s, p.x, p.z), n: new THREE.Vector3(0, 1, 0) };
    if (!s.faces) return { type: 'none', y: p.y, n: new THREE.Vector3(0, 1, 0) };
    const ox = prev.x < s.x0 ? s.x0 - prev.x : prev.x > s.x1 ? prev.x - s.x1 : 0, oz = prev.z < s.z0 ? s.z0 - prev.z : prev.z > s.z1 ? prev.z - s.z1 : 0;
    const d = ox >= oz ? (prev.x < s.x0 ? '-x' : '+x') : (prev.z < s.z0 ? '-z' : '+z');
    const f = s.faces[d]; const n = new THREE.Vector3(d === '+x' ? 1 : d === '-x' ? -1 : 0, 0, d === '+z' ? 1 : d === '-z' ? -1 : 0);
    const pt = p.clone(); if (d[1] === 'x') pt.x = d[0] === '+' ? s.x1 : s.x0; else pt.z = d[0] === '+' ? s.z1 : s.z0;
    return { type: f ? 'wall' : 'none', face: f, n, pt, y: p.y };
  },
  // liquid splash: small core + droplets flung along the reflected direction
  splash(owner, p, n, dir, r, kind, face) {
    const team = owner.team, col = TEAM_HEX[team];
    const inside = Math.abs(p.x) < XH && Math.abs(p.z) < ZH;
    if (kind === 'floor') {
      const hz = Math.hypot(dir.x, dir.z) || 1, graze = clamp(1 - Math.abs(dir.y), 0, 1);
      owner.addPaint(splatFloor(p.x, p.y, p.z, r * 0.62, team, 0.7, true, { ux: dir.x / hz, uz: dir.z / hz, k: 1 + graze * 0.9 }));
    } else if (kind === 'wall' && face) {
      const along = face.ax ? p.z : p.x; splatWall(face, along - face.a0, clamp(p.y, 0, face.h), r * 0.7, team);
    }
    const dn = dir.x * n.x + dir.y * n.y + dir.z * n.z;
    const rx = dir.x - 2 * dn * n.x, ry = dir.y - 2 * dn * n.y, rz = dir.z - 2 * dn * n.z;
    const N = Math.round(5 + r * 6), o = new THREE.Vector3(p.x + n.x * 0.15, p.y + n.y * 0.15 + 0.05, p.z + n.z * 0.15), v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const sp = rand(2.2, 5.5) * (0.7 + r * 0.15), up = rand(1.8, 4.2);
      v.set(rx * sp + n.x * up + rand(-2, 2), ry * sp * 0.4 + n.y * up + rand(0, 1.2), rz * sp + n.z * up + rand(-2, 2));
      this.spray(owner, o, v, r * rand(0.15, 0.28));
    }
    Fx.burstDir(o.x, o.y, o.z, col, Math.round(10 + r * 7), 3 + r * 1.6, 0.08 + r * 0.02, n.x + rx * 0.5, n.y + Math.max(0, ry) * 0.5, n.z + rz * 0.5, 0.75);
    Fx.burstDir(o.x, o.y, o.z, col, Math.round(4 + r * 2), 1.5, 0.16, n.x, n.y, n.z, 1.1);
  },
  bomb(owner, o, dir) {
    const g = new THREE.Group();
    const mat = TEAMMAT[owner.team];
    const body = new THREE.Mesh(this.bombGeo, mat); body.castShadow = true; g.add(body);
    const light = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0 });
    const band = new THREE.Mesh(this.bandGeo, light); band.rotation.x = Math.PI / 2; g.add(band);
    g.position.copy(o); scene.add(g);
    const v = this.bombVel(owner, dir);
    this.bombs.push({ owner, team: owner.team, p: o.clone(), v, g, light, fuse: -1, bounces: 0 });
    if (sndVol(o) > 0.05) Sfx.throwB(sndVol(o));
  },
  // ---- curling bomb: slides along the ground laying a path of ink, bounces off walls, explodes when the fuse runs out
  curlMesh(team) {
    const g = new THREE.Group();
    if (!this.curlGeo) { this.curlGeo = new THREE.CylinderGeometry(0.3, 0.36, 0.2, 20); this.curlHandle = new THREE.TorusGeometry(0.11, 0.035, 6, 12, Math.PI); this.curlDark = new THREE.MeshStandardMaterial({ color: 0x1d1f28, roughness: 0.3, metalness: 0.5 }); }
    const body = new THREE.Mesh(this.curlGeo, TEAMMAT[team]); body.position.y = 0.1; body.castShadow = true; g.add(body);
    const light = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0 });
    const band = new THREE.Mesh(this.bandGeo, light); band.rotation.x = Math.PI / 2; band.scale.setScalar(1.6); band.position.y = 0.19; g.add(band);
    const handle = new THREE.Mesh(this.curlHandle, this.curlDark); handle.position.y = 0.2; g.add(handle);
    return { g, light };
  },
  bombMesh(team) {
    const g = new THREE.Group(); const body = new THREE.Mesh(this.bombGeo, TEAMMAT[team]); body.castShadow = true; g.add(body);
    const light = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0 });
    const band = new THREE.Mesh(this.bandGeo, light); band.rotation.x = Math.PI / 2; g.add(band);
    return { g, light };
  },
  curling(owner, dir) {
    const { g, light } = this.curlMesh(owner.team);
    const st = this.curlStart(owner, dir);
    g.position.copy(st.p); scene.add(g);
    this.bombs.push(Object.assign(st, { curl: true, owner, team: owner.team, g, light, fuse: CURL_FUSE, trail: 0 }));
    if (sndVol(st.p) > 0.05) Sfx.throwB(sndVol(st.p));
  },
  curlStart(owner, dir) {
    const f = new THREE.Vector3(dir.x, 0, dir.z); if (f.lengthSq() < 1e-4) f.set(Math.sin(owner.aimYaw), 0, Math.cos(owner.aimYaw)); f.normalize();
    const p = new THREE.Vector3(owner.pos.x + f.x * 0.8, 0, owner.pos.z + f.z * 0.8);
    if (owner.grounded === false) { p.y = owner.pos.y + 0.8; if (solidAt(p.x, p.y + 0.15, p.z)) p.set(owner.pos.x, owner.pos.y + 0.8, owner.pos.z); }   // mid-air: it drops out of the hand, then slides
    else { p.y = groundBelow(p.x, p.z, owner.pos.y + 0.1, 0.5); if (solidAt(p.x, p.y + 0.15, p.z)) p.copy(owner.pos); }   // start at our feet, not on top of a wall in front
    const sp = 12.8 * ((owner.cs && owner.cs.swimK) || 1);              // as fast as its thrower swims: you can keep up right behind it
    return { p, v: f.multiplyScalar(sp), vy: 0, t: 0 };
  },
  // one physics step (shared by the real bomb and the aim preview); returns true if it bounced
  curlStep(b, dt) {
    b.t = (b.t || 0) + dt;
    const sp = Math.hypot(b.v.x, b.v.z); if (sp > 1e-3 && b.t > CURL_CRUISE) { const k = Math.max(0, sp - 16 * dt) / sp; b.v.x *= k; b.v.z *= k; }   // full speed, then brakes near the end
    let bounced = false;
    const blocked = (x, z) => Math.abs(x) > XH - 0.35 || Math.abs(z) > ZH - 0.35 || !!solidAt(x, b.p.y + 0.18, z) || inBarrier(1 - b.team, new THREE.Vector3(x, b.p.y, z)) || !!Cover.at(b.team, x, b.p.y + 0.18, z);
    const nx = b.p.x + b.v.x * dt; if (blocked(nx, b.p.z)) { b.v.x *= -0.8; bounced = true; } else b.p.x = nx;
    const nz = b.p.z + b.v.z * dt; if (blocked(b.p.x, nz)) { b.v.z *= -0.8; bounced = true; } else b.p.z = nz;
    const g = groundBelow(b.p.x, b.p.z, b.p.y + 0.5, 0);
    if (b.p.y > g + 0.01) { b.vy -= 22 * dt; b.p.y = Math.max(g, b.p.y + b.vy * dt); if (b.p.y <= g) b.vy = 0; } else { b.p.y = g; b.vy = 0; }
    return bounced;
  },
  updateCurl(b, dt) {
    b.fuse -= dt;
    const sp = Math.hypot(b.v.x, b.v.z);
    if (this.curlStep(b, dt)) { const v = sndVol(b.p); if (v > 0.05) Sfx.impact(v * 0.6, sndPan(b.p)); }
    b.trail += sp * dt;
    if (b.trail > 0.32 && b.vy === 0) { b.trail = 0; b.owner.addPaint(splatFloor(b.p.x, b.p.y, b.p.z, 0.62, b.team, 0.6, true)); if (Math.random() < 0.6) Fx.burst(b.p.x, b.p.y + 0.1, b.p.z, TEAM_HEX[b.team], 2, 1.5, 0.05); }
    for (const c of CHARS) if (c.team !== b.team && c.alive && c.state === 'play' && Math.hypot(c.pos.x - b.p.x, c.pos.z - b.p.z) < 0.75 && Math.abs(c.pos.y - b.p.y) < 1.2) b.fuse = Math.min(b.fuse, 0.15);
    b.light.emissiveIntensity = b.fuse < 0.8 ? (Math.sin(b.fuse * 40) > 0 ? 2.5 : 0) : 0.4;
    b.g.position.copy(b.p); b.g.rotation.y += sp * dt * 1.5;
    return b.fuse <= 0;
  },
  bombVel(owner, dir) {
    const air = !owner.grounded, v = dir.clone().multiplyScalar(air ? 14 * 1.12 : 14);
    v.y += 5.5; v.x += owner.vel.x * 0.5; v.z += owner.vel.z * 0.5;
    if (air) v.y += Math.max(0, owner.vel.y) * 0.3;      // jump-throw: carries the jump's upward speed -> flies further
    return v;
  },
  // throw-arc preview (player holds the sub button)
  preview(owner, dir, ok) {
    if (!this.pv) {
      this.pvMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
      this.pvDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), this.pvMat, 40); this.pvDots.frustumCulled = false; scene.add(this.pvDots);
      this.pvRing = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.4, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      this.pvRing.rotation.x = -Math.PI / 2; scene.add(this.pvRing); this.pv = true;
    }
    if (!owner) { this.pvDots.count = 0; this.pvRing.visible = false; Cover.ghost(null); return; }
    const col = ok ? TEAM_HEX[owner.team] : '#9aa0aa';
    this.pvMat.color.set(col); this.pvRing.material.color.set(col);
    if (owner.subId === 'curling') {
      // straight slide along the ground (with bounces), ring where it will blow up
      const b = this.curlStart(owner, dir); b.team = owner.team; let n = 0;
      for (let i = 0; i < CURL_FUSE * 60; i++) {
        this.curlStep(b, 1 / 60);
        if (i % 4 === 1 && n < 40) { _dm.position.set(b.p.x, b.p.y + 0.08, b.p.z); _dm.scale.setScalar(0.07); _dm.rotation.set(0, 0, 0); _dm.updateMatrix(); this.pvDots.setMatrixAt(n++, _dm.matrix); }
      }
      this.pvDots.count = n; this.pvDots.instanceMatrix.needsUpdate = true;
      this.pvRing.visible = true; this.pvRing.position.set(b.p.x, b.p.y + 0.05, b.p.z); this.pvRing.scale.setScalar(2.8 / 3.4);
      return;
    }
    if (owner.subId === 'cover') { this.pvDots.count = 0; this.pvRing.visible = false; Cover.ghost(owner, dir, ok); return; }
    const p = owner.muzzle(), v = this.bombVel(owner, dir), h = 1 / 60; let n = 0, prev = p.clone(), hit = null;
    for (let i = 0; i < 180 && !hit; i++) {
      prev.copy(p); v.y -= 22 * h; p.addScaledVector(v, h);
      if (solidAt(p.x, p.y, p.z) || p.y < -2) { hit = p.clone(); break; }
      if (i % 3 === 1 && n < 40) { _dm.position.copy(p); _dm.scale.setScalar(0.06); _dm.rotation.set(0, 0, 0); _dm.updateMatrix(); this.pvDots.setMatrixAt(n++, _dm.matrix); }
    }
    this.pvDots.count = n; this.pvDots.instanceMatrix.needsUpdate = true;
    if (hit) { const g = groundBelow(hit.x, hit.z, prev.y + 0.1, 0.4); this.pvRing.visible = true; this.pvRing.position.set(hit.x, g + 0.05, hit.z); this.pvRing.scale.setScalar(1); }
    else this.pvRing.visible = false;
  },
  hitChar(c, p, rad) {
    if (!c.alive || c.state !== 'play') return false;
    let y0, y1, r;
    const hk = (c.cs && c.cs.hitK) || 1;                        // bigger body (石墩) = bigger target
    if (c.swim) { y0 = y1 = c.pos.y + 0.25; r = 0.45; } else { y0 = c.pos.y + 0.35; y1 = c.pos.y + 0.35 + 1.0 * ((c.look && c.look.bodyH) || 1); r = 0.42 * hk; }
    const cy = clamp(p.y, y0, y1), dx = p.x - c.pos.x, dy = p.y - cy, dz = p.z - c.pos.z;
    return dx * dx + dy * dy + dz * dz < (r + rad) * (r + rad);
  },
  impact(s, prev, p, team, owner, r, big) {
    // returns true if absorbed
    let hx = p.x, hz = p.z;
    const inside = Math.abs(hx) < XH && Math.abs(hz) < ZH;
    const floorHit = (y) => {
      if (r > 0.8) { owner.addPaint(splatFloor(hx, y, hz, r * 0.6, team, 0.7, false)); this.splatLater(0.05, () => owner.addPaint(splatFloor(hx, y, hz, r, team, 0.7, true))); }
      else owner.addPaint(splatFloor(hx, y, hz, r, team, 0.7, false));
    };
    if (s === true) { if (inside) { const g = groundAt(hx, hz); floorHit(g); this.fx(hx, g + 0.05, hz, team, r, 0, 1, 0); } return true; }
    const tPrev = topAt(s, clamp(prev.x, s.x0, s.x1), clamp(prev.z, s.z0, s.z1));
    if (prev.y >= tPrev - 0.08) {
      const y = topAt(s, hx, hz);
      if (!s.bound && inside) floorHit(y);
      else if (s.bound) splatFloor(hx, y, hz, r * 0.8, team, 0.7, true);     // top of the perimeter wall
      this.fx(hx, y + 0.05, hz, team, r, 0, 1, 0); return true;
    }
    if (s.faces) {
      const ox = prev.x < s.x0 ? s.x0 - prev.x : prev.x > s.x1 ? prev.x - s.x1 : 0;
      const oz = prev.z < s.z0 ? s.z0 - prev.z : prev.z > s.z1 ? prev.z - s.z1 : 0;
      let d; if (ox >= oz) d = prev.x < s.x0 ? '-x' : '+x'; else d = prev.z < s.z0 ? '-z' : '+z';
      const f = s.faces[d];
      if (f) { const along = f.ax ? p.z : p.x, wy = clamp(p.y, 0, f.h); splatWall(f, along - f.a0, wy, r * 0.5, team); this.splatLater(0.05, () => splatWall(f, along - f.a0, wy, r * 0.8, team)); }
      const nx = d === '+x' ? 1 : d === '-x' ? -1 : 0, nz = d === '+z' ? 1 : d === '-z' ? -1 : 0;
      this.fx(d[1] === 'x' ? (d[0] === '+' ? s.x1 : s.x0) : hx, p.y, d[1] === 'z' ? (d[0] === '+' ? s.z1 : s.z0) : hz, team, r, nx, 0, nz);
    }
    return true;
  },
  // splash crown along the surface normal + wet impact sound
  fx(x, y, z, team, r, nx = 0, ny = 1, nz = 0) {
    if (r <= 0.6) return;
    const col = TEAM_HEX[team];
    Fx.burstDir(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, col, 14, 4.3, 0.09, nx, ny, nz, 0.95);
    Fx.burstDir(x, y, z, col, 5, 1.8, 0.17, nx, ny, nz, 0.55);
    const p = _v3a.set(x, y, z), v = sndVol(p); if (v > 0.05) Sfx.impact(v * 0.8, sndPan(p));
  },
  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) { const q = this.pending[i]; q.t -= dt; if (q.t <= 0) { this.pending.splice(i, 1); q.fn(); } }
    const S = this.shots;
    for (const b of S) if (b.kind === 'shot') { if (!b.rp) b.rp = b.p.clone(); b.rq = b.rp.clone(); }
    for (let i = S.length - 1; i >= 0; i--) {
      const b = S[i]; let dead = false;
      const sub = clamp(Math.ceil(b.v.length() * dt / 0.3), 2, 14), h = dt / sub;
      for (let k = 0; k < sub && !dead; k++) {
        const prev = b.p.clone();
        if (b.kind === 'shot') {
          this.stepShot(b, h);
          b.dist += b.v.length() * h;
          if (b.dist > b.nextDrop) { b.nextDrop += rand(0.8, 1.2); if (S.length < this.N) this.drop(b.owner, b.p, b.v.y * 0.1); }
          if (Math.random() < 0.06) Fx.add(b.p.x, b.p.y, b.p.z, b.v.x * 0.02 + rand(-0.4, 0.4), rand(-0.5, 0.4), b.v.z * 0.02 + rand(-0.4, 0.4), rand(0.04, 0.07), 0.35, TEAM_HEX[b.team], 18);
        } else { b.v.y -= 25 * h; b.p.addScaledVector(b.v, h); }
        if (b.kind === 'shot') {
          for (const c of CHARS) { if (c.team !== b.team && this.hitChar(c, b.p, b.hitR || 0.14)) {
            const dmg = this.shotDamage(b), vn = b.v.clone().normalize();
            if (c.damage(dmg, b.owner)) c.onHit(vn, dmg);
            if (b.blast) { const W = b.W; this.blastAt(b.owner, b.p.clone(), W.blastR, W.blastCore, W.blastDmg, 1.5, W.id, c); }
            Fx.burstDir(b.p.x, b.p.y, b.p.z, TEAM_HEX[b.team], 17, 4.8, 0.1, -vn.x + rand(-0.3, 0.3), 0.4, -vn.z + rand(-0.3, 0.3), 0.9);
            Fx.burstDir(b.p.x, b.p.y, b.p.z, TEAM_HEX[b.team], 4, 2, 0.15, vn.x, 0.2, vn.z, 0.6);
            dead = true; break; } }
          if (dead) break;
          // blaster shell: explodes in mid-air at the end of its flight
          if (b.blast && b.t >= b.W.fuse) { const W = b.W; this.blastAt(b.owner, b.p.clone(), W.blastR, W.blastCore, W.blastDmg, 1.5, W.id); dead = true; break; }
        }
        if (inBarrier(1 - b.team, b.p)) { Fx.burst(b.p.x, b.p.y, b.p.z, TEAM_HEX[b.team], 3, 1.5, 0.05); Barrier.flash(1 - b.team); dead = true; break; }
        if (Cover.list.length) { const cv = Cover.at(b.team, b.p.x, b.p.y, b.p.z); if (cv) { Cover.hit(cv, b.kind === 'shot' ? this.shotDamage(b) : 0, b.p, b.team, b.kind === 'shot' ? b.r : 0); if (b.blast) { const W = b.W; this.blastAt(b.owner, prev.clone(), W.blastR, W.blastCore, W.blastDmg, 1.5, W.id); } dead = true; break; } }
        const s = solidAt(b.p.x, b.p.y, b.p.z);
        if (s) {
          if (b.big) { const h = this.classify(s, prev, b.p); if (h.type !== 'none') this.splash(b.owner, h.type === 'wall' ? h.pt : new THREE.Vector3(b.p.x, h.y, b.p.z), h.n, b.v.clone().normalize(), b.r, h.type, h.face); if (sndVol(b.p) > 0.1) Sfx.splat(sndVol(b.p)); }
          else if (b.blast) { const W = b.W; this.impact(s, prev, b.p, b.team, b.owner, b.r); this.blastAt(b.owner, prev.clone(), W.blastR, W.blastCore, W.blastDmg, 1.5, W.id); }
          else this.impact(s, prev, b.p, b.team, b.owner, b.r);
          dead = true;
        }
        if (b.p.y < -4 || b.t > 3) dead = true;
      }
      if (dead) S.splice(i, 1);
    }
    // bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      if (b.curl) { if (this.updateCurl(b, dt)) { this.explode(b); scene.remove(b.g); this.bombs.splice(i, 1); } else if (b.p.y < -3) { scene.remove(b.g); this.bombs.splice(i, 1); } continue; }
      if (b.fuse < 0) {
        const prev = b.p.clone(); b.v.y -= 22 * dt; b.p.addScaledVector(b.v, dt);
        if (inBarrier(1 - b.team, b.p)) { b.p.copy(prev); b.v.x *= -0.35; b.v.z *= -0.35; Barrier.flash(1 - b.team); }
        else { const cv = Cover.at(b.team, b.p.x, b.p.y, b.p.z); if (cv) { b.p.copy(prev); b.v.x *= -0.35; b.v.z *= -0.35; Cover.hit(cv, 0, b.p); } }
        for (const c of CHARS) if (c.team !== b.team && this.hitChar(c, b.p, 0.2)) { b.fuse = 0.25; b.v.set(0, 0, 0); break; }
        const s = solidAt(b.p.x, b.p.y, b.p.z);
        if (s) {
          const onTop = s === true || prev.y >= topAt(s, clamp(prev.x, s.x0, s.x1), clamp(prev.z, s.z0, s.z1)) - 0.05;
          if (onTop) {
            b.p.y = s === true ? 0 : topAt(s, b.p.x, b.p.z); b.p.y = Math.max(b.p.y, groundAt(b.p.x, b.p.z)) + 0.2;
            if (b.bounces < 1 && Math.abs(b.v.y) > 4) { b.v.y = -b.v.y * 0.3; b.v.x *= 0.5; b.v.z *= 0.5; b.bounces++; }
            else { b.v.set(0, 0, 0); b.fuse = 0.9; }
          } else { b.p.copy(prev); b.v.x *= -0.4; b.v.z *= -0.4; }
        }
        if (b.p.y < -3) { scene.remove(b.g); this.bombs.splice(i, 1); continue; }
      } else {
        b.fuse -= dt; b.light.emissiveIntensity = Math.sin(b.fuse * 40) > 0 ? 2.5 : 0;
        b.g.scale.setScalar(1 + (0.9 - b.fuse) * 0.4);
        if (b.fuse <= 0) { this.explode(b); scene.remove(b.g); this.bombs.splice(i, 1); continue; }
      }
      b.g.position.copy(b.p); b.g.rotation.x += dt * 6;
    }
    // render shots
    let n = 0; const cap = this.N * 3;
    for (const b of S) {
      if (n >= cap - 3) break;
      _col.set(TEAM_HEX[b.team]);
      if (b.kind === 'shot') {
        // head blob + 2 trailing blobs between last frame's and this frame's position -> a continuous stream
        const sp = b.v.length(), s = 0.26 * (1 + Math.sin(G.time * 40 + b.wob) * 0.06), len = s * (1.25 + Math.min(sp * 0.011, 1.6));   // chunky ink blobs (about head-sized)
        const from = b.rq || b.p, sh = b.style === 'shell';
        for (let k = 0; k < (sh ? 1 : 3); k++) {
          const u = 1 - k / 3, sk = s * (1 - k * 0.18) * (sh ? 1.25 : 1);
          _dm.position.lerpVectors(from, b.p, u); _dm.scale.set(sk, sk, len * (1 - k * 0.15) * (sh ? 0.75 : 1));
          _dm.lookAt(_dm.position.x + b.v.x, _dm.position.y + b.v.y, _dm.position.z + b.v.z); _dm.updateMatrix();
          this.mesh.setMatrixAt(n, _dm.matrix); this.mesh.setColorAt(n, _col); n++;
        }
        b.rp.copy(b.p);
      } else {
        const s = (b.sz || 0.07) * 1.3; _dm.position.copy(b.p); _dm.scale.set(s, s, s * 1.4);
        _dm.lookAt(b.p.x + b.v.x, b.p.y + b.v.y, b.p.z + b.v.z); _dm.updateMatrix();
        this.mesh.setMatrixAt(n, _dm.matrix); this.mesh.setColorAt(n, _col); n++;
      }
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  },
  explode(b) {
    const p = b.p, g = groundBelow(p.x, p.z, p.y + 0.1, 0.4), cu = !!b.curl;
    // curling bomb: a smaller blast than the splat bomb (like the original)
    const pr = cu ? 2.7 : 3.4, R = cu ? 2.9 : 3.6, core = cu ? 1.1 : 1.4, edge = cu ? 70 : 80;
    const gained = splatFloor(p.x, g, p.z, pr, b.team, 1.6); b.owner.addPaint(gained);
    Fx.burst(p.x, g + 0.3, p.z, TEAM_HEX[b.team], cu ? 40 : 50, cu ? 8 : 10, 0.2); Fx.ring(p.x, g + 0.06, p.z, TEAM_HEX[b.team], cu ? 3.6 : 4.5);
    const v = sndVol(p); Sfx.boom(v * (cu ? 0.8 : 1)); if (v > 0.3) G.shake(v * (cu ? 0.5 : 0.7));
    for (const c of CHARS) { if (c.team === b.team || !c.alive) continue; const d = c.chest().distanceTo(p); if (d < R) c.damage(d < core ? 180 : lerp(edge, 30, (d - core) / (R - core)), b.owner, cu ? 'curling' : 'bomb'); }
    Cover.blast(b.team, p, R, cu ? 110 : 140);                         // bombs are the answer to a cover
  },
  clear() { this.shots.length = 0; this.pending.length = 0; this.bombs.forEach(b => scene.remove(b.g)); this.bombs.length = 0; Cover.clear(); }
};

/* ======================================================== SPAWN BARRIER
   Like the original: a dome-ish wall around each spawn pad. Enemies can't
   walk in, enemy ink can't get through, players inside it can't be hurt.   */
const BARRIER_R = 6.5, BARRIER_H = 9;
function inBarrier(team, p) { const s = SPAWN[team], dx = p.x - s.x, dz = p.z - s.z; return p.y < BARRIER_H && dx * dx + dz * dz < BARRIER_R * BARRIER_R; }
const Barrier = {
  meshes: [], glow: [0, 0],
  init() {
    const tex = canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,.95)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.5)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 3);
    });
    tex.repeat.set(10, 1);
    SPAWN.forEach((sp, t) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(BARRIER_R, BARRIER_R, BARRIER_H, 56, 1, true),
        new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.position.set(sp.x, BARRIER_H / 2 - 0.05, sp.z); m.renderOrder = 2; scene.add(m); this.meshes.push(m);
    });
    this.tex = tex;
  },
  flash(t) { this.glow[t] = 1; },
  update(dt, time) {
    if (!this.meshes.length) return;
    this.tex.offset.y = (time * 0.15) % 1;
    this.meshes.forEach((m, t) => { this.glow[t] = Math.max(0, this.glow[t] - dt * 3); m.material.color.set(TEAM_HEX[t]); m.material.opacity = 0.2 + this.glow[t] * 0.45; });
  }
};

/* ===================================================== GRAFFITI COVER
   满满's sub weapon: a spray-painted board. Enemy ink stops on it (and
   wears it down); your own team's ink passes straight through. Players
   walk through it (no collision), so it never blocks paths or the AI.  */
const Cover = {
  list: [], texCache: {}, W: 2.4, H: 1.6, T: 0.14,
  texFor(team) {
    const col = TEAM_HEX[team]; if (this.texCache[col]) return this.texCache[col];
    let sd = 11; const rn = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const t = canvasTex(240, 160, (g, w, h) => {
      g.fillStyle = '#262734'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2;
      for (let y = 20; y < h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 20) % 2 ? 0 : 20; x < w; x += 40) { g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x, y); g.stroke(); } }
      // big team-colour splat with drips
      g.fillStyle = col; g.beginPath(); g.arc(w * 0.46, h * 0.5, 46, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2 + rn() * 0.4, d = 44 + rn() * 16, r = 9 + rn() * 12; g.beginPath(); g.arc(w * 0.46 + Math.cos(a) * d, h * 0.5 + Math.sin(a) * d * 0.8, r, 0, Math.PI * 2); g.fill(); }
      for (let k = 0; k < 6; k++) { const x = w * 0.3 + rn() * w * 0.34, l = 16 + rn() * 34, y = h * 0.62; g.fillRect(x - 3, y, 6, l); g.beginPath(); g.arc(x, y + l, 5, 0, Math.PI * 2); g.fill(); }
      for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(rn() * w, rn() * h, 1.5 + rn() * 3, 0, Math.PI * 2); g.fill(); }
      // tag
      g.save(); g.translate(w * 0.47, h * 0.52); g.rotate(-0.12);
      g.font = 'italic 900 50px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = '#111'; g.strokeText('INK!', 0, 0); g.fillStyle = '#fff'; g.fillText('INK!', 0, 0);
      g.restore();
      g.strokeStyle = '#ffe45c'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w * 0.8, h * 0.18); g.lineTo(w * 0.86, h * 0.3); g.lineTo(w * 0.92, h * 0.16); g.stroke();
      g.beginPath(); g.moveTo(w * 0.1, h * 0.8); g.quadraticCurveTo(w * 0.2, h * 0.68, w * 0.3, h * 0.82); g.stroke();
      g.strokeStyle = col; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    }, false);
    this.texCache[col] = t; return t;
  },
  // where the board goes: ~3 m ahead on the ground, pulled closer if a wall is in the way
  spot(owner, f) {
    for (const d of [3, 2.5, 2, 1.5, 1.1]) {
      const x = clamp(owner.pos.x + f.x * d, -XH + 1.3, XH - 1.3), z = clamp(owner.pos.z + f.z * d, -ZH + 1.3, ZH - 1.3);
      const y = groundBelow(x, z, owner.pos.y + 0.6, 0.6);
      if (solidAt(x, y + 0.8, z) || Math.abs(y - owner.pos.y) > 1.2) continue;
      return { x, y, z };
    }
    return null;
  },
  // mid-air (or no room ahead): the board is flung out of the hand and falls to the ground ahead
  flight(owner, f) {
    const p = new THREE.Vector3(owner.pos.x + f.x * 0.5, owner.pos.y + 1.1, owner.pos.z + f.z * 0.5), h = 1 / 60;
    const v = new THREE.Vector3(f.x * 7 + owner.vel.x * 0.3, 3, f.z * 7 + owner.vel.z * 0.3), p0 = p.clone();
    if (solidAt(p.x, p.y, p.z)) { p.set(owner.pos.x, owner.pos.y + 1.1, owner.pos.z); p0.copy(p); v.x = v.z = 0; }
    let T = 0;
    for (let i = 0; i < 180; i++) {
      v.y -= 22 * h; let nx = clamp(p.x + v.x * h, -XH + 1.3, XH - 1.3), nz = clamp(p.z + v.z * h, -ZH + 1.3, ZH - 1.3), ny = p.y + v.y * h; T += h;
      const g = groundBelow(nx, nz, p.y + 0.1, 0);
      if (ny <= g) { p.set(nx, g, nz); break; }
      if (solidAt(nx, ny, nz)) { v.x = v.z = 0; nx = p.x; nz = p.z; }       // hit a wall: drop straight down
      p.set(nx, ny, nz);
    }
    return { x: p.x, y: groundBelow(p.x, p.z, p.y + 0.1, 0), z: p.z, fly: { p0, v0: new THREE.Vector3(f.x * 7 + owner.vel.x * 0.3, 3, f.z * 7 + owner.vel.z * 0.3), T } };
  },
  target(owner, f) { return (owner.grounded !== false && this.spot(owner, f)) || this.flight(owner, f); },
  // the board model (also used by the lobby demo)
  build(team) {
    if (!this.geo) { this.geo = new THREE.BoxGeometry(this.W, this.H, this.T); this.darkM = new THREE.MeshStandardMaterial({ color: 0x1b1c24, roughness: 0.5, metalness: 0.3 }); this.decalGeo = new THREE.CircleGeometry(1, 12); this.decalM = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff })); }
    const face = new THREE.MeshStandardMaterial({ map: this.texFor(team), roughness: 0.55, emissive: 0x000000 });
    const g = new THREE.Group();
    const board = new THREE.Mesh(this.geo, [this.darkM, this.darkM, this.darkM, this.darkM, face, face]); board.position.y = this.H / 2 + 0.1; board.castShadow = true; g.add(board);
    const top = new THREE.Mesh(this.geo, TEAMMAT[team]); top.scale.set(1.03, 0.05, 1.5); top.position.y = this.H + 0.12; g.add(top);
    [-1, 1].forEach(s => { const ft = new THREE.Mesh(this.geo, this.darkM); ft.scale.set(0.08, 0.1, 3.6); ft.position.set(s * (this.W / 2 - 0.25), 0.08, 0); g.add(ft); });
    return { g, board, face };
  },
  place(owner, dir) {
    const f = new THREE.Vector3(dir.x, 0, dir.z); if (f.lengthSq() < 1e-4) f.set(Math.sin(owner.aimYaw), 0, Math.cos(owner.aimYaw)); f.normalize();
    for (const c of this.list.slice()) if (c.owner === owner) this.breakIt(c, true);          // one board each
    const sp = this.target(owner, f), yaw = Math.atan2(f.x, f.z), team = owner.team;
    const { g, board, face } = this.build(team); g.position.set(sp.x, sp.y, sp.z); g.rotation.y = yaw;
    scene.add(g);
    const cv = { owner, team, x: sp.x, y: sp.y, z: sp.z, ax: Math.cos(yaw), az: -Math.sin(yaw), nx: f.x, nz: f.z, hp: SUBS.cover.hp, t: SUBS.cover.life, g, board, face, grow: 0, flash: 0, wob: 0, decals: [] };
    this.list.push(cv);
    if (sp.fly) { cv.fly = Object.assign({ t: 0 }, sp.fly); g.position.copy(sp.fly.p0); g.scale.setScalar(0.5); if (sndVol(g.position) > 0.05) Sfx.throwB(sndVol(g.position)); return cv; }
    this.land(cv);
    return cv;
  },
  // it hits the ground: spray-paint pop-up, puddle of our ink behind it
  land(cv) {
    const owner = cv.owner, team = cv.team, sp = cv, f = { x: cv.nx, z: cv.nz }, g = cv.g;
    cv.fly = null; g.position.set(cv.x, cv.y, cv.z); g.rotation.x = 0; cv.grow = 0;
    // a puddle of our ink behind it: swim there to refill in cover
    owner.addPaint(splatFloor(sp.x - f.x * 0.9, sp.y, sp.z - f.z * 0.9, 1.8, team, 1.0, true));
    const colr = TEAM_HEX[team];
    for (let k = 0; k < 7; k++) { const u = (k / 6 - 0.5) * this.W; Fx.burstDir(sp.x + cv.ax * u, sp.y + 0.1, sp.z + cv.az * u, colr, 3, 4, 0.08, 0, 1, 0, 0.5); }
    const v = sndVol(g.position); if (v > 0.03) Sfx.spray(v, sndPan(g.position));
  },
  // enemy board (of someone not on `team`) at this point?
  at(team, x, y, z) {
    for (const c of this.list) {
      if (c.team === team || c.grow < 0.25) continue;
      const dx = x - c.x, dz = z - c.z, lu = dx * c.ax + dz * c.az, ln = dx * c.nx + dz * c.nz;
      if (Math.abs(lu) < this.W / 2 && Math.abs(ln) < 0.24 && y > c.y - 0.1 && y < c.y + 0.12 + this.H * Math.min(1, c.grow)) return c;
    }
    return null;
  },
  // ink hit the board: splash off it, leave a mark, wear it down
  hit(c, dmg, p, team = 1 - c.team, r = 0) {
    c.hp -= dmg; if (dmg > 0) { c.flash = 1; c.wob = Math.min(1, c.wob + 0.35 + dmg / 150); }
    const side = Math.sign((p.x - c.x) * c.nx + (p.z - c.z) * c.nz) || 1, col = TEAM_HEX[team];
    Fx.burstDir(p.x, p.y, p.z, col, dmg > 60 ? 16 : 7, 3.4, 0.08, c.nx * side, 0.35, c.nz * side, 0.85);
    if (r > 0 && dmg > 0) {
      let m = c.decals.length >= 14 ? c.decals.shift() : null;
      if (!m) m = new THREE.Mesh(this.decalGeo, this.decalM[team]); else m.material = this.decalM[team];
      this.decalM[team].color.set(col);
      const lu = clamp((p.x - c.x) * c.ax + (p.z - c.z) * c.az, -this.W / 2 + 0.15, this.W / 2 - 0.15), ly = clamp(p.y - c.y, 0.25, this.H - 0.05);
      m.position.set(lu, ly, side * (this.T / 2 + 0.006)); m.rotation.set(0, side > 0 ? 0 : Math.PI, rand(0, 6)); m.scale.setScalar(clamp(r * 0.28, 0.12, 0.42) * rand(0.8, 1.2)); c.g.add(m); c.decals.push(m);
    }
    const v = sndVol(p); if (v > 0.05) Sfx.impact(v * 0.7, sndPan(p));
    if (c.hp <= 0) this.breakIt(c);
  },
  // solid for everyone: push a character back out to the side it came from (bots slide along it to get round)
  push(ch, px, pz) {
    const R = 0.38 * ((ch.cs && ch.cs.hitK) ? 1.15 : 1);
    for (const c of this.list) {
      if (c.grow < 0.25 || ch.pos.y > c.y + 0.12 + this.H || ch.pos.y < c.y - 1) continue;
      const dx = ch.pos.x - c.x, dz = ch.pos.z - c.z, lu = dx * c.ax + dz * c.az, ln = dx * c.nx + dz * c.nz;
      if (Math.abs(lu) > this.W / 2 + R * 0.7 || Math.abs(ln) > this.T / 2 + R) continue;
      const ln0 = (px - c.x) * c.nx + (pz - c.z) * c.nz, side = Math.sign(ln0) || Math.sign(ln) || -1, lnN = side * (this.T / 2 + R);
      const slide = ch.isPlayer ? 0 : Math.sign(lu || 1) * 0.07;
      ch.pos.x = c.x + c.ax * (lu + slide) + c.nx * lnN; ch.pos.z = c.z + c.az * (lu + slide) + c.nz * lnN;
      const vn = (ch.vel.x * c.nx + ch.vel.z * c.nz) * side; if (vn < 0) { ch.vel.x -= c.nx * side * vn; ch.vel.z -= c.nz * side * vn; }
    }
  },
  // enemy board between a shooter's body and their muzzle?
  between(owner, o) {
    const sx = owner.pos.x, sy = owner.pos.y + 0.93, sz = owner.pos.z;
    for (let k = 0; k <= 4; k++) { const u = k / 4, c = this.at(owner.team, sx + (o.x - sx) * u, sy + (o.y - sy) * u, sz + (o.z - sz) * u); if (c) return c; }
    return null;
  },
  // explosions nearby hurt it (bombs are the counter)
  blast(team, p, R, dmg) {
    for (const c of this.list.slice()) {
      if (c.team === team) continue;
      const lu = clamp((p.x - c.x) * c.ax + (p.z - c.z) * c.az, -this.W / 2, this.W / 2), qx = c.x + c.ax * lu, qz = c.z + c.az * lu;
      const d = Math.hypot(p.x - qx, p.z - qz, Math.max(0, p.y - (c.y + this.H))); if (d < R) this.hit(c, dmg * (1 - 0.5 * d / R), new THREE.Vector3(qx, c.y + 0.8, qz), team);
    }
  },
  breakIt(c, quiet = false) {
    const i = this.list.indexOf(c); if (i < 0) return; this.list.splice(i, 1);
    scene.remove(c.g); c.face.dispose();
    if (quiet) return;
    const col = TEAM_HEX[c.team];
    for (let k = 0; k < 5; k++) { const u = (k / 4 - 0.5) * this.W; Fx.burst(c.x + c.ax * u, c.y + 0.9, c.z + c.az * u, col, 9, 5, 0.13); }
    Fx.ring(c.x, c.y + 0.06, c.z, col, 2.6);
    splatFloor(c.x, c.y, c.z, 1.4, c.team, 0.9, true);
    const v = sndVol(c.g.position); if (v > 0.03) Sfx.crack(v, sndPan(c.g.position));
  },
  update(dt) {
    for (const c of this.list.slice()) {
      if (c.fly) {                                   // flying: tumbles along its arc, then lands
        const F = c.fly; F.t += dt; const k = Math.min(1, F.t / F.T);
        c.g.position.set(F.p0.x + F.v0.x * F.t, F.p0.y + F.v0.y * F.t - 11 * F.t * F.t, F.p0.z + F.v0.z * F.t);
        c.g.position.x = lerp(c.g.position.x, c.x, k * k); c.g.position.z = lerp(c.g.position.z, c.z, k * k); c.g.position.y = Math.max(c.g.position.y, lerp(c.g.position.y, c.y, k * k));
        c.g.rotation.x = -(1 - k) * Math.PI * 2; if (F.t >= F.T) { Fx.burst(c.x, c.y + 0.1, c.z, TEAM_HEX[c.team], 12, 4, 0.1); this.land(c); }
        continue;
      }
      c.t -= dt; if (c.t <= 0) { this.breakIt(c); continue; }
      c.grow = Math.min(1, c.grow + dt / 0.32); const k = c.grow, ob = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
      c.g.scale.set(1 + 0.12 * Math.sin(Math.PI * k) * (1 - k), Math.max(0.02, ob), 1);
      c.flash = Math.max(0, c.flash - dt * 6); c.wob = Math.max(0, c.wob - dt * 3);
      c.face.emissive.setScalar(c.flash * 0.35); const hk = 0.55 + 0.45 * clamp(c.hp / SUBS.cover.hp, 0, 1); c.face.color.setRGB(hk, hk, hk);
      c.g.rotation.z = Math.sin(G.time * 45) * 0.035 * c.wob;
      c.g.visible = c.t > 1.2 || Math.sin(c.t * 26) > -0.4;                   // blinks before it runs out
    }
  },
  // aim preview while holding E: a see-through board where it will stand
  ghost(owner, dir, ok) {
    if (!owner) { if (this.gh) this.gh.visible = false; return; }
    if (!this.gh) { this.ghM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, fog: false }); this.gh = new THREE.Mesh(new THREE.BoxGeometry(this.W, this.H, this.T), this.ghM); scene.add(this.gh); }
    const f = new THREE.Vector3(dir.x, 0, dir.z); if (f.lengthSq() < 1e-4) f.set(Math.sin(owner.aimYaw), 0, Math.cos(owner.aimYaw)); f.normalize();
    const sp = this.target(owner, f); this.gh.visible = true; this.gh.position.set(sp.x, sp.y + this.H / 2 + 0.1, sp.z); this.gh.rotation.y = Math.atan2(f.x, f.z);
    this.ghM.color.set(ok ? TEAM_HEX[owner.team] : '#9aa0aa'); this.ghM.opacity = 0.22 + Math.sin(G.time * 8) * 0.06;
  },
  clear() { this.list.slice().forEach(c => this.breakIt(c, true)); if (this.gh) this.gh.visible = false; }
};
