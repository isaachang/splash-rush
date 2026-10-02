#!/usr/bin/env node
/*  西關大屋 map checks (headless): floating blocks (walk under, head bump, two paint layers),
    the canal (landing steps, bridges, the squid-only tunnel under the centre deck), the tower,
    narrow gaps, symmetry, AI paths, and that the other maps are untouched.
    Usage:  node tools/canton-test.js                                                            */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const JS = ['01_core', '02_world', '03_env', '04_data', '05_character', '06_fx', '07_ai_input', '08_game'].map(n => read(`src/js/${n}.js`)).join('\n');
process.env.SR_MAP = 'canton';
eval(src.slice(src.indexOf('function makeSandbox'), src.indexOf('const weapons')));
const g = makeSandbox();
const tests = function () {
  const res = []; const ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  const near = (a, b, e = 0.06) => Math.abs(a - b) < e;
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  ok(MAP_ID === 'canton' && XH === 26 && ZH === 52 && !TERR.on && Paint.has2, 'the map boots (52 x 104 m) with a second paint layer under the floating blocks');
  // ---- layout
  let asym = 0; for (let k = 0; k < 600; k++) { const x = Math.random() * 50 - 25, z = Math.random() * 100 - 50; if (Math.abs(groundAt(x, z) - groundAt(-x, -z)) > 0.05) asym++; }
  ok(asym === 0, 'both halves are the same (rotated 180°): ' + asym + ' / 600 samples differ');
  const blk = SOLIDS.filter(s => s.kind !== 'street' && (s.t === 'ramp' ? Math.max(s.h0, s.h1) : s.h) > CL + STEP && (!s.float || s.y0 < CL + BODY_H) && (s.t === 'ramp' ? Math.max(s.h0, s.h1) : s.h) >= CL);
  TREES.forEach(t => blk.push({ x0: t.x - t.r, x1: t.x + t.r, z0: t.z - t.r, z1: t.z + t.r, kind: 'tree' }));
  const gaps = [];
  for (let i = 0; i < blk.length; i++) for (let j = i + 1; j < blk.length; j++) {
    const a = blk[i], b = blk[j], dx = Math.max(a.x0 - b.x1, b.x0 - a.x1), dz = Math.max(a.z0 - b.z1, b.z0 - a.z1);
    let d; if (dx > 0 && dz > 0) d = Math.hypot(dx, dz); else if (dx > 0) d = dx; else if (dz > 0) d = dz; else continue;
    const mz = (Math.max(a.z0, b.z0) + Math.min(a.z1, b.z1)) / 2;
    if (d > 0.02 && d < 1.5 && Math.abs(mz) > 3.5) gaps.push(d.toFixed(2) + ' m @ ' + [a.x0, a.z0, b.x0, b.z0].join(','));
  }
  ok(!gaps.length, 'no gap narrower than 1.5 m between blocks on the street' + (gaps.length ? ': ' + gaps.slice(0, 4).join(' | ') : ''));
  ok(Paint.total > NX * NZ * 0.85, 'turf total counts both layers (' + (Paint.total / (NX * NZ) * 100).toFixed(0) + '% of the grid)');
  // ---- floating blocks: geometry queries
  ok(near(groundAt(23, 20), CL + 3.8) && near(groundBelow(23, 20, CL + 0.1, STEP), CL) && !solidAt(23, CL + 1, 20) && !!solidAt(23, CL + 3.6, 20) && !solidAt(23, CL + 4.0, 20), 'arcade: the upper deck is solid, the street under it is open');
  ok(!solidAt(0, CL + 2, 31) && !!solidAt(0, CL + 4, 31) && !solidAt(-15.5, CL + 1, 23) && !!solidAt(-15.5, CL + 2.4, 23), 'the paifang beam and the mansion lintel are open underneath');
  // ---- two paint layers
  resetPaint();
  const g1 = splatFloor(23, CL, 20, 1.5, 0, 0.7, false), topBefore = ownerAt(23, CL + 3.8, 20);
  const g2 = splatFloor(23, CL + 3.8, 20, 1.5, 1, 0.7, false);
  ok(g1 > 0 && g2 > 0 && topBefore === -1 && ownerAt(23, CL, 20) === 0 && ownerAt(23, CL + 3.8, 20) === 1, 'ink under the arcade and ink on its deck are kept apart (street = team 0, deck = team 1)');
  const g3 = splatFloor(0, 0, 0, 1.2, 1, 0.7, false); ok(g3 > 0 && ownerAt(0.2, 0, 0.2) === 1 && ownerAt(4, CL, 0) === -1, 'the canal bed under the centre deck takes ink without touching the deck above');
  const oo = SOLIDS.find(s => s.oob); ok(splatFloor((oo.x0 + oo.x1) / 2, oo.h, (oo.z0 + oo.z1) / 2, 2, 0, 0.7, false) === 0, 'ink does not stick to the out-of-bounds buildings');
  resetPaint(); ok(Paint.teamCells[0] === 0 && Paint.teamCells[1] === 0 && ownerAt(23, CL, 20) === -1 && ownerAt(0.2, 0, 0.2) === -1, 'resetting the paint clears both layers');
  // ---- AI paths
  const from = navIdx(SPAWN[0].x, SPAWN[0].z), spots = { 'enemy spawn': [SPAWN[1].x, SPAWN[1].z], 'under own arcade': [23.5, 20.5], 'under enemy arcade': [-23.5, -20.5], 'mansion courtyard': [-19.5, 18.5], 'enemy courtyard': [19.5, -18.5], 'through the paifang': [0.5, 31.5], 'tower foot': [0.5, 5.5], 'canal bed': [-14.5, 0.5], 'side bridge': [16.5, 0.5], 'mansion roof': [-20.5, 13.5] };
  const miss = Object.keys(spots).filter(k => !astar(from, navIdx(...spots[k])));
  ok(!miss.length, 'AI can walk from the spawn to every area' + (miss.length ? ' (missing: ' + miss.join(', ') + ')' : ''));
  ok(near(NAV.h[navIdx(23.5, 20.5)], CL) && near(NAV.h[navIdx(16.5, 0.5)], CL) && near(NAV.h[navIdx(0.5, 31.5)], CL), 'AI walks under the arcade and the paifang, and over the bridges');
  // ---- walking
  GAME.uniformChars = true; Profile.data.char = 'std'; Profile.data.weapon = 'rifle'; openLobby(); startMatch(); Input.locked = true; while (G.state !== 'play') loop();
  G.bots.forEach(b => b.update = () => { }); CHARS.forEach(c => { if (c !== PLAYER) { c.pos.set(-8 + c.id * 2, CL + 2, c.team ? -50 : 50); c.intent.mx = c.intent.mz = 0; c.intent.fire = false; } });
  const P = PLAYER; const put = (x, y, z) => { P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.wall = null; P.climbing = false; P._safe = null; Input.keys = {}; for (let i = 0; i < 3; i++) loop(); };
  const walk = (yaw, n, keys = {}, each) => { Cam.yaw = yaw; Cam.pitch = 0; Input.keys = Object.assign({ KeyW: true }, keys); for (let i = 0; i < n; i++) { loop(); if (each) each(i); } Input.keys = {}; for (let i = 0; i < 4; i++) loop(); };
  const N = Math.PI, E = Math.PI / 2;            // yaw: 0 = +z, PI = -z, PI/2 = +x, -PI/2 = -x
  put(23.5, CL, 34); walk(N, 110); ok(P.pos.z < 14 && near(P.pos.y, CL), 'walking the covered street under the arcade, end to end (z ' + P.pos.z.toFixed(1) + ', y ' + P.pos.y.toFixed(2) + ')');
  put(23.5, CL, 22); let top = 0; Input.jumpQ = true; for (let i = 0; i < 40; i++) { loop(); top = Math.max(top, P.pos.y); }
  ok(top + BODY_H < CL + 3.4 && top > CL + 1.2, 'jumping under the arcade: a full jump clears the deck (peak ' + (top - CL).toFixed(2) + ' m, deck underside at 3.4 m)');
  put(23.5, CL + 2, 46); walk(N, 120); ok(near(P.pos.y, CL + 3.8) && P.pos.z < 30, 'from the spawn terrace up the ramp onto the arcade deck (y ' + (P.pos.y - CL).toFixed(2) + ' m)');
  put(0, CL, 35); walk(N, 60); ok(P.pos.z < 28 && near(P.pos.y, CL), 'walking through the paifang');
  put(-11, CL, 23); walk(-E, 70); ok(P.pos.x < -17 && near(P.pos.y, CL), 'walking in through the open mansion gate into the courtyard (x ' + P.pos.x.toFixed(1) + ')');
  put(-9, CL, 14.2); walk(-E, 60); ok(near(P.pos.y, CL + 2.6) && P.pos.x < -15, 'up the outside stairs onto the mansion roof');
  put(-15.5, CL + 2.6, 14); walk(0, 90);
  ok(near(P.pos.y, CL + 2.6) && P.pos.z > 30, 'across the lintel over the gate to the other wing (z ' + P.pos.z.toFixed(1) + ', y ' + (P.pos.y - CL).toFixed(2) + ')');
  // canal
  put(-10, 0, 0); walk(E, 60); const humanStop = P.pos.x;
  put(-10, 0, 0); walk(E, 90, { ShiftLeft: true }); const squidX = P.pos.x, squidY = P.pos.y;
  ok(humanStop < -7.2 && squidX > -6.6 && near(squidY, 0), 'centre deck: a person is stopped at the edge (x ' + humanStop.toFixed(1) + '), a squid swims under it (x ' + squidX.toFixed(1) + ')');
  put(0, 0, 0.5); Input.keys = { ShiftLeft: true }; for (let i = 0; i < 6; i++) loop(); Input.keys = {}; for (let i = 0; i < 10; i++) loop();
  ok(P.swim && near(P.pos.y, 0), 'under the centre deck there is no room to stand up: you stay a squid');
  put(10, 0, -1.6); walk(E, 80); ok(P.pos.x > 19 && near(P.pos.y, 0), 'a person can walk under the side bridge (x ' + P.pos.x.toFixed(1) + ')');
  put(16, CL, 8); walk(N, 60); ok(P.pos.z < -4 && near(P.pos.y, CL), 'and over it');
  put(-10.5, 0, 0); let upSteps = 0; walk(0, 34, {}, () => { if (P.pos.z < 3.4) upSteps = Math.max(upSteps, P.pos.y); });
  ok(upSteps > CL - 0.5 && near(P.pos.y, CL) && P.pos.z > 3.6, 'out of the canal up the landing steps (top step ' + upSteps.toFixed(2) + ', then the street)');
  put(13, 0, -0.8); walk(0, 20); const bump = P.pos.z; put(13, 0.7, 0.8); walk(-E, 20);
  ok(bump < 0 && near(P.pos.y, 0.7) && P.pos.x < 10.5, 'the dragon boat: too high to walk onto (a jump up), and you can walk along its deck (' + [bump.toFixed(2), P.pos.x.toFixed(1), P.pos.y.toFixed(2)] + ')');
  put(13, 0, -1.2); let peak = 0; Input.jumpQ = true; for (let i = 0; i < 30; i++) { loop(); peak = Math.max(peak, P.pos.y); } ok(peak < CL - 0.4, 'the canal bank is too high to jump out of (peak ' + peak.toFixed(2) + ' of ' + CL + ' m)');
  ok(!solidAt(0, 0.3, 0) && !solidAt(3.5, 0.3, -1.5) && !!solidAt(0, CL + 1, 0) && !!solidAt(3.5, CL + 1, -1.5) && near(groundBelow(0, 0, 1, 0, true), 0), 'the tower and the old wall stand on the deck: the canal tunnel under them is open');
  P.pos.set(0, 0, 2); P.setSwim(true); put(0, 0, 2); P.special = 100; P.startSpecial(); const spNo = !P.sp && P.swim;
  P.setSwim(false); P.vel.y = 13; let mx = 0; for (let i = 0; i < 30; i++) { loop(); mx = Math.max(mx, P.pos.y); }
  ok(spNo && mx < 0.9, 'in the tunnel: no special, and nobody can be pushed up through the deck (peak ' + mx.toFixed(2) + ' m)');
  // tower: 1 m step, 2 m step, then the 4 m terrace only by its inked walls
  const s1 = groundAt(3.7, -3.3), s2 = groundAt(3.7, -1.2), jumpH = 8.3 * 8.3 / (2 * GRAV);
  put(3.7, CL + 2, -1.2); Cam.yaw = -E; let tp = 0; Input.keys = { KeyW: true }; Input.jumpQ = true; for (let i = 0; i < 30; i++) { loop(); tp = Math.max(tp, P.pos.y); } Input.keys = {};
  ok(near(s1, CL + 1) && near(s2, CL + 2) && jumpH > 1.05 && tp < CL + 4 - 0.3, 'tower: two jumps up the old wall (1 m, 2 m), but the 4 m terrace is out of jumping reach (peak ' + (tp - CL).toFixed(2) + ' m)');
  const tw = SOLIDS.find(s => s.kind === 'tower'), tf = tw.faces['+x']; splatWall(tf, 2, CL + 1, 3, P.team); splatWall(tf, 2, CL + 3, 3, P.team); splatFloor(3.2, CL + 2, -1.2, 1.5, P.team);
  put(3.2, CL + 2, -1.2); Cam.yaw = -E; Input.keys = { KeyW: true, ShiftLeft: true }; let climbed = 0; for (let i = 0; i < 60; i++) { loop(); climbed = Math.max(climbed, P.pos.y); } Input.keys = {}; for (let i = 0; i < 10; i++) loop();
  ok(climbed >= CL + 4 - 0.05, 'tower: swimming up its inked wall takes you to the terrace (reached ' + (climbed - CL).toFixed(2) + ' m)');
  // shots
  resetPaint(); Proj.shot(P, new THREE.Vector3(23.5, CL + 1.2, 24), new THREE.Vector3(0, -0.5, -0.86).normalize(), WEAPONS.rifle); for (let i = 0; i < 20; i++) loop();
  let low = 0, up = 0; for (let z = 18; z < 24; z += 0.3) { if (ownerAt(23.5, CL, z) === P.team) low++; if (ownerAt(23.5, CL + 3.8, z) === P.team) up++; }
  ok(low > 0 && up === 0, 'a shot fired under the arcade paints the street, not the deck above (' + low + ' / ' + up + ' cells)');
  resetPaint(); Proj.shot(P, new THREE.Vector3(23.5, CL + 1.2, 24), new THREE.Vector3(0, 0.6, -0.8).normalize(), WEAPONS.rifle); for (let i = 0; i < 20; i++) loop();
  ok(Paint.teamCells[0] + Paint.teamCells[1] < 40, 'a shot into the underside of the deck leaves no paint');
  quitToTitle(); for (let i = 0; i < 5; i++) loop();
  // ---- the other maps are untouched by the new mechanism
  openMapSel(); switchMap('dock'); for (let i = 0; i < 5; i++) loop();
  const dockOk = MAP_ID === 'dock' && !Paint.has2 && Paint.total === NX * NZ && !SOLIDS.some(s => s.float);
  switchMap('skate'); for (let i = 0; i < 5; i++) loop(); const skateOk = MAP_ID === 'skate' && !Paint.has2 && TERR.on;
  switchMap('canton'); for (let i = 0; i < 5; i++) loop();
  ok(dockOk && skateOk && MAP_ID === 'canton' && Paint.has2 && TREES.length === 6, 'switching to the other maps and back: they have no second layer, this one gets it back');
  return res;
};
const out = vm.runInContext('(' + tests.toString() + ')()', g);
out.forEach(l => console.log(l));
const fails = out.filter(l => l.startsWith('FAIL')).length;
if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL CANTON TESTS PASSED');
