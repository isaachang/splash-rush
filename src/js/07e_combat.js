/* ============================================================ COMBAT FEEL
   Fights the player can read and answer, on every tier (the Director's framework; not in tests with
   fixed rows):
     · attack tokens: only so many enemies shoot at the player at once (1 easy · 2 normal · 3 hell, smart by
       level); the rest circle round and paint about, and the tokens change hands every couple of seconds
     · warning shots: an enemy that has just taken aim at the player puts its first shots into the ground
       in front of them - the ink splashing up says "you are being shot at"; always so (and slower to fire)
       when it comes from where the player is not looking; on hell only then
     · a breather: low on health and just hit, the player is harder to hit for a moment (not on hell)
     · backup: set on by two or more, or low and still under fire, the nearest teammates come over and go
       for whoever is shooting                                                                                  */
const Combat = {
  SLOT: 2.5,
  get on() { return Director.on && !this.off; },                           // (off: benchmarks comparing with and without)
  reset() {
    this.holders = new Map(); this.waiting = new Map(); this.supT = 0; this.engT = null; this.graceT = -99;
    this.stats = { deaths: 0, multi: 0, multi15: 0, ttd: [], tta: [], warned: 0, graced: 0, supported: 0, fireFrames: 0, twoFrames: 0, overFrames: 0, rogue: 0, gunHits: 0, rogueHits: 0, pairHits: 0 }; this.aimT = null; this.lastHit = new Map();
    for (const b of G.bots) { b.support = null; b.warnUntil = 0; b.tokCd = 0; }
  },
  level() { return Director.teamLevel(1 - PLAYER.team); },
  tokens() { const m = Director.mode(); if (typeof m === 'number') return m + 1; const lv = this.level(); return lv < 0.7 ? 1 : lv < 1.7 ? 2 : 3; },
  warnTime(behind) {
    const m = Director.mode(), lv = this.level();
    const w = m === 0 ? 0.8 : m === 1 ? 0.5 : m === 2 ? 0 : lv <= 0.3 ? 0.8 : lv <= 1 ? lerp(0.8, 0.5, (lv - 0.3) / 0.7) : lv < 1.7 ? lerp(0.5, 0, (lv - 1) / 0.7) : 0;
    return behind ? Math.max(w, 0.25) : w;
  },
  graceStrength() { const m = Director.mode(); return m === 2 ? 0 : typeof m === 'number' ? 1 : clamp(2 - this.level(), 0, 1); },
  // ---------------------------------------------------------------- tokens
  canShoot(b, e) {
    if (!this.on || e !== PLAYER) return true;
    const T = G.time, h = this.holders;
    if (h.has(b)) { h.get(b).last = T; return true; }
    for (const [o, s] of h) if (!o.c.alive || o.c.state !== 'play' || o.enemy !== PLAYER || T - s.last > 0.6) h.delete(o);
    if (h.size < this.tokens() && T >= (b.tokCd || 0)) { h.set(b, { t0: T, last: T }); return true; }
    this.waiting.set(b, T); return false;
  },
  // ---------------------------------------------------------------- warning shots and the breather
  onAcquire(b) {
    if (this.aimT == null && this.stats) this.aimT = G.time;
    if (!this.on) return;
    const behind = !Director.inView(b.c, PLAYER), w = this.warnTime(behind);
    if (behind) b.reactT *= 1.4;
    b.warnUntil = w > 0 ? G.time + b.reactT + w : 0; if (w > 0) this.stats.warned++;
  },
  warning(b, e) { return this.on && e === PLAYER && G.time < (b.warnUntil || 0); },
  // where to aim: during the warning, the ground a step or two in front of the player, on the side the shot comes from
  aimPoint(b, e, tp) {
    if (!this.warning(b, e)) return tp;
    const dx = b.c.pos.x - e.pos.x, dz = b.c.pos.z - e.pos.z, l = Math.hypot(dx, dz) || 1, k = Math.min(1.8, l * 0.4);
    const x = e.pos.x + dx / l * k, z = e.pos.z + dz / l * k; return new THREE.Vector3(x, groundBelow(x, z, e.pos.y + 0.5, 0.6) + 0.05, z);
  },
  // aim error multiplier: low and just hit, the player is harder to hit for a moment
  errK(e) {
    if (!this.on || e !== PLAYER) return 1;
    const P = PLAYER, g = this.graceStrength();
    if (g > 0 && P.hp < P.maxHp * 0.3 && G.time - P.lastHurt < 1) { if (G.time - this.graceT > 2) this.stats.graced++; this.graceT = G.time; return 1 + 1.4 * g; }
    return 1;
  },
  // while waiting for a token: keep the distance, circle, and paint the ground short of the player
  holdOff(b, I, e, d) {
    const c = b.c, fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw), R = c.weapon.range || 10, adv = d < R * 0.6 ? -0.6 : d > R ? 0.5 : 0;
    I.mx = -fz * b.strafe * 0.9 + fx * adv; I.mz = fx * b.strafe * 0.9 + fz * adv;
    if (c.weapon.charges) { I.fire = c.charging; b.holdT = G.time; return; }                  // (a sniper keeps its charge - and its laser - on the player)
    const k = clamp((d - 4) / Math.max(d, 1), 0, 1), x = c.pos.x + (e.pos.x - c.pos.x) * k, z = c.pos.z + (e.pos.z - c.pos.z) * k;
    b.aimAt(new THREE.Vector3(x, groundBelow(x, z, c.pos.y + 1, 0.6), z), 1 / 60, 12, c.weapon.id);
    I.fire = c.ink > 45 && d > 5; b.holdT = G.time;
  },
  // ---------------------------------------------------------------- backup
  supportOf(b) { return this.on && b.support ? b.support : null; },
  attackers(b) { return b.support && b.support.att || []; },
  updateSupport() {
    const P = PLAYER, T = G.time, mates = G.bots.filter(b => b.c.team === P.team && !b.c.isPlayer);
    const att = P.alive && P.state === 'play' ? CHARS.filter(o => o.team !== P.team && o.alive && o.state === 'play' && P.dmgBy.get(o) > T - 2) : [];
    if (att.length >= 2 || (att.length && P.hp < P.maxHp * 0.4)) this.supT = T + 3;
    const want = T < this.supT && att.length ? Math.min(2, att.length) : 0, cur = mates.filter(b => b.support);
    if (!want) { cur.forEach(b => b.support = null); return; }
    const cand = mates.filter(b => !b.support && b.c.alive && b.c.state === 'play' && b.mode !== 'retreat' && b.c.pos.distanceTo(P.pos) < 40).sort((a, b) => a.c.pos.distanceTo(P.pos) - b.c.pos.distanceTo(P.pos));
    while (cur.length < want && cand.length) { const b = cand.shift(); b.support = { t: T }; b.path = []; b.retarget = 0; b.supRe = 0; cur.push(b); this.stats.supported++; }
    while (cur.length > want) cur.pop().support = null;
    for (const b of cur) { if (!b.c.alive) b.support = null; else b.support.att = att; }
  },
  // ---------------------------------------------------------------- bookkeeping (kept in every mode, for the benchmarks)
  onDamage(v, amount, src, via) {
    if (v !== PLAYER || !src || src.team === v.team || !this.stats) return;
    if (this.engT == null || v.hp + amount >= v.maxHp - 0.5) this.engT = G.time;
    // (measuring) gun hits on the player: from someone without a token, and from two shooters inside 0.6 s of each other
    if (via === src.weapon.id && src.bot) {
      const T = G.time; this.stats.gunHits++;
      if (this.on && !this.holders.has(src.bot)) this.stats.rogueHits++;
      for (const [o, t] of this.lastHit) if (o !== src && T - t < 0.6) { this.stats.pairHits++; break; }
      this.lastHit.set(src, T);
    }
  },
  onDeath(v) {
    if (v !== PLAYER || !this.stats) return; const T = G.time;
    this.stats.deaths++; if (CHARS.filter(o => o.team !== v.team && v.dmgBy.get(o) > T - 4).length >= 2) this.stats.multi++; if (CHARS.filter(o => o.team !== v.team && v.dmgBy.get(o) > T - 1.5).length >= 2) this.stats.multi15++;
    if (this.engT != null) this.stats.ttd.push(T - this.engT); if (this.aimT != null) this.stats.tta.push(T - this.aimT); this.engT = this.aimT = null;
  },
  update(dt) {
    if (!PLAYER || !this.stats) return; const P = PLAYER, T = G.time;
    if (P.alive && P.hp >= P.maxHp - 0.5) this.engT = null;
    if (!G.bots.some(b => b.enemy === PLAYER) && P.hp >= P.maxHp - 0.5) this.aimT = null;
    if (!this.on) return;
    // a holder that has had its turn gives way to someone waiting
    for (const [b, w] of this.waiting) if (T - w > 0.5) this.waiting.delete(b);
    if (this.waiting.size) for (const [b, s] of this.holders) if (T - s.t0 > this.SLOT) { this.holders.delete(b); b.tokCd = T + 1.5; break; }
    this.updateSupport();
  },
  // (measuring, after the bots have moved: how many are really firing at the player - those painting the ground while they wait do not count)
  measure() {
    const P = PLAYER, T = G.time; if (!P || !this.stats || !P.alive || P.state !== 'play') return;
    const on = G.bots.filter(b => b.enemy === PLAYER && b.c.intent.fire && b.c.alive && T - (b.holdT ?? -9) > 0.05);
    if (on.length) this.stats.fireFrames++; if (on.length >= 2) this.stats.twoFrames++; if (on.length > this.tokens()) this.stats.overFrames++; if (this.on) this.stats.rogue += on.filter(b => !this.holders.has(b)).length;
  },
  panelLine() {
    if (!this.on) return '';
    const T = G.time, warn = G.bots.filter(b => b.enemy === PLAYER && this.warning(b, PLAYER)).length, sup = G.bots.filter(b => b.support).length;
    const bits = [`正在打你：${this.holders.size}/${this.tokens()} 名额${this.waiting.size ? '（' + this.waiting.size + ' 人在等）' : ''}`];
    if (warn) bits.push(warn + ' 人在警告射击'); if (T - this.graceT < 0.3) bits.push('残血喘息中'); if (sup) bits.push('队友支援 ' + sup + ' 人');
    return `<div>${bits.join(' · ')}</div>`;
  }
};
