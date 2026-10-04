#!/usr/bin/env node
/*  Smart-difficulty checks with whole matches (headless, about 2 minutes).  A rifle bot stands in for the player
    at a fixed tier, the Director runs the lobby, and we look at what it concluded.  Bot tiers differ less from
    one another than real players do (hell bots win mostly through teamwork), so the bars are set on averages
    of four matches, and only the gaps the stand-ins really have are asked for.
    Usage:  node tools/director-test.js                                                                        */
const { execFile } = require('child_process'), path = require('path');
const bench = (p, secs) => new Promise((ok, no) => execFile(process.execPath, [path.join(__dirname, 'director-bench.js'), 'canton', String(p), 's', '4', String(secs)],
  { env: Object.assign({}, process.env, { JSON: '1', WEAPON: 'rifle' }), maxBuffer: 1 << 26 }, (e, out) => e ? no(e) : ok(JSON.parse(out))));
const avg = a => a.reduce((s, v) => s + v, 0) / a.length, f2 = v => v.toFixed(2), list = r => '[' + r.map(x => f2(x.skill)).join(' ') + ']';
(async () => {
  const [weak, mid, strong] = await Promise.all([bench(0, 90), bench(1, 300), bench(2, 180)]);
  const res = [], ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  const wCal = avg(weak.map(x => x.atCal)), wEnd = avg(weak.map(x => x.skill)), mEnd = avg(mid.map(x => x.skill)), sEnd = avg(strong.map(x => x.skill));
  ok(wCal <= 0.85 && wEnd <= 0.85, 'weak stand-in (easy rifle, 1:30): judged ' + f2(wCal) + ' by the end of the 30 s calibration window and ' + f2(wEnd) + ' at the end ' + list(weak) + ' (bar: 0.85 or lower)');
  ok(mEnd >= 0.6 && mEnd <= 1.5, 'normal stand-in (normal rifle, 5:00): judged ' + f2(mEnd) + ' ' + list(mid) + ' (bar: 0.6 to 1.5; in the player slot this stand-in wins about 57 % of even duels, so a little above 1 is right)');
  ok(sEnd >= 0.9 && sEnd >= wEnd + 0.3, 'strong stand-in (hell rifle, 3:00): judged ' + f2(sEnd) + ' ' + list(strong) + ' (bar: 0.9 or higher, and at least 0.3 above the weak one)');
  const all = weak.concat(mid, strong), sw = Math.max(...all.map(x => x.swing));
  ok(sw < 0.15, 'steady: after calibration the estimate never swings more than ' + f2(sw) + ' within 10 s (bar: under 0.15) [' + all.map(x => f2(x.swing)).join(' ') + ']');
  const blow = all.filter(x => Math.abs(x.turf[0] - x.turf[1]) > 25).length;
  ok(blow <= 1, 'no runaways: ' + blow + ' of ' + all.length + ' matches ended more than 25 % of the map apart');
  res.forEach(l => console.log(l));
  const fails = res.filter(l => l.startsWith('FAIL')).length;
  if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL DIRECTOR TESTS PASSED');
})();
