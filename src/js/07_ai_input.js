/* ============================================================ NAV GRID */
const NAV = { W: XH * 2, H: ZH * 2, h: null, cost: null };
function initNav() {
  const W = NAV.W, H = NAV.H; NAV.h = new Float32Array(W * H); NAV.cost = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = -XH + i + 0.5, z = -ZH + j + 0.5, h = groundAt(x, z); NAV.h[j * W + i] = h;
    let near = 0;
    for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * Math.PI / 4) * 0.75, pz = z + Math.sin(a * Math.PI / 4) * 0.75; if (Math.abs(px) > XH - 0.3 || Math.abs(pz) > ZH - 0.3) { near = 1; continue; } if (groundAt(px, pz) > h + STEP) near = 1; }
    NAV.cost[j * W + i] = near ? 3.5 : 1;
  }
}
const navIdx = (x, z) => { const i = clamp(Math.floor(x + XH), 0, NAV.W - 1), j = clamp(Math.floor(z + ZH), 0, NAV.H - 1); return j * NAV.W + i; };
const navPos = k => new THREE.Vector3(-XH + (k % NAV.W) + 0.5, NAV.h[k], -ZH + Math.floor(k / NAV.W) + 0.5);
function navPass(a, b) { return NAV.h[b] - NAV.h[a] <= 0.62; }
function astar(s, goal) {
  const W = NAV.W, N = W * NAV.H, g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const gx = goal % W, gz = Math.floor(goal / W), hf = k => Math.hypot((k % W) - gx, Math.floor(k / W) - gz);
  g[s] = 0; push(hf(s), s); let iter = 0;
  while (heap.length && iter++ < 6000) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === goal) break;
    const x = k % W, z = Math.floor(k / W);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= NAV.H) continue;
      const n = nz * W + nx; if (closed[n] || !navPass(k, n)) continue;
      if (dx && dz && (!navPass(k, z * W + nx) || !navPass(k, nz * W + x))) continue;
      const ng = g[k] + (dx && dz ? 1.414 : 1) * NAV.cost[n];
      if (ng < g[n]) { g[n] = ng; came[n] = k; push(ng + hf(n), n); }
    }
  }
  if (came[goal] < 0 && goal !== s) return null;
  const path = []; let k = goal; while (k !== s && k >= 0) { path.push(k); k = came[k]; } path.reverse();
  // smoothing: keep every waypoint where direction changes
  const pts = path.map(navPos), out = [];
  for (let i = 0; i < pts.length; i++) { if (i === pts.length - 1 || i % 3 === 2) out.push(pts[i]); }
  return out;
}

/* ---- shooter ballistics helpers for bots (tabulated from the real bullet physics) */
const BALL = { comp: [], time: [] };
function initBallistics() {
  const W = WEAPONS.rifle, h = 1 / 240;
  const sim = (pitch, hd) => { // returns height at horizontal distance hd (or null if it never gets there) and time
    const b = { W, p: new THREE.Vector3(), v: new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(W.speed), t: 0 };
    while (b.t < 1.5) { Proj.stepShot(b, h); if (b.p.z >= hd) return [b.p.y, b.t]; if (b.p.y < -3) return null; }
    return null;
  };
  for (let i = 0; i <= 40; i++) {
    const hd = i * 0.5; let lo = -0.2, hi = 0.6, best = 0.6, t = 0.5;
    let found = false;
    for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2, r = sim(mid, hd); if (r && r[0] >= 0) { best = mid; hi = mid; t = r[1]; found = true; } else lo = mid; }
    const pc = BALL.comp.length ? BALL.comp[BALL.comp.length - 1] : 0, pt = BALL.time.length ? BALL.time[BALL.time.length - 1] : 0;
    BALL.comp.push(found ? Math.max(0, best) : pc); BALL.time.push(found ? t : pt);
  }
}
const tabLook = (arr, hd) => { const f = clamp(hd * 2, 0, arr.length - 1), i = Math.floor(f), j = Math.min(arr.length - 1, i + 1); return lerp(arr[i], arr[j], f - i); };
const dropComp = hd => tabLook(BALL.comp, hd);
const shotTime = d => tabLook(BALL.time, d);

/* ================================================================= BOT */
class Bot {
  constructor(c, role) {
    this.c = c; this.role = role; this.path = []; this.target = null; this.retarget = 0; this.enemy = null; this.scanT = rand(0, 0.2);
    this.reactT = 0; this.strafe = 1; this.strafeT = 0; this.err = new THREE.Vector3(); this.errT = 0; this.stuckT = 0; this.lastPos = new THREE.Vector3();
    this.mode = 'paint'; this.sweep = rand(0, 6); this.linger = 0; this.swimT = 0; this.jitter = rand(0.8, 1.2);
  }
  findEnemy() {
    const c = this.c, e0 = c.eye(); let best = null, bd = 1e9;
    for (const e of CHARS) {
      if (e.team === c.team || !e.alive || e.state !== 'play' || e.inOwnBarrier()) continue;
      const d = e.pos.distanceTo(c.pos); if (d > (c.weapon.type === 'charge' ? 30 : 18) || d > bd) continue;
      if (e.submerged && d > 3.5 && !(G.time - e.lastShot < 0.4)) continue;
      const ch = e.chest(); if (segBlocked(e0.x, e0.y, e0.z, ch.x, ch.y, ch.z, 0.5)) continue;
      best = e; bd = d;
    }
    return best;
  }
  chooseTarget() {
    const c = this.c, W = NAV.W; let best = -1, bs = -1e9;
    const enemyDeck = DECK[1 - c.team];
    for (let n = 0; n < 34; n++) {
      const k = randi(0, NAV.W * NAV.H - 1), p = navPos(k);
      if (inRect(enemyDeck, p.x, p.z)) continue;
      let s = 0; const own = ownerAt(p.x, p.y, p.z);
      s += own === c.team ? -3 : own === -1 ? 2 : 3;
      for (let a = 0; a < 5; a++) { const o = ownerAt(p.x + Math.cos(a * 1.26) * 2, p.y, p.z + Math.sin(a * 1.26) * 2); if (o !== c.team && o !== -2) s += 0.6; }
      const zRel = (c.team === 0 ? -p.z : p.z) / ZH;
      s += this.role === 'front' ? zRel * 3 : this.role === 'mid' ? 1 - Math.abs(zRel) * 2.2 : -zRel * 2.2;
      s -= p.distanceTo(c.pos) * 0.04; s += rand(0, 1.6);
      if (c.weapon.type === 'charge') s += NAV.h[k] * 0.9 - (this.role === 'front' ? zRel * 1.5 : 0);
      if (s > bs) { bs = s; best = k; }
    }
    if (best < 0) return;
    const path = astar(navIdx(c.pos.x, c.pos.z), best);
    if (path && path.length) { this.path = path; this.target = navPos(best); this.retarget = rand(7, 12); this.linger = 0; }
    else this.retarget = 0.5;
  }
  findRefill() {
    const c = this.c; let best = null, bd = 1e9;
    const ci = Math.floor(c.pos.x + XH), cj = Math.floor(c.pos.z + ZH);
    for (let j = cj - 12; j <= cj + 12; j++) for (let i = ci - 12; i <= ci + 12; i++) {
      if (i < 0 || j < 0 || i >= NAV.W || j >= NAV.H) continue; const k = j * NAV.W + i, p = navPos(k);
      if (ownerAt(p.x, p.y, p.z) !== c.team) continue; const d = p.distanceTo(c.pos); if (d < bd) { bd = d; best = k; }
    }
    if (best === null) return false;
    const path = astar(navIdx(c.pos.x, c.pos.z), best); if (!path) return false;
    this.path = path.length ? path : [navPos(best)]; return true;
  }
  // hold/release trigger: auto weapons just hold; chargers hold until the goal charge then release
  pull(I, goal = 1) {
    const c = this.c;
    if (c.weapon.type !== 'charge') { I.fire = true; return; }
    if (!c.charging) { I.fire = true; this.goal = goal; this.holdT = 0; return; }
    this.holdT += 1 / 60;
    I.fire = c.charge < Math.min(this.goal, 0.999) && this.holdT < 3;
  }
  chargerFight(dt, e, d, D) {
    const c = this.c, I = c.intent;
    this.errT -= dt; if (this.errT <= 0) { this.errT = rand(0.3, 0.6); const m = D.err * d * 0.75; this.err.set(rand(-m, m), rand(-m, m) * 0.5, rand(-m, m)); }
    const tp = e.chest().addScaledVector(e.vel, 0.08).add(this.err);
    const m = c.muzzle(); const dx = tp.x - m.x, dy = tp.y - m.y, dz = tp.z - m.z, hd = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz), wantPitch = Math.atan2(dy, hd);
    const yawErr = angDiff(c.aimYaw, wantYaw);
    c.aimYaw += clamp(yawErr, -D.turn * 0.8 * dt, D.turn * 0.8 * dt); c.aimPitch = damp(c.aimPitch, wantPitch, 9, dt);
    const close = d < 7;
    const fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw), rx = -fz, rz = fx;
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rand(0.8, 2); }
    const adv = close ? -0.85 : d > 24 ? 0.5 : 0, sw = close ? 0.5 : 0.25;
    I.mx = rx * this.strafe * sw + fx * adv; I.mz = rz * this.strafe * sw + fz * adv;
    this.reactT -= dt;
    const tol = 0.4 / Math.max(d, 1) + 0.02;
    if (this.reactT <= 0 && Math.abs(yawErr) < 0.5) {
      if (!c.charging) { I.fire = true; this.goal = close ? 0.3 : d > 20 ? 1 : 0.8 + Math.random() * 0.2; this.holdT = 0; }
      else { this.holdT += dt; I.fire = (c.charge < Math.min(this.goal, 0.999) || Math.abs(yawErr) > tol) && this.holdT < 2.6; }
    } else if (c.charging) I.fire = true;
    if (close && c.ink > 75 && Math.random() < dt * 0.5) { I.bomb = true; I.fire = false; }
    if (c.special >= 100 && d < 7 && Math.random() < dt * 2) I.special = true; else I.special = false;
    if (close && c.hp < 50 && ownerAt(c.pos.x, c.pos.y, c.pos.z) === c.team && Math.random() < D.dodge * dt * 3) this.swimT = 0.6;
    if (this.swimT > 0) { this.swimT -= dt; I.swim = true; I.fire = false; I.mx = -fx; I.mz = -fz; }
  }
  followPath(I, speed = 1) {
    const c = this.c;
    while (this.path.length && Math.hypot(this.path[0].x - c.pos.x, this.path[0].z - c.pos.z) < 0.9) this.path.shift();
    if (!this.path.length) { I.mx = I.mz = 0; return false; }
    const w = this.path[0], dx = w.x - c.pos.x, dz = w.z - c.pos.z, d = Math.hypot(dx, dz);
    I.mx = dx / d * speed; I.mz = dz / d * speed;
    if (w.y > c.pos.y + 0.7 && c.grounded && d < 2) I.jump = true;
    return true;
  }
  update(dt) {
    const c = this.c, I = c.intent, D = DIFF[GAME.diff], T = G.time;
    if (!c.alive || c.state !== 'play') { I.fire = I.swim = false; I.mx = I.mz = 0; this.path = []; this.enemy = null; return; }
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.2; const e = this.findEnemy();
      if (e && e !== this.enemy) this.reactT = D.react * rand(0.7, 1.3) + (c.weapon.type === 'charge' ? 0.15 : 0);
      this.enemy = e;
    }
    if (c.ink < (c.weapon.type === 'charge' ? 20 : 10) && this.mode !== 'refill') { this.mode = 'refill'; this.path = []; if (!this.findRefill()) this.path = []; }
    if (this.mode === 'refill' && c.ink > 88) { this.mode = 'paint'; this.path = []; }
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1.4) { if (this.lastPos.distanceTo(c.pos) < 0.6 && (this.path.length || this.mode !== 'paint')) { I.jump = true; this.path = []; this.retarget = 0; } this.lastPos.copy(c.pos); this.stuckT = 0; }
    I.fire = false; I.swim = false; I.aimDir = null;
    const e = this.enemy;
    const chg = c.weapon.type === 'charge';
    if (e && e.alive && (this.mode !== 'refill' || e.pos.distanceTo(c.pos) < 7 || (chg && c.ink > 22)) && c.ink > 3) {
      // -------- fight
      const d = e.pos.distanceTo(c.pos);
      if (c.weapon.type === 'charge') { this.chargerFight(dt, e, d, D); this.path = []; return; }
      this.errT -= dt; if (this.errT <= 0) { this.errT = rand(0.25, 0.5); const m = D.err * d; this.err.set(rand(-m, m), rand(-m, m) * 0.6, rand(-m, m)); }
      const tt = shotTime(d); const tp = e.chest().addScaledVector(e.vel, tt * 0.9).add(this.err);
      const m = c.muzzle(); const dx = tp.x - m.x, dy = tp.y - m.y, dz = tp.z - m.z, hd = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz), wantPitch = Math.atan2(dy, hd) + dropComp(hd);
      const dy_ = angDiff(c.aimYaw, wantYaw);
      c.aimYaw += clamp(dy_, -D.turn * dt, D.turn * dt); c.aimPitch = damp(c.aimPitch, wantPitch, 10, dt);
      this.reactT -= dt;
      if (this.reactT <= 0 && Math.abs(dy_) < 0.25 && d < c.weapon.range + 1.5 && Math.random() < D.fireHold + 0.1) I.fire = true;
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rand(0.4, 1.3); }
      const fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw), rx = -fz, rz = fx;
      const adv = d > 10 ? 0.9 : d < 4.5 ? -0.6 : 0.15;
      I.mx = rx * this.strafe * 0.75 + fx * adv; I.mz = rz * this.strafe * 0.75 + fz * adv;
      const l = Math.hypot(I.mx, I.mz); if (l > 1) { I.mx /= l; I.mz /= l; }
      if (Math.random() < dt * 0.7 * D.dodge && c.grounded) I.jump = true;
      if (c.hp < 45 && ownerAt(c.pos.x, c.pos.y, c.pos.z) === c.team && Math.random() < D.dodge) { this.swimT = 0.5; }
      if (this.swimT > 0) { this.swimT -= dt; I.swim = true; I.fire = false; }
      if (d > 5 && d < 12 && c.ink > 75 && Math.random() < dt * 0.35) { I.bomb = true; c.aimPitch += 0.28; }
      if (c.special >= 100 && d < 7 && Math.random() < dt * 2) I.special = true; else I.special = false;
      this.path = [];
      return;
    }
    I.special = false;
    if (this.mode === 'refill') {
      const on = ownerAt(c.pos.x, c.pos.y, c.pos.z) === c.team;
      if (!this.path.length && !on) { if (!this.findRefill()) { // paint own puddle
        if (c.ink > 4) { this.pull(I, 0.3); c.aimPitch = damp(c.aimPitch, -0.9, 8, dt); } I.mx = I.mz = 0; return; } }
      if (on && !this.path.length) { I.swim = true; I.mx = Math.sin(T * 0.8 + this.sweep) * 0.3; I.mz = Math.cos(T * 0.8 + this.sweep) * 0.3; return; }
      this.followPath(I); I.swim = on; return;
    }
    // -------- paint / roam
    this.retarget -= dt;
    if (!this.path.length) {
      if (this.target && this.linger < 1.6 && this.target.distanceTo(c.pos) < 2.5) { this.linger += dt; }
      else if (this.retarget <= 0 || !this.target || this.linger >= 1.6) this.chooseTarget();
    }
    const moving = this.followPath(I);
    const baseYaw = moving ? Math.atan2(I.mx, I.mz) : c.aimYaw + dt * 2.5;
    const wantYaw = baseYaw + Math.sin(T * 2.3 * this.jitter + this.sweep) * 0.6;
    c.aimYaw += angDiff(c.aimYaw, wantYaw) * Math.min(1, dt * (chg ? 3 : 6)); c.aimPitch = damp(c.aimPitch, (chg ? -0.12 : -0.3) + Math.sin(T * 1.4 + this.sweep) * (chg ? 0.05 : 0.12), 5, dt);
    const ax = c.pos.x + Math.sin(c.aimYaw) * 4, az = c.pos.z + Math.cos(c.aimYaw) * 4;
    const ah = ownerAt(ax, groundAt(ax, az), az);
    const under = ownerAt(c.pos.x, c.pos.y, c.pos.z);
    const nextOwn = this.path.length ? ownerAt(this.path[0].x, this.path[0].y, this.path[0].z) === c.team : false;
    if (!c.charging && under === c.team && nextOwn && c.ink > 30 && Math.random() < 0.9 && ah === c.team) { I.swim = true; }
    else if (c.charging) this.pull(I);
    else if (chg ? c.ink > 38 && (ah !== c.team || Math.random() < 0.15) : c.ink > 6 && (ah !== c.team || Math.random() < 0.3)) this.pull(I, chg ? rand(0.3, 0.7) : 1);
    if (c.special >= 100 && ((this.target && this.linger > 0.5) || (ah === 1 - c.team && Math.random() < dt * 0.6))) I.special = true;
    if (c.ink > 90 && Math.random() < dt * 0.08) { I.bomb = true; c.aimPitch = 0.25; }
  }
}

/* =============================================================== INPUT */
const Input = { keys: {}, fire: false, dx: 0, dy: 0, locked: false, jumpQ: false, bombQ: false, spQ: false, bombHoldKey: false, bombHoldMouse: false, bombWasHeld: false };
function initInput() {
  addEventListener('keydown', e => {
    if (e.repeat) { if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); return; }
    Input.keys[e.code] = true;
    if (e.code === 'Space') { Input.jumpQ = true; e.preventDefault(); }
    if (e.code === 'KeyE') Input.bombHoldKey = true;
    if (e.code === 'KeyQ') Input.spQ = true;
    if (e.code === 'KeyM') $('minimap').classList.toggle('big');
    if (e.code === 'Tab') e.preventDefault();
  });
  addEventListener('keyup', e => { Input.keys[e.code] = false; if (e.code === 'KeyE') Input.bombHoldKey = false; });
  addEventListener('blur', () => { Input.keys = {}; Input.fire = false; Input.bombHoldKey = Input.bombHoldMouse = false; });
  const cv = $('gl');
  addEventListener('mousedown', e => {
    if ((G.state === 'play' || G.state === 'intro') && !G.paused) {
      if (!Input.locked && !G.paused) { lockPointer(); return; }
      if (e.button === 0) Input.fire = true; if (e.button === 2) Input.bombHoldMouse = true;
    }
  });
  addEventListener('mouseup', e => { if (e.button === 0) Input.fire = false; if (e.button === 2) Input.bombHoldMouse = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => { if (Input.locked) { Input.dx += e.movementX || 0; Input.dy += e.movementY || 0; } });
  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement === cv;
    if (!Input.locked) { Input.fire = false; if (G.state === 'play' || G.state === 'intro') pauseGame(); }
  });
}
function lockPointer() { const cv = $('gl'); try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }

/* ============================================================= PLAYER */
const Cam = { bombAim: false, zoom: 1, land: new THREE.Vector3(), lock: false, landDist: 0, showLand: false, onEnemy: false, yaw: Math.PI, pitch: -0.05, pos: new THREE.Vector3(), pivotY: 0, dist: 4.4, aim: new THREE.Vector3(), onEnemy: false };
function playerControl(dt) {
  const c = PLAYER, I = c.intent, k = Input.keys;
  const s = 0.0022 * SETTINGS.sens * Cam.zoom;
  Cam.yaw -= Input.dx * s; Cam.pitch -= Input.dy * s * (SETTINGS.inv ? -1 : 1); Input.dx = Input.dy = 0;
  Cam.pitch = clamp(Cam.pitch, -1.15, 1.2);
  if (!c.alive || c.state !== 'play') { if (Proj.pv) Proj.preview(null); I.mx = I.mz = 0; I.fire = I.swim = false; Input.jumpQ = Input.bombQ = Input.spQ = false; Input.bombWasHeld = false; Cam.bombAim = false; Cam.showLand = false; Cam.lock = false; return; }
  const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  const fx = Math.sin(Cam.yaw), fz = Math.cos(Cam.yaw), rx = -fz, rz = fx;
  let mx = fx * f + rx * r, mz = fz * f + rz * r; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  I.mx = mx; I.mz = mz;
  I.swim = !!(k.ShiftLeft || k.ShiftRight);
  const held = Input.bombHoldKey || Input.bombHoldMouse;
  if (!held && Input.bombWasHeld && !c.swim) Input.bombQ = true;   // throw on release
  Input.bombWasHeld = held; Cam.bombAim = held && !c.swim && !c.sp;
  I.fire = Input.fire && !Cam.bombAim; I.jump = Input.jumpQ; I.bomb = Input.bombQ; I.special = Input.spQ;
  Input.jumpQ = Input.bombQ = Input.spQ = false;
  c.aimYaw = Cam.yaw; c.aimPitch = Cam.pitch;
  // aim ray from camera
  const o = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
  let hitP = null;
  const start = Math.max(0, Cam.pos.distanceTo(c.eye()) - 0.3);
  for (let t = start; t < 60; t += 0.3) {
    const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
    let hitE = false;
    if (t < 20) for (const e of CHARS) if (e.team !== c.team && !e.submerged && Proj.hitChar(e, { x: px, y: py, z: pz }, 0.05)) { hitE = true; break; }
    if (hitE) { hitP = new THREE.Vector3(px, py, pz); break; }
    if (solidAt(px, py, pz)) { hitP = new THREE.Vector3(px, py, pz); break; }
  }
  if (!hitP) hitP = new THREE.Vector3(o.x + d.x * 60, o.y + d.y * 60, o.z + d.z * 60);
  Cam.aim.copy(hitP);
  const mzl = c.muzzle();
  I.aimDir = hitP.clone().sub(mzl).normalize();
  // second reticle: where the ink will actually land; "lock" when an enemy would be hit
  const W = c.weapon;
  const R = c.rangeNow(), D = mzl.distanceTo(hitP);
  // small reticle sits ON the aim line: on the aimed surface if it is within range, otherwise at max range
  if (D <= R) Cam.land.copy(hitP); else Cam.land.copy(mzl).addScaledVector(I.aimDir, R);
  Cam.landDist = Math.min(D, R);
  const pr = W.type === 'charge' ? traceRay(c, mzl, I.aimDir, R, 0.3) : Proj.predict(c, mzl, I.aimDir);
  Cam.lock = !!pr.char;
  if (Cam.bombAim) Proj.preview(c, I.aimDir, c.ink >= SUBS[W.sub].cost); else if (Proj.pv) Proj.preview(null);
  Cam.showLand = !c.swim;
}
function updateCamera(dt) {
  const c = PLAYER;
  let px = c.pos.x, py = c.pos.y, pz = c.pos.z;
  if (c.state === 'dead') {
    const t = RESPAWN - c.respawnT;
    const k = c.lastAttacker && c.lastAttacker.alive && t < 2.6 ? c.lastAttacker : null;
    const g = c.ghost.position;
    const tgt = k ? k.chest() : new THREE.Vector3(g.x, g.y, g.z);
    const want = new THREE.Vector3(c.pos.x - Math.sin(Cam.yaw) * 6, c.pos.y + 5, c.pos.z - Math.cos(Cam.yaw) * 6);
    Cam.pos.lerp(want, 1 - Math.exp(-3 * dt)); camera.position.copy(Cam.pos); camera.lookAt(tgt);
    return;
  }
  const zt = c.charging ? 1 - 0.24 * c.charge : 1;
  Cam.zoom = damp(Cam.zoom, zt, 10, dt);
  const fv = SETTINGS.fov * Cam.zoom; if (Math.abs(camera.fov - fv) > 0.02) { camera.fov = fv; camera.updateProjectionMatrix(); }
  const targetY = py + (c.swim ? 1.0 : 1.5);
  Cam.pivotY = c.state === 'drop' ? targetY : damp(Cam.pivotY, targetY, 14, dt);
  const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
  const dir = new THREE.Vector3(Math.sin(Cam.yaw) * cp, sp, Math.cos(Cam.yaw) * cp);
  const right = new THREE.Vector3(-Math.cos(Cam.yaw), 0, Math.sin(Cam.yaw));
  const pivot = new THREE.Vector3(px, Cam.pivotY, pz);
  const dist = c.swim ? 5.0 : 4.6;
  const shoulder = right.clone().multiplyScalar(0);
  const want = pivot.clone().addScaledVector(dir, -dist).add(shoulder); want.y += 0.85;
  const pv = pivot.clone().add(shoulder.clone().multiplyScalar(0.5));
  const t = segBlocked(pv.x, pv.y, pv.z, want.x, want.y, want.z, 0.15);
  if (t) want.lerpVectors(pv, want, Math.max(0.1, t - 0.08));
  if (want.y < 0.3) want.y = 0.3;
  Cam.pos.copy(want);
  camera.position.copy(want);
  if (G.shakeAmt > 0) { camera.position.x += rand(-1, 1) * G.shakeAmt * 0.25; camera.position.y += rand(-1, 1) * G.shakeAmt * 0.25; G.shakeAmt = Math.max(0, G.shakeAmt - dt * 3); }
  camera.lookAt(pivot.x + dir.x * 30 + shoulder.x, pivot.y + dir.y * 30, pivot.z + dir.z * 30 + shoulder.z);
}
