/* ============================================================ PACING
   A match with rises and lulls, after Left 4 Dead's director.  The player's tension (0..1) goes up when hit,
   when low, with enemies close, on dying, on a close-range knock-out, and drains away when things are quiet.
   The enemies follow a loop on top of it:
     铺垫 build  they push up bit by bit and fights come more often
     高潮 peak   a wave: they come together, the counters and a couple of hunters with them
     喘息 relax  they fall back to their own half, one token fewer, nobody goes looking for the player
   The peak ends once the player's tension has stayed high for a few seconds (or it has run long enough);
   the relax ends once the player has calmed down.  In the closing stretch a close game is all peak.  The
   lengths follow the match (1:30 ≈ one small wave, 3:00 two, 5:00 three or four); hell's lulls are short.
   Only steers when the score is close - a runaway is the Director's business.  Music follows the phase. */
const PHASE_NAME = { build: '铺垫', peak: '高潮', relax: '喘息', final: '终局' };
const Pacing = {
  get on() { return Director.on && !this.off; },                            // (off: benchmarks comparing with and without)
  reset() {
    this.tension = 0; this.phase = 'build'; this.phaseT = 0; this.highT = 0; this.waves = 0; this.hist = [];
    this.stats = { t: { build: 0, peak: 0, relax: 0, final: 0 }, dmg: { build: 0, peak: 0, relax: 0, final: 0 }, acq: { build: 0, peak: 0, relax: 0, final: 0 }, curve: [] };     // (measuring: time in each phase and damage the player took in it)
    const k = clamp(Math.sqrt(GAME.dur / 180), 0.7, 1.3), hell = Director.mode() === 2;
    this.len = { buildMin: 30 * k, buildMax: 45 * k, peakHold: 4, peakMax: 15 * k, relaxMin: (hell ? 8 : 15) * k, relaxMax: (hell ? 13 : 25) * k };     // (≈ 2 waves in 3:00, 1 in 1:30, 3 in 5:00)
    Sfx.musicEnergy && Sfx.musicEnergy(0.5);
  },
  // ---------------------------------------------------------------- the player's tension
  onDamage(v, amount, src) { if (v === PLAYER && src && src.team !== v.team) { this.tension = Math.min(1, this.tension + amount / v.maxHp * 0.9); if (this.stats) this.stats.dmg[this.phase] += amount / v.maxHp; } },
  onDeath(v, killer) {
    if (v === PLAYER) this.tension = 1;
    else if (killer === PLAYER && v.pos.distanceTo(PLAYER.pos) < 8) this.tension = Math.min(1, this.tension + 0.15);
  },
  onAcquire() { if (this.stats && PLAYER.alive) this.stats.acq[this.on ? this.phase : 'build']++; },    // (measuring: an enemy has just picked the player out)
  near() { const P = PLAYER; return CHARS.filter(o => o.team !== P.team && o.alive && o.state === 'play' && o.pos.distanceTo(P.pos) < 13 && !o.hiddenInInk()).length; },
  // ---------------------------------------------------------------- the loop
  set(ph) {
    if (ph === this.phase) return; this.phase = ph; this.phaseT = 0; this.highT = 0; if (ph === 'peak') this.waves++; aiStat(1 - PLAYER.team, 'phase_' + ph);
    // a lull or a wave starts now, not whenever each of them next picks somewhere to go (those already at close quarters with the player finish first)
    if ((ph === 'relax' || ph === 'peak') && this.on) for (const b of G.bots) if (b.c.team !== PLAYER.team && !(b.enemy === PLAYER && b.c.pos.distanceTo(PLAYER.pos) < 7)) { b.path = []; b.retarget = 0; b.replanT = 0; }
  },
  update(dt) {
    const P = PLAYER; if (!P || this.len == null) return; const T = G.time;
    if (P.alive && P.state === 'play') {
      const n = this.near(), calm = T - P.lastHurt > 3 && n === 0;
      if (P.hp < P.maxHp * 0.4) this.tension += dt * 0.15;
      this.tension += dt * 0.06 * n;
      this.tension -= dt * (calm ? 0.12 : 0.04);
    } else this.tension -= dt * 0.08;
    this.tension = clamp(this.tension, 0, 1);
    if ((this.histT = (this.histT || 0) - dt) <= 0) { this.histT = 1; this.hist.push(this.tension); if (this.hist.length > 60) this.hist.shift(); this.stats.curve.push(this.tension); }
    if (P.alive && P.state === 'play') this.stats.t[this.on ? this.phase : 'build'] += dt;
    if (!this.on) return;
    if (this.phase !== 'relax' || (P.alive && P.state === 'play')) this.phaseT += dt;          // (a lull only counts while the player is up to enjoy it)
    const L = this.len, close = Math.abs(Director.lead) < 0.1;
    if (G.left < Director.endWindow()) this.set(close ? 'final' : 'build');
    else if (this.phase === 'build') { if ((this.phaseT > L.buildMin && this.tension > 0.6) || this.phaseT > L.buildMax) this.set('peak'); }
    else if (this.phase === 'peak') { this.highT = this.tension > 0.75 ? this.highT + dt : Math.max(0, this.highT - dt * 0.5); if (this.highT > L.peakHold || this.phaseT > L.peakMax || !P.alive) this.set('relax'); }
    else if (this.phase === 'relax') { if ((this.phaseT > L.relaxMin && this.tension < 0.25) || this.phaseT > L.relaxMax) this.set('build'); }
    else if (this.phase === 'final' && !close) this.set('build');
    // the music: muffled and sparse in a lull, full in a wave
    const e = this.phase === 'relax' ? 0.15 : this.phase === 'peak' || this.phase === 'final' ? 1 : 0.45 + this.phaseT / L.buildMax * 0.3;
    if (Sfx.musicEnergy) Sfx.musicEnergy(e);
  },
  // ---------------------------------------------------------------- what the others ask (the enemy side only; 1 = as usual)
  steering(team) { return this.on && team !== PLAYER.team && Math.abs(Director.paintFocus(team)) < 0.3; },
  posture(team) { if (!this.steering(team)) return null; return this.phase === 'peak' || this.phase === 'final' ? 'push' : this.phase === 'relax' ? 'hold' : null; },
  rangeK(team) { return this.steering(team) && this.phase === 'relax' ? 0.5 : 1; },
  // where they go to paint: in a lull anywhere but near the player (they keep taking the map - only the player gets the breather),
  // in a wave toward where the player is
  turfBias(team, zRel, p) {
    if (!this.steering(team) || !p) return 0; const d = Math.hypot(p.x - PLAYER.pos.x, p.z - PLAYER.pos.z);
    return this.phase === 'relax' ? -4 * Math.max(0, 1 - d / 18) : this.phase === 'peak' || this.phase === 'final' ? 3 * Math.max(0, 1 - d / 22) + zRel : 0;
  },
  tokenDelta(team) { return this.steering(team) && this.phase === 'relax' ? -1 : 0; },
  counterK(team) { return this.steering(team) && this.phase === 'relax' ? 0 : 1; },
  // in a wave a couple of them come for the player (one, for a beginner)
  waveHunters(team) { return this.steering(team) && (this.phase === 'peak' || this.phase === 'final') ? (Director.skill >= 0.9 ? 2 : 1) : 0; },
  remaining() { const L = this.len; if (!L) return 0; return this.phase === 'build' ? Math.max(0, L.buildMax - this.phaseT) : this.phase === 'peak' ? Math.max(0, L.peakMax - this.phaseT) : this.phase === 'relax' ? Math.max(0, L.relaxMax - this.phaseT) : Math.max(0, G.left); }
};
