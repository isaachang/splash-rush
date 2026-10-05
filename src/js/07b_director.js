/* ============================================================ DIRECTOR
   The difficulty levels.  Every tier runs on this: smart (智能) may go anywhere from 0 to 2.5, easy stays
   within 0-0.6, normal within 0.7-1.3, hell within 2-2.5 and never goes easier.  (Tests that set G.aiLevels
   to a tier still get that tier's fixed row.)  Watches how the player is doing and works out a level for them on the
   same scale as DIFF (0 easy · 1 normal · 2 hell, anything in between, and a little past hell).  Every bot
   carries its own level and moves toward a target: at once while it is dead or flying in, quickly while the
   player cannot see it, slowly while the two are fighting - so nobody turns into a sharpshooter mid-duel.
   The player decides the match: teammates sit a step below the player and the enemies at the player's level, so
   the player at their usual level is an even match and the player not pulling their weight is three weak
   teammates against four.  Nothing props up a side that is losing (save a small net for a player who is
   really trying and being crushed); a player's side running away with it makes the enemies sharpen up.
   Both sides play the score the way people do - behind, take ground; ahead, hold it.  It watches in every mode (so the saved estimate is ready
   for the next match), but only steers the bots in smart mode.                                              */
const SMART = -1, LV_MAX = 2.5;
const DIFF_DEF = { swimK: 0.9, dawdle: 0 };
// past hell, the hands only (level 2.5): sharper aim, quicker reflexes; what a bot knows stays hell's
const DIFF_TOP = { err: 0.025, react: 0.14, fireHold: 1, turn: 16, dodge: 0.9, swimK: 0.99, dawdle: 0 };
const DIFF_HANDS = ['err', 'react', 'fireHold', 'turn', 'dodge', 'swimK', 'dawdle'];
const DIFF_KNOW = ['team', 'focus', 'retreat', 'combo', 'ambush', 'bombSmart', 'sjump', 'climb', 'endgame', 'share', 'inkCare'];
// a difficulty row for any level: aim and reflexes blend between the tiers; what a bot knows (teamwork, focus fire, combos...) comes
// from the tier below or the tier above - `hi` - so that a 1.3 thinks like hell about 30 % of the time (Director.brain picks it)
function diffAt(lv, hi) {
  lv = clamp(lv, 0, LV_MAX); const r = Math.round(lv); if (r <= 2 && Math.abs(lv - r) < 1e-6) return DIFF[r];
  const top = lv > 2, i = top ? 2 : Math.floor(lv), a = DIFF[i], b = top ? DIFF_TOP : DIFF[i + 1], t = top ? (lv - 2) / (LV_MAX - 2) : lv - i;
  const know = DIFF[top ? 2 : hi ? i + 1 : i], o = {};
  for (const k of DIFF_HANDS) o[k] = lerp(a[k] ?? DIFF_DEF[k], b[k] ?? DIFF_DEF[k], t);
  for (const k of DIFF_KNOW) o[k] = know[k] ?? 0;
  return o;
}
const avgOf = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
// what each tier is for, and every system's settings for it:  easy "let rip" · normal "give and take" · hell "every wave a hard fight".
// Smart slides between them with the player's level - easy up to 0.5, normal at 1.3, hell from 2.3 (0.3 above the tiers: a judged level already
// includes what the aids give, and keying on it straight would take them away too soon).  Lull lengths are for 3:00 (scaled with the match)
//   tokens   how many may shoot at the player at once      warn / behindMin / behindReact   warning shots, and when shot from behind
//   grace    the breather when low                          heatEase / heatHard   how much a losing / winning run of duels moves the enemies
//   relax    lull length          counter / readK   how hard the counter-plans lean, how quickly the player is read (x the usual)
//   hunters  sent after the player in a wave                stomp*/ease*   when the player's side running away starts to be checked
//   net      a crushed player who is trying gets the safety net       foeOff   the enemies this far from the player's level
const TIER_PROFILE = [
  { tokens: 1, warn: 0.8, behindMin: 0.25, behindReact: 1.4, grace: 1, heatEase: 1, heatHard: 0.5, relax: 25, counter: 0, readK: 1.3, hunters: 0, stompStart: 0.12, stompSlope: 4, easeStart: 0.1, net: 1, foeOff: -0.2 },
  { tokens: 2, warn: 0.5, behindMin: 0.25, behindReact: 1.4, grace: 0.6, heatEase: 0.7, heatHard: 0.7, relax: 13, counter: 0.5, readK: 1, hunters: 2, stompStart: 0.05, stompSlope: 4, easeStart: 0.04, net: 1, foeOff: 0 },
  { tokens: 4, warn: 0, behindMin: 0, behindReact: 1, grace: 0, heatEase: 0, heatHard: 1, relax: 6, counter: 1, readK: 0.6, hunters: 3, stompStart: 0.04, stompSlope: 5, easeStart: 0.03, net: 0, foeOff: 0 }
];
function tierProfile(lv) {
  const [a, b, t] = lv <= 0.5 ? [0, 0, 0] : lv < 1.3 ? [0, 1, (lv - 0.5) / 0.8] : lv < 2.3 ? [1, 2, lv - 1.3] : [2, 2, 0], A = TIER_PROFILE[a], B = TIER_PROFILE[b], o = {};
  for (const k in A) o[k] = lerp(A[k], B[k], t);
  return o;
}
const Director = {
  K: 0.8,                                                                  // how sharply a level gap turns into duel odds: p = 1 / (1 + e^(-K·gap))
  PAINT_K: { rifle: 1, smg: 0.82, charger: 0.49, splatling: 0.58, blaster: 0.9 },   // how much each weapon paints, relative to the rifle
  HIT: { rifle: 0.45, smg: 0.3, charger: 0.4, splatling: 0.25, blaster: 0.4 },   // share of shots on target for a normal bot (a level is worth about 0.15 more)
  RATE: { fight: 0.012, seen: 0.03, away: 0.08 },                          // how fast a bot's level may move (per second, at 3:00; shorter matches move faster)
  PF: { start: 0.06, span: 0.12 },                                          // playing the score: from how far apart, fully by how much further
  OFF: { mates: 0.2, foes: 0 },                                              // teammates / enemies this far below the player
  st: null,
  // 'smart', a tier (0 easy · 1 normal · 2 hell), or 'fixed' - a test pitting fixed rows against each other (G.aiLevels)
  mode() { if (!PLAYER) return 'fixed'; if (G.aiLevels) return G.aiLevels[1 - PLAYER.team] === SMART ? 'smart' : 'fixed'; return GAME.diff === SMART ? 'smart' : GAME.diff; },
  get on() { return this.mode() !== 'fixed'; },
  // this match's tier profile (smart: from the player's level, re-read every frame)
  profile() { const m = this.mode(); return typeof m === 'number' ? TIER_PROFILE[m] : m === 'smart' ? tierProfile(this.skill) : TIER_PROFILE[1]; },
  BANDS: [[0, 0.6], [0.7, 1.3], [2, LV_MAX]],                              // the room each tier has; smart has all of it
  band() { const m = this.mode(); return typeof m === 'number' ? this.BANDS[m] : [0, LV_MAX]; },
  // the saved levels, one per character + weapon (石墩's double health makes the same hands a different player).  An old single value
  // from before (key '*') belongs to no loadout; it only seeds the ones never played
  skillBook() {
    let b = Profile.data.skill;
    if (!b || typeof b !== 'object') b = {}; else if (typeof b.s === 'number') b = { '*': { s: b.s, m: b.m || 1 } };
    for (const k in b) if (!b[k] || !isFinite(b[k].s)) delete b[k];
    return (Profile.data.skill = b);
  },
  loadoutKey(c) { return c.cs.id + '-' + c.weapon.id; },
  loadoutName(key) { const [ch, w] = key.split('-'); return (CHARACTERS[ch] ? CHARACTERS[ch].name : ch) + '·' + (WEAPONS[w] ? WEAPONS[w].name : w); },
  reset() {
    // this loadout's own saved level; never played with it: the others' average (weighted by how many matches each has), as a start only
    const book = this.skillBook(), key = this.key = this.loadoutKey(PLAYER), own = book[key], rest = Object.values(book), wsum = rest.reduce((a, r) => a + (r.m || 1), 0);
    this.seed = !own && rest.length ? rest.reduce((a, r) => a + r.s * (r.m || 1), 0) / wsum : null;
    const prior = clamp(own ? own.s : this.seed ?? 1, 0, LV_MAX);
    this.mem = own || null; this.elo = prior; this.n = own ? Math.min(4, (own.m || 1) * 1.5) : 0; this.nm = 0;
    const [lo, hi] = this.band(), start = clamp(prior, lo, hi);           // a tier starts from the saved level, kept within the tier
    this.skill = prior; this.target = this.mateGoal = start; this.conf = 0; this.corrE = this.corrM = 0; this.planBonus = 0; this.stomp = this.net = this.mateEase = this.foeEase = 0; this.lead = 0; this.boost = 1; this.effort = 0.7; this.eff = []; this.effT = 0; this.sig = {}; this.sigT = 0; this.panelT = 0;
    this.wasClimb = false; this.cheat = false; this.saved = null; this.tp = this.profile();
    this.fights = new Map(); this.log = []; this.trace = []; this.allDuels = [];
    this.st = { alive: 0, shots: 0, hits: 0, swimT: 0, refillT: 0, climbs: 0, bombs: 0, idleT: 0 };
    this.calibT = Math.min(60, 15 + GAME.dur / 6); this.endWin = clamp(Math.round(10 + GAME.dur / 9), 20, 40);
    this.squadBrain = [{}, {}]; this.teamRow = [diffAt(start), diffAt(start)];
    for (const b of G.bots) b.lv = start;
  },
  bots() { return G.bots.filter(b => !b.c.isPlayer); },
  enemies() { return G.bots.filter(b => b.c.team !== PLAYER.team); },
  // tier below or above for what it knows, re-picked every 8-14 s.  The draw is kept for the whole stretch, so as the level climbs
  // a bot switches up once and stays there instead of flickering
  brain(o, lv) { if (G.time >= (o.brainT || 0)) { o.brainT = G.time + rand(8, 14); o.brainU = Math.random(); } return lv <= 2 && o.brainU < lv - Math.floor(lv); },
  // the difficulty a bot plays at (smart mode).  Without a bot: the team as a whole, for the squad's decisions
  row(team, bot) {
    if (!bot) return this.teamRow[team];
    if (bot.lv === undefined) bot.lv = this.goal(bot);
    const hi = this.brain(bot, bot.lv);
    if (bot.dRowLv !== bot.lv || bot.dRowHi !== hi) { bot.dRowLv = bot.lv; bot.dRowHi = hi; bot.dRow = diffAt(bot.lv, hi); }
    return bot.dRow;
  },
  goal(b) { return b.c.team === PLAYER.team ? this.mateGoal : this.target; },
  teamLevel(tm) { const sb = this.squadBrain && this.squadBrain[tm]; return sb && sb.lv != null ? sb.lv : this.skill; },
  // the level a bot is playing at right now (fixed modes: the chosen tier)
  lvOf(c) { if (this.on) return c.bot && c.bot.lv !== undefined ? c.bot.lv : c.team === PLAYER.team ? this.mateGoal : this.target; const l = G.aiLevels ? G.aiLevels[c.team] : GAME.diff; return l >= 0 && l <= 2 ? l : 1; },
  endWindow() { return this.on ? this.endWin : 30; },
  idle() { return !G.pilot && this.st.idleT > 10; },
  inView(c, from) {
    if (!from) return false; const e = from.eye(), ch = c.chest(), dx = ch.x - e.x, dz = ch.z - e.z, d = Math.hypot(dx, dz);
    if (d > 40) return false; if (d > 2 && Math.abs(angDiff(from.aimYaw, Math.atan2(dx, dz))) > 0.95) return false;
    return !segBlocked(e.x, e.y, e.z, ch.x, ch.y, ch.z, 0.4);
  },
  // ---------------------------------------------------------------- what happened
  fight(e) { let f = this.fights.get(e); if (!f) { f = { e, t0: G.time, last: G.time, dealt: 0, taken: 0, lv: this.lvOf(e), help: -99, out: 0 }; this.fights.set(e, f); } return f; },
  onDamage(v, amount, src, via) {
    const P = PLAYER; if (!P || !this.st || !src) return;
    if (src.team !== v.team) { src.dDealt = (src.dDealt || 0) + amount / v.maxHp; v.dTaken = (v.dTaken || 0) + amount / v.maxHp; }
    if (v === P && src.team !== P.team) { const f = this.fight(src); f.taken += amount / v.maxHp; f.last = G.time; f.out = Math.max(f.out, CHARS.filter(o => o.team !== P.team && P.dmgBy.get(o) > G.time - 4).length); }
    else if (src === P && v.team !== P.team) { const f = this.fight(v); f.dealt += amount / v.maxHp; f.last = G.time; if (via === P.weapon.id) this.st.hits++; }
    else if (src.team === P.team && v.team !== P.team && this.fights.has(v)) this.fights.get(v).help = G.time;
  },
  onDeath(v, killer, via) {
    const P = PLAYER; if (!P || !this.st) return; const T = G.time;
    if (v.team !== P.team) {
      const f = this.fights.get(v); if (!f) return; this.fights.delete(v);
      if (killer !== P && f.dealt < 0.4) return;                           // a teammate's knock-out we barely touched: not our duel
      this.resolve(f, 1, (T - f.help < 4 ? 0.5 : 1) * (f.out >= 2 ? 1.5 : 1));
    } else if (v === P) {
      const by = CHARS.filter(o => o.team !== P.team && P.dmgBy.get(o) > T - 4), n = Math.max(1, by.length);
      const w = (n === 1 ? 1 : n === 2 ? 0.2 : 0.05) * (via === 'surge' || via === 'bomb' || via === 'curling' ? 0.3 : 1) * (this.idle() ? 0 : 1);
      for (const [e, f] of this.fights) if (by.includes(e)) this.resolve(f, 0, w);
      this.fights.clear();
    }
  },
  onShot(c) {
    if (c !== PLAYER || !this.st) return;
    const m = c.muzzle(), dir = c.intent.aimDir || aimVec(c), R = (c.weapon.maxRange || c.weapon.range) + 2;
    for (const e of CHARS) {
      if (e.team === c.team || !e.alive || e.state !== 'play' || e.hiddenInInk()) continue;
      const ch = e.chest(), dx = ch.x - m.x, dy = ch.y - m.y, dz = ch.z - m.z, d = Math.hypot(dx, dy, dz); if (d > R || d < 0.5) continue;
      if ((dx * dir.x + dy * dir.y + dz * dir.z) / d > Math.cos(Math.max(0.1, Math.atan(1.2 / d)))) { this.st.shots++; return; }
    }
  },
  onBomb(c) { if (c === PLAYER && this.st) this.st.bombs++; },
  // one duel settled: move the estimate by how surprising the result was, given the level the enemy was playing at
  resolve(f, o, w) {
    if (w <= 0 || (o < 0.5 && this.effort < 0.4)) return;                  // (a duel lost while not trying says nothing)
    Combat.onDuel(o, w);
    const p = 1 / (1 + Math.exp(-this.K * (this.elo - f.lv))), step = Math.min(G.time < this.calibT ? 1 : 0.2, Math.max(0.12, 0.7 / (1 + this.n * 0.35)));   // big steps while calibrating, small ones after
    this.elo = clamp(this.elo + step * w * (o - p), 0, LV_MAX); this.n += w; this.nm += w;
    this.log.unshift({ o, p, w, lv: f.lv, name: f.e.name, t: G.time }); if (this.log.length > 6) this.log.pop();
    if (G.dirTrace) this.allDuels.push([o, w, f.lv, f.out]);
  },
  // ---------------------------------------------------------------- the estimate
  paintK(c) { return this.PAINT_K[c.weapon.id] || 1; },
  signals() {
    const P = PLAYER, st = this.st, S = this.sig = {}, aliveM = st.alive / 60, R = this.raw = {};
    const mates = CHARS.filter(c => c.team === P.team && c !== P && (c.dirAlive || 0) > 5);
    if (st.alive > 20 && mates.length) {
      // compared with the teammates, who play the same enemies at a level we know: turf painted per minute alive
      // (allowing for how much each weapon paints), damage dealt against damage taken, and knock-outs suffered
      // (measured against the teammates' level plus half the step they were set below the player: these signals barely tell levels apart
      //  and would otherwise drag a strong player down toward the teammates; the full step reads a weak player too high early on)
      const [blo, bhi] = this.band(), base = avgOf(mates.map(c => this.lvOf(c))) + (this.on ? 0.5 * Math.max(0, clamp(this.skill, blo, bhi) - this.mateGoal) : 0), grow = Math.min(1, st.alive / 60), lr = c => Math.log2(((c.dDealt || 0) + 0.5) / ((c.dTaken || 0) + 0.5));
      const pr = P.paint / this.paintK(P) / aliveM, mr = avgOf(mates.map(c => c.paint / this.paintK(c) / (c.dirAlive / 60)));
      if (mr > 0) { R.paint = Math.log2(Math.max(0.05, pr / mr)); S.paint = { v: base + 1.6 * R.paint, w: 0.7 * grow }; }
      R.dmg = lr(P) - avgOf(mates.map(lr)); S.dmg = { v: base + 0.7 * R.dmg, w: 0.6 * grow };
      const pd = (P.deaths + 0.5) / (aliveM + 0.5), md = avgOf(mates.map(c => (c.deaths + 0.5) / (c.dirAlive / 60 + 0.5)));
      R.surv = Math.log2(md / pd); S.surv = { v: base + 0.5 * R.surv, w: 0.4 * grow };
    }
    if (st.shots >= 12) S.hit = { v: 1 + (Math.min(1, st.hits / st.shots) - (this.HIT[P.weapon.id] || 0.4)) / 0.15, w: 0.3 * Math.min(1, st.shots / 50) };
    // the basics a beginner has not found yet: swimming to travel, topping up under the ink, climbing, super jumps, bombs.
    // Only ever a sign of a beginner - knowing three or more says nothing about how good someone is
    if (st.alive > 25) { const sc = (st.swimT > 2) + (st.refillT > 1.5) + (st.climbs > 0) + (P.sjumps > 0) + (st.bombs > 0); if (sc < 3) S.know = { v: 0.1 + sc * 0.25, w: this.mem ? 0.3 : 0.8 }; }
    let sw = 0.6 + this.n * 0.5, sv = this.elo * sw;
    for (const k in S) { S[k].v = clamp(S[k].v, 0, LV_MAX); sv += S[k].v * S[k].w; sw += S[k].w; }
    // smoothed, so one duel does not jolt the whole lobby; after calibration it may move at most 0.012 a second
    const cal = G.time < this.calibT, d = (clamp(sv / sw, 0, LV_MAX) - this.skill) * (1 - Math.exp(-0.5 / (cal ? 2.5 : 10)));
    const dd = this.effort < 0.4 ? Math.max(0, d) : d;                   // (not trying: the level may go up, never down)
    this.skill += cal ? dd : clamp(dd, -0.006, 0.006); this.conf = 1 - 1 / (1 + 0.35 * (sw - 0.6));
  },
  // a score running away (more than 6 % of the map apart, at full strength by 24 %): the enemies move against it; whatever they
  // cannot take - already at the edge of the tier - goes to the teammates, who otherwise move 40 % as far the other way, 0.5 at most.
  // Everything stays within the tier; and hell never goes easy on a player who is behind - no easing off, no help from teammates
  steer() {
    const tc = Paint.teamCells, P = PLAYER, [lo, hi] = this.band(), hell = this.mode() === 2, sk = clamp(this.skill, lo, hi);
    this.lead = (tc[P.team] - tc[1 - P.team]) / Math.max(1, Paint.total);
    // the sides: teammates a step below the player (not below 0.5 unless the player is), the enemies at the player's level - so the player at
    // their usual level is an even match, and a player not pulling their weight is three weak teammates against four
    this.mateGoal = clamp(Math.max(sk - this.OFF.mates, Math.min(sk, 0.5)), lo, hi);
    // the player's side running away with it (past 5 %): the enemies sharpen up, up to +0.6 by 20 % ahead
    const tp = this.tp; this.stomp = Math.min(0.6, Math.max(0, this.lead - tp.stompStart) * tp.stompSlope);
    // the player's side crushed (past 25 %) while the player is really trying: a small net, never for one not pulling their weight, never on hell
    this.net = !hell && tp.net >= 0.5 && this.effort >= 0.5 ? Math.min(0.25, Math.max(0, -this.lead - 0.25) * 2.5) : 0;
    // bots busy countering the player play a little less efficiently; slightly sharper hands make up for it (only in a close game)
    this.planBonus = Strategist.on ? 0.15 * Strategist.k : 0;
    this.target = clamp(sk - this.OFF.foes + tp.foeOff + this.stomp - this.net + this.planBonus, lo, hi);
    this.corrE = this.target - sk; this.corrM = this.mateGoal - sk;
    this.boost = 1 + clamp((this.lead - 0.1) / 0.06, 0, 2);                   // (the enemies out of sight close in faster - only when the player's side is running away)
    // both sides play the score the way people do: the side behind keeps to taking ground, the side ahead holds its own (retakes what was
    // turned over, keeps an eye on the way in) - nobody is made stronger or weaker for it.  One exception, and only one way round: the
    // player's side running away with it, the teammates ease off (hang back, stop chasing) - so the player's side does not stomp
    const f = clamp((Math.abs(this.lead) - this.PF.start) / this.PF.span, 0, 1), sg = Math.sign(this.lead);
    this.pf = []; this.pf[P.team] = -sg * f; this.pf[1 - P.team] = sg * f; this.mateEase = sg > 0 ? clamp((this.lead - tp.easeStart) / 0.08, 0, 1) : 0;
    // ...and the safety net's real lever (levels hardly move the turf): crushed past 15 % while really trying, the enemies ease off the same way
    this.foeEase = !hell && tp.net >= 0.5 && this.effort >= 0.5 ? clamp((-this.lead - 0.15) / 0.1, 0, 1) : 0;
  },
  // 1 take ground · 0 as usual · -1 hold what we have
  paintFocus(team) { return this.on && this.pf ? this.pf[team] : 0; },
  // holding back (0..1): the player's teammates while their side is well ahead; the enemies while a player who is trying is being crushed
  mateEaseOf(team) { return this.on && PLAYER ? (team === PLAYER.team ? this.mateEase : this.foeEase) || 0 : 0; },
  // extra score for a spot to paint: taking ground wants what is not ours yet; holding wants our own half back where it was turned over
  turfBias(team, own, zRel) { const f = this.paintFocus(team), ease = this.mateEaseOf(team); if (ease) return -ease * zRel * 2.5; return f > 0 ? (own !== team ? 2 * f : 0) : f < 0 ? (own !== team && own !== -2 && zRel < 0.1 ? -2.5 * f : 0) + (zRel > 0.3 ? f * zRel * 1.5 : 0) : 0; },
  // ---------------------------------------------------------------- how much the player is pulling their weight (last ~45 s, 0..1)
  // moving and shooting, out of the spawn, painting and dealing damage like the teammates do.  Without it there is no safety net, and
  // the level does not drop: playing badly on purpose must not make the match easier
  effortTick(dt) {
    const P = PLAYER; if ((this.effT -= dt) > 0) return; this.effT = 0.5;
    if (!P.alive || P.state !== 'play') return;                           // (time dead is neither here nor there)
    const mates = CHARS.filter(c => c.team === P.team && c !== P), sum = (f) => mates.reduce((s, c) => s + f(c), 0);
    const sp = SPAWN[P.team], s = { act: Math.hypot(P.vel.x, P.vel.z) > 1 || G.time - P.lastShot < 0.6 ? 1 : 0, away: Math.hypot(P.pos.x - sp.x, P.pos.z - sp.z) > 16 ? 1 : 0,
      paint: P.paint / this.paintK(P), dealt: P.dDealt || 0, mPaint: sum(c => c.paint / this.paintK(c)) / Math.max(1, mates.length), mDealt: sum(c => c.dDealt || 0) / Math.max(1, mates.length) };
    this.eff.push(s); if (this.eff.length > 90) this.eff.shift(); if (this.eff.length < 8) return;
    const a = this.eff[0], b = s, avg = k => this.eff.reduce((t, e) => t + e[k], 0) / this.eff.length;
    const rel = (d, m) => m > 0.01 ? clamp(d / m, 0, 1) : d > 0 ? 1 : 0.3;
    this.effort = clamp(0.2 * avg('act') + 0.1 * avg('away') + 0.35 * rel(b.paint - a.paint, b.mPaint - a.mPaint) + 0.35 * rel(b.dealt - a.dealt, b.mDealt - a.mDealt), 0, 1);
  },
  // ---------------------------------------------------------------- every frame of play
  update(dt) {
    const P = PLAYER; if (!P || !this.st) return; const T = G.time, st = this.st;
    if (devGod() || vipOn()) this.cheat = true;
    this.tp = this.profile();
    this.effortTick(dt);
    if (P.alive && P.state === 'play') {
      const sp = Math.hypot(P.vel.x, P.vel.z);
      st.idleT = sp > 0.5 || T - P.lastShot < 0.3 ? 0 : st.idleT + dt;
      if (!this.idle()) {
        st.alive += dt;
        if (P.submerged && sp > 7) st.swimT += dt;
        if (P.submerged && sp < 2 && P.ink < 70) st.refillT += dt;
        if (P.climbing && !this.wasClimb) st.climbs++;
      }
      this.wasClimb = P.climbing;
    }
    for (const c of CHARS) if (c.team === P.team && c !== P && c.alive && c.state === 'play') c.dirAlive = (c.dirAlive || 0) + dt;
    // a fight nobody has followed up for four seconds: settle it on the damage traded, at low weight
    for (const [e, f] of this.fights) if (T - f.last > 4) { this.fights.delete(e); if (f.dealt + f.taken > 0.5) this.resolve(f, clamp(0.5 + (f.dealt - f.taken) * 0.5, 0, 1), 0.3); }
    if ((this.sigT -= dt) <= 0) { this.sigT = 0.5; this.signals(); }
    this.steer();
    // every bot moves toward its goal at a pace that depends on whether the player could notice
    const kd = Math.sqrt(180 / GAME.dur), from = P.alive ? P : Cam.spec, all = this.bots();
    for (const b of all) {
      const c = b.c, goal = this.goal(b); if (b.lv === undefined) b.lv = goal;
      let s; const f = this.fights.get(c);
      if (!c.alive || c.state !== 'play') s = 'respawn';
      else if (c.team !== P.team && (b.enemy === P || (f && T - f.last < 2.5))) s = 'fight';
      else { if ((b.seeT = (b.seeT || 0) - dt) <= 0) { b.seeT = 0.25; b.seen = this.inView(c, from); } s = b.seen ? 'seen' : 'away'; }
      b.dState = s;
      if (!this.on) continue;
      if (s === 'respawn') b.lv = goal;
      else { const r = this.RATE[s] * (s === 'away' ? this.boost : 1) * kd * dt; b.lv += clamp(goal - b.lv, -r, r); }
    }
    for (const tm of [0, 1]) {
      const tb = all.filter(b => b.c.team === tm); if (!tb.length) continue;
      const tl = Math.round(avgOf(tb.map(b => b.lv)) * 100) / 100, sb = this.squadBrain[tm], hi = this.brain(sb, tl);
      if (sb.lv !== tl || sb.hi !== hi) { sb.lv = tl; sb.hi = hi; this.teamRow[tm] = diffAt(tl, hi); }
    }
    if (G.dirTrace) this.trace.push([T, this.skill, this.target, ...this.enemies().map(b => b.lv)]);
    DirPanel.update(dt);
  },
  // end of a match: fold this match into this loadout's saved level - a rolling average, 0.6 old + 0.4 new, the new part counting for less after
  // a short match or few fights.  Not with a name-box mode on (that is cheating), nor in tests where a bot plays for the player
  save() {
    if (G.pilot || G.aiLevels || !PLAYER || !this.st || this.cheat || this.st.alive < 30) return;
    const sv = this.mem, q = Math.min(1, this.st.alive / 120) * Math.min(1, (this.nm + 1) / 6), s = sv ? lerp(sv.s, this.skill, 0.4 * q) : this.skill;
    this.saved = this.skillBook()[this.key] = { s: Math.round(s * 100) / 100, m: Math.min(10, (sv ? sv.m || 1 : 0) + 1) }; Profile.save();
  },
  // the panel lives in DirPanel (press ` during a match)
  toggle() { DirPanel.toggle(); },
  tier(v) { if (v > 2.15) return '地狱+'; const r = clamp(Math.round(v), 0, 2), d = v - r; return ['轻松', '普通', '地狱'][r] + (d > 0.15 ? '·偏强' : d < -0.15 ? '·偏弱' : ''); }
};
