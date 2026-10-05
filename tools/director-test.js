#!/usr/bin/env node
/*  The four tiers with whole matches (headless, about 3 minutes).  A rifle bot stands in for the player at a
    given level and the other seven are what the chosen tier gives a player.  Checks that the tiers really
    differ, that a player who does not play loses, that the bots' levels stay put, and that the estimate of the
    player (shown on the panel only) tells a weak stand-in from a strong one.  Bot stand-ins differ less from
    one another than real players do, so the bars go by medians and averages of several matches.
    Usage:  node tools/director-test.js                                                                        */
const { execFile } = require('child_process'), path = require('path');
const bench = (p, tier, secs, n = 4, extra = {}) => new Promise((ok, no) => execFile(process.execPath, [path.join(__dirname, 'director-bench.js'), 'canton', String(p), tier, String(n), String(secs)],
  { env: Object.assign({}, process.env, { JSON: '1', WEAPON: 'rifle' }, extra), maxBuffer: 1 << 26 }, (e, out) => e ? no(e) : ok(JSON.parse(out))));
const avg = a => a.reduce((s, v) => s + v, 0) / a.length, f2 = v => v.toFixed(2), list = r => '[' + r.map(x => f2(x.skill)).join(' ') + ']';
const med = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n % 2 ? b[n >> 1] : (b[n / 2 - 1] + b[n / 2]) / 2; };
const gap = r => avg(r.map(x => x.turf[0] - x.turf[1])), wins = r => r.filter(x => x.win).length;
(async () => {
  const [weak, mid, strong, lazy, onEasy, onHell] = await Promise.all([bench(0.3, 't1', 90, 8), bench(1, 't1', 300), bench(2, 't1', 180, 6), bench(1, 't1', 120, 6, { LAZY: '2' }), bench(1, 't0', 120, 8), bench(1, 't3', 120, 8)]);
  const res = [], ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  // the tiers: the same stand-in fares clearly better on easy than on hell.  Between bots the turf moves little with level (all of them
  // paint), so the bar goes by the fights - knock-outs minus deaths - and the turf is only reported
  const kd = r => avg(r.map(x => x.k - x.d)), gE = gap(onEasy), gH = gap(onHell), kE = kd(onEasy), kH = kd(onHell);
  ok(kE > kH + 3, 'tiers: a normal stand-in goes ' + (kE >= 0 ? '+' : '') + kE.toFixed(1) + ' in knock-outs minus deaths a match on easy and ' + (kH >= 0 ? '+' : '') + kH.toFixed(1) + ' on hell (bar: at least 3 apart); wins ' + wins(onEasy) + ' / ' + wins(onHell) + ' of ' + onEasy.length + ', turf ' + (gE >= 0 ? '+' : '') + gE.toFixed(1) + ' / ' + (gH >= 0 ? '+' : '') + gH.toFixed(1));
  // the bots stay where the tier put them, whatever the stand-in does
  const lvOk = mid.concat(strong, weak).every(x => x.enemyLv.every(v => v >= 0.85 - 1e-6 && v <= 1.15 + 1e-6) && x.mateLv.every(v => v >= 0.7 - 1e-6 && v <= 1 + 1e-6));
  ok(lvOk, 'fixed levels: on normal every enemy ends the match within 0.85-1.15 and every teammate within 0.7-1.0, for a weak, a normal and a strong stand-in alike');
  const lw = wins(lazy);
  ok(lw <= 1, 'the player decides: a stand-in that wanders about and never shoots wins ' + lw + ' of ' + lazy.length + ' (bar: 1 at most - the teammates do not carry it)');
  // the estimate (panel only)
  const wCal = med(weak.map(x => x.atCal)), wEnd = med(weak.map(x => x.skill)), mEnd = med(mid.map(x => x.skill)), sEnd = med(strong.map(x => x.skill));
  ok(wEnd <= 0.85, 'estimate: weak stand-in (level 0.3, 1:30) judged ' + f2(wCal) + ' after calibration and ' + f2(wEnd) + ' at the end ' + list(weak) + ' (bar: 0.85 or lower)');
  ok(mEnd >= 0.6 && mEnd <= 1.5, 'estimate: normal stand-in (5:00) judged ' + f2(mEnd) + ' ' + list(mid) + ' (bar: 0.6 to 1.5)');
  ok(sEnd >= 0.9 && sEnd >= wEnd + 0.3, 'estimate: strong stand-in (level 2, 3:00) judged ' + f2(sEnd) + ' ' + list(strong) + ' (bar: 0.9 or higher, and at least 0.3 above the weak one)');
  const all = weak.concat(mid, strong), sw = Math.max(...all.map(x => x.swing));
  ok(sw < 0.15, 'steady: after calibration the estimate never swings more than ' + f2(sw) + ' within 10 s (bar: under 0.15)');
  const plans = new Set(onHell.flatMap(x => Object.keys(x.plans || {}).filter(k => k !== 'plan_none'))), jobT = onHell.reduce((s, x) => s + Object.values(x.jobs || {}).reduce((a, b) => a + b, 0), 0);
  ok(plans.size >= 2 && jobT > 0, 'counter-plans on hell: ' + [...plans].map(k => k.slice(5)).join(', ') + ' were picked, ' + Math.round(jobT / onHell.length) + ' bot-seconds of jobs a match');
  res.forEach(l => console.log(l));
  const fails = res.filter(l => l.startsWith('FAIL')).length;
  if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL DIRECTOR TESTS PASSED');
})();
