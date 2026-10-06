/* ============================================================ DIRECTOR
   The four tiers - 轻松 easy · 普通 normal · 困难 hard · 地狱 hell - and nothing that goes easy on anyone.
   A tier is simply how good the bots are (DIFF's scale: 0 easy, 1 normal, 2 hell, anything in between): the
   level is set when the match starts and stays.  Each bot is a person of its own within the tier - a little
   better or worse than the tier (about ±0.15), more pushy or more careful.  The player's teammates do not climb
   with the tier (hell's are a little above normal), and they are the supporting cast: they paint like anyone
   but shoot a little wider - so on the hard tiers it is the player who has to make the difference (the way
   Halo's marines or The Last of Us' companions are written, rather than CS or Rocket League, where the teammate
   bots are as strong as the enemies and carry you).  Both sides play the score
   the way people do: behind, take ground; ahead, hold it.
   It also keeps an estimate of how well the player is playing, for the panel only - nothing is steered by it.
   (Tests that set G.aiLevels pit fixed rows against each other instead.)                                   */
const LV_MAX = 2.5;
const DIFF_DEF = { swimK: 0.9, dawdle: 0 };
// past hell, the hands only (level 2.5): sharper aim, quicker reflexes, keener senses; what a bot knows stays hell's
const DIFF_TOP = { err: 0.025, react: 0.14, fireHold: 1, turn: 16, dodge: 0.9, swimK: 0.99, dawdle: 0, fov: 1.6, hear: 25, mem: 5, settle: 0.18, lead: 1, flinch: 0.15 };
const DIFF_HANDS = ['err', 'react', 'fireHold', 'turn', 'dodge', 'swimK', 'dawdle', 'fov', 'hear', 'mem', 'settle', 'lead', 'flinch'];
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
// the tiers.  lv: how good the enemies are; mates: how good the player's teammates are; mateAim: how much wider the teammates shoot
// (not on easy - a beginner needs the help); counter: how much the enemies adapt to the player's habits (the strategist)
const TIERS = [
  { name: '轻松', note: '放开打', lv: 0.3, mates: 0.2, mateAim: 1, counter: 0 },
  { name: '普通', note: '有来有回', lv: 1.0, mates: 0.85, mateAim: 1.1, counter: 0.5 },
  { name: '困难', note: '认真起来', lv: 1.5, mates: 1.2, mateAim: 1.15, counter: 0.75 },
  { name: '地狱', note: '每一波都是硬仗', lv: 2.0, mates: 1.35, mateAim: 1.25, counter: 1 }
];
const Director = {
  K: 0.8,                                                                  // how sharply a level gap turns into duel odds: p = 1 / (1 + e^(-K·gap))
  PAINT_K: { rifle: 1, smg: 0.82, charger: 0.49, splatling: 0.58, blaster: 0.9 },   // how much each weapon paints, relative to the rifle
  HIT: { rifle: 0.45, smg: 0.3, charger: 0.4, splatling: 0.25, blaster: 0.4 },   // share of shots on target for a normal bot (a level is worth about 0.15 more)
  PF: { start: 0.06, span: 0.12 },                                          // playing the score: from how far apart, fully by how much further
  SPREAD: 0.15,                                                             // each bot's own level, around the tier's
  st: null,
  // a tier (0 easy · 1 normal · 2 hard · 3 hell), or 'fixed' - a test pitting fixed rows against each other (G.aiLevels)
  mode() { return !PLAYER || G.aiLevels ? 'fixed' : clamp(GAME.diff | 0, 0, TIERS.length - 1); },
  get on() { return this.mode() !== 'fixed'; },
  tierOf() { const m = this.mode(); return TIERS[typeof m === 'number' ? m : 1]; },
  // the saved estimates, one per character + weapon (shown on the panel; 石墩's double health makes the same hands a different player)
  skillBook() {
    let b = Profile.data.skill;
    if (!b || typeof b !== 'object') b = {}; else if (typeof b.s === 'number') b = { '*': { s: b.s, m: b.m || 1 } };
    for (const k in b) if (!b[k] || !isFinite(b[k].s)) delete b[k];
    return (Profile.data.skill = b);
  },
  loadoutKey(c) { return c.cs.id + '-' + c.weapon.id; },
  loadoutName(key) { const [ch, w] = key.split('-'); return (CHARACTERS[ch] ? CHARACTERS[ch].name : ch) + '·' + (WEAPONS[w] ? WEAPONS[w].name : w); },
  reset() {
    const book = this.skillBook(), key = this.key = this.loadoutKey(PLAYER), own = book[key], rest = Object.values(book), wsum = rest.reduce((a, r) => a + (r.m || 1), 0);
    this.seed = !own && rest.length ? rest.reduce((a, r) => a + r.s * (r.m || 1), 0) / wsum : null;
    const prior = clamp(own ? own.s : this.seed ?? 1, 0, LV_MAX);
    this.mem = own || null; this.elo = prior; this.n = own ? Math.min(4, (own.m || 1) * 1.5) : 0; this.nm = 0;
    this.skill = prior; this.conf = 0; this.lead = 0; this.sig = {}; this.sigT = 0; this.wasClimb = false; this.cheat = false; this.saved = null;
    this.fights = new Map(); this.log = []; this.trace = []; this.allDuels = [];
    this.st = { alive: 0, shots: 0, hits: 0, swimT: 0, refillT: 0, climbs: 0, bombs: 0, idleT: 0 };
    this.calibT = Math.min(60, 15 + GAME.dur / 6); this.endWin = clamp(Math.round(10 + GAME.dur / 9), 20, 40);
    // every bot a person: its own level around the tier's (the teammates': around theirs), and a temperament - pushy or careful
    const tr = this.tierOf();
    for (const b of G.bots) {
      if (b.c.isPlayer) continue;
      b.lv = clamp((b.c.team === PLAYER.team ? tr.mates : tr.lv) + rand(-this.SPREAD, this.SPREAD), 0, LV_MAX);
      b.trait = { aggr: rand(-1, 1), care: rand(-1, 1) };
    }
    this.squadBrain = [{}, {}]; this.teamRow = [0, 1].map(tm => diffAt(this.teamLevel(tm)));
  },
  bots() { return G.bots.filter(b => !b.c.isPlayer); },
  enemies() { return G.bots.filter(b => b.c.team !== PLAYER.team); },
  // what a bot knows comes from the tier below or above, re-picked every 8-14 s (so a 1.5 plays like hell about half the time)
  brain(o, lv) { if (G.time >= (o.brainT || 0)) { o.brainT = G.time + rand(8, 14); o.brainU = Math.random(); } return lv <= 2 && o.brainU < lv - Math.floor(lv); },
  // the difficulty a bot plays at.  Without a bot: the team as a whole, for the squad's decisions
  row(team, bot) {
    if (!bot) return this.teamRow[team];
    if (bot.lv === undefined) bot.lv = this.tierOf().lv;
    const hi = this.brain(bot, bot.lv);
    if (bot.dRowLv !== bot.lv || bot.dRowHi !== hi) { bot.dRowLv = bot.lv; bot.dRowHi = hi; bot.dRow = diffAt(bot.lv, hi); }
    return bot.dRow;
  },
  teamLevel(tm) { const tb = this.bots().filter(b => b.c.team === tm && b.lv !== undefined); return tb.length ? avgOf(tb.map(b => b.lv)) : this.tierOf().lv; },
  // the player's teammates shoot this much wider than their level would (1 for everyone else, and in tests with fixed rows)
  aimOf(c) { return this.on && PLAYER && c.team === PLAYER.team && !c.isPlayer ? this.tierOf().mateAim : 1; },
  // the level a bot is playing at (tests with fixed rows: that row)
  lvOf(c) { if (this.on) return c.bot && c.bot.lv !== undefined ? c.bot.lv : this.tierOf().lv; const l = G.aiLevels ? G.aiLevels[c.team] : 1; return l >= 0 && l <= 2 ? l : 1; },
  endWindow() { return this.on ? this.endWin : 30; },
  idle() { return !G.pilot && this.st.idleT > 10; },
  inView(c, from) {
    if (!from) return false; const e = from.eye(), ch = c.chest(), dx = ch.x - e.x, dz = ch.z - e.z, d = Math.hypot(dx, dz);
    if (d > 40) return false; if (d > 2 && Math.abs(angDiff(from.aimYaw, Math.atan2(dx, dz))) > 0.95) return false;
    return !segBlocked(e.x, e.y, e.z, ch.x, ch.y, ch.z, 0.4);
  },
  // ---------------------------------------------------------------- what happened (for the estimate)
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
    if (w <= 0) return;
    const p = 1 / (1 + Math.exp(-this.K * (this.elo - f.lv))), step = Math.min(G.time < this.calibT ? 1 : 0.2, Math.max(0.12, 0.7 / (1 + this.n * 0.35)));
    this.elo = clamp(this.elo + step * w * (o - p), 0, LV_MAX); this.n += w; this.nm += w;
    this.log.unshift({ o, p, w, lv: f.lv, name: f.e.name, t: G.time }); if (this.log.length > 6) this.log.pop();
    if (G.dirTrace) this.allDuels.push([o, w, f.lv, f.out]);
  },
  // ---------------------------------------------------------------- the estimate (panel only)
  paintK(c) { return this.PAINT_K[c.weapon.id] || 1; },
  signals() {
    const P = PLAYER, st = this.st, S = this.sig = {}, aliveM = st.alive / 60, R = this.raw = {};
    const mates = CHARS.filter(c => c.team === P.team && c !== P && (c.dirAlive || 0) > 5);
    if (st.alive > 20 && mates.length) {
      // compared with the teammates, who play the same enemies at a level we know
      const base = avgOf(mates.map(c => this.lvOf(c))), grow = Math.min(1, st.alive / 60), lr = c => Math.log2(((c.dDealt || 0) + 0.5) / ((c.dTaken || 0) + 0.5));
      const pr = P.paint / this.paintK(P) / aliveM, mr = avgOf(mates.map(c => c.paint / this.paintK(c) / (c.dirAlive / 60)));
      if (mr > 0) { R.paint = Math.log2(Math.max(0.05, pr / mr)); S.paint = { v: base + 1.6 * R.paint, w: 0.7 * grow }; }
      R.dmg = lr(P) - avgOf(mates.map(lr)); S.dmg = { v: base + 0.7 * R.dmg, w: 0.6 * grow };
      const pd = (P.deaths + 0.5) / (aliveM + 0.5), md = avgOf(mates.map(c => (c.deaths + 0.5) / (c.dirAlive / 60 + 0.5)));
      R.surv = Math.log2(md / pd); S.surv = { v: base + 0.5 * R.surv, w: 0.4 * grow };
    }
    if (st.shots >= 12) S.hit = { v: 1 + (Math.min(1, st.hits / st.shots) - (this.HIT[P.weapon.id] || 0.4)) / 0.15, w: 0.3 * Math.min(1, st.shots / 50) };
    if (st.alive > 25) { const sc = (st.swimT > 2) + (st.refillT > 1.5) + (st.climbs > 0) + (P.sjumps > 0) + (st.bombs > 0); if (sc < 3) S.know = { v: 0.1 + sc * 0.25, w: this.mem ? 0.3 : 0.8 }; }
    let sw = 0.6 + this.n * 0.5, sv = this.elo * sw;
    for (const k in S) { S[k].v = clamp(S[k].v, 0, LV_MAX); sv += S[k].v * S[k].w; sw += S[k].w; }
    const cal = G.time < this.calibT, d = (clamp(sv / sw, 0, LV_MAX) - this.skill) * (1 - Math.exp(-0.5 / (cal ? 2.5 : 10)));
    this.skill += cal ? d : clamp(d, -0.006, 0.006); this.conf = 1 - 1 / (1 + 0.35 * (sw - 0.6));
  },
  // ---------------------------------------------------------------- playing the score, the way people do (both sides, nobody made stronger or weaker)
  steer() {
    const tc = Paint.teamCells, P = PLAYER; this.lead = (tc[P.team] - tc[1 - P.team]) / Math.max(1, Paint.total);
    const f = clamp((Math.abs(this.lead) - this.PF.start) / this.PF.span, 0, 1), sg = Math.sign(this.lead);
    this.pf = []; this.pf[P.team] = -sg * f; this.pf[1 - P.team] = sg * f;
  },
  // 1 take ground · 0 as usual · -1 hold what we have
  paintFocus(team) { return this.on && this.pf ? this.pf[team] : 0; },
  // extra score for a spot to paint: taking ground wants what is not ours yet; holding wants our own half back where it was turned over
  turfBias(team, own, zRel) { const f = this.paintFocus(team); return f > 0 ? (own !== team ? 2 * f : 0) : f < 0 ? (own !== team && own !== -2 && zRel < 0.1 ? -2.5 * f : 0) + (zRel > 0.3 ? f * zRel * 1.5 : 0) : 0; },
  // ---------------------------------------------------------------- every frame of play
  update(dt) {
    const P = PLAYER; if (!P || !this.st) return; const T = G.time, st = this.st;
    if (devGod() || vipOn()) this.cheat = true;
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
    for (const [e, f] of this.fights) if (T - f.last > 4) { this.fights.delete(e); if (f.dealt + f.taken > 0.5) this.resolve(f, clamp(0.5 + (f.dealt - f.taken) * 0.5, 0, 1), 0.3); }
    if ((this.sigT -= dt) <= 0) { this.sigT = 0.5; this.signals(); }
    this.steer();
    // the squads' shared know-how: re-picked from the tier below / above now and then, like each bot's
    for (const tm of [0, 1]) { const tl = Math.round(this.teamLevel(tm) * 100) / 100, sb = this.squadBrain[tm], hi = this.brain(sb, tl); if (sb.lv !== tl || sb.hi !== hi) { sb.lv = tl; sb.hi = hi; this.teamRow[tm] = diffAt(tl, hi); } }
    if (G.dirTrace) this.trace.push([T, this.skill, this.tierOf().lv, ...this.enemies().map(b => b.lv)]);
    DirPanel.update(dt);
  },
  // end of a match: fold this match into this loadout's saved estimate (a rolling average).  Not with a name-box mode on, nor in tests
  save() {
    if (G.pilot || G.aiLevels || Camp.on || !PLAYER || !this.st || this.cheat || this.st.alive < 30) return;     // (闯关 rounds play by other rules: kept out)
    const sv = this.mem, q = Math.min(1, this.st.alive / 120) * Math.min(1, (this.nm + 1) / 6), s = sv ? lerp(sv.s, this.skill, 0.4 * q) : this.skill;
    this.saved = this.skillBook()[this.key] = { s: Math.round(s * 100) / 100, m: Math.min(10, (sv ? sv.m || 1 : 0) + 1) }; Profile.save();
  },
  toggle() { DirPanel.toggle(); },
  // a level by name: the nearest tier, a little above or below it
  tier(v) { if (v > 2.15) return '地狱+'; const pts = [0.3, 1, 1.5, 2], i = pts.reduce((b, p, k) => Math.abs(p - v) < Math.abs(pts[b] - v) ? k : b, 0), d = v - pts[i]; return TIERS[i].name + (d > 0.12 ? '·偏强' : d < -0.12 ? '·偏弱' : ''); }
};
