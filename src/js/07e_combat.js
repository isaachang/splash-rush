/* ============================================================ COMBAT (measuring only)
   Nothing here changes how a fight goes - the bots see, hear, aim and decide on their own (Bot).  This only
   keeps count of how the player's fights go, for the benchmarks: how long the player lasts once hit, how
   often two of them are on the player at once, how many gun hits come from two shooters together.        */
const Combat = {
  reset() {
    this.engT = null; this.aimT = null; this.lastHit = new Map();
    this.stats = { deaths: 0, multi: 0, multi15: 0, ttd: [], tta: [], fireFrames: 0, twoFrames: 0, gunHits: 0, pairHits: 0 };
  },
  onAcquire() { if (this.aimT == null && this.stats) this.aimT = G.time; },   // an enemy has just picked the player out
  onDamage(v, amount, src, via) {
    if (v !== PLAYER || !src || src.team === v.team || !this.stats) return;
    if (this.engT == null || v.hp + amount >= v.maxHp - 0.5) this.engT = G.time;
    if (via === src.weapon.id && src.bot) {
      const T = G.time; this.stats.gunHits++;
      for (const [o, t] of this.lastHit) if (o !== src && T - t < 0.6) { this.stats.pairHits++; break; }
      this.lastHit.set(src, T);
    }
  },
  onDeath(v) {
    if (v !== PLAYER || !this.stats) return; const T = G.time;
    this.stats.deaths++; if (CHARS.filter(o => o.team !== v.team && v.dmgBy.get(o) > T - 4).length >= 2) this.stats.multi++; if (CHARS.filter(o => o.team !== v.team && v.dmgBy.get(o) > T - 1.5).length >= 2) this.stats.multi15++;
    if (this.engT != null) this.stats.ttd.push(T - this.engT); if (this.aimT != null) this.stats.tta.push(T - this.aimT); this.engT = this.aimT = null;
  },
  update() {
    if (!PLAYER || !this.stats) return; const P = PLAYER;
    if (P.alive && P.hp >= P.maxHp - 0.5) this.engT = null;
    if (!G.bots.some(b => b.enemy === PLAYER) && P.hp >= P.maxHp - 0.5) this.aimT = null;
  },
  // (after the bots have moved: how many are firing at the player right now)
  measure() {
    const P = PLAYER; if (!P || !this.stats || !P.alive || P.state !== 'play') return;
    const on = G.bots.filter(b => b.enemy === PLAYER && b.c.intent.fire && b.c.alive).length;
    if (on) this.stats.fireFrames++; if (on >= 2) this.stats.twoFrames++;
  }
};
