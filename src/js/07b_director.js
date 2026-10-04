/* ============================================================ DIRECTOR
   The smart difficulty (智能).  Watches how the player is doing and works out a level for them on the
   same scale as DIFF (0 easy · 1 normal · 2 hell, and anything in between).  Every bot carries its own
   level and moves toward a target: at once while it is dead or flying in, quickly while the player cannot
   see it, slowly while the two are fighting - so nobody turns into a sharpshooter mid-duel.  The whole lobby
   follows the player (teammates too, or three normal teammates would carry a beginner), and a runaway
   score nudges the enemies one way and the teammates half as far the other.  It watches in every mode (so the saved estimate is ready for
   the next match), but only steers the bots in smart mode.                                                  */
const SMART = -1;
const DIFF_DEF = { swimK: 0.9, dawdle: 0 };
// a difficulty row for any level from 0 to 2: aim and reflexes blend between the tiers, know-how switches on at set points
function diffAt(lv) {
  lv = clamp(lv, 0, 2); const r = Math.round(lv); if (Math.abs(lv - r) < 1e-6) return DIFF[r];
  const i = Math.floor(lv), a = DIFF[i], b = DIFF[i + 1], t = lv - i, mix = k => lerp(a[k] ?? DIFF_DEF[k], b[k] ?? DIFF_DEF[k], t), on = x => lv >= x ? 1 : 0;
  return {
    err: mix('err'), react: mix('react'), fireHold: mix('fireHold'), turn: mix('turn'), dodge: mix('dodge'), swimK: mix('swimK'), dawdle: mix('dawdle'), ambush: mix('ambush'),
    retreat: lv < 0.5 ? 0 : Math.max(DIFF[1].retreat, mix('retreat')), combo: lv < 1.5 ? 0 : mix('combo'),
    team: on(0.5) + on(1.5), climb: on(0.5) + on(1.5), focus: on(1.5), bombSmart: on(0.5), sjump: on(0.5), endgame: on(0.5), share: on(0.5), inkCare: on(0.5)
  };
}
const avgOf = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const Director = {
  K: 0.8,                                                                  // how sharply a level gap turns into duel odds: p = 1 / (1 + e^(-K·gap))
  PAINT_K: { rifle: 1, smg: 0.82, charger: 0.49, splatling: 0.58, blaster: 0.9 },   // how much each weapon paints, relative to the rifle
  HIT: { rifle: 0.45, smg: 0.3, charger: 0.4, splatling: 0.25, blaster: 0.4 },   // share of shots on target for a normal bot (a level is worth about 0.15 more)
  RATE: { fight: 0.012, seen: 0.03, away: 0.08 },                          // how fast a bot's level may move (per second, at 3:00; shorter matches move faster)
  shown: false, st: null,
  get on() { return !!PLAYER && (G.aiLevels ? G.aiLevels[1 - PLAYER.team] : GAME.diff) === SMART; },
  reset() {
    const sv = Profile.data.skill, prior = sv && isFinite(sv.s) ? clamp(sv.s, 0, 2) : 1;
    this.mem = !!sv; this.elo = prior; this.n = sv ? Math.min(sv.n || 0, 4) : 0;
    this.skill = this.target = prior; this.conf = 0; this.corr = 0; this.lead = 0; this.sig = {}; this.sigT = 0; this.panelT = 0; this.wasClimb = false;
    this.fights = new Map(); this.log = []; this.trace = []; this.allDuels = [];
    this.st = { alive: 0, shots: 0, hits: 0, swimT: 0, refillT: 0, climbs: 0, bombs: 0, idleT: 0 };
    this.calibT = Math.min(60, 15 + GAME.dur / 6); this.endWin = clamp(Math.round(10 + GAME.dur / 9), 20, 40);
    this.teamLv = [prior, prior]; this.teamRow = [diffAt(prior), diffAt(prior)];
    for (const b of G.bots) b.lv = prior;
  },
  bots() { return G.bots.filter(b => !b.c.isPlayer); },
  enemies() { return G.bots.filter(b => b.c.team !== PLAYER.team); },
  // the difficulty a bot plays at (smart mode).  Without a bot: the team as a whole, for the squad's decisions
  row(team, bot) {
    if (!bot) return this.teamRow[team];
    if (bot.lv === undefined) bot.lv = this.goal(bot);
    if (bot.dRowLv !== bot.lv) { bot.dRowLv = bot.lv; bot.dRow = diffAt(bot.lv); }
    return bot.dRow;
  },
  // a runaway score moves the enemies, and the teammates half as far the other way (so it still works when the enemies are already at hell)
  goal(b) { return b.c.team === PLAYER.team ? clamp(this.skill - this.corr * 0.5, 0, 2) : this.target; },
  // the level a bot is playing at right now (fixed modes: the chosen tier)
  lvOf(c) { if (this.on) return c.bot && c.bot.lv !== undefined ? c.bot.lv : c.team === PLAYER.team ? clamp(this.skill - this.corr * 0.5, 0, 2) : this.target; const l = G.aiLevels ? G.aiLevels[c.team] : GAME.diff; return l >= 0 && l <= 2 ? l : 1; },
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
    if (w <= 0) return;
    const p = 1 / (1 + Math.exp(-this.K * (this.elo - f.lv))), step = Math.min(G.time < this.calibT ? 1 : 0.2, Math.max(0.12, 0.7 / (1 + this.n * 0.35)));   // big steps while calibrating, small ones after
    this.elo = clamp(this.elo + step * w * (o - p), 0, 2); this.n += w;
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
      const base = avgOf(mates.map(c => this.lvOf(c))), grow = Math.min(1, st.alive / 60), lr = c => Math.log2(((c.dDealt || 0) + 0.5) / ((c.dTaken || 0) + 0.5));
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
    for (const k in S) { S[k].v = clamp(S[k].v, 0, 2); sv += S[k].v * S[k].w; sw += S[k].w; }
    // smoothed, so one duel does not jolt the whole lobby; after calibration it may move at most 0.012 a second
    const cal = G.time < this.calibT, d = (clamp(sv / sw, 0, 2) - this.skill) * (1 - Math.exp(-0.5 / (cal ? 2.5 : 10)));
    this.skill += cal ? d : clamp(d, -0.006, 0.006); this.conf = 1 - 1 / (1 + 0.35 * (sw - 0.6));
  },
  // ---------------------------------------------------------------- every frame of play
  update(dt) {
    const P = PLAYER; if (!P || !this.st) return; const T = G.time, st = this.st;
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
    // the enemies' target: the player's level, nudged against a runaway score (more than 15 % of the map apart)
    const tc = Paint.teamCells; this.lead = (tc[P.team] - tc[1 - P.team]) / Math.max(1, Paint.total);
    const ex = Math.abs(this.lead) - 0.15; this.corr = ex > 0 ? Math.sign(this.lead) * Math.min(0.4, ex * 4) : 0;
    this.target = clamp(this.skill + this.corr, 0, 2);
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
      else { const r = this.RATE[s] * kd * dt; b.lv += clamp(goal - b.lv, -r, r); }
    }
    for (const tm of [0, 1]) { const tb = all.filter(b => b.c.team === tm); if (!tb.length) continue; const tl = avgOf(tb.map(b => b.lv)); if (Math.abs(tl - this.teamLv[tm]) > 0.01) { this.teamLv[tm] = tl; this.teamRow[tm] = diffAt(tl); } }
    if (G.dirTrace) this.trace.push([T, this.skill, this.target, ...this.enemies().map(b => b.lv)]);
    this.panel(dt);
  },
  save() {
    if (G.pilot || G.aiLevels || !PLAYER || !this.st || devGod() || vipOn() || this.st.alive < 30) return;
    Profile.data.skill = { s: Math.round(this.skill * 100) / 100, n: Math.round(Math.min(8, this.n) * 10) / 10 }; Profile.save();
  },
  // ---------------------------------------------------------------- the panel (press ` during a match)
  toggle() { this.shown = !this.shown; $('dirPanel').classList.toggle('show', this.shown); this.panelT = 0; },
  panel(dt) {
    if (!this.shown || (this.panelT -= dt) > 0) return; this.panelT = 0.25;
    const f2 = v => v.toFixed(2), pc = v => Math.round(v * 100) + '%', tier = v => v < 0.5 ? '轻松' : v < 1.5 ? '普通' : '地狱';
    const SN = { paint: '涂地', dmg: '伤害比', surv: '存活', hit: '命中', know: '熟练' }, STN = { fight: '交火中', seen: '视野内', away: '视野外', respawn: '复活中' };
    const left = Math.max(0, this.calibT - G.time), mode = this.on ? '智能模式' : '观察中 · 固定难度「' + (['轻松', '普通', '地狱'][this.lvOf(CHARS.find(c => c.team !== PLAYER.team))] || '?') + '」';
    let h = `<b>导演台</b><span>${mode}</span>`;
    h += `<div class="big">玩家水平 <em>${f2(this.skill)}</em> ≈${tier(this.skill)} <small>可信度 ${pc(this.conf)} · ${left > 0 ? '校准中 ' + Math.ceil(left) + 's' : this.conf < 0.3 ? '数据不足' : '已校准'}${this.mem ? ' · 有存档' : ''}${this.idle() ? ' · 挂机不计' : ''}</small></div>`;
    h += `<div>交火积分 ${f2(this.elo)}（${this.n.toFixed(1)} 次）` + Object.keys(SN).filter(k => this.sig[k]).map(k => ` · ${SN[k]} ${f2(this.sig[k].v)}<small>×${this.sig[k].w.toFixed(1)}</small>`).join('') + '</div>';
    h += `<div>目标难度 <em>${f2(this.target)}</em> = 水平 ${f2(this.skill)} ${this.corr >= 0 ? '+' : '−'} 局势 ${f2(Math.abs(this.corr))}<small>（${this.lead >= 0 ? '我方领先' : '我方落后'} ${pc(Math.abs(this.lead))}）</small></div>`;
    h += '<div>最近交火 ' + (this.log.length ? this.log.map(l => `<i class="${l.o > 0.5 ? 'w' : l.o < 0.5 ? 'l' : ''}">${l.o > 0.5 ? '赢' : l.o < 0.5 ? '输' : '平'}</i><small>预期${pc(l.p)}${l.w < 1 ? '×' + l.w.toFixed(1) : ''}</small>`).join(' ') : '—') + '</div>';
    const mates = this.bots().filter(b => b.c.team === PLAYER.team);
    if (mates.length) h += `<div>队友难度 ${f2(avgOf(mates.map(b => b.lv ?? this.skill)))} → ${f2(clamp(this.skill - this.corr * 0.5, 0, 2))}</div>`;
    h += '<table>' + this.enemies().map(b => `<tr><td>${b.c.name}</td><td>${b.lv === undefined ? '—' : f2(b.lv)}</td><td>→ ${f2(this.target)}</td><td>${STN[b.dState] || ''}</td></tr>`).join('') + '</table>';
    $('dirPanel').innerHTML = h;
  }
};
