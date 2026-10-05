'use strict';
/* =====================================================================
   SPLASH RUSH · 墨浪突击  —  single-file 3D turf-war shooter (Three.js)
   ===================================================================== */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

const SETTINGS = { sens: 1, fov: 62, vol: 0.7, mus: 0.5, qual: 1, inv: 0 };
const PALETTES = [
  ['#ff7a00', '#3346ff'], ['#ff2d95', '#22d64a'], ['#8c3cff', '#f2e600'],
  ['#00cfff', '#ff3b30'], ['#b7f500', '#b43cff'], ['#ffc400', '#1b6bff']
];
const GAME = { pal: 0, diff: 1, dur: 180, name: '新人墨仔', uniformChars: false };   // uniformChars: tests give everyone the same character
// bot difficulty.  The first five numbers are marksmanship; the rest say what a team's bots know how to do:
//   retreat  break off below this share of health and hide in own ink (0 = fight to the end)
//   team     0 every bot for itself · 1 a simple split (front / home / sniper) · 2 full calls (flank, regroup, play the score)
//   focus    everyone shoots the same target     ambush  chance to lie in wait at a choke point
//   combo    dive under fire / ink the feet first   bombSmart  bombs go where enemies were seen
//   sjump    super-jump back to the front        climb   1 snipers ink walls to reach high ground · 2 anyone does
//   endgame  all paint in the last 30 s          share   tell teammates who was seen, turn on an unseen shooter
//   inkCare  top up ink between fights   dawdle  chance to stop and look about between jobs   swimK  how readily it swims through own ink to travel
// fov: half-angle of what a bot notices (rad) · hear: how far off a shot or a fast swim is heard (m) · mem: how long it keeps looking
// for someone it lost (s) · settle: how quickly its aim settles on someone new (s) · lead: how well it leads a moving target · flinch: how much being hit throws its aim
const DIFF = [
  { err: 0.13, react: 0.75, fireHold: 0.55, turn: 5, dodge: 0.2, retreat: 0, team: 0, focus: 0, ambush: 0, combo: 0, bombSmart: 0, sjump: 0, climb: 0, endgame: 0, share: 0, inkCare: 0, dawdle: 0.3, swimK: 0.7,
    fov: 0.87, hear: 10, mem: 1.5, settle: 0.7, lead: 0.35, flinch: 1 },
  { err: 0.075, react: 0.42, fireHold: 0.8, turn: 8, dodge: 0.45, retreat: 0.4, team: 1, focus: 0, ambush: 0.25, combo: 0, bombSmart: 1, sjump: 1, climb: 1, endgame: 1, share: 1, inkCare: 1,
    fov: 1.13, hear: 15, mem: 2.5, settle: 0.45, lead: 0.65, flinch: 0.6 },
  { err: 0.04, react: 0.2, fireHold: 0.95, turn: 13, dodge: 0.8, retreat: 0.55, team: 2, focus: 1, ambush: 0.7, combo: 0.8, bombSmart: 1, sjump: 1, climb: 2, endgame: 1, share: 1, inkCare: 1, swimK: 0.97,
    fov: 1.48, hear: 22, mem: 4, settle: 0.25, lead: 0.9, flinch: 0.25 },
  // (index 3, tests only: the pre-v0.11 "normal" bot - same aim as normal, none of the new know-how - as a yardstick)
  { err: 0.075, react: 0.42, fireHold: 0.8, turn: 8, dodge: 0.45, retreat: 0, team: 0, focus: 0, ambush: 0, combo: 0, bombSmart: 0, sjump: 0, climb: 0, endgame: 0, share: 0, inkCare: 0,
    fov: 1.13, hear: 15, mem: 2.5, settle: 0.45, lead: 0.65, flinch: 0.6 }
];

/* --------------------------------------------------------------- audio */
const Sfx = (() => {
  let ctx = null, master, sfxG, musG, musF, comp, noiseBuf, duckF, duckOn = false;
  const M = { on: false, next: 0, step: 0, bpm: 124, mode: 'title', timer: null, energy: 0.5, e: 0.5 };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    duckF = ctx.createBiquadFilter(); duckF.type = 'lowpass'; duckF.frequency.value = 20000; duckF.Q.value = 0.7; duckF.connect(comp);
    master = ctx.createGain(); master.connect(duckF);
    sfxG = ctx.createGain(); sfxG.connect(master);
    musF = ctx.createBiquadFilter(); musF.type = 'lowpass'; musF.frequency.value = 9000; musF.Q.value = 0.6; musF.connect(master);
    musG = ctx.createGain(); musG.connect(musF);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setVol();
  }
  function setVol() { if (!ctx) return; const k = duckOn ? 0.3 : 1; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.value = SETTINGS.vol * k; musG.gain.value = SETTINGS.mus * 0.5; }
  // pause: everything slowly gets quieter and muffled (as if heard from behind a door); resume brings it back
  function duck(on) {
    duckOn = on; if (!ctx) return; const t = ctx.currentTime, g = master.gain, f = duckF.frequency;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(SETTINGS.vol * (on ? 0.3 : 1), t + (on ? 0.7 : 0.35));
    f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); f.exponentialRampToValueAtTime(on ? 700 : 20000, t + (on ? 0.7 : 0.35));
  }
  function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
  // stereo panning helper: returns a node to connect sounds into
  function panNode(pan) { if (!ctx || !pan || !ctx.createStereoPanner) return sfxG; const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(sfxG); return p; }
  let lastImpact = 0;
  function tone(type, f0, f1, dur, vol, dest, t0) {
    if (!ctx || vol < 0.002) return; const t = t0 ?? ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, vol, dur); o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, ft, freq, q, f1, dest, t0) {
    if (!ctx || vol < 0.002) return; const t = t0 ?? ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    const g = ctx.createGain(); env(g, t, 0.003, vol, dur); s.connect(f); f.connect(g); g.connect(dest || sfxG);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // ---------- music
  const ROOTS = [40, 36, 38, 35];
  const MAJ = [false, true, true, false];
  function bass(m, t, len) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(260, t + len); f.Q.value = 6;
    const g = ctx.createGain(); env(g, t, 0.005, 0.22, len); o.connect(f); f.connect(g); g.connect(musG); o.start(t); o.stop(t + len + 0.05);
  }
  function stab(root, maj, t) {
    [0, maj ? 4 : 3, 7, 12].forEach(iv => tone('square', mtof(root + 24 + iv), null, 0.09, 0.028, musG, t));
  }
  function playStep(s, t) {
    const bar = (s >> 4) & 3, i = s & 15, r = ROOTS[bar], mode = M.mode;
    const title = mode === 'title', hurry = mode === 'hurry', game = !title;
    // the match's energy (pacing): a lull drops the chord stabs and half the hats behind a muffled filter, a wave adds 16th hats and a lead
    if (game && i === 0) { M.e += (M.energy - M.e) * 0.5; if (musF) musF.frequency.setTargetAtTime(lerp(1500, 16000, M.e), t, 0.4); }
    const lull = game && !hurry && M.e < 0.3, wave = game && M.e > 0.75;
    // kick
    if (title ? (i === 0 || i === 10) : i % 4 === 0) tone('sine', 150, 42, 0.22, title ? 0.5 : 0.8, musG, t);
    if (i === 4 || i === 12) { noise(0.14, title ? 0.12 : 0.26, 'bandpass', 1900, 0.8, null, musG, t); tone('triangle', 230, 130, 0.08, 0.12, musG, t); }
    if (hurry || wave ? true : lull ? i % 4 === 2 : i % 2 === 0) noise(0.035, (i % 4 === 2 ? 0.1 : 0.05) * (title ? 0.6 : 1), 'highpass', 8000, 1, null, musG, t);
    if ([0, 3, 6, 8, 10, 11, 14].includes(i)) bass(r + (i === 6 || i === 14 ? 12 : i === 11 ? 7 : 0), t, 0.16);
    if (!title && !lull && (i === 2 || i === 7 || i === 10)) stab(r, MAJ[bar], t);
    if (wave && (i === 6 || i === 14)) tone('sine', 150, 42, 0.18, 0.5, musG, t);
    if (title || hurry || wave) {
      const scale = [0, 3, 5, 7, 10, 12, 15];
      if (i % 2 === 0 && hash(s * 3.1 + bar) > 0.35) tone('triangle', mtof(r + 36 + scale[Math.floor(hash(s + 7.7) * 7)]), null, 0.12, title ? 0.05 : 0.04, musG, t);
    }
  }
  function sched() { if (!ctx) return; while (M.next < ctx.currentTime + 0.14) { playStep(M.step, M.next); M.next += 60 / M.bpm / 4; M.step = (M.step + 1) % 64; } }
  function music(mode) {
    init(); if (!ctx) return; M.mode = mode; M.bpm = mode === 'hurry' ? 148 : mode === 'title' ? 108 : 126;
    if (!M.on) { M.on = true; M.next = ctx.currentTime + 0.08; M.step = 0; M.timer = setInterval(sched, 25); }
  }
  function stopMusic() { if (M.timer) clearInterval(M.timer); M.on = false; }
  return {
    init, setVol, music, stopMusic, duck, get ducked() { return duckOn; },
    musicEnergy(e) { M.energy = clamp(e, 0, 1); },
    // pressurised "pshh" + low thump, 3 variants with random pitch, panned by direction
    shoot(v, pan = 0) {
      if (!ctx) return; const d = panNode(pan), k = rand(0.92, 1.08), var_ = Math.floor(Math.random() * 3);
      noise(0.07, 0.11 * v, 'bandpass', [2300, 2700, 2000][var_] * k, 1.1, [900, 1100, 800][var_] * k, d);
      noise(0.035, 0.07 * v, 'highpass', 5200 * k, 0.8, null, d);
      tone('sine', 190 * k, 70, 0.07, 0.12 * v, d);
      tone('triangle', [620, 700, 560][var_] * k, 240, 0.04, 0.03 * v, d);
    },
    // wet "splat" when ink hits a surface (throttled so rapid fire doesn't pile up)
    impact(v, pan = 0) {
      if (!ctx || v < 0.04) return; const now = ctx.currentTime; if (now - lastImpact < 0.035) return; lastImpact = now;
      const d = panNode(pan), k = rand(0.85, 1.15);
      noise(0.09, 0.09 * v, 'lowpass', 1600 * k, 1.2, 300, d); tone('sine', 320 * k, 120, 0.06, 0.05 * v, d);
    },
    splat(v) { noise(0.12, 0.07 * v, 'lowpass', 1200, 1, 250); },
    // spray can: rattle + long hiss (graffiti cover going up), and a wet crack when it breaks
    spray(v, pan = 0) {
      if (!ctx || v < 0.03) return; const d = panNode(pan), t = ctx.currentTime;
      for (let k = 0; k < 2; k++) tone('square', 1900, 1500, 0.025, 0.02 * v, d, t + k * 0.06);
      noise(0.42, 0.1 * v, 'highpass', 3800, 0.7, 5200, d, t + 0.1); noise(0.3, 0.06 * v, 'bandpass', 2400, 1.2, 1800, d, t + 0.12);
    },
    crack(v, pan = 0) {
      if (!ctx || v < 0.03) return; const d = panNode(pan);
      noise(0.22, 0.16 * v, 'lowpass', 1400, 1.1, 260, d); tone('triangle', 420, 90, 0.16, 0.09 * v, d); noise(0.06, 0.08 * v, 'highpass', 4200, 1, null, d);
    },
    // hit confirmation: bright tick + wet pop (+ extra body when the hit was heavy)
    hit(heavy = false) {
      if (!ctx) return; const t = ctx.currentTime, k = rand(0.96, 1.04);
      tone('triangle', 1750 * k, 2350 * k, 0.05, 0.13); tone('sine', 3200 * k, null, 0.03, 0.05, null, t + 0.01);
      noise(0.07, 0.12, 'bandpass', 1300 * k, 2.2, 600); tone('sine', 240, 110, 0.07, heavy ? 0.14 : 0.08);
    },
    // knock-out: a rising zap, a wet splat and a thump; each kill in a streak a minor third higher
    kill(streak = 1) {
      if (!ctx) return; const t = ctx.currentTime, k = Math.pow(2, (Math.min(streak, 5) - 1) * 3 / 12);
      tone('square', 520 * k, 1040 * k, 0.09, 0.09); tone('triangle', 1560 * k, 2600 * k, 0.24, 0.11, null, t + 0.06); tone('sine', 2600 * k, 3400 * k, 0.18, 0.06, null, t + 0.12);
      noise(0.35, 0.3, 'lowpass', 1800, 0.9, 180); tone('sine', 140, 50, 0.3, 0.25); noise(0.16, 0.16, 'bandpass', 900, 1.4, 260, null, t + 0.03);
      if (streak >= 2) tone('square', 1040 * k, 2080 * k, 0.16, 0.05, null, t + 0.18);
    },
    // the whole other team down at once: a quick fanfare on top
    wipe() { if (!ctx) return; const t = ctx.currentTime; [76, 79, 83, 88].forEach((m, i) => tone('square', mtof(m), null, 0.16, 0.06, null, t + 0.2 + i * 0.07)); },
    assist() { if (!ctx) return; const t = ctx.currentTime; tone('sine', 900, 1200, 0.07, 0.06); tone('sine', 1350, 1700, 0.09, 0.05, null, t + 0.06); },
    hurt() { tone('sawtooth', 240, 110, 0.14, 0.09); noise(0.1, 0.12, 'lowpass', 700, 1); },
    swimIn() { tone('sine', 280, 950, 0.12, 0.14); noise(0.16, 0.12, 'bandpass', 900, 2, 300); },
    swimOut() { tone('sine', 820, 300, 0.1, 0.1); },
    jump() { tone('sine', 300, 600, 0.1, 0.07); },
    throwB(v) { noise(0.25, 0.1 * v, 'bandpass', 1400, 2, 380); },
    boom(v) { noise(0.7, 0.55 * v, 'lowpass', 1600, 0.8, 70); tone('sine', 120, 38, 0.55, 0.55 * v); },
    death() { tone('triangle', 760, 90, 0.6, 0.18); noise(0.5, 0.3, 'bandpass', 700, 1, 200); },
    click() { tone('sine', 700, 1150, 0.07, 0.12); },
    beep(hi) { tone('square', hi ? 1320 : 880, null, hi ? 0.4 : 0.14, 0.09); },
    whistle() { if (!ctx) return; const t = ctx.currentTime; [0, 0.32].forEach((d, k) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2400; const l = ctx.createOscillator(); l.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 120; l.connect(lg); lg.connect(o.frequency); const g = ctx.createGain(); env(g, t + d, 0.01, 0.06, k ? 0.6 : 0.22); o.connect(g); g.connect(sfxG); o.start(t + d); l.start(t + d); o.stop(t + d + 0.9); l.stop(t + d + 0.9); }); },
    special() { tone('sawtooth', 160, 1400, 0.7, 0.1); noise(0.7, 0.15, 'bandpass', 400, 3, 3000); },
    superJump() { tone('sine', 300, 1300, 0.6, 0.08); },
    land(v) { noise(0.2, 0.2 * v, 'lowpass', 900, 1, 150); },
    fanfare(win) { if (!ctx) return; const t = ctx.currentTime; const n = win ? [72, 76, 79, 84, 88] : [67, 63, 60, 55]; n.forEach((m, k) => { tone(win ? 'square' : 'triangle', mtof(m), null, 0.25, 0.08, null, t + k * 0.14); tone('sine', mtof(m - 12), null, 0.3, 0.07, null, t + k * 0.14); }); },
    chargeStart() {
      if (!ctx) return; this.chargeStop();
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 180;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 8;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.05);
      o.connect(f); f.connect(g); g.connect(sfxG); o.start(); this._ch = { o, f, g };
    },
    chargeSet(c) { if (!ctx || !this._ch) return; const t = ctx.currentTime; this._ch.o.frequency.setTargetAtTime(180 + c * 520, t, 0.03); this._ch.f.frequency.setTargetAtTime(900 + c * 2600, t, 0.03); },
    chargeStop() { if (!ctx || !this._ch) return; const { o, g } = this._ch; const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.stop(t + 0.08); this._ch = null; },
    squelch() { noise(0.13, 0.09, 'lowpass', 520, 3, 160); tone('sine', rand(170, 210), 85, 0.11, 0.05); },
    chargeReady() { tone('triangle', 990, null, 0.06, 0.08); },
    fizzle() { noise(0.12, 0.1, 'bandpass', 1500, 2, 500); tone('sine', 500, 200, 0.1, 0.05); },
    chargeFull() { tone('sine', 1760, null, 0.12, 0.12); tone('sine', 2640, null, 0.18, 0.08, null, ctx && ctx.currentTime + 0.05); },
    cannonImpact(v, pan = 0) {
      if (!ctx) return; const d = panNode(pan), t = ctx.currentTime;
      noise(0.9, 0.5 * v, 'lowpass', 1400, 0.8, 60, d); tone('sine', 110, 32, 0.8, 0.45 * v, d);
      noise(0.25, 0.25 * v, 'bandpass', 900, 1.5, 300, d, t + 0.05); tone('triangle', 70, 40, 1.2, 0.12 * v, d, t + 0.1);
    },
    cannon(v, c) { noise(0.35 + c * 0.3, (0.25 + c * 0.35) * v, 'lowpass', 2400, 0.9, 120); tone('square', 520, 60, 0.25, 0.12 * v); tone('sine', 150, 40, 0.4 + c * 0.2, (0.3 + c * 0.3) * v); noise(0.06, 0.25 * v, 'highpass', 3000, 1); },
    // the secret name: a run of bright notes climbing (on), or tumbling back down (off)
    cheat(on) { if (!ctx) return; const t = ctx.currentTime, n = on ? [72, 76, 79, 84, 88, 91, 96] : [84, 79, 76, 72, 67]; n.forEach((m, k) => { tone('square', mtof(m), null, 0.11, 0.07, null, t + k * 0.065); tone('triangle', mtof(m - 12), null, 0.14, 0.06, null, t + k * 0.065); }); if (on) { noise(0.5, 0.16, 'bandpass', 500, 2, 4200, null, t); tone('sine', 1760, 3520, 0.5, 0.06, null, t + 0.46); } },
    // Karita's welcome: a soft tick as each letter turns over, then a little music-box tune with an echo
    tick(i = 0) { tone('sine', mtof(76 + i * 2), null, 0.07, 0.09); tone('triangle', mtof(88 + i * 2), null, 0.05, 0.04); },
    welcome() { if (!ctx) return; const t = ctx.currentTime, n = [76, 79, 84, 83, 79, 84, 88, 91, 88, 96]; n.forEach((m, k) => { const at = t + k * 0.17; tone('sine', mtof(m), null, 0.42, 0.11, null, at); tone('triangle', mtof(m + 12), null, 0.2, 0.035, null, at); tone('sine', mtof(m), null, 0.3, 0.035, null, at + 0.26); }); [60, 67, 72].forEach(m => tone('sine', mtof(m), null, 1.9, 0.05, null, t)); },
    // SMG: a light, short, high "pip-tsk" (fires twice as often as the rifle, so it stays quiet)
    smg(v, pan = 0) {
      if (!ctx) return; const d = panNode(pan), k = rand(0.92, 1.08);
      noise(0.045, 0.11 * v, 'bandpass', 2600 * k, 1.6, 1500, d); tone('triangle', 620 * k, 240, 0.04, 0.06 * v, d);
    },
    // heavy gatling spin-up: a motor whine climbing in pitch + the barrels' ratchet ticking faster, then a hum while it fires
    spinStart(dur) {
      if (!ctx) return; this.spinStop(true); const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(230, t + dur);
      const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 1100;
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.setValueAtTime(900, t); nf.frequency.exponentialRampToValueAtTime(2600, t + dur); nf.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0;                       // ratchet: noise gated by a square LFO that speeds up
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.setValueAtTime(7, t); lfo.frequency.exponentialRampToValueAtTime(34, t + dur);
      const lg = ctx.createGain(); lg.gain.value = 0.045; lfo.connect(lg); lg.connect(ng.gain);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.6);
      o.connect(of); of.connect(g); n.connect(nf); nf.connect(ng); ng.connect(g); g.connect(sfxG);
      o.start(t); n.start(t); lfo.start(t); this._sp = { o, n, lfo, g, nf };
    },
    spinReady() {
      if (!ctx) return; tone('square', 1250, 820, 0.05, 0.05); noise(0.04, 0.08, 'highpass', 4000, 1);   // a dry metal "clack": barrels up to speed
      if (this._sp) { const t = ctx.currentTime; this._sp.g.gain.setTargetAtTime(0.045, t, 0.08); }
    },
    spinStop(now) {
      if (!ctx || !this._sp) return; const { o, n, lfo, g, nf } = this._sp, t = ctx.currentTime, d = now ? 0.03 : 0.28; this._sp = null;
      o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.exponentialRampToValueAtTime(45, t + d);
      lfo.frequency.cancelScheduledValues(t); lfo.frequency.setValueAtTime(lfo.frequency.value, t); lfo.frequency.exponentialRampToValueAtTime(4, t + d);
      nf.frequency.cancelScheduledValues(t); nf.frequency.setValueAtTime(nf.frequency.value, t); nf.frequency.exponentialRampToValueAtTime(500, t + d);
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      [o, n, lfo].forEach(x => x.stop(t + d + 0.05));
    },
    // heavy gatling: short dry mechanical rattle per round (nothing like the rifle's wet "pshh")
    gatling(v, pan = 0) {
      if (!ctx) return; const d = panNode(pan), k = rand(0.94, 1.06);
      tone('square', 190 * k, 85, 0.035, 0.07 * v, d); noise(0.03, 0.1 * v, 'bandpass', 3600 * k, 2.6, 2200, d); tone('sawtooth', 72, 48, 0.045, 0.06 * v, d);
    },
    // range blaster: hollow "poomp" out of a tube + a hard click
    blastShot(v, pan = 0) {
      if (!ctx) return; const d = panNode(pan), t = ctx.currentTime;
      tone('sine', 110, 52, 0.24, 0.32 * v, d); noise(0.14, 0.16 * v, 'bandpass', 500, 2.2, 2200, d); tone('square', 950, 400, 0.025, 0.05 * v, d);
      noise(0.06, 0.08 * v, 'highpass', 4000, 1, null, d, t + 0.02);
    },
    // its explosion: sharp crack, a punchy body and a fizzing ink tail (bigger radius = deeper)
    blastBoom(v, pan = 0, R = 2) {
      if (!ctx) return; const d = panNode(pan), k = clamp(R / 2.4, 0.6, 1.2), t = ctx.currentTime;
      noise(0.05, 0.28 * v, 'highpass', 5200, 0.9, null, d); noise(0.5 * k, 0.4 * v, 'lowpass', 2400, 0.8, 110, d);
      tone('sine', 170 / k, 44, 0.4 * k, 0.32 * v, d); noise(0.6, 0.07 * v, 'bandpass', 900, 1.6, 2600, d, t + 0.08);
    },
    get ctx() { return ctx; }
  };
})();

/* ------------------------------------------------------------ renderer */
let renderer, scene, camera, sun, hemi, fillLight;
const clock = new THREE.Clock();
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc4e6ff, 110, 520);
  camera = new THREE.PerspectiveCamera(SETTINGS.fov, innerWidth / innerHeight, 0.08, 1500);
  scene.add(camera);
  hemi = new THREE.HemisphereLight(0xd6ecff, 0x9b8a74, 0.55);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d8, 3.4);
  sun.position.set(38, 70, 24);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 10; sc.far = 200;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const fill = fillLight = new THREE.DirectionalLight(0xa9c8ff, 0.7); fill.position.set(-30, 25, -40); scene.add(fill);
  applyQuality();
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
}
function applyQuality() {
  const q = SETTINGS.qual;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === 2 ? 2 : q === 1 ? 1.5 : 1));
  sun.castShadow = q > 0;
  const ms = q === 2 ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}

/* ------------------------------------------------- procedural textures */
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, a, dark = true) {
  for (let i = 0; i < n; i++) {
    const v = dark ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`;
    const s = Math.random() * 2.2 + 0.5; g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
const TEX = {};
function buildTextures() {
  TEX.concrete = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#c9ccd1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const l = 196 + Math.random() * 18; g.fillStyle = `rgb(${l},${l + 2},${l + 6})`; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
    speckle(g, w, h, 5000, 0.12); speckle(g, w, h, 1500, 0.2, false);
    g.strokeStyle = 'rgba(80,85,95,.55)'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    for (let i = 0; i < 6; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(60,60,70,.12)'); gr.addColorStop(1, 'rgba(60,60,70,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  TEX.grate = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6d7480'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const cx = x * 32 + (y % 2) * 16, cy = y * 32 + 16;
      g.save(); g.translate(cx, cy); g.rotate(y % 2 ? 0.7 : -0.7);
      const gr = g.createLinearGradient(-9, 0, 9, 0); gr.addColorStop(0, '#9aa2ae'); gr.addColorStop(1, '#4d5360');
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 10, 3.2, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    speckle(g, w, h, 1200, 0.15);
  });
  const container = (base, dark) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); }
    g.fillStyle = dark; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    speckle(g, w, h, 900, 0.2); for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(120,60,20,.18)'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 8 + Math.random() * 30); }
  });
  TEX.contR = container('#d6453d', '#7a1f1a');
  TEX.contB = container('#2d8fb8', '#124a63');
  TEX.contY = container('#f1b52c', '#8c5e08');
  TEX.contG = container('#4fa35a', '#1f5327');
  TEX.panel = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e9ebef'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2d2f3a'; g.fillRect(0, h - 40, w, 40);
    g.fillStyle = '#ffd23a'; for (let x = -40; x < w + 40; x += 36) { g.beginPath(); g.moveTo(x, h - 40); g.lineTo(x + 18, h - 40); g.lineTo(x + 38, h); g.lineTo(x + 20, h); g.fill(); }
    g.strokeStyle = 'rgba(40,45,60,.35)'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 50);
    g.fillStyle = '#9aa0ab'; [[14, 14], [w - 14, 14], [14, h - 54], [w - 14, h - 54]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); });
    speckle(g, w, h, 900, 0.1);
  });
  TEX.crate = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c98c4a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = `rgba(90,50,20,${0.15 + Math.random() * 0.1})`; g.fillRect(0, y, w, 3); for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(110,60,25,.15)'; g.fillRect(Math.random() * w, y + Math.random() * 30, 30 + Math.random() * 60, 1.5); } }
    g.strokeStyle = '#6e4420'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    g.beginPath(); g.moveTo(16, 16); g.lineTo(w - 16, h - 16); g.stroke();
  });
  TEX.deck = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#373b4a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a5064'; for (let x = 0; x < w; x += 64) g.fillRect(x + 4, 0, 56, h);
    g.fillStyle = '#ffffff22'; g.fillRect(0, 120, w, 16);
    speckle(g, w, h, 800, 0.2);
  });
  TEX.stone = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9a9ea8'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const l = 140 + Math.random() * 30; g.fillStyle = `rgb(${l},${l + 3},${l + 10})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); }
    speckle(g, w, h, 1500, 0.15);
  });
  // ---- 西關大屋: granite street slabs, grey-blue brick, damp canal blocks, red terrace tiles, cream plaster, dressed stone
  const tone = (r, g2, b, k) => `rgb(${Math.round(r * k)},${Math.round(g2 * k)},${Math.round(b * k)})`, rr = (a, b) => a + (b - a) * Math.random();
  TEX.granite = canvasTex(512, 512, (g, w, h) => {      // 麻石: long slabs in running courses (texture = 4 m); kept pale and calm so ink reads on it
    g.fillStyle = '#9a8f78'; g.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) { let x = -rr(0, 120); while (x < w) { const L = rr(110, 220); g.fillStyle = tone(186, 170, 138, rr(0.94, 1.04)); g.fillRect(x + 2, r * rh + 2, L - 4, rh - 4); if (x + L > w) g.fillRect(x + 2 - w, r * rh + 2, L - 4, rh - 4); x += L; } }
    speckle(g, w, h, 5000, 0.1);
  });
  TEX.brick = canvasTex(512, 512, (g, w, h) => {        // 青磚 (texture = 2 m)
    g.fillStyle = '#a3a59e'; g.fillRect(0, 0, w, h);
    const bw = 64, bh = 512 / 26;
    for (let r = 0; r < 26; r++) for (let c = -1; c < 9; c++) { const x = c * bw + (r % 2) * bw / 2; g.fillStyle = tone(98, 112, 124, rr(0.9, 1.1)); g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3); }
    speckle(g, w, h, 4000, 0.07);
  });
  TEX.canal = canvasTex(512, 256, (g, w, h) => {        // canal bank: rough blocks, mossy toward the water (one texture = the whole height)
    g.fillStyle = '#7f7b71'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) { let x = -rr(0, 80); while (x < w) { const L = rr(70, 150); g.fillStyle = tone(132, 124, 108, rr(0.88, 1.06)); g.fillRect(x + 3, r * 64 + 3, L - 6, 58); if (x + L > w) g.fillRect(x + 3 - w, r * 64 + 3, L - 6, 58); x += L; } }
    speckle(g, w, h, 4000, 0.14);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(50,80,50,.12)'); gr.addColorStop(1, 'rgba(40,78,48,.6)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  TEX.terrace = canvasTex(256, 256, (g, w, h) => {      // 階磚: red quarry tiles (texture = 2.4 m)
    g.fillStyle = '#cdbfab'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = tone(170, 84, 60, rr(0.92, 1.06)); g.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29); }
    speckle(g, w, h, 1500, 0.08);
  });
  TEX.plaster = canvasTex(256, 256, (g, w, h) => {      // arcade render: warm cream, faint rain streaks
    g.fillStyle = '#d2b98a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,100,70' : '255,250,235'},${rr(0.02, 0.07)})`; g.fillRect(rr(0, w), 0, rr(2, 10), h); }
    speckle(g, w, h, 1800, 0.06);
  });
  TEX.cstone = canvasTex(256, 256, (g, w, h) => {       // dressed pale granite (texture = 2 m): steps, bridges, the paifang, plinths
    g.fillStyle = '#b0a48a'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 2; c++) { g.fillStyle = tone(196, 182, 152, rr(0.96, 1.03)); g.fillRect(c * 128 + (r % 2) * 64 + 1, r * 64 + 1, 126, 62); }
    speckle(g, w, h, 2500, 0.09);
  });
  TEX.gtile = canvasTex(256, 256, (g, w, h) => {        // grey roof tiles you can walk on (the mansion's wings)
    g.fillStyle = '#4f555a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, '#5a6167'); gr.addColorStop(0.5, '#8d959b'); gr.addColorStop(1, '#5a6167'); g.fillStyle = gr; g.fillRect(x + 1, 0, 30, h); }
    for (let y = 0; y < h; y += 43) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, w, 3); }
  });
  // stone stairs drawn on a slope (2 m of texture = 4 treads): a lit nosing, the tread, the shadow under the next riser
  const stairs = vert => canvasTex(256, 256, (g, w, h) => {
    for (let k = 0; k < 4; k++) { const gr = vert ? g.createLinearGradient(0, k * 64, 0, k * 64 + 64) : g.createLinearGradient(k * 64, 0, k * 64 + 64, 0);
      gr.addColorStop(0, '#6f6656'); gr.addColorStop(0.16, '#8e846f'); gr.addColorStop(0.22, '#c9bb9b'); gr.addColorStop(0.9, '#c4b696'); gr.addColorStop(0.93, '#e6dcc2'); gr.addColorStop(1, '#e6dcc2'); g.fillStyle = gr;
      if (vert) g.fillRect(0, k * 64, w, 64); else g.fillRect(k * 64, 0, 64, h); }
    speckle(g, w, h, 2200, 0.08);
  });
  TEX.stairZ = stairs(true); TEX.stairX = stairs(false);
  TEX.bamboo = canvasTex(128, 128, (g, w, h) => {       // a stack of bamboo steamers
    for (let y = 0; y < h; y += 32) { g.fillStyle = '#c9a463'; g.fillRect(0, y, w, 32); g.fillStyle = '#a8833f'; g.fillRect(0, y + 26, w, 6); g.fillStyle = '#e0c287'; g.fillRect(0, y, w, 4); }
    for (let x = 0; x < w; x += 5) { g.fillStyle = `rgba(90,60,20,${rr(0.04, 0.16)})`; g.fillRect(x, 0, 1.5, h); }
  });
  TEX.sandstone = canvasTex(256, 256, (g, w, h) => {    // 紅砂岩: the old city wall under Zhenhai Tower (texture = 2 m)
    g.fillStyle = '#4a221b'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 2; c++) { g.fillStyle = tone(150, 62, 48, rr(0.88, 1.08)); g.fillRect(c * 128 + (r % 2) * 64 + 2, r * 64 + 2, 124, 60); }
    speckle(g, w, h, 2500, 0.1);
  });
  TEX.hull = canvasTex(256, 128, (g, w, h) => {         // dragon boat hull: lacquered planks, a gold line under the gunwale
    g.fillStyle = '#7c2219'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 26) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y, w, 2); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,8,4' : '190,90,60'},${rr(0.04, 0.14)})`; g.fillRect(rr(0, w), rr(0, h), rr(20, 70), 1.5); }
    g.fillStyle = '#d8a640'; g.fillRect(0, 10, w, 5);
  });
  // skatepark: smooth pool concrete, wooden ramps, grass / hedges, see-through grate
  TEX.skate = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d9dde2'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, 0.07); speckle(g, w, h, 900, 0.12, false);
    for (let i = 0; i < 10; i++) { const x = Math.random() * w, y = Math.random() * h, r = 40 + Math.random() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,130,145,.10)'); gr.addColorStop(1, 'rgba(120,130,145,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(90,95,110,.22)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
  TEX.bowl = canvasTex(512, 512, (g, w, h) => {       // smooth poured concrete of the skate bowls (no slab joints)
    g.fillStyle = '#e4ebef'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, 0.05); speckle(g, w, h, 700, 0.08, false);
    for (let i = 0; i < 14; i++) { const x = Math.random() * w, y = Math.random() * h, r = 50 + Math.random() * 110; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(110,130,150,.09)'); gr.addColorStop(1, 'rgba(110,130,150,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  TEX.parkWall = canvasTex(1024, 256, (g, w, h) => {   // the park's outer wall: dark panels, a few posters (our own brand)
    g.fillStyle = '#34404c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1500, 0.06);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h);
    g.fillStyle = '#5b2bd6'; g.fillRect(0, h - 22, w, 8); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 10, w, 4);
    const post = (x, c0, c1, t) => { g.fillStyle = c0; g.fillRect(x, 46, 150, 150); g.fillStyle = c1; g.beginPath(); g.arc(x + 110, 90, 46, 0, 7); g.fill(); g.font = '900 30px Arial Black, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(t, x + 12, 180); };
    post(150, '#ff7a00', '#3346ff', 'RUSH!'); post(560, '#1f8f6a', '#ffe45c', 'INK UP'); post(830, '#d6246e', '#3fd0ff', 'SPLASH');
  });
  TEX.wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c99a5b'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { const l = 180 + Math.random() * 30; g.fillStyle = `rgb(${l},${l * 0.74 | 0},${l * 0.46 | 0})`; g.fillRect(0, y + 2, w, 28); g.fillStyle = 'rgba(80,45,15,.35)'; g.fillRect(0, y, w, 2); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(100,60,25,.18)'; g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 1.5); }
    g.fillStyle = 'rgba(60,40,20,.5)'; for (let y = 16; y < h; y += 32) [20, w - 20].forEach(x => { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); });
  });
  TEX.grass = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4f9a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? 'rgba(40,110,40,.5)' : 'rgba(140,200,90,.35)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3 + Math.random() * 3); }
  });
  TEX.hedge = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3f7d34'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) { const x = Math.random() * w, y = Math.random() * h, r = 5 + Math.random() * 9, l = 0.7 + Math.random() * 0.6; g.fillStyle = `rgb(${50 * l | 0},${120 * l | 0},${45 * l | 0})`; g.beginPath(); g.ellipse(x, y, r, r * 0.6, Math.random() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#6b6f78'; g.fillRect(0, h - 28, w, 28); g.fillStyle = '#ffc629'; g.fillRect(0, h - 30, w, 5);
  });
  TEX.grateA = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#7d8592'; g.lineWidth = 5;
    for (let k = -w; k < w * 2; k += 21) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
    g.strokeStyle = '#c3c9d2'; g.lineWidth = 1.5;
    for (let k = -w; k < w * 2; k += 21) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); }
  });
  TEX.windows = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 20) for (let x = 8; x < w - 8; x += 24) { const lit = Math.random(); g.fillStyle = lit > 0.8 ? '#fff6c8' : lit > 0.4 ? '#7f93ad' : '#5d6e87'; g.fillRect(x, y, 14, 12); }
  }, false);
  TEX.noise = makeNoiseTex(256);
  TEX.layout = layoutTex();
}
function makeNoiseTex(N) {
  // tileable fbm value noise
  const data = new Uint8Array(N * N * 4);
  const lat = (sz) => { const a = new Float32Array(sz * sz); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
  const octs = [[8, 0.5], [16, 0.28], [32, 0.14], [64, 0.08]].map(([s, w]) => ({ s, w, l: lat(s) }));
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const o of octs) {
      const fx = x / N * o.s, fy = y / N * o.s, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const L = (a, b) => o.l[((b % o.s + o.s) % o.s) * o.s + ((a % o.s + o.s) % o.s)];
      v += o.w * lerp(lerp(L(ix, iy), L(ix + 1, iy), tx), lerp(L(ix, iy + 1), L(ix + 1, iy + 1), tx), ty);
    }
    const i = (y * N + x) * 4; data[i] = data[i + 1] = data[i + 2] = clamp(v * 255, 0, 255); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
