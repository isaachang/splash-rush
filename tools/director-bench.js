#!/usr/bin/env node
/*  Tier benchmark (headless).  A bot stands in for the player at a given level; the other seven are what the
    chosen tier gives a player (enemies at the tier's level, teammates a step below, each bot its own person).
    Prints how the matches went and what the estimate made of the "player".
    Usage:  node tools/director-bench.js [map=canton] [player=1] [tier=t1] [matches=4] [seconds=180]
            player: a level - 0.3 plays like 轻松, 1 普通, 1.5 困难, 2 地狱 (any value 0..2.5)
            tier: t0 轻松 · t1 普通 · t2 困难 · t3 地狱 · f0 / f1 / f2 every bot on one fixed row (as before v0.15)
            TIERO='{"1":{"mates":0.9,"mateAim":1}}' tries other tier settings (TIERS in 07b_director.js)
            LAZY=1 the stand-in idles about its spawn and never shoots, LAZY=2 wanders the map and never shoots
            JSON=1 prints the raw numbers as JSON instead                                                    */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
const [map = 'canton', pl = '1', en = 't1', n = '4', secs = '180'] = process.argv.slice(2);
process.env.SR_MAP = map;
eval(src.slice(src.indexOf('const root'), src.indexOf('const weapons')));
const g = makeSandbox();
const run = function (PL, EN, N, SECS, WPN, DIRO, NOSTRAT, LAZY, TIERO) {
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  if (NOSTRAT) Strategist.off = true;                                        // NOSTRAT=1 : without the strategist's plans
  if (TIERO) for (const i in TIERO) Object.assign(TIERS[i], TIERO[i]);     // TIERO='{"1":{"mates":0.9}}' : try other tier settings
  if (DIRO) for (const k in DIRO) Director[k] = Object.assign({}, Director[k], DIRO[k]);      // DIRO='{"PF":{"span":0.08}}' : try other Director settings
  const out = [];
  for (let m = 0; m < N; m++) {
    const w = WPN || WEAPON_ORDER[m % WEAPON_ORDER.length];
    GAME.dur = SECS; GAME.diff = EN >= 20 ? 1 : EN - 10; Profile.data.skill = undefined; Profile.data.weapon = w; Profile.data.char = charForWeapon(w); openLobby();
    startMatch(); Input.locked = true; G.aiLevels = EN >= 20 ? [EN - 20, EN - 20] : null; G.pilot = true; G.pilotLevel = PL; G.bots.push(new Bot(PLAYER, 'front')); G.dirTrace = true;
    // LAZY=1: the "player" idles about its own spawn and never shoots; LAZY=2: wanders the map and never shoots
    if (LAZY) { const lb = G.bots[G.bots.length - 1]; lb.update = function (dt) { const c = this.c, I = c.intent; I.fire = I.swim = I.bomb = I.special = I.jump = false; if (!c.alive || c.state !== 'play') { I.mx = I.mz = 0; return; }
      if ((this.lzT = (this.lzT || 0) - dt) <= 0) { this.lzT = rand(1.5, 3.5); const sp = SPAWN[c.team], a = rand(0, 6.28), r = LAZY === 1 ? rand(2, 12) : rand(0, 30); this.lz = LAZY === 1 ? { x: sp.x + Math.cos(a) * r, z: sp.z + Math.sin(a) * r } : { x: clamp(Math.cos(a) * r, -XH + 3, XH - 3), z: clamp(Math.sin(a) * r, -ZH + 3, ZH - 3) }; }
      const dx = this.lz.x - c.pos.x, dz = this.lz.z - c.pos.z, l = Math.hypot(dx, dz) || 1; I.mx = l > 1 ? dx / l : 0; I.mz = l > 1 ? dz / l : 0; c.aimYaw += dt * 0.6; }; }
    let f = 0, atCal = null;
    const jobs = {};
    while (G.state !== 'results' && f < 30 * (SECS + 40)) { loop(); f++; if (atCal === null && G.state === 'play' && G.time >= Director.calibT) atCal = Director.skill;
      if (G.state === 'play' && f % 30 === 0) for (const b of G.bots) if (b.c.team === 1 && b.task) jobs[b.task.id] = (jobs[b.task.id] || 0) + 1; }
    const D = Director, t = [Paint.teamCells[0] / Paint.total * 100, Paint.teamCells[1] / Paint.total * 100];
    const late = D.trace.filter(r => r[0] > D.calibT).map(r => r[1]), mean = late.reduce((s, v) => s + v, 0) / Math.max(1, late.length);
    const sd = Math.sqrt(late.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, late.length));
    // the biggest swing of the estimate inside any 10-second window after calibration (back-and-forth, not slow drift)
    const lt = D.trace.filter(r => r[0] > D.calibT); let swing = 0; for (let i = 0, j = 0; i < lt.length; i++) { while (lt[i][0] - lt[j][0] > 10) j++; let lo = 9, hi = -9; for (let k = j; k <= i; k++) { lo = Math.min(lo, lt[k][1]); hi = Math.max(hi, lt[k][1]); } swing = Math.max(swing, hi - lo); }
    const enemyLv = D.trace.length ? D.trace[D.trace.length - 1].slice(3) : [];
    const mates = CHARS.filter(c => c.team === 0 && !c.isPlayer);
    out.push({ w, win: t[0] > t[1], turf: t, skill: D.skill, atCal, sd, swing, elo: D.elo, duels: D.n, sig: Object.fromEntries(Object.entries(D.sig).map(([k, v]) => [k, +v.v.toFixed(2)])),
      hit: D.st.shots ? D.st.hits / D.st.shots : null, shots: D.st.shots, paintMin: PLAYER.paint / Math.max(1, D.st.alive / 60), matePaintMin: mates.map(c => c.paint / Math.max(1, (c.dirAlive || 1) / 60)),
      mateW: mates.map(c => c.weapon.id), raw: D.raw, mateLv: mates.map(c => D.lvOf(c)), combat: Object.assign({}, Combat.stats, { ttd: Combat.stats.ttd.slice() }), pacing: JSON.parse(JSON.stringify(Pacing.stats)), jobs, sense: Object.fromEntries(['investigate', 'retreat', 'focus', 'lurk'].map(k => [k, ((G.aiStat || [{}, {}])[1][k] || 0)])), plans: Object.fromEntries(Object.entries((G.aiStat || [{}, {}])[1]).filter(([k]) => k.startsWith('plan_'))), prof: Strategist.prof && Object.fromEntries(Object.entries(Strategist.prof).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(2)])), k: PLAYER.kills, d: PLAYER.deaths, enemyLv, duelLog: D.allDuels || [] });
    G.aiLevels = null; G.dirTrace = false; G.aiStat = null; for (let i = 0; i < 20; i++) loop(); quitToTitle(); for (let i = 0; i < 5; i++) loop();
  }
  return out;
};
const EN = en[0] === 'f' ? 20 + +en.slice(1) : 10 + +en.replace('t', '');
const res = vm.runInContext('(' + run.toString() + ')(' + [+pl, EN, +n, +secs, JSON.stringify(process.env.WEAPON || ''), process.env.DIRO || 'null', process.env.NOSTRAT ? 'true' : 'false', +(process.env.LAZY || 0), process.env.TIERO || 'null'].join(',') + ')', g);
if (process.env.JSON) { console.log(JSON.stringify(res)); process.exit(0); }
const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length), f2 = v => v == null ? '-' : v.toFixed(2);
const TN = ['easy', 'normal', 'hard', 'hell'], ENAME = EN >= 20 ? 'fixed row ' + (EN - 20) : 'tier ' + TN[EN - 10];
console.log(`${map}  player level ${pl}  on  ${ENAME}   (${n} matches, ${secs} s)`);
for (const r of res) console.log(`  ${r.w.padEnd(9)} ${r.win ? 'WIN ' : 'lose'} turf ${r.turf[0].toFixed(1)}-${r.turf[1].toFixed(1)}  skill ${f2(r.skill)} (at calib ${f2(r.atCal)}, sd ${f2(r.sd)})  elo ${f2(r.elo)} n ${r.duels.toFixed(1)}  sig ${JSON.stringify(r.sig)}  hit ${f2(r.hit)}/${r.shots}  K/D ${r.k}/${r.d}  enemies ${r.enemyLv.map(f2).join(' ')}`);
console.log(`  => player-team wins ${res.filter(r => r.win).length}/${res.length}   mean |turf gap| ${avg(res.map(r => Math.abs(r.turf[0] - r.turf[1]))).toFixed(1)}   mean skill ${f2(avg(res.map(r => r.skill)))}   at calib ${f2(avg(res.map(r => r.atCal)))}`);
