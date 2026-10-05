/* ============================================================ TENSION → MUSIC
   The player's tension (0..1) goes up when hit, when low, with enemies close, on dying, on a close-range
   knock-out, and drains away when things are quiet.  The music follows it - sparse when calm, full in a
   fight, and full again in a close finish.  It only listens: the bots are never told to push or ease off.  */
const Pacing = {
  reset() {
    this.tension = 0; this.hist = [];
    this.stats = { curve: [], dmgT: [], aliveT: [] };                     // (measuring: the tension curve, damage taken and time alive per 10 s)
    Sfx.musicEnergy && Sfx.musicEnergy(0.5);
  },
  onDamage(v, amount, src) { if (v === PLAYER && src && src.team !== v.team) { this.tension = Math.min(1, this.tension + amount / v.maxHp * 0.9); if (this.stats) { const k = Math.floor(G.time / 10); this.stats.dmgT[k] = (this.stats.dmgT[k] || 0) + amount / v.maxHp; } } },
  onDeath(v, killer) {
    if (v === PLAYER) this.tension = 1;
    else if (killer === PLAYER && v.pos.distanceTo(PLAYER.pos) < 8) this.tension = Math.min(1, this.tension + 0.15);
  },
  near() { const P = PLAYER; return CHARS.filter(o => o.team !== P.team && o.alive && o.state === 'play' && o.pos.distanceTo(P.pos) < 13 && !o.hiddenInInk()).length; },
  update(dt) {
    const P = PLAYER; if (!P || !this.stats) return; const T = G.time;
    if (P.alive && P.state === 'play') {
      const n = this.near(), calm = T - P.lastHurt > 3 && n === 0;
      if (P.hp < P.maxHp * 0.4) this.tension += dt * 0.15;
      this.tension += dt * 0.06 * n;
      this.tension -= dt * (calm ? 0.12 : 0.04);
    } else this.tension -= dt * 0.08;
    this.tension = clamp(this.tension, 0, 1);
    if ((this.histT = (this.histT || 0) - dt) <= 0) { this.histT = 1; this.hist.push(this.tension); if (this.hist.length > 60) this.hist.shift(); this.stats.curve.push(this.tension); }
    if (P.alive && P.state === 'play') { const k = Math.floor(T / 10); this.stats.aliveT[k] = (this.stats.aliveT[k] || 0) + dt; }
    // the music: calm → sparse, a fight → full; a close finish is full whatever the player is doing
    const close = Math.abs(Director.lead || 0) < 0.1 && G.left < Director.endWindow();
    if (Sfx.musicEnergy) Sfx.musicEnergy(close ? 1 : 0.3 + this.tension * 0.7);
  }
};
