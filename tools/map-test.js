#!/usr/bin/env node
/*  Skatepark map checks (headless): curved terrain (bowls, outer wall), grate
    bridges / fences, the climb-only tower, out-of-bounds paint, AI paths.
    Usage:  node tools/map-test.js                                          */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const JS = ['01_core', '02_world', '03_env', '03b_canton_design', '04_data', '05_character', '06_fx', '07_ai_input', '07b_director', '07c_strategy', '08_game'].map(n => read(`src/js/${n}.js`)).join('\n');
process.env.SR_MAP = 'skate';
eval(src.slice(src.indexOf('function makeSandbox'), src.indexOf('const weapons')));
const g = makeSandbox();
const tests = function () {
  const res = []; const ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  const K = SKATE_K;            // the plan is spread out by K (heights unchanged)
  ok(MAP_ID === 'skate' && XH === 25.5 && ZH === 55.5 && TERR.on, 'skatepark map boots with curved terrain (51 x 111 m)');
  ok(Paint.total < NX * NZ * 0.8 && Paint.total > NX * NZ * 0.5, 'outside the park and the planters are excluded from the turf total (' + (Paint.total / (NX * NZ) * 100).toFixed(0) + '% of the floor counts)');
  const oo = SOLIDS.find(s => s.oob); ok(splatFloor((oo.x0 + oo.x1) / 2, oo.h, (oo.z0 + oo.z1) / 2, 2, 0, 0.7, false) === 0, 'ink does not stick to out-of-bounds planters');
  ok(splatFloor(-17 * K, TERR.OOB_H, 40 * K, 2, 0, 0.7, false) === 0 && terrOob(-17 * K, 40 * K), 'ink does not stick outside the park wall');
  // rotational symmetry of the terrain
  let asym = 0; for (let k = 0; k < 400; k++) { const x = Math.random() * 40 - 20, z = Math.random() * 90 - 45; if (Math.abs(groundAt(x, z) - groundAt(-x, -z)) > 0.05) asym++; }
  ok(asym < 4, 'both halves are the same (rotated 180°): ' + asym + ' / 400 samples differ');
  ok(terrH(8 * K, 24 * K) > 0.5 && terrH(12 * K, 22 * K) < 0.1 && terrH(15 * K, 21 * K) > 0.3 && Math.abs(terrH(0, 6 * K) - SL) < 0.01, 'bowl: floor below the street, a round hump and a snake ridge inside');
  let clash = 0; const F = Paint.faces.filter(f => !f.cap && !f.ramp);
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) { const a = F[i], b = F[j]; if (a.d !== b.d || Math.abs(a.plane - b.plane) > 0.02) continue; const o = Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0); if (o > 0.05) clash++; }
  ok(clash === 0, 'no overlapping wall faces (' + clash + ')');
  const from = navIdx(SPAWN[0].x, SPAWN[0].z), spots = { 'enemy spawn': [SPAWN[1].x, SPAWN[1].z], 'own bowl floor': [12, 22], 'enemy bowl floor': [-12, -22], 'tower foot': [0.3, 2.6], 'side ledge': [17, 8], 'spawn platform': [-10, 30], 'narrow ledge': [-17, 22], 'side pit': [-17, 7], 'enemy narrow ledge': [17, -22] };
  Object.keys(spots).forEach(k => { if (k !== 'enemy spawn') spots[k] = spots[k].map(v => v * K); });
  const miss = Object.keys(spots).filter(k => !astar(from, navIdx(...spots[k])));
  ok(!miss.length, 'AI can walk from the spawn to every area' + (miss.length ? ' (missing: ' + miss.join(', ') + ')' : ''));
  // mouse movement during the opening shot is dropped (it used to pile up and swing the camera at GO)
  openLobby(); startMatch(); Input.locked = true; const yaw0 = Cam.yaw; let fr0 = 0; while (G.state !== 'play' && fr0++ < 400) { Input.dx += 40; loop(); } loop();
  ok(G.state === 'play' && Math.abs(Cam.yaw - yaw0) < 1e-6, 'opening shot: moving the mouse during it does not turn the camera at GO');
  quitToTitle(); for (let i = 0; i < 5; i++) loop();
  GAME.uniformChars = true; Profile.data.char = 'std'; Profile.data.weapon = 'rifle'; openLobby(); startMatch(); Input.locked = true; while (G.state !== 'play') loop();
  G.bots.forEach(b => b.update = () => { }); CHARS.forEach(c => { if (c !== PLAYER) { c.pos.set((-8 + c.id * 0.9) * K, SKATE_LV.plat, 44 * K); c.intent.mx = c.intent.mz = 0; c.intent.fire = false; } });
  const P = PLAYER; const put = (x, y, z) => { P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.wall = null; P.climbing = false; P._safe = null; Input.keys = {}; for (let i = 0; i < 3; i++) loop(); };
  const walk = (yaw, n, keys = {}) => { Cam.yaw = yaw; Cam.pitch = 0; Input.keys = Object.assign({ KeyW: true }, keys); for (let i = 0; i < n; i++) loop(); Input.keys = {}; for (let i = 0; i < 4; i++) loop(); };
  // into the bowl and back out up the rounded transition
  put(-1, SL, 10 * K); walk(0, 60); const inBowl = P.pos.y < SL - 0.3; walk(Math.PI, 60); const outBowl = P.pos.z < 13 * K && Math.abs(P.pos.y - SL) < 0.05;
  ok(inBowl && outBowl, 'bowl: walk down into it and back up its rounded edge (in ' + inBowl + ', out ' + outBowl + ')');
  // where the bowl meets the spawn platform its edge rises 2 m: still a slope you can walk up (no dead wall)
  put(-1.5 * K, 0.1, 27 * K); walk(-Math.PI / 2, 120); const upRim = P.pos.y > SKATE_LV.plat - 0.05;
  ok(upRim, 'bowl edge by the spawn platform: walk straight up onto the platform (y ' + P.pos.y.toFixed(2) + ')');
  // the outer wall: can't walk or jump out of the park
  put(-6.8 * K, SKATE_LV.plat, 44 * K); walk(0, 90); const z1 = P.pos.z; put(-6.8 * K, SKATE_LV.plat, 44 * K); Input.jumpQ = true; walk(0, 50, { Space: true });
  ok(z1 < 46.6 * K && P.pos.z < 46.6 * K && !terrOob(P.pos.x, P.pos.z), 'outer wall: no walking or jumping out of the park (z ' + z1.toFixed(2) + ', ' + P.pos.z.toFixed(2) + ')');
  // the round end of the bowl: run along the curved wall, slide along it, never through
  put(14 * K, 0.2, 24 * K); let worst = 0; Cam.yaw = Math.PI / 2; Input.keys = { KeyW: true, KeyD: true }; for (let i = 0; i < 120; i++) { loop(); if (terrOob(P.pos.x, P.pos.z)) worst++; } Input.keys = {};
  ok(worst === 0, 'curved bowl wall: running into it slides along, never through');
  // planters: you can jump up onto them, but their palm trunks are solid (no walking through the tree)
  const PL = SOLIDS.find(o => o.oob && o.x0 > 4 && o.z0 > 9 && o.h > 2.5), GW = BRIDGES.find(o => o.x0 > PL.x1 - 0.1 && o.h > 2.5);
  put((GW.x0 + GW.x1) / 2, GW.h, (PL.z0 + PL.z1) / 2); Cam.yaw = -Math.PI / 2; Input.jumpQ = true; walk(-Math.PI / 2, 25, { Space: true }); const jumpedOn = inRect(PL, P.pos.x, P.pos.z) && Math.abs(P.pos.y - PL.h) < 0.05;
  const TR = TREES.filter(t => inRect(PL, t.x, t.z)); let thru = 0;
  TR.forEach(t => { put(t.x + 1.6, PL.h, t.z); for (let i = 0; i < 60; i++) { Cam.yaw = Math.atan2(t.x - P.pos.x, t.z - P.pos.z) + Math.PI; Cam.pitch = 0; Input.keys = { KeyW: true }; loop(); if (Math.hypot(P.pos.x - t.x, P.pos.z - t.z) < t.r + 0.3) thru++; } Input.keys = {}; });
  ok(jumpedOn && TR.length === 2 && !thru, 'planters: jump up onto them; the palm trunks block people (' + TR.length + ' palms checked)');
  ok(PALMS.length % 2 === 0 && PALMS.every(([x, z], i) => i % 2 === 0 ? Math.abs(PALMS[i + 1][0] + x) < 1e-6 && Math.abs(PALMS[i + 1][1] + z) < 1e-6 : true) && TREES.every(t => SOLIDS.some(o => o.oob && inRect(o, t.x, t.z) && Math.abs(o.h - t.y0) < 1e-6 && Math.min(t.x - o.x0, o.x1 - t.x, t.z - o.z0, o.z1 - t.z) > 0.9)), 'palms: fixed mirrored spots, each standing well inside its planter');
  // a grate walkway at chest height: people bump into it instead of walking under it (squids slip under)
  const WG = BRIDGES.find(o => o.h === 2.0 && o.x0 < 0 && o.x1 > -3 && o.z0 > 4);
  put(WG.x1 + 1.2, SL, (WG.z0 + WG.z1) / 2); walk(-Math.PI / 2, 40); const underBlocked = P.pos.x > WG.x1 && P.pos.y < SL + 0.05;
  put(WG.x1 + 1.2, SL, (WG.z0 + WG.z1) / 2); walk(-Math.PI / 2, 40, { ShiftLeft: true }); const squidUnder = P.pos.x < WG.x1 - 0.3;
  ok(underBlocked && squidUnder, 'grate walkway at chest height: people bump into it, squids slip under it');
  // grate bridge over the side pit: stand on it, drop through it as a squid
  const B = BRIDGES.find(b => b.h === SKATE_LV.plat && b.x0 < -15), bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
  put(bx, B.h + 0.05, bz); for (let i = 0; i < 15; i++) loop(); const stood = Math.abs(P.pos.y - B.h) < 0.05;
  Input.keys.ShiftLeft = true; for (let i = 0; i < 25; i++) loop(); const dropped = P.pos.y < 0.2; Input.keys = {}; for (let i = 0; i < 5; i++) loop();
  ok(stood && dropped, 'grate bridge: people stand on it, squids drop through into the pit');
  walk(Math.PI / 2, 90); const outPit = P.pos.y > SL - 0.05;
  ok(outPit, 'side pit: walk out of it up its ramp (y ' + P.pos.y.toFixed(2) + ')');
  // fence pocket beside the tower: blocks people, squids slip through, ink flies through
  const fn = FENCES.find(f => f.z1 - f.z0 < 0.2 && f.z0 > 5 && f.z0 < 8 && f.x0 > 0), fx = (fn.x0 + fn.x1) / 2;
  put(fx, SL, fn.z0 - 0.8); Cam.yaw = 0; Cam.pitch = 0; Input.keys.KeyW = true; for (let i = 0; i < 30; i++) loop(); const blocked = P.pos.z < fn.z0;
  Input.keys.ShiftLeft = true; for (let i = 0; i < 30; i++) loop(); const through = P.pos.z > fn.z1 + 0.3; Input.keys = {}; for (let i = 0; i < 5; i++) loop();
  const e = CHARS.find(c => c.team === 1); e.pos.set(fx, SL, fn.z1 + 1.2); e.hp = e.maxHp; e.alive = true; e.state = 'play'; e.invulnT = 0; e.swim = e.submerged = false; e.intent.swim = false; const h0 = e.hp;
  Proj.shot(P, new THREE.Vector3(fx, SL + 0.95, fn.z0 - 1.5), new THREE.Vector3(0, 0, 1), WEAPONS.rifle); for (let i = 0; i < 10; i++) loop();
  ok(blocked && through && e.hp < h0, 'grate fence: blocks people, squids slip through, ink goes through it');
  put(fx, SL, fn.z0 - 0.6); Cam.yaw = 0; Input.jumpQ = true; walk(0, 40, { Space: true }); const overFence = P.pos.z > fn.z1;
  ok(!overFence, 'grate fence: too tall to jump over');
  e.pos.set(15 * K, SL, -44 * K);
  // the tower: too high to jump onto from its balcony, climbable once its wall is inked
  const T = SOLIDS.find(s => s.t === 'box' && Math.abs(s.x0 + 1.6 * K) < 0.01 && s.h >= 3.9), tz = 1.5;
  put(-3.4, 2.0, tz); Cam.yaw = Math.PI / 2; Input.keys.KeyW = true; Input.jumpQ = true; Input.keys.Space = true; for (let i = 0; i < 40; i++) loop(); Input.keys = {}; const jumpedUp = P.pos.y > T.h - 0.2;
  for (let v = 0.1; v < T.h; v += 0.3) splatWall(T.faces['-x'], tz - T.z0, v, 0.8, 0);
  put(-3.3, 2.0, tz); Cam.yaw = Math.PI / 2; Input.keys.ShiftLeft = true; Input.keys.KeyW = true; let fr = 0; while (fr++ < 90 && P.pos.y < T.h - 0.05) loop(); for (let i = 0; i < 15; i++) loop(); Input.keys = {};
  ok(!jumpedUp && P.pos.y > T.h - 0.1, 'centre tower: too high to jump onto, climbable once its wall is inked (y ' + P.pos.y.toFixed(2) + ')');
  // shots at the outer wall splash on it and leave no paint
  const before = Paint.teamCells[0]; Proj.shot(P, new THREE.Vector3(-6.8 * K, SKATE_LV.plat + 0.9, 44 * K), new THREE.Vector3(0, 0, 1), WEAPONS.rifle); for (let i = 0; i < 20; i++) loop();
  ok(Paint.teamCells[0] - before < 60, 'shots at the outer wall do not paint the ground behind it');
  quitToTitle(); for (let i = 0; i < 5; i++) loop();
  // switching maps on the map select screen rebuilds the world in place (no page reload) and back again
  const n0 = SOLIDS.length, kids0 = scene.children.length;
  openMapSel(); switchMap('dock'); for (let i = 0; i < 5; i++) loop();
  const dockOk = MAP_ID === 'dock' && XH === 28 && !TERR.on && !TREES.length && Paint.total === NX * NZ && NAV.W === 56 && SPAWN[0].z === 42;
  switchMap('skate'); for (let i = 0; i < 5; i++) loop();
  const backOk = MAP_ID === 'skate' && SOLIDS.length === n0 && TERR.on && TREES.length === PALMS.length && scene.children.length === kids0;
  mapSelNext(); startMatch(); Input.locked = true; let fr2 = 0; while (G.state !== 'play' && fr2++ < 400) loop(); for (let i = 0; i < 30; i++) loop();
  ok(dockOk && backOk && G.state === 'play' && Math.abs(PLAYER.pos.z - SPAWN[0].z) < 4 && !!astar(navIdx(SPAWN[0].x, SPAWN[0].z), navIdx(SPAWN[1].x, SPAWN[1].z)), 'map select: switching maps rebuilds the park in place (no reload), back and forth, and a match starts fine on it');
  quitToTitle(); for (let i = 0; i < 5; i++) loop();
  return res;
};
const out = vm.runInContext('(' + tests.toString() + ')()', g);
out.forEach(l => console.log(l));
const fails = out.filter(l => l.startsWith('FAIL')).length;
if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL MAP TESTS PASSED');
