#!/usr/bin/env node
/*  Bot checks (headless): the nav graph on all three maps (stairs, bridges, no one-way
    traps), getting out of the canal, retreating, focus fire, wall climbing, the four
    tiers, what a bot sees, hears and remembers, how its aim settles, who it picks.  With SR_CODES="a,b" (the two special names) it also checks the two name-box modes.
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
  // ---------------- levels between the tiers
  {
    const same = [0, 1, 2].every(k => diffAt(k) === DIFF[k]), mid = diffAt(0.5);
    const between = ['err', 'react', 'turn', 'fireHold', 'dodge', 'fov', 'hear', 'settle'].every(k => mid[k] >= Math.min(DIFF[0][k], DIFF[1][k]) - 1e-9 && mid[k] <= Math.max(DIFF[0][k], DIFF[1][k]) + 1e-9);
    let mono = true; for (let l = 0; l < LV_MAX - 0.01; l += 0.05) { const a = diffAt(l), b = diffAt(l + 0.05); if (b.err > a.err + 1e-9 || b.react > a.react + 1e-9 || b.turn < a.turn - 1e-9 || b.fov < a.fov - 1e-9 || b.hear < a.hear - 1e-9 || b.settle > a.settle + 1e-9) mono = false; }
    const know = !diffAt(1.5, false).focus && diffAt(1.5, true).focus && diffAt(1.5, true).team === 2 && !diffAt(0.3, false).retreat && diffAt(0.3, true).retreat > 0;
    const past = diffAt(2.4).err < DIFF[2].err && diffAt(2.4).react < DIFF[2].react && diffAt(2.4).focus === DIFF[2].focus && diffAt(2.4).team === 2;
    const o = {}; let up = 0; for (let i = 0; i < 2000; i++) { o.brainT = 0; if (Director.brain(o, 1.5)) up++; }
    ok(same && between && mono && know && past && Math.abs(up / 2000 - 0.5) < 0.04, 'levels: 0 / 1 / 2 are exactly the easy / normal / hell rows; in between aim, reflexes and senses blend, and a 1.5 (hard) thinks like hell ' + Math.round(up / 20) + ' % of the time; past 2 the hands keep sharpening');
  }
  {
    const { B } = setup(1); const E = G.bots.find(b => b.c.team === 1);
    ok(botDiff(0, B) === DIFF[1] && botDiff(1, E) === DIFF[1] && botDiff(1) === DIFF[1] && !Director.on && Director.endWindow() === 30, 'fixed rows for tests: with G.aiLevels set to normal every bot plays the normal row and the all-out push stays at 30 s');
  }
  {
    const r = [90, 180, 300].map(d => { GAME.dur = d; Director.reset(); return [Director.calibT, Director.endWin]; }); GAME.dur = 180;
    ok(JSON.stringify(r) === '[[30,20],[45,30],[60,40]]', 'match length: calibration window 30 / 45 / 60 s and the all-out push 20 / 30 / 40 s for 1:30 / 3:00 / 5:00 (' + JSON.stringify(r) + ')');
  }
  // ---------------- the four tiers: fixed levels, each bot a person, teammates a step below - and nothing that goes easy on anyone
  {
    setup(1); const D = Director, gd = GAME.diff, P = PLAYER; G.aiLevels = null;
    const names = TIERS.map(t => t.name).join(), lvls = TIERS.map(t => t.lv).join();
    let inside = true, gap = 0, n = 0, spread = 0, traits = true;
    for (let t = 0; t < 4; t++) for (let k = 0; k < 12; k++) {
      GAME.diff = t; D.reset(); const L = TIERS[t].lv, M = TIERS[t].mates, foes = D.enemies().map(b => b.lv), mates = D.bots().filter(b => b.c.team === P.team).map(b => b.lv);
      if (foes.some(v => v < L - 0.15 - 1e-9 || v > L + 0.15 + 1e-9) || mates.some(v => v < M - 0.15 - 1e-9 || v > M + 0.15 + 1e-9)) inside = false;
      gap += avgOf(foes) - avgOf(mates); n++; spread += Math.max(...foes) - Math.min(...foes);
      if (!D.bots().every(b => b.trait && Math.abs(b.trait.aggr) <= 1 && Math.abs(b.trait.care) <= 1)) traits = false;
    }
    const mlv = TIERS.map(t => t.mates).join(), maim = TIERS.map(t => t.mateAim).join();
    ok(names === '轻松,普通,困难,地狱' && lvls === '0.3,1,1.5,2' && mlv === '0.2,0.85,1.2,1.35' && inside && Math.abs(gap / n - avgOf(TIERS.map(t => t.lv - t.mates))) < 0.05 && spread / n > 0.1 && traits, 'tiers: enemies 轻松 0.3 · 普通 1.0 · 困难 1.5 · 地狱 2.0, the player\'s teammates 0.2 · 0.85 · 1.2 · 1.35 (they do not climb with the tier), each bot within ±0.15 of its own and with its own temperament');
    // the teammates are the supporting cast: they shoot wider than their level would (not on easy); the enemies and the player do not
    const aimBy = t => { GAME.diff = t; D.reset(); const m = D.bots().find(b => b.c.team === P.team), f = D.enemies()[0]; m.acqT = f.acqT = G.time - 9; m.c.lastHurt = f.c.lastHurt = -99; return [m.aimK(DIFF[1]), f.aimK(DIFF[1])]; };
    const [mE, fE] = aimBy(0), [mH, fH] = aimBy(3);
    ok(Math.abs(mE - fE) < 1e-6 && mH > fH * 1.2 && Math.abs(D.aimOf(P) - 1) < 1e-9, 'teammates: on hell they shoot ' + (mH / fH).toFixed(1) + 'x wider than an enemy of the same level (they still paint as usual); on easy as straight as anyone; the player is never touched');
    // the levels stay put: however the player is judged and whatever the score
    GAME.diff = 1; D.reset(); const before = D.bots().map(b => b.lv).join(), sig = D.signals;
    D.signals = function () { this.skill = 2.4; }; run(90); const vsStrong = D.bots().map(b => b.lv).join();
    D.signals = function () { this.skill = 0.1; }; const tc = Paint.teamCells.slice(), tot = Paint.total; Paint.teamCells[P.team] = Math.round(tot * 0.1); Paint.teamCells[1 - P.team] = Math.round(tot * 0.6); run(90); const crushed = D.bots().map(b => b.lv).join();
    const pfE = D.paintFocus(1 - P.team), pfM = D.paintFocus(P.team);
    Paint.teamCells[P.team] = Math.round(tot * 0.6); Paint.teamCells[1 - P.team] = Math.round(tot * 0.1); D.steer(); const pfE2 = D.paintFocus(1 - P.team), pfM2 = D.paintFocus(P.team);
    Paint.teamCells[0] = tc[0]; Paint.teamCells[1] = tc[1]; D.signals = sig;
    ok(before === vsStrong && before === crushed && pfE < 0 && pfM > 0 && pfE2 > 0 && pfM2 < 0, 'no adapting, no mercy: the bots\' levels do not move for a player judged 2.4 or 0.1, nor with the player\'s side crushed 10 % to 60 %; both sides just play the score (behind takes ground, ahead holds it)');
    const gone = ['canShoot', 'aimPoint', 'errK', 'holdOff', 'updateSupport', 'tokens'].every(k => !(k in Combat)) && ['posture', 'rangeK', 'turfBias', 'waveHunters', 'set'].every(k => !(k in Pacing)) && !('mateEaseOf' in D) && typeof SMART === 'undefined';
    ok(gone, 'no help hidden anywhere: no attack tokens, warning shots, breathers or backup; no pacing of the bots; no smart mode');
    // the strategist leans in harder the higher the tier; easy never counters
    const ks = [0, 1, 2, 3].map(t => { GAME.diff = t; D.reset(); D.pf = [0, 0]; for (const tm of [0, 1]) D.teamRow[tm] = diffAt(D.teamLevel(tm), true); return Strategist.intensity(); });
    ok(ks[0] === 0 && ks[1] > 0 && ks[2] > ks[1] && ks[3] >= ks[2] && ks[3] === 1, 'counters by tier: easy none, normal ' + Math.round(ks[1] * 100) + ' %, hard ' + Math.round(ks[2] * 100) + ' %, hell in full');
    GAME.diff = gd;
  }
  // an old save: the old hell (2) becomes 地狱 (3), the old smart mode (-1) becomes 普通
  {
    const keep = JSON.parse(JSON.stringify(Profile.data)), gd = GAME.diff, load = d => { globalThis.localStorage = { getItem: () => JSON.stringify(Object.assign({}, keep, d)), setItem() { } }; Profile.load(); delete globalThis.localStorage; return GAME.diff; };
    const r = [load({ diff: 2, dv: undefined }), load({ diff: -1, dv: undefined }), load({ diff: 0, dv: undefined }), load({ diff: 2, dv: 2 }), load({ diff: 3, dv: 2 })];
    Profile.data = keep; GAME.diff = gd;
    ok(r.join() === '3,1,0,2,3', 'old saves: hell stays hell (2 -> 3), smart becomes normal, easy stays easy; new saves keep 困难 2 and 地狱 3 (' + r.join() + ')');
  }
  // ---------------- perception: what a bot notices
  {
    let P = PLAYER; const look = (lv, yaw, dz, f) => { const { B } = setup(lv); P = PLAYER; const F = G.bots.find(b => b.c.team !== P.team); P.pos.set(0, 2.2, 20); P.vel.set(0, 0, 0); P.lastShot = -99; F.c.pos.set(0, 2.2, 20 - dz); F.c.aimYaw = yaw; F.c.lastHurt = -99; F.alert = null; F.enemy = null; if (f) f(F); return [F, F.findEnemy()]; };
    const see = (...a) => look(...a)[1] === PLAYER, front = see(1, 0, 12), behind = see(1, Math.PI, 12), side = see(1, 1.0, 12), sideEasy = see(0, 1.0, 12), close = see(1, Math.PI, 2);
    ok(front && !behind && side && !sideEasy && close, 'sight: a bot sees the player in front of it, not behind it; ' + Math.round(DIFF[1].fov * 57.3) + '° to the side normal notices, easy (' + Math.round(DIFF[0].fov * 57.3) + '°) does not; right beside it (2 m) it always does');
    const hears = lv => { const [F, e] = look(lv, Math.PI, 15, () => { PLAYER.lastShot = G.time; }); return !e && !!F.alert && F.alert.e === PLAYER; };
    const [Fq, eq] = look(2, Math.PI, 15);
    ok(hears(2) && !hears(0) && !eq && !Fq.alert, 'hearing: the player shooting 15 m behind a bot is heard on hell (' + DIFF[2].hear + ' m) - as a noise to turn to, not a target - but not on easy (' + DIFF[0].hear + ' m); keeping quiet is not heard at all');
    // turning on a noise: the bot turns round and picks the player out, quicker the better it is
    const turn = (lv, how) => { const [F] = look(lv, 0, 12); const P = PLAYER; F.c.pos.set(0, 2.2, 25); P.pos.set(0, 2.2, 13); F.update = F._u; F.c.ink = 100; let t = -1; run(30 * 4, i => { P.pos.set(0, 2.2, 13); P.vel.set(0, 0, 0); P.hp = P.maxHp; if (how === 'shoot') P.lastShot = G.time; else if (i < 3) { F.c.lastHurt = G.time; F.c.lastAttacker = P; } if (F.enemy === P) { t = i / 30; return true; } return false; }); return t; };
    const tShotN = turn(1, 'shoot'), tShotH = turn(2, 'shoot'), tShotE = turn(0, 'shoot'), tHit = turn(0, 'hit');
    ok(tShotN > 0.2 && tShotN < 2 && tShotH > 0 && tShotH < tShotN && tShotE < 0 && tHit > 0.2 && tHit < 3, 'turning round: shooting 12 m behind a bot (toward its own base, so it would not turn that way by itself), normal turns and picks the player out in ' + tShotN.toFixed(1) + ' s, hell in ' + tShotH.toFixed(1) + ' s, easy does not hear it (' + tShotE + '); shot in the back, even easy turns round (' + tHit.toFixed(1) + ' s)');
  }
  // memory: someone lost from sight is looked for a while (longer, the better the bot), and picked up again quicker
  {
    let P = PLAYER; const mem = lv => { const { B } = setup(lv); P = PLAYER; const F = G.bots.find(b => b.c.team !== P.team); P.pos.set(0, 2.2, 20); F.c.pos.set(0, 2.2, 8); F.c.aimYaw = 0; F.update = F._u; F.c.lastHurt = -99; F.scanT = 0; run(10); const had = F.enemy === P;
      P.inBarrierT = 0; const sx = P.pos.x; P.pos.set(60, 2.2, 20); F.scanT = 0; run(2); const st = F.dState, lost = !F.enemy && F.alert && F.alert.e === P; let kept = 0; run(30 * 6, () => { P.pos.set(60, 2.2, 20); if (F.dState === 'alert') kept += 1 / 30; return false; });
      P.pos.set(sx, 2.2, 20); return { had, lost: lost && st === 'alert', kept }; };
    const n = mem(1), h = mem(2), e = mem(0);
    ok(n.had && n.lost && h.lost && e.lost && e.kept < n.kept && n.kept < h.kept, 'memory: losing sight of the player, a bot remembers where they were and keeps looking - easy ' + e.kept.toFixed(1) + ' s, normal ' + n.kept.toFixed(1) + ' s, hell ' + h.kept.toFixed(1) + ' s');
    const { B } = setup(1); const D = DIFF[1]; B.alert = { e: PLAYER, d: 10, x: 0, y: 2, z: 20, t: G.time, t0: G.time - 9 }; B.enemy = null; B.findEnemy = () => PLAYER; B.scanT = 0; B.update(1 / 30); const knownR = B.reactT, knownA = G.time - B.acqT;
    B.enemy = null; B.alert = null; B.scanT = 0; B.update(1 / 30); const freshR = B.reactT; B.findEnemy = Bot.prototype.findEnemy;
    ok(knownA > 0.25 && freshR - knownR > -0.1 && knownR < D.react * 1.3 * 0.5 + 0.05, 'memory: someone the bot was already looking for is picked up again with half the reaction time (' + knownR.toFixed(2) + ' s vs ' + freshR.toFixed(2) + ' s), its aim half settled');
  }
  // ---------------- aim: wide on someone just picked out, settling in; thrown off by being hit; leading a moving target by level
  {
    const { B } = setup(1); const T = G.time, k = (row, t, hurt) => { B.acqT = T - t; B.c.lastHurt = hurt ? T : -99; return B.aimK(row); };
    const e0 = k(DIFF[0], 0.5), n0 = k(DIFF[1], 0.5), h0 = k(DIFF[2], 0.5), first = k(DIFF[1], 0), settled = k(DIFF[2], 1.5), hitE = k(DIFF[0], 3, true), hitH = k(DIFF[2], 3, true);
    ok(Math.abs(first - 2.5) < 0.01 && e0 > n0 && n0 > h0 && settled < 1.01 && hitE > 1.9 && hitH < 1.3 && DIFF[0].lead < DIFF[1].lead && DIFF[1].lead < DIFF[2].lead, 'aim: on someone just picked out a bot shoots 2.5x wide and settles in - after 0.5 s easy ' + e0.toFixed(2) + 'x, normal ' + n0.toFixed(2) + 'x, hell ' + h0.toFixed(2) + 'x; being hit throws it off (easy ' + hitE.toFixed(1) + 'x, hell ' + hitH.toFixed(2) + 'x); it leads a moving target ' + DIFF[0].lead + ' / ' + DIFF[1].lead + ' / ' + DIFF[2].lead);
  }
  // ---------------- decisions: who to take on
  {
    const pickOf = (lv, f) => { const { B } = setup(lv); const [E1, E2] = CHARS.filter(c => c.team === 1); B.c.pos.set(10, 2.2, 30); B.c.aimYaw = Math.PI; B.c.lastHurt = -99; B.enemy = null; E1.pos.set(8, 2.2, 20); E2.pos.set(12.5, 2.2, 19); [E1, E2].forEach(e => { e.vel.set(0, 0, 0); e.hp = e.maxHp; e.ink = 100; }); f(E1, E2); return B.findEnemy() === E2 ? 'far' : 'near'; };
    const wounded = (a, b) => { b.hp = b.maxHp * 0.3; }, trade = (a, b) => { CHARS.find(c => c.team === 0 && !c.isPlayer && c !== G.bots.find(x => x.c.team === 0).c).dmgBy.set(b, G.time); };
    const r = { woundedN: pickOf(1, wounded), woundedE: pickOf(0, wounded), tradeN: pickOf(1, trade), plain: pickOf(1, () => { }) };
    ok(r.woundedN === 'far' && r.woundedE === 'near' && r.tradeN === 'far' && r.plain === 'near', 'decisions: past easy a bot goes for the hurt enemy over a nearer healthy one, and for the one who has just hit a teammate (trading); easy just shoots the nearest (' + JSON.stringify(r) + ')');
  }
  // ---------------- tension drives the music, and nothing else; the panel
  {
    setup(1); const Pc = Pacing, P = PLAYER, gd = GAME.diff; G.aiLevels = null; GAME.diff = 1; Director.reset(); Pc.reset(); let e = null; const me = Sfx.musicEnergy; Sfx.musicEnergy = v => { e = v; };
    P.pos.set(0, 2.2, 20); Pc.tension = 0; Pc.update(1 / 30); const calm = e; Pc.tension = 0.9; Pc.update(1 / 30); const tense = e; Sfx.musicEnergy = me;
    ok(calm < 0.4 && tense > 0.85, 'music: follows the player\'s tension (calm ' + calm.toFixed(2) + ', in a fight ' + tense.toFixed(2) + ')');
    DirPanel.view = 0; DirPanel.toggle(); const compact = DirPanel.render(); DirPanel.toggle(); const full = DirPanel.render(); DirPanel.toggle();
    ok(['dp-ruler', '普通', '紧张度', '比分', '盯你'].every(k => compact.includes(k)) && !compact.includes('dp-bots') && ['dp-cols', '发挥估计', '最近交火', 'dp-bots', '本局固定'].every(k => full.includes(k)) && !/节奏|投入|兜底|防碾压/.test(full) && DirPanel.view === 0, 'director panel: first press the essentials (tier, levels, tension, score, who is on the player, the other side), second press the details; nothing about rhythm, effort or safety nets any more');
    GAME.diff = gd;
  }
  // judging duels (panel only): beating an equal is worth more than beating a weaker bot; losing 1 v 2 barely counts
  {
    const D = Director, f = lv => ({ e: { name: 'x' }, lv, out: 1 }), go = (lv, o, w) => { D.elo = 1; D.n = 4; D.resolve(f(lv), o, w); return D.elo - 1; };
    const up = go(1, 1, 1), down = -go(1, 0, 1), upWeak = go(0.3, 1, 1), downStrong = -go(1.7, 0, 1);
    const { E } = setup(1); G.aiLevels = null; const E2 = CHARS.find(c => c.team === 1 && c !== E), P = PLAYER; P.invulnT = 0; P.pos.set(0, 2.2, 20); for (let i = 0; i < 3; i++) loop();
    P.damage(40, E); P.damage(40, E2); P.damage(200, E); const w2 = D.log.slice(0, 2).map(l => l.w);
    ok(up > 0 && down > 0 && upWeak < up * 0.8 && downStrong < down * 0.8 && w2.length === 2 && w2.every(w => w === 0.2), 'judging duels: a win over an equal moves the estimate ' + up.toFixed(3) + ', over a weaker bot only ' + upWeak.toFixed(3) + '; a loss to a stronger bot costs less than to an equal; a knock-out by two at once counts 0.2 each' + (w2.length === 2 && w2.every(w => w === 0.2) ? '' : ' [got ' + JSON.stringify(w2) + ']'));
  }
  // the estimate is kept between matches (per loadout) - and the bots pay it no attention
  {
    setup(1); const D = Director, gd = GAME.diff; G.aiLevels = null; GAME.diff = 1; Profile.data.skill = undefined; const key = D.key, rec = () => Profile.data.skill[key].s;
    D.skill = 0.62; D.nm = 6; D.st.alive = 120; D.save(); const saved = Profile.data.skill && Profile.data.skill[key] ? rec() : null;
    const next = () => { quitToTitle(); for (let i = 0; i < 3; i++) loop(); openLobby(); startMatch(); while (G.state !== 'play') loop(); G.aiLevels = null; };
    next(); const start = D.skill, lvs = D.enemies().map(b => b.lv);
    D.skill = 1.2; D.nm = 8; D.st.alive = 150; D.save(); const second = rec();
    next(); D.skill = 2.0; D.nm = 1; D.st.alive = 45; D.save(); const short = rec();
    next(); const nm = GAME.name, vip = Profile.data.vip; Profile.data.vip = VIP_NAME; GAME.name = VIP_NAME; loop(); D.skill = 2.3; D.nm = 9; D.st.alive = 150; D.save(); const cheat = rec(), flagged = D.cheat;
    GAME.name = nm; Profile.data.vip = vip;
    ok(saved === 0.62 && start === 0.62 && D.mem && lvs.every(v => v >= 0.85 - 1e-9 && v <= 1.15 + 1e-9) && second === 0.85 && short > second && short < 0.95 && flagged && cheat === short, 'memory: the estimate is saved (' + saved + ') and the next match starts its estimate from it - the bots stay at the tier\'s level; then a rolling average (a full match judged 1.2 -> ' + second + ', a short one judged 2.0 -> only ' + short + '); a match with a name-box mode on is left out');
    const ch0 = Profile.data.char, w0 = Profile.data.weapon; Profile.data.char = 'dun'; Profile.data.weapon = 'splatling';
    next(); const dunKey = D.key, dunStart = D.skill, dunMem = D.mem; D.skill = 1.7; D.nm = 8; D.st.alive = 150; D.save();
    Profile.data.char = ch0; Profile.data.weapon = w0; next(); const backKey = D.key, back = D.skill;
    ok(dunKey === 'dun-splatling' && !dunMem && Math.abs(dunStart - short) < 1e-9 && backKey === key && Math.abs(back - short) < 1e-9, 'per loadout: 石墩·加特林 starts from the other loadouts (' + dunStart.toFixed(2) + ') and is then saved on its own; going back, ' + key + ' still starts from ' + back.toFixed(2));
    Profile.data.skill = undefined; GAME.diff = gd;
  }
  // ---------------- jobs by what each bot carries
  {
    const r1 = rolesFor(['rifle', 'smg', 'charger', 'splatling']), r2 = rolesFor(['rifle', 'rifle', 'rifle']), r3 = rolesFor(['charger', 'rifle', 'smg']);
    setup(1); const fromMatch = G.bots.every(b => b.role0 === rolesFor(G.roster[b.c.team].filter(m => !m.isPlayer).map(m => m.weapon))[G.roster[b.c.team].filter(m => !m.isPlayer).findIndex(m => m.name === b.c.name)]);
    ok(r1.join() === 'home,flank,mid,front' && r2.join() === 'front,mid,home' && r3.join() === 'mid,front,flank' && fromMatch, 'jobs by what they carry: SMG -> round the side, sniper -> the middle (and its high ground), gatling -> the front line, rifles fill front / middle / home (' + r1.join(' ') + '); every bot in a match gets its own');
    const S = Strategist; GAME.dur = 90; const w90 = S.warmup(); GAME.dur = 180; const w180 = S.warmup();
    ok(Math.abs(w180 - 20) < 1e-9 && w90 < 15 && w90 > 13, 'reading the player starts after ' + w180.toFixed(0) + ' s at 3:00 and ' + w90.toFixed(1) + ' s at 1:30');
    setup(1); G.aiLevels = null; GAME.diff = 1; const tm = 1 - PLAYER.team, team = G.bots.filter(b => b.c.team === tm);
    const smg = team[2]; smg.c.weapon = WEAPONS.smg; team.forEach(b => b.task = null); S.prof = { lane: 1 }; S.give(tm, ['flank']); const flanker = team.find(b => b.task && b.task.id === 'flank'); smg.c.weapon = WEAPONS.rifle;
    ok(flanker === smg, 'the strategist sends the SMG one to go round the side');
    G.aiLevels = null;
  }
  // ---------------- the strategist: reading the player and picking a plan against it
  {
    setup(1); G.aiLevels = null; GAME.diff = 3; const S = Strategist, D = Director; D.reset(); for (let i = 0; i < 3; i++) loop();
    const fresh = () => { S.fs = 0.3; S.depth = 0; S.lanes = [1 / 3, 1 / 3, 1 / 3]; S.choke = TAC.chokes.map(() => 0); S.hist = []; S.plan = null; S.planT = -99; D.raw = { paint: 0 }; };
    const pick = f => { fresh(); f(); S.choose(); return S.plan; };
    const zi = S.zones.findIndex(z => depthOf(S.team(), z.z) < 0), turn = i => S.zones.map((_, k) => k === zi ? [0.8 - i * 0.04, 0.1 + i * 0.04] : [0.3, 0.3]);
    const got = { hunter: pick(() => { S.fs = 0.7; }), painter: pick(() => { S.fs = 0.05; }), diver: pick(() => { S.depth = 0.6; }),
      steady: pick(() => { S.lanes = [0.05, 0.9, 0.05]; S.choke[0] = 0.6; }), flipper: pick(() => { for (let i = 0; i < 12; i++) S.hist.push(turn(i)); }), nothing: pick(() => { }) };
    const want = { hunter: 'paint', painter: 'hunt', diver: 'flank', steady: 'block', flipper: 'retake', nothing: null };
    ok(Object.keys(want).every(k => got[k] === want[k]), 'strategist: reads the player and counters - hunts people -> 抢地, paints and avoids fights -> 围猎, dives deep -> 绕后, keeps to one route -> 封路, flips their side -> 反推, nothing clear -> no plan (' + JSON.stringify(got) + ')');
    fresh(); S.fs = 0.45; S.choose(); const first = S.plan; S.depth = 0.6; S.choose(); const held = S.plan; S.planT = G.time - 60; S.choose(); const later = S.plan;
    ok(first === 'paint' && held === 'paint' && later === 'flank', 'strategist: a plan is kept for ~18 s even when another one starts to look better, then it switches (' + [first, held, later].join(' -> ') + ')');
    fresh(); S.fs = 0.05; S.choose(); const tm = S.team();
    for (const b of G.bots) b.lv = 2; D.squadBrain[tm].lv = null; D.update(0);
    const steer = D.steer; D.pf = [0, 0]; D.steer = () => { }; S.assign(); const close = G.bots.filter(b => b.c.team === tm && b.task && b.task.id === 'hunt').length, kClose = S.k;
    D.pf[tm] = 0.6; S.assign(); const behind = G.bots.filter(b => b.c.team === tm && b.task).length; D.pf[tm] = -0.6; S.assign(); const ahead = G.bots.filter(b => b.c.team === tm && b.task).length; D.steer = steer;
    ok(close === 2 && kClose > 0 && behind === 0 && ahead === 0 && G.bots.every(b => b.c.team === tm || !b.task), 'strategist (hell): in a close game ' + close + ' bots go together to hunt a player who avoids fights (strength ' + Math.round(kClose * 100) + ' %); once the score runs away either way they play the score instead; teammates never get one');
    D.pf = [0, 0]; const H = G.bots.find(b => b.c.team === tm), M = G.bots.find(b => b.c.team !== tm);
    H.c.pos.set(10, 2.2, 25); H.c.aimYaw = Math.PI; PLAYER.pos.set(10, 2.2, 14); M.c.pos.set(10.5, 2.2, 20); M.hp = M.maxHp; H.task = null; H.enemy = null; const plain = H.findEnemy();
    H.task = { id: 'hunt', x: 10, z: 14, r: 7, bonus: 5 }; const hunter = H.findEnemy(); H.task = null;
    ok(plain === M.c && hunter === PLAYER, 'strategist: a bot sent to hunt picks the player over a nearer enemy (without the job: ' + (plain === M.c ? 'the nearer one' : plain ? plain.name : 'nobody') + ')');
    GAME.diff = 1;
  }
  {
    setup(1); run(60); const tasks = G.bots.filter(b => b.task || Strategist.taskId(b)).length;
    ok(!Strategist.on && tasks === 0, 'strategist: off with fixed rows - nobody gets a plan');
  }
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
