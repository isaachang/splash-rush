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
  // ---------------- smart difficulty (the Director)
  {
    const same = [0, 1, 2].every(k => diffAt(k) === DIFF[k]), mid = diffAt(0.5);
    const between = ['err', 'react', 'turn', 'fireHold', 'dodge'].every(k => mid[k] >= Math.min(DIFF[0][k], DIFF[1][k]) - 1e-9 && mid[k] <= Math.max(DIFF[0][k], DIFF[1][k]) + 1e-9);
    let mono = true; for (let l = 0; l < LV_MAX - 0.01; l += 0.05) { const a = diffAt(l), b = diffAt(l + 0.05); if (b.err > a.err + 1e-9 || b.react > a.react + 1e-9 || b.turn < a.turn - 1e-9) mono = false; }
    const know = !diffAt(1.3, false).focus && diffAt(1.3, true).focus && diffAt(1.3, true).team === 2 && !diffAt(0.3, false).retreat && diffAt(0.3, true).retreat > 0;
    const past = diffAt(2.4).err < DIFF[2].err && diffAt(2.4).react < DIFF[2].react && diffAt(2.4).focus === DIFF[2].focus && diffAt(2.4).team === 2;
    const o = {}; let up = 0; for (let i = 0; i < 2000; i++) { o.brainT = 0; if (Director.brain(o, 1.3)) up++; }
    ok(same && between && mono && know && past && Math.abs(up / 2000 - 0.3) < 0.04, 'smart difficulty: levels 0 / 1 / 2 are exactly the three tiers; in between, aim and reflexes blend smoothly, and a 1.3 thinks like hell (focus fire, full teamwork) ' + Math.round(up / 20) + ' % of the time; up to 2.5 the aim keeps sharpening past hell');
  }
  {
    const { B } = setup(1); const E = G.bots.find(b => b.c.team === 1);
    ok(botDiff(0, B) === DIFF[1] && botDiff(1, E) === DIFF[1] && botDiff(1) === DIFF[1] && !Director.on && Director.endWindow() === 30, 'fixed rows for tests: with G.aiLevels set to normal every bot plays the normal row and the all-out push stays at 30 s');
  }
  {
    const r = [90, 180, 300].map(d => { GAME.dur = d; Director.reset(); return [Director.calibT, Director.endWin]; }); GAME.dur = 180;
    ok(JSON.stringify(r) === '[[30,20],[45,30],[60,40]]', 'match length: calibration window 30 / 45 / 60 s and the all-out push 20 / 30 / 40 s for 1:30 / 3:00 / 5:00 (' + JSON.stringify(r) + ')');
  }
  // how fast each enemy moves toward the target: slowly in a fight with the player, quickly out of sight, at once when knocked out
  {
    GAME.dur = 180; setup(SMART); const D = Director, sig = D.signals; D.signals = function () { this.skill = 2; }; D.skill = 2;
    const en = G.bots.filter(b => b.c.team === 1), [f, a, k] = en; for (const b of G.bots) b.lv = 1;
    f.enemy = PLAYER; k.c.die(null);
    run(30); D.signals = sig;
    const df = f.lv - 1, da = a.lv - 1, kd = Math.sqrt(180 / GAME.dur);
    ok(f.dState === 'fight' && df > 0 && df <= D.RATE.fight * kd * 1.05 + 1e-3 && a.dState === 'away' && da > df * 4 && Math.abs(k.lv - 2) < 1e-9, 'smart: in 1 s toward a harder target, the enemy fighting the player moves ' + df.toFixed(3) + ', one out of sight ' + da.toFixed(3) + ', a knocked-out one jumps straight to it (' + k.lv.toFixed(2) + ')');
  }
  // judging duels: beating an equal is worth more than beating someone the Director had already made weaker; losing 1 v 2 barely counts
  {
    const D = Director, f = lv => ({ e: { name: 'x' }, lv, out: 1 }), go = (lv, o, w) => { D.elo = 1; D.n = 4; D.resolve(f(lv), o, w); return D.elo - 1; };
    const up = go(1, 1, 1), down = -go(1, 0, 1), upWeak = go(0.3, 1, 1), downStrong = -go(1.7, 0, 1);
    const { E } = setup(SMART); const E2 = CHARS.find(c => c.team === 1 && c !== E), P = PLAYER; P.invulnT = 0; P.pos.set(0, 2.2, 20); for (let i = 0; i < 3; i++) loop();
    P.damage(40, E); P.damage(40, E2); P.damage(200, E); const w2 = D.log.slice(0, 2).map(l => l.w);
    ok(up > 0 && down > 0 && upWeak < up * 0.8 && downStrong < down * 0.8 && w2.length === 2 && w2.every(w => w === 0.2), 'judging duels: a win over an equal moves the estimate ' + up.toFixed(3) + ', over a weakened enemy only ' + upWeak.toFixed(3) + '; a loss to a stronger enemy costs less than to an equal; a knock-out by two at once counts 0.2 each' + (w2.length === 2 && w2.every(w => w === 0.2) ? '' : ' [got ' + JSON.stringify(w2) + ', loss vs stronger ' + downStrong.toFixed(3) + ' vs equal ' + down.toFixed(3) + ']'));
  }
  // the estimate is kept between matches and the next one starts from it
  {
    setup(SMART); const D = Director, gd = GAME.diff; G.aiLevels = null; GAME.diff = SMART; Profile.data.skill = undefined; const key = D.key, rec = () => Profile.data.skill[key].s;
    D.skill = 0.62; D.nm = 6; D.st.alive = 120; D.save(); const saved = Profile.data.skill && Profile.data.skill[key] ? rec() : null;
    const next = () => { quitToTitle(); for (let i = 0; i < 3; i++) loop(); openLobby(); startMatch(); while (G.state !== 'play') loop(); G.aiLevels = null; };
    next(); const start = D.skill, lvs = G.bots.map(b => b.lv);
    // second match: a full one judged 1.2 -> 0.6 x 0.62 + 0.4 x 1.2; a short one with few fights counts for less
    D.skill = 1.2; D.nm = 8; D.st.alive = 150; D.save(); const second = rec();
    next(); D.skill = 2.0; D.nm = 1; D.st.alive = 45; D.save(); const short = rec();
    // a match with a name-box mode on: judged as usual on the panel, kept out of the saved level
    next(); const nm = GAME.name, vip = Profile.data.vip; Profile.data.vip = VIP_NAME; GAME.name = VIP_NAME; loop(); D.skill = 2.3; D.nm = 9; D.st.alive = 150; D.save(); const cheat = rec(), flagged = D.cheat;
    GAME.name = nm; Profile.data.vip = vip;
    ok(saved === 0.62 && start === 0.62 && D.mem && lvs.every(v => v === 0.62) && second === 0.85 && short > second && short < 0.95 && flagged && cheat === short, 'memory: the first match is saved as it is (' + saved + ') and the next match - every bot included - starts from it; after that a rolling average (a full match judged 1.2 -> ' + second + ', a short one judged 2.0 -> only ' + short + '); a match with a name-box mode on is left out (' + cheat + ')');
    // a different character + weapon keeps its own level: the first match with it starts from the others, then it goes its own way
    const ch0 = Profile.data.char, w0 = Profile.data.weapon; Profile.data.char = 'dun'; Profile.data.weapon = 'splatling';
    next(); const dunKey = D.key, dunStart = D.skill, dunSeed = D.seed, dunMem = D.mem; D.skill = 1.7; D.nm = 8; D.st.alive = 150; D.save();
    Profile.data.char = ch0; Profile.data.weapon = w0; next(); const backKey = D.key, back = D.skill;
    // a save from before (one value for everything) only seeds loadouts never played
    Profile.data.skill = { s: 1.3, m: 3 }; Profile.data.char = 'sa'; Profile.data.weapon = 'smg'; next(); const oldSeed = D.skill, oldMem = D.mem;
    Profile.data.char = ch0; Profile.data.weapon = w0;
    ok(dunKey === 'dun-splatling' && !dunMem && Math.abs(dunStart - short) < 1e-9 && Math.abs(dunSeed - short) < 1e-9 && backKey === key && Math.abs(back - short) < 1e-9 && Math.abs(oldSeed - 1.3) < 1e-9 && !oldMem,
      'per loadout: 石墩·加特林 starts from the other loadouts (' + dunStart.toFixed(2) + ') and is then saved on its own (1.7); going back, ' + key + ' still starts from ' + back.toFixed(2) + '; an old single save only seeds new loadouts');
    Profile.data.skill = undefined; GAME.diff = gd;
  }
  // ---------------- the tiers: each moves within its own range; hell never goes easy on a player who is behind
  {
    setup(SMART); const D = Director, S = Strategist, gd = GAME.diff, sig = D.signals, tc = Paint.teamCells.slice(), tot = Paint.total, me = PLAYER.team; G.aiLevels = null; D.signals = function () { };
    const at = (t, skill, lead, effort = 0.9) => { GAME.diff = t; D.skill = skill; D.effort = effort; S.k = 0; Paint.teamCells[me] = Math.round(tot * (0.4 + lead / 2)); Paint.teamCells[1 - me] = Math.round(tot * (0.4 - lead / 2)); D.steer(); return { t: D.target, m: D.mateGoal, pfE: D.paintFocus(1 - me), pfM: D.paintFocus(me), ease: D.mateEaseOf(me) }; };
    let inside = true; for (const [t, lo, hi] of [[0, 0, 0.6], [1, 0.7, 1.3], [2, 2, 2.5], [SMART, 0, 2.5]]) for (const sk of [0.1, 1.0, 2.4]) for (const ld of [-0.3, 0, 0.3]) { const r = at(t, sk, ld); if (r.t < lo - 1e-9 || r.t > hi + 1e-9 || r.m < lo - 1e-9 || r.m > hi + 1e-9) inside = false; }
    // smart: teammates a step below, enemies level - whatever the score; nobody is propped up when losing
    const even = at(SMART, 1.2, 0), behind = at(SMART, 1.2, -0.2), lowSk = at(SMART, 0.3, 0), midSk = at(SMART, 0.6, 0);
    const sides = Math.abs(even.m - 1.0) < 1e-9 && Math.abs(even.t - 1.2) < 1e-9 && Math.abs(behind.m - 1.0) < 1e-9 && Math.abs(behind.t - 1.2) < 1e-9 && Math.abs(lowSk.m - 0.3) < 1e-9 && Math.abs(midSk.m - 0.5) < 1e-9;
    ok(inside && sides, 'sides: teammates sit 0.2 below the player (' + even.m.toFixed(2) + ' for a 1.2; not below 0.5 unless the player is), enemies at the player\'s level, everything inside the tier; 20 % behind changes neither (' + behind.m.toFixed(2) + ' / ' + behind.t.toFixed(2) + ')');
    // crushed: a small net only for a player who is trying; never on hell
    const tryHard = at(SMART, 1.2, -0.35, 0.8), tryEase = D.mateEaseOf(1 - me), slack = at(SMART, 1.2, -0.35, 0.2), slackEase = D.mateEaseOf(1 - me), hellCrushed = at(2, 2.2, -0.35, 0.9), hellEase = D.mateEaseOf(1 - me);
    ok(tryHard.t < 1.2 && tryHard.t >= 1.2 - 0.25 - 1e-9 && tryEase === 1 && Math.abs(slack.t - 1.2) < 1e-9 && slackEase === 0 && hellCrushed.t >= 2.2 - 1e-9 && hellEase === 0 && tryHard.m === slack.m, 'crushed 35 % behind: trying -> the enemies ease by ' + (1.2 - tryHard.t).toFixed(2) + ' (0.25 at most) and hold back; not trying -> nothing; hell -> nothing; teammates never change');
    // running away: the enemies sharpen up and the teammates hold back - only that way round
    const ahead = at(SMART, 1.2, 0.25), aheadN = at(1, 1.0, 0.3), lose = at(SMART, 1.2, -0.25);
    ok(ahead.t > 1.7 && ahead.ease === 1 && ahead.pfE > 0 && Math.abs(aheadN.t - 1.3) < 1e-9 && lose.ease === 0 && lose.pfM > 0 && lose.pfE < 0, 'player\'s side 25 % ahead: enemies +' + (ahead.t - 1.2).toFixed(2) + ' and taking ground, teammates hold back; on normal capped at 1.3; behind: teammates take ground, enemies hold theirs - nobody eases off for the player');
    const easyCounters = (at(0, 0.6, 0), S.intensity());
    Paint.teamCells[0] = tc[0]; Paint.teamCells[1] = tc[1];
    ok(easyCounters === 0, 'tiers: easy never counters');
    // and the bots themselves, over a few seconds of play on normal with a player judged far above it
    GAME.diff = 1; D.signals = function () { this.skill = 2.4; }; run(150); const lvs = G.bots.filter(b => !b.c.isPlayer).map(b => b.lv);
    ok(lvs.every(v => v >= 0.7 - 1e-9 && v <= 1.3 + 1e-9) && Math.max(...lvs) > 1.2, 'tiers: on normal, a player judged 2.4 gets bots at the top of normal and no further (' + Math.min(...lvs).toFixed(2) + '-' + Math.max(...lvs).toFixed(2) + ')');
    D.signals = sig;
    // each tier starts from the saved level, kept within the tier
    const next = t => { GAME.diff = t; quitToTitle(); for (let i = 0; i < 3; i++) loop(); openLobby(); startMatch(); while (G.state !== 'play') loop(); return G.bots.filter(b => !b.c.isPlayer).map(b => b.lv); };
    Profile.data.skill = {}; Profile.data.skill[D.loadoutKey(PLAYER)] = { s: 1.6, m: 3 };
    const n16 = next(1), e16 = next(0), s16 = next(SMART); Profile.data.skill[D.loadoutKey(PLAYER)] = { s: 0.4, m: 3 }; const h04 = next(2);
    ok(n16.every(v => v === 1.3) && e16.every(v => v === 0.6) && s16.every(v => v === 1.6) && h04.every(v => v === 2), 'tiers: a saved level of 1.6 starts normal at 1.3, easy at 0.6 and smart at 1.6; a saved 0.4 starts hell at 2.0');
    Profile.data.skill = undefined; GAME.diff = gd;
  }
  // ---------------- combat feel: attack tokens, warning shots, the breather, backup
  {
    setup(SMART); const C = Combat, D = Director, gd = GAME.diff; G.aiLevels = null; GAME.diff = 1; C.reset(); const P = PLAYER, T = G.time;
    const en = G.bots.filter(b => b.c.team !== P.team); en.forEach(b => { b.enemy = P; b.tokCd = 0; });
    const got = en.map(b => C.canShoot(b, P)), cap = got.filter(Boolean).length;
    const holder = en.find((b, i) => got[i]), waiter = en.find((b, i) => !got[i]);
    [...C.holders.values()].forEach(s => s.t0 = T - 3); C.waiting.set(waiter, G.time); C.update(0);
    const handed = C.holders.size === cap - 1 && C.canShoot(waiter, P) && holder.tokCd > G.time;
    GAME.diff = 0; const easyCap = C.tokens(); GAME.diff = 2; const hellCap = C.tokens(); GAME.diff = 1;
    ok(cap === 2 && handed && easyCap === 1 && hellCap === 3 && C.canShoot(en[0], CHARS.find(c => c.team === P.team && c !== P)), 'attack tokens: on normal 2 of ' + en.length + ' enemies may shoot at the player at once (easy 1, hell 3); after its turn a holder hands over to one that is waiting; shooting at teammates is not limited');
    // warning shots: in front of the player, on the side the shot comes from
    const B = en[0]; B.c.pos.set(P.pos.x, P.pos.y, P.pos.z - 10); Cam.yaw = P.aimYaw = Math.PI; B.reactT = 0.4; C.onAcquire(B);
    const front = B.warnUntil - G.time, ap = C.aimPoint(B, P, P.chest()), off = Math.hypot(ap.x - P.pos.x, ap.z - P.pos.z), toward = (ap.z - P.pos.z) < 0;
    P.aimYaw = 0; B.reactT = 0.4; C.onAcquire(B); const behindReact = B.reactT, behindW = B.warnUntil - G.time;
    GAME.diff = 2; P.aimYaw = Math.PI; B.reactT = 0.4; C.onAcquire(B); const hellFront = B.warnUntil; P.aimYaw = 0; B.reactT = 0.4; C.onAcquire(B); const hellBehind = B.warnUntil - G.time; GAME.diff = 1;
    ok(Math.abs(front - 0.9) < 0.01 && off > 1 && off < 2.2 && toward && Math.abs(behindReact - 0.56) < 0.01 && hellFront === 0 && hellBehind > 0.5, 'warning shots: an enemy that takes aim at the player first puts ' + (front - 0.4).toFixed(1) + ' s of shots into the ground ' + off.toFixed(1) + ' m in front of them, on its side; from behind it is also slower to fire; on hell only from behind');
    // the breather
    P.hp = P.maxHp * 0.2; P.lastHurt = G.time; const kNorm = C.errK(P); GAME.diff = 2; const kHell = C.errK(P); GAME.diff = 1; P.hp = P.maxHp; const kFull = C.errK(P);
    ok(kNorm > 2 && kHell === 1 && kFull === 1, 'breather: low and just hit, the player is ' + kNorm.toFixed(1) + 'x harder to hit for a moment (not on hell, not at full health)');
    // backup: set on by two, the nearest teammates come and go for whoever is shooting
    const mates = G.bots.filter(b => b.c.team === P.team && !b.c.isPlayer); mates.forEach((b, i) => { b.support = null; b.mode = 'paint'; b.c.pos.set(P.pos.x + 3 + i * 6, P.pos.y, P.pos.z + 2); });
    P.dmgBy.set(en[0].c, G.time); P.dmgBy.set(en[1].c, G.time); C.supT = 0; C.updateSupport();
    const sup = mates.filter(b => b.support), nearest = sup.includes(mates[0]) && sup.includes(mates[1]);
    en[0].c.pos.set(P.pos.x + 3, P.pos.y, P.pos.z - 8); const other = en[2].c; other.pos.set(P.pos.x + 3, P.pos.y, P.pos.z - 2); const pickA = mates[0].findEnemy();
    P.dmgBy.clear(); C.supT = 0; C.updateSupport(); const off2 = mates.every(b => !b.support);
    ok(sup.length === 2 && nearest && pickA === en[0].c && off2, 'backup: shot at by two, the 2 nearest teammates come over and go for an attacker before a nearer enemy; once it is over they go back to their own jobs');
    // tests with fixed rows: none of it
    G.aiLevels = [1, 1]; const fixedOk = en.every(b => C.canShoot(b, P)) && C.errK(P) === 1;
    ok(fixedOk, 'combat feel: off for the fixed rows used by tests');
    G.aiLevels = null; GAME.diff = gd;
  }
  // ---------------- the player decides: effort, no reward for playing badly on purpose, the duel director, backup that leaves the kill
  {
    setup(SMART); const D = Director, C = Combat, P = PLAYER, gd = GAME.diff; G.aiLevels = null; GAME.diff = SMART; P.pos.set(0, 2.2, 20);
    const mates = CHARS.filter(c => c.team === P.team && c !== P), tick = (n, f) => { for (let i = 0; i < n; i++) { f(); D.effT = 0; D.effortTick(0.5); } };
    D.eff = []; tick(40, () => { const sp = SPAWN[P.team]; P.pos.set(sp.x, sp.y, sp.z); P.vel.set(0, 0, 0); P.lastShot = -99; mates.forEach(c => { c.paint += 3; c.dDealt = (c.dDealt || 0) + 0.05; }); });
    const lazy = D.effort;
    D.eff = []; P.pos.set(0, 2.2, 20); tick(40, () => { P.vel.set(4, 0, 0); P.lastShot = G.time; P.paint += 3; P.dDealt = (P.dDealt || 0) + 0.05; mates.forEach(c => { c.paint += 3; c.dDealt = (c.dDealt || 0) + 0.05; }); });
    const keen = D.effort;
    // not trying: the level may go up, never down; a duel lost while not trying does not count
    const sig = D.signals; D.skill = 1.0; D.elo = 0.2; D.n = 6; D.effort = 0.2; G.time = Math.max(G.time, D.calibT + 1); D.signals(); const frozen = D.skill;
    D.effort = 0.9; D.signals(); const drops = D.skill; D.elo = 1; D.effort = 0.2; D.resolve({ e: { name: 'x' }, lv: 1 }, 0, 1); const eloSlack = D.elo; D.signals = sig;
    ok(lazy < 0.25 && keen > 0.85 && frozen === 1.0 && drops < 1.0 && eloSlack === 1, 'effort: idling at the spawn reads ' + lazy.toFixed(2) + ', moving, shooting, painting and hitting like the teammates ' + keen.toFixed(2) + '; while not trying the level does not drop and lost duels do not count (playing badly on purpose does not make it easier)');
    // the duel director: losing duels - longer warnings, slower, wider, one fewer shooting; winning - the other way; hell only gets harder
    C.reset(); const base = { tok: C.tokens(), err: C.duelErrK(), warn: C.warnTime(false) };
    for (let i = 0; i < 6; i++) C.onDuel(0, 1); const cold = { h: C.heat, tok: C.tokens(), err: C.duelErrK(), react: C.duelReactK(), warn: C.warnTime(false) };
    C.reset(); for (let i = 0; i < 6; i++) C.onDuel(1, 1); const hot = { h: C.heat, tok: C.tokens(), err: C.duelErrK(), react: C.duelReactK(), warn: C.warnTime(false) };
    GAME.diff = 2; C.reset(); for (let i = 0; i < 6; i++) C.onDuel(0, 1); const hellCold = C.duelErrK(); GAME.diff = SMART;
    ok(cold.h < -0.8 && cold.tok === base.tok - 1 && cold.err > 1.5 && cold.react > 1.4 && cold.warn > base.warn + 0.3 && hot.h > 0.8 && hot.tok === base.tok + 1 && hot.err < 0.75 && hot.react < 0.8 && hot.warn < base.warn * 0.4 && hellCold === 1,
      'duel director: after a run of lost duels the enemies facing the player shoot ' + cold.err.toFixed(1) + 'x wider, ' + cold.react.toFixed(1) + 'x slower, warn ' + cold.warn.toFixed(1) + ' s and one fewer may shoot; after a run of wins ' + hot.err.toFixed(2) + 'x, ' + hot.react.toFixed(2) + 'x, ' + hot.warn.toFixed(2) + ' s and one more; on hell a losing run changes nothing');
    // backup suppresses and leaves the knock-out to the player
    const mb = G.bots.find(b => b.c.team === P.team && !b.c.isPlayer), foe = CHARS.find(c => c.team !== P.team);
    mb.support = { t: G.time, att: [foe] }; foe.hp = foe.maxHp * 0.3; foe.dmgBy.set(P, G.time);
    const hold = C.supportHold(mb, foe), wide = C.mateErrK(mb, foe); foe.hp = foe.maxHp; const fresh = C.supportHold(mb, foe); mb.support = null;
    ok(hold && wide > 1.5 && !fresh && C.mateErrK(mb, foe) === 1, 'backup: a teammate covering the player shoots wide at the attackers (' + wide + 'x) and holds fire on one the player has nearly finished, so the knock-out is the player\'s');
    GAME.diff = gd;
  }
  // ---------------- pacing: build-up -> wave -> lull, and the panel
  {
    setup(SMART); const Pc = Pacing, D = Director, gd = GAME.diff, P = PLAYER; G.aiLevels = null; GAME.diff = 1; GAME.dur = 180; Pc.reset(); D.pf = [0, 0];
    const step = (n, f) => { for (let i = 0; i < n; i++) { if (f) f(); Pc.update(1 / 30); } };
    Pc.tension = 0.7; step(30 * 10); const early = Pc.phase;                                   // tense, but too soon for a wave
    step(30 * 25, () => { Pc.tension = Math.max(Pc.tension, 0.7); }); const wave = Pc.phase;    // a while later: the wave comes
    step(30 * 6, () => { Pc.tension = 0.9; }); const after = Pc.phase;                         // held high a few seconds: the lull
    step(30 * 3, () => { Pc.tension = 0.1; }); const tooSoon = Pc.phase; step(30 * 20, () => { Pc.tension = 0.1; }); const back = Pc.phase;
    const L3 = Pc.len.relaxMax; GAME.diff = 2; Pc.reset(); const Lh = Pc.len.relaxMax; GAME.diff = 1; GAME.dur = 90; Pc.reset(); const L90 = Pc.len.buildMin; GAME.dur = 300; Pc.reset(); const L300 = Pc.len.buildMin; GAME.dur = 180; Pc.reset();
    ok(early === 'build' && wave === 'peak' && after === 'relax' && tooSoon === 'relax' && back === 'build' && Lh < L3 && L90 < L300, 'pacing: build-up -> a wave once tense (not before ~30 s) -> a lull once the tension has stayed high -> build-up again once calm; hell lulls are shorter (' + Lh.toFixed(0) + ' vs ' + L3.toFixed(0) + ' s), and the lengths follow the match');
    // what the bots do with it: in a lull an enemy 12 m away does not come for the player, in a build-up it does; paint spots avoid / approach the player
    const B = G.bots.find(b => b.c.team !== P.team); P.pos.set(0, 2.2, 20); B.c.pos.set(0, 2.2, 8); B.c.lastHurt = -99;          // (off the spawn pad: nobody targets a player inside their own barrier)
    Pc.set('build'); const inBuild = B.findEnemy() === P; Pc.set('relax'); const inLull = B.findEnemy() === P; const near = new THREE.Vector3(P.pos.x + 3, P.pos.y, P.pos.z), far = new THREE.Vector3(P.pos.x + 30, P.pos.y, P.pos.z);
    const lullNear = Pc.turfBias(B.c.team, 0, near), lullFar = Pc.turfBias(B.c.team, 0, far); Pc.set('peak'); const waveNear = Pc.turfBias(B.c.team, 0, near), mates = Pc.turfBias(P.team, 0, near);
    Pc.set('relax'); const tok = Combat.tokens(); Pc.set('build'); const tokB = Combat.tokens(); D.pf[B.c.team] = 0.6; Pc.set('relax'); const runaway = Pc.rangeK(B.c.team); D.pf = [0, 0];
    ok(inBuild && !inLull && lullNear < -2 && lullFar === 0 && waveNear > 2 && mates === 0 && tok === tokB - 1 && runaway === 1, 'pacing: in a lull an enemy 12 m off leaves the player alone (it would come in a build-up), paints away from them, and one token fewer; in a wave they head for the player; teammates are not paced; a runaway score switches it off' + (inBuild && !inLull && lullNear < -2 && lullFar === 0 && waveNear > 2 && mates === 0 && tok === tokB - 1 && runaway === 1 ? '' : ' ' + JSON.stringify({ inBuild, inLull, lullNear, lullFar, waveNear, mates, tok, tokB, runaway })));
    // the panel: both views render
    DirPanel.view = 0; DirPanel.toggle(); const compact = DirPanel.render(); DirPanel.toggle(); const full = DirPanel.render(); DirPanel.toggle();
    ok(['dp-ruler', '节奏', '紧张度', '比分', '对面'].every(k => compact.includes(k)) && !compact.includes('dp-bots') && ['dp-cols', '评分依据', '最近交火', 'dp-bots'].every(k => full.includes(k)) && DirPanel.view === 0, 'director panel: first press the essentials (level ruler, rhythm, tension, score, the other side), second press the details beside them, third press off');
    GAME.diff = gd;
  }
  // ---------------- the strategist (smart mode): reading the player and picking a plan against it
  {
    setup(SMART); const S = Strategist, D = Director, sig = D.signals; D.signals = function () { this.skill = 1.6; }; for (let i = 0; i < 3; i++) loop();
    const fresh = () => { S.fs = 0.3; S.depth = 0; S.lanes = [1 / 3, 1 / 3, 1 / 3]; S.choke = TAC.chokes.map(() => 0); S.hist = []; S.plan = null; S.planT = -99; D.raw = { paint: 0 }; };
    const pick = f => { fresh(); f(); S.choose(); return S.plan; };
    const zi = S.zones.findIndex(z => depthOf(S.team(), z.z) < 0), turn = i => S.zones.map((_, k) => k === zi ? [0.8 - i * 0.04, 0.1 + i * 0.04] : [0.3, 0.3]);
    const got = { hunter: pick(() => { S.fs = 0.7; }), painter: pick(() => { S.fs = 0.05; }), diver: pick(() => { S.depth = 0.6; }),
      steady: pick(() => { S.lanes = [0.05, 0.9, 0.05]; S.choke[0] = 0.6; }), flipper: pick(() => { for (let i = 0; i < 12; i++) S.hist.push(turn(i)); }), nothing: pick(() => { }) };
    const want = { hunter: 'paint', painter: 'hunt', diver: 'flank', steady: 'block', flipper: 'retake', nothing: null };
    ok(Object.keys(want).every(k => got[k] === want[k]), 'strategist: reads the player and counters - hunts people -> 抢地, paints and avoids fights -> 围猎, dives deep -> 绕后, keeps to one route -> 封路, flips their side -> 反推, nothing clear -> no plan (' + JSON.stringify(got) + ')');
    // a plan holds for a while instead of flipping with every reading
    fresh(); S.fs = 0.45; S.choose(); const first = S.plan; S.depth = 0.6; S.choose(); const held = S.plan; S.planT = G.time - 60; S.choose(); const later = S.plan;
    ok(first === 'paint' && held === 'paint' && later === 'flank', 'strategist: a plan is kept for ~18 s even when another one starts to look better, then it switches (' + [first, held, later].join(' -> ') + ')');
    // only in a close game: once the Director starts steering the score, the plans stand down
    fresh(); S.fs = 0.05; S.choose(); const tm = S.team();
    for (const b of G.bots) b.lv = 1.6; D.squadBrain[tm].lv = 1.6;
    D.skill = 0.6; D.pf = [0, 0]; S.assign(); const novice = G.bots.filter(b => b.task && b.task.id === 'hunt').length; D.skill = 1.6;
    D.pf = [0, 0]; S.assign(); const close = G.bots.filter(b => b.c.team === tm && b.task && b.task.id === 'hunt').length, kClose = S.k;
    D.pf[tm] = 0.6; S.assign(); const behind = G.bots.filter(b => b.c.team === tm && b.task).length; D.pf[tm] = -0.6; S.assign(); const ahead = G.bots.filter(b => b.c.team === tm && b.task).length;
    ok(novice === 0 && close === 2 && kClose > 0 && behind === 0 && ahead === 0 && G.bots.every(b => b.c.team === tm || !b.task), 'strategist: in a close game ' + close + ' bots go together to hunt a player who avoids fights (strength ' + Math.round(kClose * 100) + ' %); nobody hunts a beginner; once the score runs away either way the plans stand down; teammates never get one');
    // a hunter goes for the player even with someone else nearer
    D.pf = [0, 0]; const H = G.bots.find(b => b.c.team === tm), M = G.bots.find(b => b.c.team !== tm);
    H.c.pos.set(10, 2.2, 25); PLAYER.pos.set(10, 2.2, 14); M.c.pos.set(10.5, 2.2, 20); H.task = null; const plain = H.findEnemy();
    H.task = { id: 'hunt', x: 10, z: 14, r: 7, bonus: 5 }; const hunter = H.findEnemy(); H.task = null;
    ok(plain === M.c && hunter === PLAYER, 'strategist: a bot sent to hunt picks the player over a nearer enemy (without the job: ' + (plain === M.c ? 'the nearer one' : plain ? plain.name : 'nobody') + ')');
    D.signals = sig;
  }
  {
    setup(1); run(60); const tasks = G.bots.filter(b => b.task || Strategist.taskId(b)).length;
    ok(!Strategist.on && tasks === 0, 'strategist: off with a fixed tier - nobody gets a plan');
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
