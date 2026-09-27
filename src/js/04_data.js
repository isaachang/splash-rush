/* ======================================================= GAME DATA
   Weapons / subs / specials are pure data. Characters read their
   loadout from here; appearance is stored separately (LOOK) so that
   gameplay and visuals stay decoupled.                               */
const SUBS = {
  bomb: { id: 'bomb', name: '墨水炸弹', cost: 70, desc: '抛出后弹一下再爆炸，大范围涂色并造成伤害' }
};
const SPECIALS = {
  surge: { id: 'surge', name: '墨浪冲击', desc: '跃向高空后砸地，大范围涂色并击倒周围敌人' }
};
const WEAPONS = {
  rifle: {
    id: 'rifle', name: '墨浪步枪', en: 'SPLASH RIFLE', role: '全能 · 中距离', type: 'auto', cls: 'shooter',
    desc: '射速、射程、涂地都很均衡，4 发击倒。适合任何场合，新手首选。',
    // ballistics (Splatoon-style): near-instant straight flight, then a "brake" phase with drag + gravity
    dmg: 25, dmgFar: 12, falloff: [0.16, 0.4], interval: 0.105, speed: 130, straight: 0.055, dragH: 18, dragV: 16, grav: 150,
    spread: 0.045, airSpread: 0.1, cost: 0.92, splat: [0.95, 1.2],
    moveFire: 4.8, muzzleF: 0.55, range: 13, spLoss: 0.5,
    sub: 'bomb', special: 'surge', spArea: 42,
    stats: { range: 3, dmg: 3, rate: 4, paint: 3, mobility: 4 }
  },
  charger: {
    id: 'charger', name: '重炮狙击', en: 'HEAVY CANNON', role: '远程 · 狙击', type: 'charge', cls: 'charger',
    desc: '按住蓄力、松开发射，蓄得越久射程越远、伤害越高，蓄满一发击倒。弹道沿途涂出墨线，落点大范围溅射。蓄力时会暴露激光瞄准线，近身很吃亏。',
    chargeTime: 0.95, minCharge: 0, minRange: 11, maxRange: 30, dmgMin: 40, dmgMax: 100, dmgFull: 160,
    costMin: 3, costFull: 18, lineR: 0.5, impactR: [1.0, 2.8], moveCharge: 1.35, moveFire: 1.35, muzzleF: 1.05, range: 30, storeTime: 1.25, spLoss: 0.5,
    sub: 'bomb', special: 'surge', spArea: 36,
    stats: { range: 5, dmg: 5, rate: 1, paint: 2, mobility: 2 }
  }
};
const WEAPON_ORDER = ['rifle', 'charger'];
const STAT_LABELS = [['range', '射程'], ['dmg', '伤害'], ['rate', '射速'], ['paint', '涂地'], ['mobility', '机动']];

/* ---------------------------------------------------------- icons */
function weaponIcon(id, color = '#fff', w = 64, accent = 'var(--c0)') {
  const h = w / 2, st = 'stroke="#111" stroke-width="2.5" stroke-linejoin="round"';
  let body = '';
  if (id === 'rifle') body = `<rect x="10" y="12" width="30" height="10" rx="3" fill="${color}" ${st}/><rect x="38" y="14" width="16" height="5" rx="2" fill="${color}" ${st}/><rect x="16" y="20" width="7" height="9" rx="2" fill="${color}" ${st}/><circle cx="24" cy="10" r="5" style="fill:${accent}" ${st}/>`;
  else if (id === 'charger') body = `<rect x="4" y="14" width="22" height="9" rx="3" fill="${color}" ${st}/><rect x="24" y="15.5" width="36" height="5" rx="2" fill="${color}" ${st}/><rect x="14" y="7" width="16" height="5" rx="2.5" fill="${color}" ${st}/><rect x="10" y="21" width="6" height="8" rx="2" fill="${color}" ${st}/><circle cx="8" cy="12" r="4.5" style="fill:${accent}" ${st}/>`;
  else if (id === 'bomb') body = `<circle cx="32" cy="17" r="11" style="fill:${accent}" ${st}/><rect x="21" y="15" width="22" height="4" fill="${color}" ${st}/><rect x="29" y="3" width="6" height="5" rx="1" fill="${color}" ${st}/>`;
  else if (id === 'surge') body = `<path d="M8 26 Q20 6 32 18 T56 10 L56 28 L8 28Z" style="fill:${accent}" ${st}/><path d="M32 2 L32 16 M26 10 L32 16 L38 10" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
  else body = `<circle cx="32" cy="16" r="10" fill="${color}" ${st}/>`;
  return `<svg viewBox="0 0 64 32" width="${w}" height="${h}" style="vertical-align:middle;overflow:visible">${body}</svg>`;
}

/* ------------------------------------------------------ appearance */
function randomLook() {
  return {
    skin: pick(SKIN_TONES), cloth: pick(CLOTH_COLS), cloth2: pick(CLOTH_COLS),
    pants: pick(['#23242c', '#3b3f52', '#4a3b2c', '#1f3050', '#e9e4d8']),
    hat: pick(['phones', 'band', 'goggles', 'none', 'cap']), hatColor: pick(CLOTH_COLS),
    trim: pick(['#ffd23a', '#f0f0f0', '#ff5a5a', '#5ad1ff'])
  };
}
const SKIN_TONES = ['#ffdcc0', '#f3c39b', '#dba577', '#b07650', '#7d4d31'];
const CLOTH_COLS = ['#f5f5f2', '#2a2b35', '#697386', '#eadcc2', '#5c7a3a', '#274b8f', '#8f3434', '#ffcf3f', '#ff8fb1', '#40c0b0'];

/* --------------------------------------------------------- profile */
const PROFILE_KEY = 'splashrush.profile';
const Profile = {
  data: { v: 1, name: '新人墨仔', weapon: 'rifle', pal: 0, diff: 1, dur: 180, look: null },
  load() {
    try { const s = localStorage.getItem(PROFILE_KEY); if (s) { const d = JSON.parse(s); if (d && d.v === 1) Object.assign(this.data, d); } } catch (e) { }
    if (!this.data.look) this.data.look = randomLook();
    if (!WEAPONS[this.data.weapon]) this.data.weapon = 'rifle';
    const d = this.data; GAME.name = d.name; GAME.pal = clamp(d.pal | 0, 0, PALETTES.length - 1); GAME.diff = clamp(d.diff | 0, 0, 2); GAME.dur = [90, 180, 300].includes(d.dur) ? d.dur : 180;
  },
  save() {
    Object.assign(this.data, { name: GAME.name, pal: GAME.pal, diff: GAME.diff, dur: GAME.dur });
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.data)); } catch (e) { }
  }
};
