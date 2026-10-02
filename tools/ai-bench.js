#!/usr/bin/env node
/*  All-bot matches to measure the AI (headless).  Two teams with the same line-up, each on its own difficulty.
    Usage:  node tools/ai-bench.js [map=canton] [levelA=2] [levelB=1] [matches=6] [seconds=120]
            levels: 0 easy · 1 normal · 2 hell · 3 the old pre-v0.11 bot (yardstick)
    Sides are swapped every other match.  Prints wins, turf, knock-outs and how long bots stood stuck.          */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
const [map = 'canton', la = '2', lb = '1', n = '6', secs = '120'] = process.argv.slice(2);
process.env.SR_MAP = map;
eval(src.slice(src.indexOf('const root'), src.indexOf('const weapons')));
const g = makeSandbox();
const run = function (LA, LB, N, SECS, OVR, TRACE) {
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  if (OVR) { DIFF[4] = Object.assign({}, DIFF[LA], OVR); LA = 4; }          // AIO='{"team":0}' : try level A with some switches changed
  const LINE = [['sa', 'rifle'], ['sa', 'smg'], ['man', 'charger'], ['dun', 'splatling']];
  const res = { winA: 0, winB: 0, turfA: 0, turfB: 0, koA: 0, koB: 0, stuckA: 0, stuckB: 0, lines: [], stat: [{}, {}], log: [], time: [{}, {}] };
  for (let m = 0; m < N; m++) {
    const swap = m % 2 === 1, lv = swap ? [LB, LA] : [LA, LB];
    GAME.dur = SECS; Profile.data.char = LINE[1][0]; Profile.data.weapon = LINE[1][1]; openLobby();
    G.roster.forEach(team => team.forEach((r, i) => { r.char = LINE[i][0]; r.weapon = LINE[i][1]; }));
    startMatch(); Input.locked = true; G.aiLog = res.log; G.aiLevels = lv; G.pilot = true; G.bots.push(new Bot(PLAYER, 'front'));
    const hist = new Map(), stuck = [0, 0]; let f = 0;
    while (G.state !== 'results' && f < 30 * (SECS + 40)) {
      loop(); f++;
      if (res.trace && res.traceN-- > 0) { const b = res.trace, c = b.c; res.lines.push('  f' + f + ' ' + c.pos.x.toFixed(2) + ',' + c.pos.y.toFixed(2) + ',' + c.pos.z.toFixed(2) + ' v' + Math.hypot(c.vel.x, c.vel.z).toFixed(1) + ' ' + b.mode + ' path' + b.path.length + ' I ' + c.intent.mx.toFixed(2) + ',' + c.intent.mz.toFixed(2) + (c.intent.fire ? ' fire' : '') + (c.intent.swim ? ' swim' : '') + (c.charging ? ' chg' + c.charge.toFixed(2) : '') + ' state ' + c.state + (c.sj ? ' sj' : '') + (c.grounded ? ' gnd' : ' air') + ' wp ' + (b.path[0] ? b.path[0].x + ',' + b.path[0].y.toFixed(1) + ',' + b.path[0].z : '-') + ' tgt ' + (b.target ? b.target.x + ',' + b.target.z : '-') + ' enemy ' + !!b.enemy + ' lurk' + b.lurkT.toFixed(1) + (b.climb ? ' climb' : '')); }
      if (G.state === 'play' && f % 15 === 0) for (const b of G.bots) { const c = b.c, i = (c.team === (m % 2 === 1 ? 1 : 0)) ? 0 : 1, o = res.time[i];
        const k = !c.alive || c.state !== 'play' ? 'dead/fly' : b.mode === 'retreat' ? 'retreat' : b.enemy ? 'fight' : b.mode === 'refill' ? 'refill' : b.lurkT > 0 ? 'lurk' : b.climb ? 'climb' : b.dawdleT > 0 ? 'dawdle' : b.path.length ? (c.swim ? 'travel-swim' : c.intent.fire ? 'walk+paint' : 'walk') : 'idle'; o[k] = (o[k] || 0) + 1; o.n = (o.n || 0) + 1; }
      if (G.state === 'play' && f % 30 === 0) for (const b of G.bots) {
        const c = b.c; if (!c.alive || c.state !== 'play' || b.lurkT > 0 || b.mode === 'refill' || b.mode === 'retreat' || b.enemy || (b.perch && b.linger > 0)) { hist.delete(c); continue; }
        const h = hist.get(c) || []; h.push([c.pos.x, c.pos.z]); if (h.length > 6) h.shift(); hist.set(c, h);
        if (h.length === 6) { const xs = h.map(p => p[0]), zs = h.map(p => p[1]); if (Math.max(...xs) - Math.min(...xs) < 0.6 && Math.max(...zs) - Math.min(...zs) < 0.6) { stuck[c.team]++; if (TRACE && !res.trace && c.weapon.id === TRACE) { res.trace = b; res.traceN = 45; } if (res.lines.length < (TRACE ? 60 : 12)) res.lines.push('stuck L' + lv[c.team] + ' ' + c.weapon.id + ' @' + c.pos.x.toFixed(0) + ',' + c.pos.y.toFixed(1) + ',' + c.pos.z.toFixed(0) + ' ' + b.mode + '/' + b.role + ' path' + b.path.length + (b.climb ? ' climb' : '') + (() => { const s = navNode(c.pos.x, c.pos.y, c.pos.z); let oe = 0; for (let d = 0; d < 8; d++) if (NAV.eT[s * 8 + d] >= 0) oe++; return ' node h' + NAV.nh[s].toFixed(1) + ' out' + oe + ' reach' + TAC.reach[c.team][s] + ' tgt' + (b.target ? b.target.x + ',' + b.target.y.toFixed(1) + ',' + b.target.z : '-') + ' linger' + b.linger.toFixed(1) + ' rt' + b.retarget.toFixed(1) + ' I ' + c.intent.mx.toFixed(2) + ',' + c.intent.mz.toFixed(2) + (c.intent.fire ? ' fire' : '') + (c.intent.swim ? ' swim' : '') + (c.charging ? ' charging' : '') + ' ink' + c.ink.toFixed(0) + ' wp ' + (b.path[0] ? b.path[0].x + ',' + b.path[0].y.toFixed(1) + ',' + b.path[0].z + ' fl' + b.path[0].fl : '-') + ' wpT' + b.wpT.toFixed(1) + ' fails' + b.fails; })()); } }
      }
    }
    const t = [Paint.teamCells[0] / Paint.total * 100, Paint.teamCells[1] / Paint.total * 100], ko = [0, 1].map(tm => CHARS.filter(c => c.team === tm).reduce((s, c) => s + c.kills, 0));
    const a = swap ? 1 : 0, b = 1 - a;
    if (t[a] > t[b]) res.winA++; else res.winB++;
    res.turfA += t[a]; res.turfB += t[b]; res.koA += ko[a]; res.koB += ko[b]; res.stuckA += stuck[a]; res.stuckB += stuck[b];
    [a, b].forEach((tm, i) => { const st = (G.aiStat || [{}, {}])[tm]; for (const k in st) { const o = res.stat[i]; o[k] = (o[k] || 0) + st[k]; } }); G.aiStat = null;
    G.aiLevels = null; for (let i = 0; i < 20; i++) loop(); quitToTitle(); for (let i = 0; i < 5; i++) loop();
  }
  const NAME = ['easy', 'normal', 'hell', 'old', 'custom'];
  return MAP_ID + '  ' + NAME[LA] + ' vs ' + NAME[LB] + '  (' + N + ' matches, ' + SECS + ' s):  wins ' + res.winA + ' - ' + res.winB + '   turf ' + (res.turfA / N).toFixed(1) + '% - ' + (res.turfB / N).toFixed(1) + '%   KOs ' + (res.koA / N).toFixed(1) + ' - ' + (res.koB / N).toFixed(1) + '   stuck seconds ' + res.stuckA + ' - ' + res.stuckB + '\n  per match  A: ' + Object.keys(res.stat[0]).map(k => k + ' ' + (res.stat[0][k] / N).toFixed(1)).join(', ') + '\n             B: ' + Object.keys(res.stat[1]).map(k => k + ' ' + (res.stat[1][k] / N).toFixed(1)).join(', ') + '\n  time share A: ' + Object.keys(res.time[0]).filter(k => k !== 'n').sort().map(k => k + ' ' + (res.time[0][k] / res.time[0].n * 100).toFixed(0) + '%').join(', ') + '\n             B: ' + Object.keys(res.time[1]).filter(k => k !== 'n').sort().map(k => k + ' ' + (res.time[1][k] / res.time[1].n * 100).toFixed(0) + '%').join(', ') + (res.lines.length ? '\n  ' + res.lines.join('\n  ') : '') + (res.log.length ? '\n  ' + res.log.slice(0, 25).join('\n  ') : '');
};
console.log(vm.runInContext('(' + run.toString() + ')(' + [+la, +lb, +n, +secs, process.env.AIO || 'null', JSON.stringify(process.env.TRACE || '')].join(',') + ')', g));
