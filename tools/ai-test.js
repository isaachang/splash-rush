#!/usr/bin/env node
/*  Bot checks (headless): the nav graph on all three maps (stairs, bridges, no one-way
    traps), getting out of the canal, retreating, focus fire, wall climbing, the three
    difficulty tiers.  With SR_CODES="a,b" (the two special names) it also checks the two name-box modes.
    Usage:  node tools/ai-test.js                                                      */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
process.env.SR_MAP = 'canton';
eval(src.slice(src.indexOf('const root'), src.indexOf('const weapons')));
const g = makeSandbox();
const tests = function (DEVC, VIPC) {
  const res = []; const ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  const WALK = NF.SWIM | NF.JUMP | NF.DROP;
  // ---------------- the nav graph, on every map
  const graphCheck = () => {
    const NN = NAV.N * NAV.L, sp = SPAWN.map(s => navNode(s.x, s.y, s.z));
    const rev = Array.from({ length: NN }, () => []); for (let n = 0; n < NN; n++) for (let d = 0; d < 8; d++) { const t = NAV.eT[n * 8 + d]; if (t >= 0 && !(NAV.eF[n * 8 + d] & NF.CLIMB)) rev[t].push(n); }
    const back = new Uint8Array(NN), q = [sp[0]]; back[sp[0]] = 1; for (let i = 0; i < q.length; i++) for (const p of rev[q[i]]) if (!back[p]) { back[p] = 1; q.push(p); }
    let reach = 0, traps = 0; for (let n = 0; n < NN; n++) if (TAC.reach[0][n] >= 0) { reach++; if (!back[n]) traps++; }
    return { reach, traps, across: !!astar(sp[0], sp[1]), chokes: TAC.chokes.length, highs: TAC.highs.length };
  };
  const gc = {}; for (const id of ['dock', 'skate', 'canton']) { if (MAP_ID !== id) { openMapSel(); switchMap(id); for (let i = 0; i < 3; i++) loop(); } gc[id] = graphCheck(); }
  ok(Object.values(gc).every(v => v.across && v.traps === 0 && v.reach > 2500), 'nav graph on all three maps: spawn-to-spawn route, and nowhere a bot can walk into but not out of (' + Object.keys(gc).map(k => k + ' ' + gc[k].reach + ' spots').join(', ') + ')');
  ok(Object.values(gc).every(v => v.chokes >= 3) && gc.canton.highs >= 4, 'tactics: choke points and high ground found on each map (' + Object.keys(gc).map(k => k + ' ' + gc[k].chokes + '/' + gc[k].highs).join(', ') + ')');
  // canton: the canal is its own level with stairs out; the centre tower top needs a climb
  let canal = -1; for (let k = 0; k < NAV.N && canal < 0; k++) { const p = navPos(k); if (NAV.h[k] < 0.2 && Math.abs(p.z) < 2 && Math.abs(p.x - 6) < 3) canal = k; }
  const out = canal >= 0 && astar(canal, navNode(SPAWN[0].x, SPAWN[0].y, SPAWN[0].z));
  ok(canal >= 0 && out && out.length > 3, 'Xiguan: there is a walking route from the canal bed back up to the street (' + (out ? out.length : 0) + ' waypoints)');
  let climbs = 0, swims = 0, jumps = 0; for (let e = 0; e < NAV.eT.length; e++) if (NAV.eT[e] >= 0) { if (NAV.eF[e] & NF.CLIMB) climbs++; if (NAV.eF[e] & NF.SWIM) swims++; if (NAV.eF[e] & NF.JUMP) jumps++; }
  const tower = TAC.highs.find(h => Math.hypot(h.x, h.z) < 6);
  ok(climbs > 50 && swims > 50 && jumps > 20 && tower && tower.climb[0] && tower.climb[1], 'Xiguan: the graph knows squid-only passages (' + swims + ' links), hops (' + jumps + ') and inkable walls (' + climbs + '); the centre tower is reached only by climbing');
  // ---------------- a match with every other character parked, so one bot can be studied
  const setup = (lv) => {
    quitToTitle(); for (let i = 0; i < 3; i++) loop();
    GAME.uniformChars = true; Profile.data.char = 'std'; Profile.data.weapon = 'rifle'; GAME.name = 'tester'; openLobby();
    G.roster.forEach(t => t.forEach(r => { r.char = 'std'; r.weapon = 'rifle'; })); startMatch(); Input.locked = true; while (G.state !== 'play') loop();
    G.aiLevels = [lv, lv]; G.aiStat = null;
    G.bots.forEach(b => { b._u = b.update; b.update = () => { }; }); CHARS.forEach((c, i) => { if (c !== PLAYER) { c.pos.set(-20 + i * 1.2, 4.2, c.team ? -49 : 49); c.vel.set(0, 0, 0); c.intent.mx = c.intent.mz = 0; c.intent.fire = c.intent.swim = false; } });
    PLAYER.pos.set(0, 4.2, 49);
    const B = G.bots.find(b => b.c.team === 0), E = CHARS.find(c => c.team === 1);
    B.update = B._u; return { B, E };
  };
  const run = (n, each) => { for (let i = 0; i < n; i++) { loop(); if (each && each(i)) return i; } return -1; };
  // out of the canal: dropped on the bed, and wedged in the strip under the kerb (where the old grid thought it was the street)
  for (const [nm, x, z] of [['the middle of the canal', 5.5, 0.5], ['the strip under the kerb', -12.3, 3.3]]) {
    const { B } = setup(1); B.c.pos.set(x, 0, z); B.c.vel.set(0, 0, 0); B.path = []; B.target = null;
    const fr = run(30 * 16, () => B.c.pos.y > 2.0 && B.c.grounded);
    ok(fr >= 0, 'a bot dropped in ' + nm + ' finds the steps and walks out (' + (fr >= 0 ? (fr / 30).toFixed(1) + ' s' : 'still at y ' + B.c.pos.y.toFixed(1) + ', ' + B.c.pos.x.toFixed(1) + ',' + B.c.pos.z.toFixed(1)) + ')');
  }
  // retreat: a normal bot that is losing breaks off, hides in its own ink and heals; an easy bot fights on
  const duel = lv => {
    const { B, E } = setup(lv); const c = B.c;
    c.pos.set(10, 2.2, 30); E.pos.set(10, 2.2, 21); E.aimYaw = 0;
    for (let x = 4; x <= 16; x += 1.5) for (let z = 30; z <= 40; z += 1.5) splatFloor(x, 2.2, z, 1.4, 0, 0.7, false);
    run(20); c.hp = c.maxHp * 0.3; c.lastHurt = G.time; c.lastAttacker = E;
    let retreated = false, back = 0, hid = false; run(30 * 5, () => { if (B.mode === 'retreat') { retreated = true; c.hp = Math.min(c.hp, c.maxHp * 0.3); if (c.submerged) hid = true; } back = Math.max(back, c.pos.distanceTo(E.pos) - 9); E.hp = E.maxHp; E.pos.set(10, 2.2, 21); E.vel.set(0, 0, 0); return false; });
    return { retreated, dz: back, hid, sees: !!B.enemy };
  };
  const dn = duel(1), de = duel(0);
  ok(dn.retreated && dn.dz > 2 && dn.hid && !de.retreated, 'losing a fight: a normal bot breaks off, gets ' + dn.dz.toFixed(1) + ' m further away and dives into its own ink; an easy bot never retreats');
  // focus fire (hell): two bots, two enemies in sight - both pick the weaker one
  {
    const { B, E } = setup(2); const B2 = G.bots.find(b => b.c.team === 0 && b !== B); B2.update = B2._u; const E2 = CHARS.find(c => c.team === 1 && c !== E);
    B.c.pos.set(8, 2.2, 28); B2.c.pos.set(12, 2.2, 28); E.pos.set(7, 2.2, 18); E2.pos.set(13, 2.2, 18); E.maxHp = E2.maxHp = 2000; E.hp = 2000; E2.hp = 700;
    let same = 0; run(30 * 3, () => { E.pos.set(7, 2.2, 18); E2.pos.set(13, 2.2, 18); E.hp = 2000; E2.hp = 700; E.vel.set(0, 0, 0); E2.vel.set(0, 0, 0); if (B.enemy === E2 && B2.enemy === E2) same++; return false; });
    ok(G.squads[0].focus === E2 && same > 30, 'hell: the squad calls one target and both bots turn on the weaker enemy (' + same + ' of 90 frames together' + (same > 30 ? '' : '; focus ' + (G.squads[0].focus ? G.squads[0].focus.name : 'none') + ', seen ' + G.squads[0].seen.size) + ')');
  }
  // climbing (hell): ink a wall and swim up it
  {
    const { B } = setup(2); const c = B.c; let from = -1, to = -1, dir = 0;
    for (let n = 0; n < NAV.N && from < 0; n++) for (let d = 0; d < 8; d += 2) { const e = n * 8 + d, t = NAV.eT[e]; if (t >= 0 && (NAV.eF[e] & NF.CLIMB) && NAV.nh[t] - NAV.nh[n] > 1.6 && NAV.nh[t] - NAV.nh[n] < 3.2 && TAC.reach[0][n] >= 0 && Math.abs(NAV.nh[n] - TAC.street) < 0.1) { from = n; to = t; dir = d; break; } }
    const f = navPos(from), w = navPos(to); w.fl = NF.CLIMB; w.from = f;
    c.pos.set(f.x, f.y, f.z); c.vel.set(0, 0, 0); c.ink = 100; B.setPath([w]); B.target = w; B.retarget = 30;
    const fr = run(30 * 9, () => c.pos.y >= w.y - 0.25 && c.grounded);
    ok(from >= 0 && fr >= 0, 'hell: a bot inks a ' + (w.y - f.y).toFixed(1) + ' m wall and swims up it (' + (fr >= 0 ? (fr / 30).toFixed(1) + ' s' : 'stuck at y ' + c.pos.y.toFixed(1)) + ')');
  }
  // the tiers differ in what they know, not only in aim
  ok(DIFF[0].team === 0 && !DIFF[0].retreat && !DIFF[0].focus && DIFF[1].team === 1 && DIFF[1].retreat > 0 && !DIFF[1].focus && !DIFF[1].combo && DIFF[2].team === 2 && DIFF[2].focus && DIFF[2].combo > 0 && DIFF[2].ambush > DIFF[1].ambush && DIFF[2].err < DIFF[1].err && DIFF[1].err < DIFF[0].err, 'difficulty tiers: easy = every bot for itself, normal = retreats / basic teamwork, hell = focus fire, ambushes and combos');
  // ---------------- the two name-box modes (only when the names are supplied)
  if (!DEVC || !VIPC) res.push('SKIP name-box modes (set SR_CODES to check them)');
  if (DEVC) {
    const { E } = setup(1); const P = PLAYER; P.invulnT = 0; P.pos.set(0, 2.2, 20); for (let i = 0; i < 3; i++) loop();
    P.hp = P.maxHp; P.damage(40, E, 'rifle'); const hurt = P.hp < P.maxHp;
    const shoot = n => { P.ink = 100; P.fireCd = 0; Cam.yaw = Math.PI; Cam.pitch = 0; Input.fire = true; for (let i = 0; i < n; i++) loop(); Input.fire = false; return P.ink; };
    const inkNormal = shoot(45);
    GAME.name = ' ' + DEVC.toUpperCase() + ' '; P.hp = P.maxHp; P.damage(40, E, 'rifle'); P.damage(400, E, 'rifle'); const god = P.hp === P.maxHp && P.alive;
    const inkGod = shoot(45), w = WEAPONS[P.weapon.id]; Input.keys = {}; P.ink = 3; loop(); const refilled = P.ink > 95;
    GAME.name = 'tester'; P.damage(40, E, 'rifle'); const back = P.hp < P.maxHp;
    ok(hurt && god && back && inkNormal < 90 && inkGod > 95 && refilled, 'mode A: the player takes no damage and the ink tank stays full (after 1.5 s of firing: ' + inkGod.toFixed(0) + '% vs ' + inkNormal.toFixed(0) + '% normally); any other name plays as usual');
    // pressing Enter in the name box: the secret name switches the look on, another name switches it off again
    GAME.name = DEVC; nameConfirm(); const onCls = $('pnameWrap').classList.contains('dev'); GAME.name = '阿明'; nameConfirm(); const offCls = !$('pnameWrap').classList.contains('dev');
    ok(onCls && offCls, 'name box: Enter with the special name turns the stamp on, a normal name takes it off');
  }
  // ---------------- mode B: renames the player and gives four times the health and three times the ink
  if (VIPC) {
    quitToTitle(); for (let i = 0; i < 3; i++) loop();
    GAME.name = VIP_NAME; nameConfirm(); const byHand = vipOn();                        // typing the name itself does nothing
    GAME.name = VIPC.toUpperCase(); nameConfirm(); const named = GAME.name === VIP_NAME && vipOn() && Profile.data.vip === VIP_NAME && $('pnameWrap').classList.contains('vip') && !devGod();
    Profile.data.char = 'sa'; Profile.data.weapon = 'smg'; GAME.uniformChars = false; openLobby(); startMatch(); Input.locked = true; while (G.state !== 'play') loop();
    const P = PLAYER, hp = P.maxHp, ink = P.inkK, E = CHARS.find(c => c.team === 1); P.invulnT = 0; P.pos.set(0, 2.2, 20); for (let i = 0; i < 3; i++) loop(); P.hp = P.maxHp; P.damage(100, E, 'rifle');
    const bot = G.bots.find(b => b.c.cs === P.cs); quitToTitle(); for (let i = 0; i < 3; i++) loop();
    GAME.name = '阿明'; nameConfirm(); const off = !vipOn() && !Profile.data.vip && !$('pnameWrap').classList.contains('vip');
    openLobby(); startMatch(); while (G.state !== 'play') loop(); const hp2 = PLAYER.maxHp; quitToTitle(); for (let i = 0; i < 3; i++) loop();
    ok(!byHand && named && hp === CHARACTERS.sa.hp * 4 && Math.abs(ink - CHARACTERS.sa.inkCap * 3) < 1e-6 && P.alive && off && hp2 === CHARACTERS.sa.hp && (!bot || bot.c.maxHp === bot.c.cs.hp), 'mode B: renames the player, ' + hp + ' health (x4) and a x3 ink tank, survives a 100-damage hit; bots are unchanged; another name switches it off');
    GAME.uniformChars = true;
  }
  G.aiLevels = null; quitToTitle(); for (let i = 0; i < 5; i++) loop();
  return res;
};
const codes = (process.env.SR_CODES || ',').split(',');
const out = vm.runInContext('(' + tests.toString() + ')(' + JSON.stringify(codes[0] || '') + ',' + JSON.stringify(codes[1] || '') + ')', g);
out.forEach(l => console.log(l));
const fails = out.filter(l => l.startsWith('FAIL')).length;
if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL AI TESTS PASSED');
