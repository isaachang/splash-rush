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
  beam(a, b, col, w) {
    let m = this.beams.find(m => !m.visible);
    if (!m) { if (this.beams.length > 12) m = this.beams[0]; else { m = new THREE.Mesh(GEO.beam, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false })); scene.add(m); this.beams.push(m); } }
    m.visible = true; m.material.color.set(col); m.position.copy(a); m.lookAt(b); m.userData = { t: 0, w, len: a.distanceTo(b) };
    m.scale.set(w, w, m.userData.len);
    let c = this.beams.find(x => x !== m && !x.visible);
    if (!c) { c = new THREE.Mesh(GEO.beam, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: false })); scene.add(c); this.beams.push(c); }
    c.visible = true; c.position.copy(a); c.lookAt(b); c.userData = { t: 0, w: w * 0.4, len: m.userData.len }; c.scale.set(w * 0.4, w * 0.4, c.userData.len);
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
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / 0.22;
      if (k >= 1) { m.visible = false; continue; }
      const w = u.w * (1 - k * 0.7); m.scale.set(w, w, u.len); m.material.opacity = 1 - k;
    }
    for (const m of this.rings) {
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / 0.45;
      if (k >= 1) { m.visible = false; continue; }
      const s = u.r * (0.3 + 0.7 * (1 - Math.pow(1 - k, 3))); m.scale.set(s, s, s); m.material.opacity = (1 - k) * 0.9;
    }
  },
  clear() { this.parts.length = 0; this.rings.forEach(r => r.visible = false); this.beams.forEach(b => b.visible = false); }
};

/* ======================================================== PROJECTILES */
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
  shot(owner, o, dir) {
    if (this.shots.length > this.N - 10) this.shots.shift();
    const W = owner.weapon;
    this.shots.push({ owner, team: owner.team, W, p: o.clone(), rp: o.clone(), v: dir.multiplyScalar(W.speed), t: 0, dist: 0, nextDrop: rand(0.7, 1.1), kind: 'shot', r: rand(W.splat[0], W.splat[1]), wob: rand(0, 6.28) });
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
      for (const e of CHARS) if (e.team !== owner.team && !e.submerged && this.hitChar(e, b.p, 0.14)) return { end: b.p.clone(), char: e, t: b.t };
      if (solidAt(b.p.x, b.p.y, b.p.z) || b.p.y < -3) return { end: b.p.clone(), t: b.t };
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
    if (prev.y >= tPrev - 0.08) return { type: s.bound ? 'none' : 'floor', y: topAt(s, p.x, p.z), n: new THREE.Vector3(0, 1, 0) };
    if (s.t !== 'box' || !s.faces) return { type: 'none', y: p.y, n: new THREE.Vector3(0, 1, 0) };
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
    if (kind === 'floor' && inside) {
      const hz = Math.hypot(dir.x, dir.z) || 1, graze = clamp(1 - Math.abs(dir.y), 0, 1);
      owner.addPaint(splatFloor(p.x, p.y, p.z, r * 0.62, team, 0.7, true, { ux: dir.x / hz, uz: dir.z / hz, k: 1 + graze * 0.9 }));
    } else if (kind === 'wall' && face) {
      const along = face.ax ? p.z : p.x; splatWall(face, along - face.a0, clamp(p.y, 0, face.h), r * 0.7, team);
    }
    const dn = dir.x * n.x + dir.y * n.y + dir.z * n.z;
    const rx = dir.x - 2 * dn * n.x, ry = dir.y - 2 * dn * n.y, rz = dir.z - 2 * dn * n.z;
    const N = Math.round(4 + r * 4.5), o = new THREE.Vector3(p.x + n.x * 0.15, p.y + n.y * 0.15 + 0.05, p.z + n.z * 0.15), v = new THREE.Vector3();
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
  bombVel(owner, dir) { const v = dir.clone().multiplyScalar(13); v.y += 5.5; v.x += owner.vel.x * 0.5; v.z += owner.vel.z * 0.5; return v; },
  // throw-arc preview (player holds the sub button)
  preview(owner, dir, ok) {
    if (!this.pv) {
      this.pvMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
      this.pvDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), this.pvMat, 40); this.pvDots.frustumCulled = false; scene.add(this.pvDots);
      this.pvRing = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.4, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      this.pvRing.rotation.x = -Math.PI / 2; scene.add(this.pvRing); this.pv = true;
    }
    if (!owner) { this.pvDots.count = 0; this.pvRing.visible = false; return; }
    const col = ok ? TEAM_HEX[owner.team] : '#9aa0aa';
    this.pvMat.color.set(col); this.pvRing.material.color.set(col);
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
    if (c.swim) { y0 = y1 = c.pos.y + 0.25; r = 0.45; } else { y0 = c.pos.y + 0.35; y1 = c.pos.y + 1.35; r = 0.42; }
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
      this.fx(hx, y + 0.05, hz, team, r, 0, 1, 0); return true;
    }
    if (s.t === 'box' && s.faces) {
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
    Fx.burstDir(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, col, 9, 3.4, 0.075, nx, ny, nz, 0.9);
    Fx.burstDir(x, y, z, col, 3, 1.4, 0.14, nx, ny, nz, 0.5);
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
          for (const c of CHARS) { if (c.team !== b.team && this.hitChar(c, b.p, 0.14)) {
            const dmg = this.shotDamage(b), vn = b.v.clone().normalize();
            if (c.damage(dmg, b.owner)) c.onHit(vn, dmg);
            Fx.burstDir(b.p.x, b.p.y, b.p.z, TEAM_HEX[b.team], 12, 4, 0.085, -vn.x + rand(-0.3, 0.3), 0.4, -vn.z + rand(-0.3, 0.3), 0.9);
            Fx.burstDir(b.p.x, b.p.y, b.p.z, TEAM_HEX[b.team], 4, 2, 0.15, vn.x, 0.2, vn.z, 0.6);
            dead = true; break; } }
          if (dead) break;
        }
        if (inBarrier(1 - b.team, b.p)) { Fx.burst(b.p.x, b.p.y, b.p.z, TEAM_HEX[b.team], 3, 1.5, 0.05); Barrier.flash(1 - b.team); dead = true; break; }
        const s = solidAt(b.p.x, b.p.y, b.p.z);
        if (s) {
          if (b.big) { const h = this.classify(s, prev, b.p); if (h.type !== 'none') this.splash(b.owner, h.type === 'wall' ? h.pt : new THREE.Vector3(b.p.x, h.y, b.p.z), h.n, b.v.clone().normalize(), b.r, h.type, h.face); if (sndVol(b.p) > 0.1) Sfx.splat(sndVol(b.p)); }
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
      if (b.fuse < 0) {
        const prev = b.p.clone(); b.v.y -= 22 * dt; b.p.addScaledVector(b.v, dt);
        if (inBarrier(1 - b.team, b.p)) { b.p.copy(prev); b.v.x *= -0.35; b.v.z *= -0.35; Barrier.flash(1 - b.team); }
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
        const sp = b.v.length(), s = 0.19 * (1 + Math.sin(G.time * 40 + b.wob) * 0.06), len = s * (1.3 + Math.min(sp * 0.012, 1.7));
        const from = b.rq || b.p;
        for (let k = 0; k < 3; k++) {
          const u = 1 - k / 3, sk = s * (1 - k * 0.18);
          _dm.position.lerpVectors(from, b.p, u); _dm.scale.set(sk, sk, len * (1 - k * 0.15));
          _dm.lookAt(_dm.position.x + b.v.x, _dm.position.y + b.v.y, _dm.position.z + b.v.z); _dm.updateMatrix();
          this.mesh.setMatrixAt(n, _dm.matrix); this.mesh.setColorAt(n, _col); n++;
        }
        b.rp.copy(b.p);
      } else {
        const s = b.sz || 0.07; _dm.position.copy(b.p); _dm.scale.set(s, s, s * 1.4);
        _dm.lookAt(b.p.x + b.v.x, b.p.y + b.v.y, b.p.z + b.v.z); _dm.updateMatrix();
        this.mesh.setMatrixAt(n, _dm.matrix); this.mesh.setColorAt(n, _col); n++;
      }
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  },
  explode(b) {
    const p = b.p, g = groundBelow(p.x, p.z, p.y + 0.1, 0.4);
    const gained = splatFloor(p.x, g, p.z, 3.4, b.team, 1.6); b.owner.addPaint(gained);
    Fx.burst(p.x, g + 0.3, p.z, TEAM_HEX[b.team], 50, 10, 0.2); Fx.ring(p.x, g + 0.06, p.z, TEAM_HEX[b.team], 4.5);
    const v = sndVol(p); Sfx.boom(v); if (v > 0.3) G.shake(v * 0.7);
    for (const c of CHARS) { if (c.team === b.team || !c.alive) continue; const d = c.chest().distanceTo(p); if (d < 3.6) c.damage(d < 1.4 ? 180 : lerp(80, 30, (d - 1.4) / 2.2), b.owner, 'bomb'); }
  },
  clear() { this.shots.length = 0; this.pending.length = 0; this.bombs.forEach(b => scene.remove(b.g)); this.bombs.length = 0; }
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
