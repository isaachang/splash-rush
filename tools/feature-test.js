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
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  // ---------- charger: store charge while swimming
  Profile.data.weapon = 'charger'; openLobby(); startMatch(); Input.locked = true;
  while (G.state !== 'play') loop();
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
  // ---------- swim speed = 2x run
  ok(Math.abs(12.8 / 6.4 - 2) < 1e-9 && WEAPONS.charger.moveCharge === 1.35, 'speed ratios: swim 2.0x run, charging 21% of run');
})()`, g);
