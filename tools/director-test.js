#!/usr/bin/env node
/*  Smart-difficulty checks with whole matches (headless, about 2 minutes).  A rifle bot stands in for the player
    at a fixed tier, the Director runs the lobby, and we look at what it concluded.  Bot tiers differ less from
    one another than real players do (hell bots win mostly through teamwork), so the bars are set on averages
    (medians) of four to eight matches, and only the gaps the stand-ins really have are asked for.  The combat aids (attack tokens, warning shots, the
    breather - which make the player harder to kill and so are rightly judged as strength) are switched off here: this checks the
    estimate itself; tools/ai-test.js checks the aids.
    Usage:  node tools/director-test.js                                                                        */
const { execFile } = require('child_process'), path = require('path');
const bench = (p, secs, n = 4, extra = { NOCOMBAT: '1' }) => new Promise((ok, no) => execFile(process.execPath, [path.join(__dirname, 'director-bench.js'), 'canton', String(p), 's', String(n), String(secs)],
  { env: Object.assign({}, process.env, { JSON: '1', WEAPON: 'rifle' }, extra), maxBuffer: 1 << 26 }, (e, out) => e ? no(e) : ok(JSON.parse(out))));
const avg = a => a.reduce((s, v) => s + v, 0) / a.length, f2 = v => v.toFixed(2), list = r => '[' + r.map(x => f2(x.skill)).join(' ') + ']';
// the judgements go by the median: one odd match (a stand-in that happened to have a great or awful game) must not swing the result
const med = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n % 2 ? b[n >> 1] : (b[n / 2 - 1] + b[n / 2]) / 2; };
(async () => {
  const [weak, mid, strong, lazy] = await Promise.all([bench(0, 90, 8), bench(1, 300), bench(2, 180, 6), bench(1, 120, 6, { LAZY: '2' })]);   // (lazy: wanders about and never shoots, with everything on as players get it)          // (the short weak runs get eight matches: one odd match would swing four)
  const res = [], ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  const wCal = med(weak.map(x => x.atCal)), wEnd = med(weak.map(x => x.skill)), mEnd = med(mid.map(x => x.skill)), sEnd = med(strong.map(x => x.skill));
  ok(wCal <= 0.85 && wEnd <= 0.85, 'weak stand-in (easy rifle, 1:30): judged ' + f2(wCal) + ' by the end of the 30 s calibration window and ' + f2(wEnd) + ' at the end ' + list(weak) + ' (bar: 0.85 or lower)');
  ok(mEnd >= 0.6 && mEnd <= 1.5, 'normal stand-in (normal rifle, 5:00): judged ' + f2(mEnd) + ' ' + list(mid) + ' (bar: 0.6 to 1.5; in the player slot this stand-in wins about 57 % of even duels, so a little above 1 is right)');
  ok(sEnd >= 0.9 && sEnd >= wEnd + 0.3, 'strong stand-in (hell rifle, 3:00): judged ' + f2(sEnd) + ' ' + list(strong) + ' (bar: 0.9 or higher, and at least 0.3 above the weak one)');
  const lw = lazy.filter(x => x.win).length, ls = avg(lazy.map(x => x.skill));
  ok(lw <= 1 && ls >= 0.95, 'the player decides: a stand-in that wanders about and never shoots wins ' + lw + ' of ' + lazy.length + ' (bar: 1 at most - the teammates do not carry it) and its level stays at ' + f2(ls) + ' (bar: 0.95 or more - playing badly on purpose does not make the next match easier)');
  const all = weak.concat(mid, strong), sw = Math.max(...all.map(x => x.swing));
  ok(sw < 0.15, 'steady: after calibration the estimate never swings more than ' + f2(sw) + ' within 10 s (bar: under 0.15) [' + all.map(x => f2(x.swing)).join(' ') + ']');
  const plans = new Set(all.flatMap(x => Object.keys(x.plans || {}).filter(k => k !== 'plan_none'))), jobT = all.reduce((s, x) => s + Object.values(x.jobs || {}).reduce((a, b) => a + b, 0), 0);
  ok(plans.size >= 2 && jobT > 0, 'counter-plans in use: ' + [...plans].map(k => k.slice(5)).join(', ') + ' were picked, ' + Math.round(jobT / all.length) + ' bot-seconds of jobs a match');
  const blow = all.filter(x => Math.abs(x.turf[0] - x.turf[1]) > 25).length;
  ok(blow <= 1, 'no runaways: ' + blow + ' of ' + all.length + ' matches ended more than 25 % of the map apart');
  res.forEach(l => console.log(l));
  const fails = res.filter(l => l.startsWith('FAIL')).length;
  if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL DIRECTOR TESTS PASSED');
})();
