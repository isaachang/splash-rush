#!/usr/bin/env node
/*  Skatepark map checks (headless): geometry, grate bridges / fences, the
    climb-only tower, out-of-bounds paint, AI paths.
    Usage:  node tools/map-test.js                                          */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const JS = ['01_core', '02_world', '03_env', '04_data', '05_character', '06_fx', '07_ai_input', '08_game'].map(n => read(`src/js/${n}.js`)).join('\n');
process.env.SR_MAP = 'skate';
eval(src.slice(src.indexOf('function makeSandbox'), src.indexOf('const weapons')));
const g = makeSandbox();
const tests = function () {
  const res = []; const ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  ok(MAP_ID === 'skate' && XH === 22 && ZH === 48, 'skatepark map boots (44 x 96 m)');
  ok(Paint.total < NX * NZ && Paint.total > NX * NZ * 0.6, 'out-of-bounds gardens are excluded from the turf total (' + (Paint.total / (NX * NZ) * 100).toFixed(0) + '% of the floor counts)');
  const oo = SOLIDS.find(s => s.oob); const gain = splatFloor((oo.x0 + oo.x1) / 2, oo.h, (oo.z0 + oo.z1) / 2, 2, 0, 0.7, false);
  ok(gain === 0, 'ink does not stick to out-of-bounds planters');
  // no two visible wall faces in the same plane overlapping (would flicker)
  let clash = 0; const F = Paint.faces.filter(f => !f.cap && !f.ramp);
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) { const a = F[i], b = F[j]; if (a.d !== b.d || Math.abs(a.plane - b.plane) > 0.02) continue; const o = Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0); if (o > 0.05) clash++; }
  ok(clash === 0, 'no overlapping wall faces (' + clash + ')');
  // AI can walk from spawn to every area
  const from = navIdx(SPAWN[0].x, SPAWN[0].z), spots = [[0, 6], [SPAWN[1].x, SPAWN[1].z], [8, 24], [-8, -24], [-16, 7.5], [7.5, 36], [-15, 15], [15, -2]];
  ok(spots.every(([x, z]) => astar(from, navIdx(x, z))), 'every area is reachable on foot from the spawn');
  GAME.uniformChars = true; Profile.data.char = 'std'; Profile.data.weapon = 'rifle'; openLobby(); startMatch(); Input.locked = true; while (G.state !== 'play') loop();
  G.bots.forEach(b => b.update = () => { }); CHARS.forEach(c => { if (c !== PLAYER) { c.pos.set(15 + c.id, SL, 44); c.intent.mx = c.intent.mz = 0; c.intent.fire = false; } });
  const P = PLAYER; const put = (x, y, z) => { P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.wall = null; P.climbing = false; Input.keys = {}; for (let i = 0; i < 3; i++) loop(); };
  // grate bridge: stand on it as a person, drop through it as a squid
  const B = BRIDGES[0], bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
  put(bx, B.h + 0.05, bz); for (let i = 0; i < 15; i++) loop(); const stood = Math.abs(P.pos.y - B.h) < 0.05;
  Input.keys.ShiftLeft = true; for (let i = 0; i < 25; i++) loop(); const dropped = P.pos.y < 0.2; Input.keys = {}; for (let i = 0; i < 5; i++) loop();
  ok(stood && dropped, 'grate bridge: people stand on it, squids drop through into the pit');
  // fence: blocks people, squids slip through, ink flies through
  const fn = FENCES.find(f => f.z1 - f.z0 < 0.2 && f.z0 > 0 && f.z0 < 4), fx = (fn.x0 + fn.x1) / 2;
  put(fx, SL, fn.z0 - 0.8); Cam.yaw = 0; Cam.pitch = 0; Input.keys.KeyW = true; for (let i = 0; i < 30; i++) loop(); const blocked = P.pos.z < fn.z0;
  Input.keys.ShiftLeft = true; for (let i = 0; i < 30; i++) loop(); const through = P.pos.z > fn.z1 + 0.3; Input.keys = {}; for (let i = 0; i < 5; i++) loop();
  const e = CHARS.find(c => c.team === 1); e.pos.set(fx, SL, fn.z1 + 1.2); e.hp = e.maxHp; e.alive = true; e.state = 'play'; e.invulnT = 0; e.swim = e.submerged = false; e.intent.swim = false; const h0 = e.hp;
  Proj.shot(P, new THREE.Vector3(fx, SL + 0.95, fn.z0 - 1.5), new THREE.Vector3(0, 0, 1), WEAPONS.rifle); for (let i = 0; i < 10; i++) loop();
  ok(blocked && through && e.hp < h0, 'grate fence: blocks people, squids slip through, ink goes through it');
  // the tower: can't be jumped onto from its balcony, but can be climbed once its wall is inked
  const T = SOLIDS.find(s => s.t === 'box' && Math.abs(s.x0 + 2.3) < 0.01 && s.h >= 3.9);
  put(3.1, 1.9, 0); Cam.yaw = -Math.PI / 2; Input.keys.KeyW = true; Input.jumpQ = true; for (let i = 0; i < 40; i++) loop(); Input.keys = {}; const jumpedUp = P.pos.y > T.h - 0.2;
  for (let v = 0.1; v < T.h; v += 0.3) splatWall(T.faces['+x'], 2.3, v, 0.8, 0);
  put(3.0, 1.9, 0); Cam.yaw = -Math.PI / 2; Input.keys.ShiftLeft = true; Input.keys.KeyW = true; let fr = 0; while (fr++ < 90 && P.pos.y < T.h - 0.05) loop(); for (let i = 0; i < 15; i++) loop(); Input.keys = {};
  ok(!jumpedUp && P.pos.y > T.h - 0.1, 'centre tower: too high to jump onto, climbable once its wall is inked (y ' + P.pos.y.toFixed(2) + ')');
  quitToTitle(); for (let i = 0; i < 5; i++) loop();
  return res;
};
const out = vm.runInContext('(' + tests.toString() + ')()', g);
out.forEach(l => console.log(l));
const fails = out.filter(l => l.startsWith('FAIL')).length;
if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL MAP TESTS PASSED');
