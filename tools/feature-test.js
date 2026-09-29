#!/usr/bin/env node
/*  Headless smoke test — no browser, no npm install needed.
    Boots the game with a fake renderer/DOM, then auto-plays full matches
    with every weapon and checks that nothing throws.
    Usage:  node tools/smoke-test.js            (all weapons, 90 s matches)
            node tools/smoke-test.js charger    (one weapon)                 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const JS = ['01_core', '02_world', '03_env', '04_data', '05_character', '06_fx', '07_ai_input', '08_game'].map(n => read(`src/js/${n}.js`)).join('\n');

function makeSandbox() {
  const ctx2d = new Proxy({}, { get(t, k) { if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }); if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() { } }); if (k in t) return t[k]; return () => { }; }, set(t, k, v) { t[k] = v; return true; } });
  const el = id => { const e = { id, style: { setProperty() { }, getPropertyValue() { return ''; } }, children: [], dataset: {}, classList: { _s: new Set(), add(...a) { a.forEach(x => this._s.add(x)); }, remove(...a) { a.forEach(x => this._s.delete(x)); }, toggle(x, on) { if (on === undefined) on = !this._s.has(x); on ? this._s.add(x) : this._s.delete(x); }, contains(x) { return this._s.has(x); } },
    textContent: '', innerHTML: '', value: '', width: 150, height: 246, getContext: () => ctx2d, appendChild(c) { this.children.push(c); return c; }, prepend(c) { this.children.unshift(c); }, get lastChild() { const s = this; return { remove() { s.children.pop(); } }; },
    querySelector: () => el('q'), querySelectorAll: () => [], setAttribute() { }, remove() { }, requestPointerLock() { }, offsetWidth: 1, addEventListener() { } }; return e; };
  const els = {}, listeners = {};
  const document = { getElementById: id => els[id] || (els[id] = el(id)), createElement: t => el(t), createElementNS: () => el('svg'), querySelectorAll: () => [], addEventListener() { }, documentElement: el('html'), pointerLockElement: null, exitPointerLock() { } };
  const quiet = Object.assign({}, console, { warn() { } });
  const g = { document, console: quiet, Math, Date, performance, setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); } };
  g.window = g; g.globalThis = g; vm.createContext(g);
  vm.runInContext(read('vendor/three.min.js'), g, { filename: 'three.min.js' });
  vm.runInContext(`THREE.WebGLRenderer = class { constructor(){ this.shadowMap = {}; } setSize(){} setPixelRatio(){} render(){} compile(){} };
    THREE.PMREMGenerator = class { fromScene(){ return { texture: null }; } dispose(){} };`, g);
  vm.runInContext(JS, g, { filename: 'game.js' });
  listeners.load.forEach(f => f());
  return g;
}

const g = makeSandbox();
vm.runInContext(`(() => {
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 10; i++) loop();
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) globalThis.__fails = (globalThis.__fails || 0) + 1; };
  // ---------- charger: store charge while swimming
  Profile.data.weapon = 'charger'; openLobby(); startMatch(); Input.locked = true;
  const bf = CHARS.filter(c => c.team === 1).every(c => Math.cos(c.aimYaw) > 0.9) && CHARS.filter(c => c.team === 0).every(c => Math.cos(c.aimYaw) < -0.9);   // checked at spawn, before bots start turning
  while (G.state !== 'play') loop();
  { const v = new THREE.Vector3(); loop(); camera.getWorldDirection(v);
    ok(v.z < -0.9 && Math.abs(Cam.yaw - Math.PI) < 0.05 && bf, 'match starts facing the battlefield (camera dir z=' + v.z.toFixed(2) + ', enemies face us too)'); }
  const P = PLAYER; G.bots.forEach(b => b.update = () => {});   // freeze bots
  CHARS.forEach(c => { if (c !== P) { c.pos.set(0, 0, -30 - c.id); c.intent.mx = c.intent.mz = 0; c.intent.fire = false; } });
  P.pos.set(0, 0, 20); P.vel.set(0, 0, 0); P.ink = 100;
  let fired = []; const of = P.fireCharger.bind(P); P.fireCharger = (c, I) => { fired.push(+c.toFixed(2)); of(c, I); };
  Input.fire = true; for (let i = 0; i < 35; i++) loop();
  ok(P.charge >= 1 && P.charging, 'charger reaches full charge');
  Input.keys.ShiftLeft = true; for (let i = 0; i < 15; i++) loop();
  ok(P.stored > 0 && !P.charging && fired.length === 0, 'full charge stored while swimming (stored=' + P.stored.toFixed(2) + ')');
  Input.keys.ShiftLeft = false; loop(); loop();
  ok(P.charging && P.charge >= 1, 'surfacing resumes the full charge');
  Input.fire = false; loop(); loop();
  ok(fired.length === 1 && fired[0] >= 1, 'release fires a full-charge shot ' + JSON.stringify(fired));
  for (let i = 0; i < 20; i++) loop(); P.ink = 100;
  Input.fire = true; for (let i = 0; i < 35; i++) loop(); Input.keys.ShiftLeft = true; for (let i = 0; i < 50; i++) loop();
  ok(P.stored === 0 && P.charge === 0, 'stored charge expires after ~1.25s underwater');
  Input.keys.ShiftLeft = false; Input.fire = false; for (let i = 0; i < 5; i++) loop();
  // ---------- tap fire (no minimum)
  P.ink = 100; fired = []; Input.fire = true; loop(); loop(); Input.fire = false; loop(); loop();
  ok(fired.length === 1 && fired[0] < 0.2, 'quick tap fires a weak shot ' + JSON.stringify(fired));
  // ---------- reticle on aim line, capped at range
  for (let i = 0; i < 10; i++) loop();
  Cam.pitch = 0.6; for (let i = 0; i < 3; i++) loop();
  const d = P.muzzle().distanceTo(Cam.land);
  ok(Math.abs(d - P.rangeNow()) < 0.6, 'aiming at the sky: small reticle sits at max range (' + d.toFixed(1) + 'm / ' + P.rangeNow().toFixed(1) + 'm)');
  Cam.pitch = -0.1;
  // ---------- bomb: hold to preview, release to throw
  P.ink = 100; Input.bombHoldKey = true; for (let i = 0; i < 5; i++) loop();
  ok(Cam.bombAim && Proj.pvDots && Proj.pvDots.count > 3 && Proj.bombs.length === 0, 'holding E shows the arc preview (' + (Proj.pvDots && Proj.pvDots.count) + ' dots), nothing thrown yet');
  Input.bombHoldKey = false; loop(); loop();
  ok(Proj.bombs.length === 1 && Proj.pvDots.count === 0, 'releasing E throws the bomb and hides the preview');
  for (let i = 0; i < 60; i++) loop();
  // ---------- spawn barrier
  const E = CHARS.find(c => c.team === 1 && c.alive && c.weapon.id === 'rifle');
  E.pos.set(SPAWN[0].x + 1, SPAWN[0].y, SPAWN[0].z); E.vel.set(0, 0, 0); E.state = 'play'; loop();
  const de = Math.hypot(E.pos.x - SPAWN[0].x, E.pos.z - SPAWN[0].z);
  ok(de >= BARRIER_R, 'enemy is pushed out of the spawn barrier (' + de.toFixed(1) + 'm)');
  P.pos.set(SPAWN[0].x, SPAWN[0].y, SPAWN[0].z); P.hp = 100; loop();
  ok(P.inOwnBarrier() && P.damage(50, E, 'rifle') === false && P.hp === 100, 'player inside own barrier takes no damage');
  const before = Proj.shots.length; Proj.shot(E, new THREE.Vector3(SPAWN[0].x, 2.9, SPAWN[0].z - 9), new THREE.Vector3(0, 0, 1)); for (let i = 0; i < 12; i++) loop();
  ok(P.hp === 100, 'enemy bullets fired into the barrier are blocked');
  // ---------- screen ink feedback
  P.pos.set(0, 0, 10); P.hp = 100; P.invulnT = 0; loop(); ScreenInk.clear();
  const foe = CHARS.find(c => c.team === 1 && c.weapon.id === 'rifle'); foe.pos.set(P.pos.x - 6, 0, P.pos.z); // on the player's right side (yaw 0 -> right = -x)
  Cam.yaw = 0; P.damage(36, foe, 'rifle'); loop();
  const sp0 = ScreenInk.splats[0];
  ok(ScreenInk.splats.length >= 1 && sp0.x > ScreenInk.canvas.width * 0.8, 'hit from the right puts ink on the right edge (x=' + (sp0 ? Math.round(sp0.x) : '-') + ')');
  P.hp = 100; P.lastHurt = -99; loop();
  ok(ScreenInk.splats.length === 0, 'ink clears once health is full again');

  P.pos.set(0, 0, 10); loop(); P.special = 80; P.invulnT = 0; P.hp = 1; P.damage(100, E, 'rifle');
  ok(!P.alive && P.special === 40, 'death halves the special gauge (80 -> ' + P.special + ')');
  // ================= v0.5.0 =================
  for (let i = 0; i < 300 && !(P.alive && P.state === 'play'); i++) loop();
  const rif = CHARS.find(c => c.team === 1 && c.weapon.id === 'rifle');
  // rifle: 3 hits
  const V = CHARS.find(c => c.team === 0 && !c.isPlayer); V.pos.set(5, 0, 5); V.state = 'play'; V.alive = true; V.hp = 100; V.invulnT = 0; V.sj = null;
  for (let k = 0; k < 3; k++) V.damage(WEAPONS.rifle.dmg, rif, 'rifle');
  ok(!V.alive && WEAPONS.rifle.dmg === 36, 'rifle kills in 3 hits (36 dmg)');
  V.respawnT = 999;   // keep it out of the way (bots may super-jump onto the player on respawn)
  // regen timing (standing): nothing before 1 s, 12.5/s after
  P.pos.set(0, 0, 12); P.vel.set(0, 0, 0); P.state = 'play'; P.alive = true; P.sj = null; Input.keys = {}; Input.fire = false; loop();
  splatFloor(0, 0, 12, 4, 0, 1, false); loop();
  P.hp = 50; P.lastHurt = G.time; for (let i = 0; i < 27; i++) loop(); const h09 = P.hp; for (let i = 0; i < 30; i++) loop();
  ok(Math.abs(h09 - 50) < 0.01 && P.hp > 55 && P.hp < 64, 'regen waits 1s then ~12.5/s (after 0.9s: ' + h09.toFixed(1) + ', after 1.9s: ' + P.hp.toFixed(1) + ')');
  // enemy ink floor at 50
  splatFloor(0, 0, 12, 4, 1, 1, false); P.pos.set(0, 0, 12); P.vel.set(0, 0, 0); Input.keys = {}; P.hp = 100; P.lastHurt = -99; for (let i = 0; i < 150; i++) loop();
  ok(Math.abs(P.hp - 50) < 1, 'standing in enemy ink drains to 50 HP and stops (' + P.hp.toFixed(1) + ')');
  // submerged regen: 100/s
  splatFloor(0, 0, 12, 4, 0, 1, false); P.hp = 30; P.lastHurt = G.time - 1.1; Input.keys.ShiftLeft = true; for (let i = 0; i < 12; i++) loop();
  ok(P.hp >= 60 && P.submerged, 'submerged in own ink regenerates ~100/s (' + P.hp.toFixed(1) + ' after 0.4s)');
  // ink spots on hurt characters
  V.alive = true; V.state = 'play'; V.hp = 30; V.syncModel(0);
  const shown = V.inkSpots.filter(m => m.visible).length; V.hp = 100; V.syncModel(0); const none = V.inkSpots.filter(m => m.visible).length;
  ok(shown >= 8 && none === 0, 'hurt characters get covered in enemy ink (' + shown + ' spots at 30 HP, ' + none + ' at full)');
  // swim jump keeps momentum
  for (let z = 28; z >= -6; z -= 2.5) splatFloor(-9, 0, z, 2.6, 0, 1, false);
  P.pos.set(-9, 0, 27); P.vel.set(0, 0, 0); Cam.yaw = Math.PI; Cam.pitch = 0; Input.keys = { KeyW: true, ShiftLeft: true };
  for (let i = 0; i < 20; i++) loop(); const vx = Math.hypot(P.vel.x, P.vel.z), z0 = P.pos.z;
  Input.jumpQ = true; loop(); let air = 0; while (!P.grounded && air < 90) { loop(); air++; } const jd = Math.abs(P.pos.z - z0);
  ok(vx > 11 && jd > 7, 'swim-jump keeps speed (run-up ' + vx.toFixed(1) + ' m/s, jump distance ' + jd.toFixed(1) + ' m)');
  Input.keys = {};
  // super jump while alive (from the map)
  const ally = CHARS.find(c => c.team === 0 && !c.isPlayer && c.alive);
  ally.pos.set(-12, 0, -8); ally.state = 'play'; P.pos.set(10, 0, 20); P.vel.set(0, 0, 0); loop();
  HUD.drawMap(); const idx = HUD.mapAllies.findIndex(a => a.c === ally);
  toggleMap(true); HUD.pickAlly(idx);
  ok(!!P.sj && !G.mapOpen && P.sjMarker && P.sjMarker.visible, 'picking a teammate on the map starts a super jump (marker shown, map closed)');
  let f2 = 0, maxStep = 0, lp = P.pos.clone(), sawFly = false;
  while ((P.sj || P.state !== 'play') && f2 < 200) { loop(); f2++; maxStep = Math.max(maxStep, P.pos.distanceTo(lp)); lp.copy(P.pos); if (P.state === 'sjfly') sawFly = true; }
  ok(sawFly && maxStep < 2.5, 'super jump is one continuous arc flight, no teleport (largest step ' + maxStep.toFixed(2) + ' m/frame)');
  const dA = Math.hypot(P.pos.x - ally.pos.x, P.pos.z - ally.pos.z);
  ok(P.state === 'play' && dA < 2 && !P.sjMarker.visible, 'super jump lands next to the teammate in ' + (f2 / 30).toFixed(1) + 's (' + dA.toFixed(1) + 'm away)');
  // choose a jump target while dead -> respawn on the teammate
  P.invulnT = 0; P.hp = 1; P.damage(100, rif, 'rifle'); HUD.drawMap(); toggleMap(true);
  HUD.pickAlly(HUD.mapAllies.findIndex(a => a.c === ally)); ok(P.jumpTarget === ally, 'while dead you can pick a teammate to jump to');
  let f3 = 0; while ((!P.alive || P.state !== 'play') && f3 < 400) { loop(); f3++; }
  const dB = Math.hypot(P.pos.x - ally.pos.x, P.pos.z - ally.pos.z);
  ok(P.state === 'play' && dB < 2, 'respawn super-jumps straight to that teammate (' + dB.toFixed(1) + 'm away)');
  // enemy-ink feedback
  splatFloor(6, 0, 12, 3, 1, 1, false); P.pos.set(6, 0, 12); P.vel.set(0, 0, 0); P.hp = 100; ScreenInk.sticky = 0;
  for (let i = 0; i < 20; i++) loop();
  ok(P.inEnemy && ScreenInk.sticky > 0.5, 'standing in enemy ink: screen goo rises (' + ScreenInk.sticky.toFixed(2) + ')');
  splatFloor(6, 0, 12, 3, 0, 1, false); for (let i = 0; i < 45; i++) loop();
  ok(!P.inEnemy && ScreenInk.sticky < 0.1, 'leaving enemy ink: screen goo fades (' + ScreenInk.sticky.toFixed(2) + ')');
  ok(VERSION === RELEASES[0].v && RELEASES.every(r => r.items.length >= 3 && r.date.length === 10 && typeof r.time === 'string' && r.time.length === 5 && r.time[2] === ':'), 'version badge ' + VERSION + ' and release notes with date+time (' + RELEASES.length + ' versions)');
  // ================= v0.5.1 hit feel =================
  // reticle: a low wall between the gun and the target -> small reticle sticks to the wall
  Profile.data.weapon = 'rifle';
  { const W = WEAPONS.rifle; ok(W.grav === 72 && W.range === 16, 'longer, smoother rifle ballistics (range 16 m)'); }
  const w = SOLIDS.find(s => s.t === 'box' && s.h > 1 && s.h < 1.3 && s.z0 > 20);   // front cover wall near our spawn
  Cam.yaw = Math.PI; Cam.pitch = 0.02; P.pos.set((w.x0 + w.x1) / 2, 0, w.z1 + 1.2); P.vel.set(0, 0, 0); P.state = 'play'; P.alive = true; Input.keys = {};
  for (let i = 0; i < 4; i++) loop();
  ok(Cam.blocked && Math.abs(Cam.land.z - w.z1) < 0.6, 'wall between gun and aim point: small reticle sticks to the wall (blocked=' + Cam.blocked + ', z=' + Cam.land.z.toFixed(2) + ' wall=' + w.z1 + ')');
  // bullets render as a 3-blob stream and paint lands in two beats
  Proj.shots.length = 0; const mate = CHARS.find(c => c.team === 0 && !c.isPlayer && c.weapon.id === 'rifle') || rif; Proj.shot(mate, P.muzzle(), new THREE.Vector3(0, 0, 1)); loop();
  ok(Proj.mesh.count >= 3, 'each bullet renders as a stream of blobs (' + Proj.mesh.count + ' instances)');
  let seenPending = false; for (let i = 0; i < 20; i++) { loop(); if (Proj.pending.length) seenPending = true; }
  ok(seenPending && Proj.pending.length === 0, 'impact paint lands in two beats (core, then full splat)');
  // ================= v0.5.2 weapon identity =================
  ok(Math.floor(100 / WEAPONS.rifle.cost) === 70, 'rifle tank holds 70 shots (' + WEAPONS.rifle.cost + '% per shot)');
  // bomb: standing vs jump throw distance (read from the arc preview)
  P.pos.set(-9, 0, 27); P.vel.set(0, 0, 0); P.grounded = true; Cam.yaw = Math.PI; Cam.pitch = 0; P.aimYaw = Math.PI; P.aimPitch = 0; loop();
  const dirB = new THREE.Vector3(0, 0, -1);
  Proj.preview(P, dirB, true); const dStand = Math.abs(Proj.pvRing.position.z - P.pos.z);
  P.grounded = false; P.vel.set(0, 3, 0); P.pos.y = 0.9; Proj.preview(P, dirB, true); const dJump = Math.abs(Proj.pvRing.position.z - P.pos.z);
  P.grounded = true; P.pos.y = 0; P.vel.set(0, 0, 0); Proj.preview(null);
  ok(dStand > 8.5 && dStand < 11 && dJump > dStand * 1.25, 'bomb: standing throw ' + dStand.toFixed(1) + ' m, jump throw ' + dJump.toFixed(1) + ' m');
  // charger: full charge paints far more than a mid charge
  const ch = CHARS.find(c => c.weapon.id === 'charger' && c.team === 1) || CHARS.find(c => c.weapon.id === 'charger');
  if (ch) {
    const tryShot = (charge, z) => { resetPaint(); ch.pos.set(20, 0, z); ch.aimYaw = Math.PI; ch.aimPitch = -0.25; ch.ink = 100; ch.state = 'play'; ch.alive = true; ch.intent.aimDir = null;
      ch.fireCharger(charge, ch.intent); for (let i = 0; i < 40; i++) loop(); return Paint.teamCells[ch.team]; };
    const mid = tryShot(0.6, 0), fullC = tryShot(1, 0);
    ok(fullC > mid * 1.8, 'charger: full-charge shot paints much more than a 60% shot (' + fullC + ' vs ' + mid + ' cells)');
  }
  // ---------- swim speed = 2x run
  ok(Math.abs(12.8 / 6.4 - 2) < 1e-9 && WEAPONS.charger.moveCharge === 1.35, 'speed ratios: swim 2.0x run, charging 21% of run');
  // ================= v0.6 turf polish =================
  {
    // every surface takes ink: ramp sides and the top of the perimeter walls
    const inkIn = f => { let n = 0; for (let j = 0; j < f.rh - 2; j++) for (let i = 0; i < f.rw - 2; i++) { const o = ((f.ry + 1 + j) * Paint.W + f.rx + 1 + i) * 4; if (Paint.wdata[o] > 128 || Paint.wdata[o + 1] > 128) n++; } return n; };
    resetPaint();
    const rampsOk = SOLIDS.filter(s => s.t === 'ramp').every(s => Object.values(s.faces).filter(f => f.side).length === 2);
    const rp = SOLIDS.find(s => s.t === 'ramp' && s.axis === 'z' && s.faces['+x']), rf = rp.faces['+x'], zm = (rp.z0 + rp.z1) / 2, own = { team: 0, addPaint() { } };
    Proj.impact(rp, new THREE.Vector3(rp.x1 + 0.3, 0.3, zm), new THREE.Vector3(rp.x1 - 0.05, 0.3, zm), 0, own, 1.0); for (let i = 0; i < 5; i++) loop();
    const cap = Paint.faces.find(f => f.cap), cx = cap.ax ? cap.inner + 0.7 * cap.sgn : 3, cz = cap.ax ? 3 : cap.inner + 0.7 * cap.sgn;
    Proj.impact(cap.s, new THREE.Vector3(cx, cap.capY + 0.3, cz), new THREE.Vector3(cx, cap.capY - 0.05, cz), 0, own, 1.0);
    const bm = { team: 1, owner: { team: 1, addPaint() { } } };
    splatFloor(rp.x1 + 0.5, 0, zm + 1, 2.5, 1, 1.6);
    ok(rampsOk && inkIn(rf) > 50 && inkIn(cap) > 50 && Paint.faces.filter(f => f.cap).length === 4, 'ramp sides and perimeter wall tops take ink (ramp side ' + inkIn(rf) + ' px, wall top ' + inkIn(cap) + ' px)');
    // assists / specials / super jumps are tracked
    const vic = CHARS.find(c => c.team === 1), k1 = CHARS.find(c => c.team === 0 && c !== P), k2 = P;
    vic.state = 'play'; vic.alive = true; vic.hp = 100; vic.invulnT = 0; vic.pos.set(10, 0, -20);
    const a0 = k2.assists, kk = k1.kills; vic.damage(40, k2, 'rifle'); vic.damage(80, k1, 'rifle');
    ok(k1.kills === kk + 1 && k2.assists === a0 + 1, 'kills and assists are counted (assist = hurt the victim within 4 s)');
    const sp0 = P.specials; P.special = 100; P.startSpecial(); ok(P.specials === sp0 + 1, 'special uses are counted');
    // medals: gold for best in the match, silver for best on the team
    CHARS.forEach(c => { c.paint = 10; c.kills = 0; c.assists = 0; c.specials = 0; c.sjumps = 0; c.deaths = 3; });
    P.paint = 999; const tm = CHARS.find(c => c.team === 0 && c !== P); tm.kills = 3; const en = CHARS.find(c => c.team === 1); en.kills = 5;
    const mp = medalsFor(P), mt = medalsFor(tm), me = medalsFor(en);
    ok(mp.some(m => m.gold && m.t === '涂地最多') && mt.some(m => !m.gold && m.t === '击倒最多') && me.some(m => m.gold && m.t === '击倒最多'), 'medals: gold = best in match, silver = best on team');
    // Tab scoreboard
    G.state = 'play'; Input.keys.Tab = true; HUD.tabT = 0; HUD.update(0.03);
    const shown = $('scoreTab').classList.contains('show'), html = $('stA').innerHTML + $('stB').innerHTML;
    Input.keys.Tab = false; HUD.update(0.03);
    ok(shown && !$('scoreTab').classList.contains('show') && html.includes(P.name) && html.includes('共击倒'), 'holding Tab shows the live scoreboard, releasing hides it');
    // praise when you did well, a cheeky roast when you didn't
    CHARS.forEach(c => { c.paint = 50; c.kills = 1; c.assists = 0; c.specials = 1; c.sjumps = 0; c.deaths = 2; c.special = 0; });
    const bad = CHARS.find(c => c.team === 0 && c !== P); bad.paint = 1; bad.kills = 0; bad.deaths = 9; bad.special = 100; bad.specials = 0;
    const rb = roastsFor(bad).map(r => r.t), lb = verdictLine(bad);
    P.paint = 999; const lp = verdictLine(P);
    ok(rb.length >= 2 && !lb.good && lp.good && PRAISE['涂地最多'].includes(lp.text), 'awards: praise for the best, roast badges + a cheeky line for a bad game (' + rb.join('/') + ': ' + lb.text + ')');
    // pause ducks the sound, resume brings it back
    Sfx.duck(true); const d1 = Sfx.ducked; Sfx.duck(false);
    ok(d1 && !Sfx.ducked, 'pausing ducks and muffles the sound, resuming restores it');
    // ================= v0.7 long-range trio =================
    {
      const setup = w => { quitToTitle(); for (let i = 0; i < 3; i++) loop(); Profile.data.weapon = w; openLobby('turf'); startMatch(); Input.locked = true; while (G.state !== 'play') loop();
        G.bots.forEach(b => b.update = () => {}); CHARS.forEach(c => { if (c !== PLAYER) { c.pos.set(20 + c.id, 0, -30); c.intent.mx = c.intent.mz = 0; c.intent.fire = false; } });
        const P2 = PLAYER; P2.pos.set(-9, 0, 20); P2.vel.set(0, 0, 0); P2.ink = 100; Cam.yaw = Math.PI; Cam.pitch = 0; for (let i = 0; i < 3; i++) loop(); return P2; };
      const foe = k => { const e = CHARS.filter(c => c.team === 1)[k]; e.hp = 100; e.alive = true; e.state = 'play'; e.invulnT = 0; e.vel.set(0, 0, 0); return e; };
      // --- heavy gatling: spin up, then a long burst
      let Q = setup('splatling'); const WS = WEAPONS.splatling; let shots = 0; const os = Proj.shot.bind(Proj); Proj.shot = (o, ...a) => { if (o === Q) shots++; return os(o, ...a); };
      Input.fire = true; Input.keys.KeyW = true; for (let i = 0; i < 32; i++) loop(); const ch = Q.charge, slow = Math.hypot(Q.vel.x, Q.vel.z); Input.keys.KeyW = false;
      Input.fire = false; for (let i = 0; i < 75; i++) loop(); Proj.shot = os;
      const pr = Proj.predict(Q, Q.muzzle(), new THREE.Vector3(0, 0, -1)), reach = Q.muzzle().distanceTo(pr.end);
      ok(ch > 0.95 && shots >= 24 && shots <= 32 && Math.abs(slow - WS.moveCharge) < 0.3 && reach > 19, 'gatling: spins up in ~1 s (walks ' + slow.toFixed(1) + ' m/s), full burst fires ' + shots + ' bullets, reaches ' + reach.toFixed(1) + ' m');
      const g1 = foe(0); g1.pos.set(-9, 0, 4); Q.ink = 100; Input.fire = true; for (let i = 0; i < 32; i++) loop(); Input.fire = false; let fr = 0; while (g1.alive && fr < 90) { loop(); fr++; }
      ok(!g1.alive && g1.lastVia === 'splatling', 'gatling burst takes someone out at 16 m');
      // --- tri-stringer: 3 arrows, horizontal on the ground, vertical in the air; full draw sticks and explodes
      Q = setup('stringer'); const WT = WEAPONS.stringer; const arrows = []; const os2 = Proj.shot.bind(Proj); Proj.shot = (o, p, d, ...a) => { if (o === Q) arrows.push(d.clone().normalize()); return os2(o, p, d, ...a); };
      Input.fire = true; for (let i = 0; i < 30; i++) loop(); Input.fire = false; loop(); loop();
      const yaws = arrows.map(d => Math.atan2(d.x, d.z)), spreadH = Math.max(...yaws.map(y => Math.abs(angDiff(yaws[1], y))));
      arrows.length = 0; Q.ink = 100; for (let i = 0; i < 20; i++) loop(); Input.jumpQ = true; loop(); loop(); Input.fire = true; for (let i = 0; i < 12; i++) loop(); Input.fire = false; loop();
      const pit = arrows.map(d => d.y), spreadV = Math.max(...pit) - Math.min(...pit), yawV = Math.max(...arrows.map(d => Math.abs(angDiff(Math.atan2(arrows[1].x, arrows[1].z), Math.atan2(d.x, d.z)))));
      Proj.shot = os2;
      ok(spreadH > 0.1 && spreadV > 0.07 && yawV < 0.03, 'stringer: 3 arrows fan out sideways on the ground (±' + spreadH.toFixed(2) + ' rad), stack vertically when jumping');
      for (let i = 0; i < 40; i++) loop(); const t1 = foe(1); t1.pos.set(-8.2, 0, 11); Q.pos.set(-9, 0, 20); Q.vel.set(0, 0, 0); Q.ink = 100; Cam.pitch = -0.12;
      Input.fire = true; for (let i = 0; i < 30; i++) loop(); Input.fire = false; for (let i = 0; i < 12; i++) loop(); const hpA = t1.hp; for (let i = 0; i < 25; i++) loop();
      ok(t1.hp < hpA || !t1.alive, 'stringer: a full-draw arrow sticks in the ground and explodes a moment later (hp ' + Math.round(hpA) + ' -> ' + Math.round(t1.alive ? t1.hp : 0) + ')');
      // --- range blaster: direct hit = knockout, splash near a miss, airburst at max range
      Q = setup('blaster'); const WB = WEAPONS.blaster; const b1 = foe(0); b1.pos.set(-9, 0, 12);
      Cam.pitch = 0.0; for (let i = 0; i < 2; i++) loop(); Input.fire = true; loop(); Input.fire = false; for (let i = 0; i < 20; i++) loop();
      ok(!b1.alive && b1.lastVia === 'blaster', 'blaster: a direct hit knocks out in one shot');
      for (let i = 0; i < 40; i++) loop(); Q.ink = 100; Q.fireCd = 0; Cam.pitch = -0.32; for (let i = 0; i < 2; i++) loop();
      const land = Proj.predict(Q, Q.muzzle(), Q.intent.aimDir.clone()).end; const b2 = foe(1); b2.pos.set(land.x + 1.5, 0, land.z);
      Input.fire = true; loop(); Input.fire = false; for (let i = 0; i < 20; i++) loop();
      ok(b2.alive && b2.hp < 60, 'blaster: missing still splashes whoever is next to the blast (hp ' + Math.round(b2.hp) + ')');
      let boomAt = null; const ob = Proj.blastAt.bind(Proj); Proj.blastAt = (o, p, ...a) => { if (o === Q) boomAt = p.clone(); return ob(o, p, ...a); };
      Q.ink = 100; Q.fireCd = 0; Cam.pitch = 0.25; for (let i = 0; i < 2; i++) loop(); Input.fire = true; loop(); Input.fire = false; for (let i = 0; i < 20; i++) loop(); Proj.blastAt = ob;
      ok(boomAt && boomAt.y > 2.5 && Math.hypot(boomAt.x - Q.pos.x, boomAt.z - Q.pos.z) > 14, 'blaster: the shell airbursts at the end of its range (' + (boomAt ? Math.hypot(boomAt.x - Q.pos.x, boomAt.z - Q.pos.z).toFixed(1) + ' m out, ' + boomAt.y.toFixed(1) + ' m up' : 'none') + ')');
      const wl = SOLIDS.find(s => s.t === 'box' && !s.bound && s.h > 1.5 && s.x1 - s.x0 < 4 && s.z1 - s.z0 > 6);
      const b3 = foe(2), side = (wl.x0 + wl.x1) / 2, zc = (wl.z0 + wl.z1) / 2; b3.pos.set(wl.x1 + 0.6, 0, zc);
      Proj.blastAt(Q, new THREE.Vector3(wl.x0 - 0.3, 1, zc), WB.blastR, WB.blastCore, WB.blastDmg, 1.5, 'blaster');
      ok(b3.hp === 100, 'explosions do not go through walls');
      quitToTitle(); for (let i = 0; i < 3; i++) loop(); Profile.data.weapon = 'rifle';
    }
    // knocked out: killer cam first, then watch a teammate, back to yourself on respawn
    quitToTitle(); for (let i = 0; i < 3; i++) loop(); openLobby('turf'); startMatch(); while (G.state !== 'play') loop();
    const Q = PLAYER, foe = CHARS.find(c => c.team === 1); G.bots.forEach(b => b.update = () => {});
    Q.invulnT = 0; Q.pos.set(0, 0, 20); for (let i = 0; i < 3; i++) loop();
    Q.hp = 10; Q.damage(50, foe, 'rifle'); for (let i = 0; i < 20; i++) loop();
    const early = Cam.spec; for (let i = 0; i < 60; i++) loop();
    const mate = Cam.spec, dCam = mate ? camera.position.distanceTo(mate.pos) : 99, tag = $('specTag').textContent;
    const pick = CHARS.find(c => c.team === 0 && c !== Q && c !== mate); HUD.mapAllies = [{ c: pick }]; HUD.pickAlly(0); for (let i = 0; i < 5; i++) loop();
    const switched = Cam.spec === pick;
    while (!Q.alive || Q.state !== 'play') loop(); loop();
    const v2 = new THREE.Vector3(); camera.getWorldDirection(v2);
    ok(!early && mate && mate.team === 0 && dCam < 9 && tag.includes(mate.name) && switched && !Cam.spec, 'knocked out: sees the attacker, then watches a teammate (' + (mate && mate.name) + ', cam ' + dCam.toFixed(1) + ' m), follows your super-jump pick, back to you on respawn');
    ok(Q.state === 'play' && (Q.sj || Q.fly || v2.z < -0.5 || Q.pos.distanceTo(pick.pos) < 3), 'respawn: facing the battlefield or flying to the picked teammate');
  }
})()`, g);
if (g.__fails) { console.log(g.__fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL FEATURE TESTS PASSED');
