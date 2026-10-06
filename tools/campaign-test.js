#!/usr/bin/env node
/*  闯关 checks (headless, on 西關大屋): entering and leaving the campaign, the five buildings and their tug of
    war (damage, range, the 2 s protection, blasts, the door splashes), real shots and bot shots taking them,
    the end-of-round check (three held = cleared), the placeholder results, and 4v4 left as it was.
    Usage:  node tools/campaign-test.js                                                              */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
process.env.SR_MAP = 'canton';
eval(src.slice(src.indexOf('const root'), src.indexOf('const weapons')));
const g = makeSandbox();
const tests = function () {
  const res = []; const ok = (c, m) => res.push((c ? 'PASS ' : 'FAIL ') + m);
  clock.getDelta = () => 1 / 30; for (let i = 0; i < 5; i++) loop();
  const run = (n, each) => { for (let i = 0; i < n; i++) { loop(); if (each && each(i)) return i; } return -1; };
  const toPlay = () => { let f = 0; while (G.state !== 'play' && f++ < 30 * 20) loop(); };
  // ---- entering: the campaign's own length and map; the player's 4v4 choice is kept aside
  GAME.dur = 300; Profile.save(); const durSaved = Profile.data.dur;
  Camp.enter('xiguan'); openLobby(); const lobbyCamp = $('lobby').classList.contains('camp'), goal = $('lobbyGoal').innerHTML;
  Profile.save(); const durKept = Profile.data.dur;
  enforceRoster(); startMatch(); Input.locked = true; toPlay();
  const S = Shops.list, names = S.map(s => s.name).join();
  ok(Camp.on && GAME.dur === 90 && G.left <= 90 && G.left > 85 && MAP_ID === 'canton' && lobbyCamp && goal.includes('霸住至少 3 间') && durSaved === 300 && durKept === 300 && !Strategist.on && $('hud').classList.contains('camp'),
    'entering: 1:30 on 西關大屋, the lobby shows the goal (and hides map and length), the player\'s own 3:00/5:00 choice is not overwritten, the strategist is off');
  ok(S.length === 5 && names === '吳系茶餐廳,源記腸粉,鎮海樓,陳添記魚皮,廣州酒家' && S.every(s => s.owner === -1 && s.v === 0 && s.skins.length > 0) && S[0].boxes[0].y0 > 1.5,
    'five buildings: 吳系茶餐廳 and 源記腸粉 on our side, 鎮海樓 in the middle, 陳添記魚皮 and 廣州酒家 on theirs - all neutral, with their ink skins, at the map\'s real heights');
  // ---- the tug of war, by hand
  const P = PLAYER, Y = S[1], E = CHARS.find(c => c.team === 1), M = CHARS.find(c => c.team === 0 && !c.isPlayer), at = (c, x, y, z) => c.pos.set(x, y, z);
  const face = new THREE.Vector3(26.0, Y.boxes[0].y0 + 1.5, 21);
  at(P, 18, Y.boxes[0].y0 + 0.3, 21); let n = 0; while (Y.owner !== 0 && n < 200) { Shops.hit(P, face, 36); n++; }
  const took = Y.owner === 0 && Y.v === 1, hitsToTake = n, banner = $('shopBanner').innerHTML;
  at(E, 20, Y.boxes[0].y0 + 0.3, 21); const before = Y.v; Shops.hit(E, face, 300); const guarded = Y.v === before;
  G.time += 2.1; for (let i = 0; i < 400 && Y.owner === 0; i++) Shops.hit(E, face, 36); const lost = Y.owner === -1 && Y.v <= 0;
  for (let i = 0; i < 400 && Y.owner !== 1; i++) Shops.hit(E, face, 36); const theirs = Y.owner === 1 && Y.v === -1;
  ok(took && hitsToTake >= 18 && hitsToTake <= 26 && banner.includes('源記腸粉') && guarded && lost && theirs,
    'tug of war: ' + hitsToTake + ' rifle hits fill a neutral shop (≈ 2.7 s of fire) and it is ours; for 2 s the other side can\'t push it; then they wash it back to neutral first, and only then is it theirs');
  // range, teammates, blasts
  const Z = S[2], tower = new THREE.Vector3(0, Z.boxes[0].y0 + 2, 2.6);
  at(P, 0, Z.boxes[0].y0, 22); const far = Shops.hit(P, tower, 36);
  at(P, 0, Z.boxes[0].y0, 12); const v0 = Z.v; Shops.hit(P, tower, 36); const dp = Z.v - v0; at(M, 1, Z.boxes[0].y0, 12); Shops.hit(M, tower, 36); const dm = Z.v - v0 - dp;
  const v1 = Z.v; Shops.blast(P, new THREE.Vector3(0, Z.boxes[0].y0 + 1, 3.5), 3.6, 140); const blasted = Z.v > v1;
  const wk = c => Shops.WK[c.weapon.id] || 1;
  ok(!far && Math.abs(dm / dp - Shops.MATE * wk(M) / wk(P)) < 1e-6 && Z.size > 1 && blasted, 'range and help: hits from 20 m away do not count; a teammate\'s hit counts ' + Shops.MATE + 'x a player\'s; 鎮海樓 takes ' + Z.size + 'x as much; a bomb next to it counts');
  // door splashes
  const doorOwn = () => { const [x, z] = Shops.doors(Y)[0]; return ownerAt(x, groundBelow(x, z, Y.boxes[0].y0 + 1.5, 1), z); };
  const Wx = S[0]; Wx.owner = 0; Wx.v = 1; Wx.pourT = 0.01; const [wx, wz] = Shops.doors(Wx)[0]; resetPaint(); run(3); const poured = ownerAt(wx, groundBelow(wx, wz, Wx.boxes[0].y0 + 1.5, 1), wz) === 0;
  ok(poured && typeof doorOwn() === 'number', 'a held building splashes our ink at its door every few seconds');
  // ---- real shots: the player stands in the arcade street and fires at 源記腸粉's front
  startMatch(); Input.locked = true; toPlay(); const R = Shops.list[1], y0 = R.boxes[0].y0;
  const P2 = PLAYER; P2.pos.set(19, y0 + 0.05, 22); P2.vel.set(0, 0, 0); P2.ink = 100;
  CHARS.forEach(c => { if (c !== P2) { c.pos.set(-20, y0, c.team ? -49 : 49); } }); G.bots.forEach(b => { b._u = b.update; b.update = () => { }; });
  let fr = run(30 * 8, () => { P2.pos.set(19, y0 + 0.05, 22); P2.vel.set(0, 0, 0); P2.ink = 100; Cam.yaw = Math.PI / 2; Cam.pitch = -0.02; Input.fire = true; return R.owner === 0; });
  Input.fire = false; const ring = $('capRing').classList.contains('on');
  ok(fr > 0 && fr / 30 < 6 && Shops.stats.pHits > 10 && ring, 'real shots: firing the rifle at 源記腸粉 from the street takes it in ' + (fr / 30).toFixed(1) + ' s (' + Shops.stats.pHits + ' hits), with the ring round the crosshair showing');
  // ---- the bots: left to themselves for a round, both sides shoot buildings and take some
  startMatch(); Input.locked = true; toPlay(); G.pilot = true; G.bots.push(new Bot(PLAYER, 'front'));
  run(30 * 100, () => G.state !== 'play');
  const caps = Shops.stats.caps, bh = Shops.stats.botHits;
  ok(bh[0] > 50 && bh[1] > 50 && caps[0] + caps[1] >= 3, 'bots: over a round both sides shoot the buildings (' + bh.join(' / ') + ' hits) and take them (' + caps.join(' / ') + ' times)');
  // ---- end of the round: three held = cleared, then the placeholder results
  const fin = Camp.last; let f = 0; while (G.state !== 'results' && f++ < 30 * 10) loop();
  ok(!!fin && fin.need === 3 && fin.pass === (fin.held >= 3) && G.state === 'results' && $('campres').classList.contains('show') && !$('results').classList.contains('show') && $('crLine').innerHTML.includes('霸住'),
    'end of the round: held ' + (fin ? fin.held : '?') + ' → ' + (fin && fin.pass ? '过关' : '未过关') + '; the placeholder results show (not the 4v4 one)');
  // forced: three of ours at the whistle clears it, two doesn't
  startMatch(); Input.locked = true; toPlay(); Shops.list.forEach((s, i) => { s.owner = i < 3 ? 0 : 1; }); const three = Camp.finish().pass; Shops.list[2].owner = 1; const two = Camp.finish().pass;
  ok(three && !two, 'clearing: holding three at the end clears the round, two does not (the turf does not matter)');
  // the pause card, restart
  pauseGame(); const pc = $('pause').classList.contains('camp') && $('pauseGoal').innerHTML.includes('霸住'); resumeGame();
  ok(pc, 'pause: shows the round\'s goal card and how many are held, with a restart button');
  // ---- leaving: 4v4 as it was
  G.pilot = null; quitToTitle(); run(3); const outOk = !Camp.on && GAME.dur === 300 && Shops.list.length === 0 && Strategist.off !== true;
  openLobby(); const lob = !$('lobby').classList.contains('camp'); startMatch(); toPlay(); const vs = !Shops.on && G.left > 290 && !$('hud').classList.contains('camp') && Strategist.on;
  quitToTitle(); run(3);
  ok(outOk && lob && vs, 'leaving: back to the player\'s own 5:00, no buildings, the strategist back on, the lobby and HUD as in 4v4');
  return res;
};
const out = vm.runInContext('(' + tests.toString() + ')()', g);
out.forEach(l => console.log(l));
const fails = out.filter(l => l.startsWith('FAIL')).length;
if (fails) { console.log(fails + ' FAILED'); process.exitCode = 1; } else console.log('ALL CAMPAIGN TESTS PASSED');
