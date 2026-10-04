#!/usr/bin/env node
/*  Smart-difficulty benchmark (headless).  A bot stands in for the player at a fixed level; its teammates are
    normal; the enemies are either smart (the Director steers them) or a fixed tier.  Prints how the matches went
    and what the Director made of the "player".
    Usage:  node tools/director-bench.js [map=canton] [player=0] [enemies=s] [matches=4] [seconds=180]
            player: 0 easy · 1 normal · 2 hell     enemies: s smart · t0 / t1 / t2 a tier as players get it (moving within its range) · f0 / f1 / f2 a tier as it was before v0.15 (both teams on the fixed row) · 0 / 1 / 2 the enemies on a fixed row, teammates normal
            JSON=1 prints the raw numbers as JSON instead                                                    */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
const [map = 'canton', pl = '0', en = 's', n = '4', secs = '180'] = process.argv.slice(2);
process.env.SR_MAP = map;
eval(src.slice(src.indexOf('const root'), src.indexOf('const weapons')));
const g = makeSandbox();
const run = function (PL, EN, N, SECS, WPN, DIRO, NOSTRAT, NOCOMBAT, NOPACING) {
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  if (NOSTRAT) Strategist.off = true;
  if (NOCOMBAT) Combat.off = true;
  if (NOPACING) Pacing.off = true;                                           // NOPACING=1 : without the pacing (rise and lull)                                           // NOCOMBAT=1 : without the attack tokens, warning shots, breather and backup                                         // NOSTRAT=1 : the Director without the strategist's plans
  if (DIRO) for (const k in DIRO) Director[k] = Object.assign({}, Director[k], DIRO[k]);      // DIRO='{"PF":{"span":0.08}}' : try other Director settings
  const out = [];
  for (let m = 0; m < N; m++) {
    const w = WPN || WEAPON_ORDER[m % WEAPON_ORDER.length];
    GAME.dur = SECS; GAME.diff = EN >= 20 ? EN - 20 : EN >= 10 ? EN - 10 : EN; Profile.data.skill = undefined; Profile.data.weapon = w; Profile.data.char = charForWeapon(w); openLobby();
    startMatch(); Input.locked = true; G.aiLevels = EN >= 20 ? [EN - 20, EN - 20] : EN >= 10 ? null : EN === SMART ? [SMART, SMART] : [1, EN]; G.pilot = true; G.pilotLevel = PL; G.bots.push(new Bot(PLAYER, 'front')); G.dirTrace = true;
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
      mateW: mates.map(c => c.weapon.id), raw: D.raw, combat: Object.assign({}, Combat.stats, { ttd: Combat.stats.ttd.slice() }), pacing: JSON.parse(JSON.stringify(Pacing.stats)), waves: Pacing.waves, jobs, plans: Object.fromEntries(Object.entries((G.aiStat || [{}, {}])[1]).filter(([k]) => k.startsWith('plan_'))), prof: Strategist.prof && Object.fromEntries(Object.entries(Strategist.prof).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(2)])), k: PLAYER.kills, d: PLAYER.deaths, enemyLv, duelLog: D.allDuels || [] });
    G.aiLevels = null; G.dirTrace = false; G.aiStat = null; for (let i = 0; i < 20; i++) loop(); quitToTitle(); for (let i = 0; i < 5; i++) loop();
  }
  return out;
};
const EN = en === 's' ? -1 : en[0] === 't' ? 10 + +en.slice(1) : en[0] === 'f' ? 20 + +en.slice(1) : +en;
const res = vm.runInContext('(' + run.toString() + ')(' + [+pl, EN, +n, +secs, JSON.stringify(process.env.WEAPON || ''), process.env.DIRO || 'null', process.env.NOSTRAT ? 'true' : 'false', process.env.NOCOMBAT ? 'true' : 'false', process.env.NOPACING ? 'true' : 'false'].join(',') + ')', g);
if (process.env.JSON) { console.log(JSON.stringify(res)); process.exit(0); }
const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length), f2 = v => v == null ? '-' : v.toFixed(2);
const NAME = ['easy', 'normal', 'hell'], ENAME = EN === -1 ? 'SMART' : EN >= 20 ? 'old tier ' + NAME[EN - 20] : EN >= 10 ? 'tier ' + NAME[EN - 10] : 'fixed ' + NAME[EN];
console.log(`${map}  player ${NAME[+pl]}  vs  enemies ${ENAME}   (${n} matches, ${secs} s)`);
for (const r of res) console.log(`  ${r.w.padEnd(9)} ${r.win ? 'WIN ' : 'lose'} turf ${r.turf[0].toFixed(1)}-${r.turf[1].toFixed(1)}  skill ${f2(r.skill)} (at calib ${f2(r.atCal)}, sd ${f2(r.sd)})  elo ${f2(r.elo)} n ${r.duels.toFixed(1)}  sig ${JSON.stringify(r.sig)}  hit ${f2(r.hit)}/${r.shots}  K/D ${r.k}/${r.d}  enemies ${r.enemyLv.map(f2).join(' ')}`);
console.log(`  => player-team wins ${res.filter(r => r.win).length}/${res.length}   mean |turf gap| ${avg(res.map(r => Math.abs(r.turf[0] - r.turf[1]))).toFixed(1)}   mean skill ${f2(avg(res.map(r => r.skill)))}   at calib ${f2(avg(res.map(r => r.atCal)))}`);
