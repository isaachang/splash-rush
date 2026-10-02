#!/usr/bin/env node
/*  Headless smoke test — no browser, no npm install needed.
    Boots the game with a fake renderer/DOM, then auto-plays full matches
    with every weapon and checks that nothing throws.
    Usage:  node tools/smoke-test.js            (all weapons, 90 s matches)
            SR_MAP=skate node tools/smoke-test.js  (on the skatepark map)
            node tools/smoke-test.js charger    (one weapon)                 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const JS = ['01_core', '02_world', '03_env', '03b_canton_design', '04_data', '05_character', '06_fx', '07_ai_input', '08_game'].map(n => read(`src/js/${n}.js`)).join('\n');

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
  g.SR_MAP = process.env.SR_MAP || 'dock';             // which map to boot (default: the dock)
  vm.runInContext(read('vendor/three.min.js'), g, { filename: 'three.min.js' });
  vm.runInContext(`THREE.WebGLRenderer = class { constructor(){ this.shadowMap = {}; } setSize(){} setPixelRatio(){} render(){} compile(){} };
    THREE.PMREMGenerator = class { fromScene(){ return { texture: null }; } dispose(){} };`, g);
  vm.runInContext(JS, g, { filename: 'game.js' });
  listeners.load.forEach(f => f());
  return g;
}

const weapons = process.argv[2] ? [process.argv[2]] : null;
const g = makeSandbox();
const result = vm.runInContext(`(() => {
  if (G.state !== 'title') throw new Error('boot failed: ' + G.state);
  clock.getDelta = () => 1 / 30;
  for (let i = 0; i < 60; i++) loop();
  const list = ${JSON.stringify(weapons)} || WEAPON_ORDER, out = [];
  for (const w of list) {
    if (!WEAPONS[w]) throw new Error('unknown weapon ' + w);
    GAME.dur = 90; Profile.data.weapon = w; Profile.data.char = charForWeapon(w); openLobby(); startMatch(); Input.locked = true;
    let f = 0;
    while (G.state !== 'results' && f < 30 * 140) {
      const k = Input.keys; k.KeyW = (f % 240) < 200; k.KeyA = (f % 500) < 60; k.ShiftLeft = (f % 180) > 150;
      Input.fire = (f % 90) < 70; Input.dx = Math.sin(f * 0.01) * 6; Input.dy = Math.sin(f * 0.013) * 2;
      if (f % 97 === 0) Input.jumpQ = true; if (f % 400 === 0) Input.bombQ = true; if (f % 300 === 0) Input.spQ = true;
      loop(); f++;
    }
    if (G.state !== 'results') throw new Error('match did not finish with ' + w);
    out.push({ weapon: w, frames: f, turf: [0, 1].map(t => (Paint.teamCells[t] / Paint.total * 100).toFixed(1) + '%'),
      roster: CHARS.map(c => c.weapon.id[0]).join(''), kills: CHARS.reduce((a, c) => a + c.kills, 0) });
    for (let i = 0; i < 30; i++) loop();
    quitToTitle(); for (let i = 0; i < 10; i++) loop();
  }
  return out;
})()`, g);
result.forEach(r => console.log(`✔ ${r.weapon.padEnd(8)} match finished · turf ${r.turf[0]} vs ${r.turf[1]} · total KOs ${r.kills} · roster ${r.roster}`));
console.log('SMOKE TEST PASSED');
