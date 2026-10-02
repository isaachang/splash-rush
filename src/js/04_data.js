/* ======================================================= GAME DATA
   Weapons / subs / specials are pure data. Characters read their
   loadout from here; appearance is stored separately (LOOK) so that
   gameplay and visuals stay decoupled.                               */
const SUBS = {
  bomb: { id: 'bomb', name: '墨水炸弹', short: '炸弹', cost: 56, desc: '抛出后弹一下再爆炸，大范围涂色并造成伤害' },
  // like the original's curling bomb: slides along the ground laying a path of ink you can swim behind
  curling: { id: 'curling', name: '冰壶炸弹', short: '冰壶', cost: 56, desc: '贴着地面快速滑出去，一路铺出一条墨路，撞墙会反弹，滑到头爆炸。潜进墨路跟在后面冲，就能快速贴近敌人' },
  // graffiti cover: a spray-painted board that stops enemy ink; your own team shoots straight through it
  cover: { id: 'cover', name: '涂鸦掩体', short: '掩体', cost: 56, hp: 300, life: 10, desc: '在前方立起一块涂鸦板，挡住敌人的子弹，自己人的子弹能穿过去。脚下会铺一片墨，可以躲在后面潜墨回墨。能被打坏，最多存在 10 秒' }
};
const SPECIALS = {
  surge: { id: 'surge', name: '墨浪冲击', desc: '跃向高空后砸地，大范围涂色并击倒周围敌人' }
};
const WEAPONS = {
  rifle: {
    id: 'rifle', name: '墨浪步枪', en: 'SPLASH RIFLE', role: '全能 · 中距离', type: 'auto', cls: 'shooter',
    desc: '射速、射程、涂地都很均衡，3 发击倒。适合任何场合，新手首选。',
    // ballistics (Splatoon-style): near-instant straight flight, then a "brake" phase with drag + gravity
    dmg: 36, dmgFar: 18, falloff: [0.18, 0.42], interval: 0.105, speed: 130, straight: 0.07, dragH: 14, dragV: 7, grav: 72,
    spread: 0.045, airSpread: 0.1, cost: 1.42, splat: [1.07, 1.35],
    moveFire: 4.8, muzzleF: 0.55, range: 16, spLoss: 0.5,
    sub: 'bomb', special: 'surge', spArea: 42,
    stats: { range: 4, dmg: 3, rate: 4, paint: 3, mobility: 4 }
  },
  charger: {
    id: 'charger', name: '重炮狙击', en: 'HEAVY CANNON', role: '远程 · 狙击', type: 'charge', cls: 'charger',
    desc: '按住蓄力、松开发射，蓄得越久射程越远、伤害越高，蓄满一发击倒。弹道沿途涂出墨线，落点大范围溅射。蓄力时会暴露激光瞄准线，近身很吃亏。',
    chargeTime: 0.95, minCharge: 0, minRange: 11, maxRange: 30, dmgMin: 40, dmgMax: 100, dmgFull: 160,
    costMin: 3, costFull: 18, lineR: 0.56, lineRFull: 0.9, impactR: [1.12, 2.24], impactFull: 4.0, moveCharge: 1.35, moveFire: 1.35, muzzleF: 1.05, range: 30, storeTime: 1.25, spLoss: 0.5,
    sub: 'bomb', special: 'surge', spArea: 36,
    stats: { range: 5, dmg: 5, rate: 1, paint: 2, mobility: 2 }
  }
};
// ---- two long-range weapons modelled on the original's weapon classes (splatling / blaster)
// they reuse the same bullets, splashes, hit feedback and sounds as the rifle and the cannon
WEAPONS.splatling = {
  id: 'splatling', name: '重型加特林', en: 'HEAVY GATLING', role: '远程 · 扫射', type: 'auto', cls: 'splatling',
  desc: '按住先让枪管转起来（约 0.3 秒），转起来以后按住就一直扫射，松手就停，再按又要重新转。射速极快、射程远，但一罐墨只够打约 40 发（约 2 秒），打完要赶紧潜墨回墨。转动和扫射时都走得慢。',
  // shooter-style bullets with a longer straight flight; very fast fire, small magazine
  dmg: 22, dmgFar: 12, falloff: [0.17, 0.36], interval: 0.05, speed: 150, straight: 0.11, dragH: 14, dragV: 7, grav: 72,
  spinUp: 0.3, spread: 0.055, airSpread: 0.1, cost: 2.5, splat: [0.9, 1.1], moveFire: 3.8, muzzleF: 0.85, range: 21, spLoss: 0.5,
  sub: 'bomb', special: 'surge', spArea: 44,
  stats: { range: 4, dmg: 2, rate: 5, paint: 4, mobility: 2 }
};
WEAPONS.blaster = {
  id: 'blaster', name: '远程爆破枪', en: 'RANGE BLASTER', role: '中远 · 爆破', type: 'blaster', cls: 'blaster',
  desc: '一次打出一颗墨弹：直接命中一枪击倒；打在地上、墙上或飞到最远处（约 23 米）会爆炸，溅射周围的人。在半空炸开可以打到躲在掩体后面的人。射速很慢，打空了要等很久。',
  interval: 1.0, blastR: 2.4, blastCore: 1.1, blastDmg: [70, 50], fuse: 0.37, cost: 11,
  speed: 62, straight: 0.37, dragH: 3, dragV: 1, grav: 30, splat: [0.8, 0.9], dmg: 125, dmgFar: 125, falloff: [9, 9], spread: 0.008, airSpread: 0.03, retR: 1.1,
  moveFire: 4.2, muzzleF: 0.75, range: 23, spLoss: 0.5,
  sub: 'bomb', special: 'surge', spArea: 34,
  stats: { range: 4, dmg: 5, rate: 1, paint: 1, mobility: 3 }
};
// 阿飒's second main weapon: very fast, weak bullets that burn through the tank but refill quickly
WEAPONS.smg = {
  id: 'smg', name: '疾风冲锋枪', en: 'SWIFT SMG', role: '近中距离 · 速射', type: 'auto', cls: 'shooter',
  desc: '射速极快，单发伤害很低，5 发击倒，靠连射压人。射程和步枪一样。很费墨，一罐只够连打约 3 秒，但回墨比别的枪快，停火后也更早开始回墨。边打边跑也很灵活。',
  // same flight as the rifle (so the bots' aim tables carry over), weaker and much faster
  dmg: 20, dmgFar: 10, falloff: [0.18, 0.42], interval: 0.06, speed: 130, straight: 0.07, dragH: 14, dragV: 7, grav: 72,
  spread: 0.06, airSpread: 0.12, cost: 1.6, splat: [0.85, 1.05],
  moveFire: 5.4, muzzleF: 0.5, range: 16, spLoss: 0.5, inkRegenK: 1.3, regenDelay: 0.4,
  sub: 'bomb', special: 'surge', spArea: 40,
  stats: { range: 4, dmg: 1, rate: 5, paint: 3, mobility: 5 }
};
WEAPONS.charger.charges = true;
// (the range blaster is kept in the code but not offered for now)
const WEAPON_ORDER = ['rifle', 'smg', 'charger', 'splatling'];
const STAT_LABELS = [['range', '射程'], ['dmg', '伤害'], ['rate', '射速'], ['paint', '涂地'], ['mobility', '机动']];

/* ------------------------------------------------------ characters
   Squid-kid characters in the spirit of the original (tentacle "hair" in
   team colour, visor, backpack ink tank) — original designs.  Each has a
   different body and different stats; any character can use any weapon. */
const CHARACTERS = {
  sa: {
    id: 'sa', name: '阿飒', en: 'SWIFT', role: '疾风 · 游击', tag: '跑得最快的街头涂鸦手',
    desc: '全场最快：移速、潜行都快一大截，适合绕后偷袭、抢地盘。主武器可选墨浪步枪或疾风冲锋枪。但身板最薄，墨罐也小，要省着打，挨两下就得撤。',
    hp: 80, runK: 1.25, swimK: 1.15, inkCap: 0.8, inkRegen: 1, knockK: 1.2, weapons: ['rifle', 'smg'], sub: 'curling',
    look: { skin: '#f3c39b', cloth: '#f5f5f2', cloth2: '#40c0b0', pants: '#23242c', hat: 'band', hatColor: '#40c0b0', trim: '#5ad1ff', hair: 'tail', bodyW: 0.92, bodyH: 1.0, tankK: 0.9, crestK: 1.35 },
    bars: { hp: 1, speed: 5, ink: 1 }, weaponNote: '步枪 / 冲锋枪'
  },
  man: {
    id: 'man', name: '满满', en: 'TANKFUL', role: '墨罐 · 持久', tag: '背着超大墨罐的涂地狂',
    desc: '背着一个超大墨罐的狙击手，墨水多 20%，回墨也更快，重炮狙击一罐能多打一枪。身板偏薄，被近身就赶紧潜进墨里换位置。',
    hp: 85, runK: 0.95, swimK: 1.1, inkCap: 1.2, inkRegen: 1.15, knockK: 1, weapons: ['charger'], sub: 'cover',
    look: { skin: '#dba577', cloth: '#ffcf3f', cloth2: '#2a2b35', pants: '#1f3050', hat: 'phones', hatColor: '#2a2b35', trim: '#f0f0f0', hair: 'twin', bodyW: 1.0, bodyH: 1.0, tankK: 1.45, crestK: 1.0 },
    bars: { hp: 2, speed: 3, ink: 4 }, weaponNote: '专属武器'
  },
  dun: {
    id: 'dun', name: '石墩', en: 'BULWARK', role: '重装 · 肉盾', tag: '挨打也不退一步的大块头',
    desc: '又壮又胖，生命值最高（步枪要 5 发才倒），被打中几乎不后仰、不被推开，端着加特林顶在最前面。代价是全场最慢、跳得低，身板大也更容易被打中。',
    hp: 160, runK: 0.57, swimK: 0.665, inkCap: 1, inkRegen: 1, knockK: 0.4, jumpK: 0.85, hitK: 1.3, weapons: ['splatling'], sub: 'bomb',
    look: { skin: '#7d4d31', cloth: '#3b3f52', cloth2: '#ff8a3d', pants: '#2a2b35', hat: 'goggles', hatColor: '#3b3f52', trim: '#ffd23a', hair: 'fin', bodyW: 1.04, bodyH: 1.02, fat: 1, tankK: 1.05, crestK: 0.8 },
    bars: { hp: 5, speed: 1, ink: 3 }, weaponNote: '专属武器'
  }
};
const CHAR_ORDER = ['sa', 'man', 'dun'];
// baseline body used by the automated mechanics tests (not selectable)
CHARACTERS.std = Object.assign({}, CHARACTERS.man, { id: 'std', name: '标准', sub: null, hp: 100, runK: 1, swimK: 1, inkCap: 1, inkRegen: 1, knockK: 1, weapons: ['rifle', 'smg', 'charger', 'splatling', 'blaster'] });
// a plain training dummy for the lobby sub-weapon demo (not selectable)
CHARACTERS.dummy = Object.assign({}, CHARACTERS.std, { id: 'dummy', name: '假人', look: { skin: '#f3c39b', cloth: '#e9e4d8', cloth2: '#697386', pants: '#3b3f52', hat: 'cap', hatColor: '#697386', trim: '#f0f0f0', bodyW: 1, bodyH: 1, tankK: 1, crestK: 1 } });
// the character that carries a given weapon (first match)
function charForWeapon(w) { return CHAR_ORDER.find(id => CHARACTERS[id].weapons.includes(w)) || 'sa'; }
// portrait: head with tentacle hair in team colour + each character's accessory (SVG, used in cards and lists)
function charIcon(id, w = 64, accent = 'var(--c0)') {
  const C = CHARACTERS[id] || CHARACTERS.man, L = C.look, st = 'stroke="#111" stroke-width="3" stroke-linejoin="round"';
  const hair = id === 'sa'
    ? `<path d="M14 30 Q12 8 32 6 Q52 8 50 30 Z" style="fill:${accent}" ${st}/><path d="M48 18 Q62 22 60 44 Q56 36 50 30 Z" style="fill:${accent}" ${st}/>`
    : id === 'dun'
      ? `<path d="M9 33 Q10 10 32 9 Q54 10 55 33 Z" style="fill:${accent}" ${st}/><path d="M24 12 L32 -2 L40 12 Z" style="fill:${accent}" ${st}/>`
      : `<path d="M12 32 Q10 8 32 6 Q54 8 52 32 Z" style="fill:${accent}" ${st}/><path d="M12 26 Q2 34 6 52 Q12 46 14 34 Z" style="fill:${accent}" ${st}/><path d="M52 26 Q62 34 58 52 Q52 46 50 34 Z" style="fill:${accent}" ${st}/>`;
  const acc = id === 'sa' ? `<rect x="12" y="20" width="40" height="6" rx="3" fill="${L.hatColor}" ${st}/>`
    : id === 'dun' ? `<circle cx="24" cy="15" r="6" fill="#9aa3b5" ${st}/><circle cx="40" cy="15" r="6" fill="#9aa3b5" ${st}/>`
      : `<path d="M11 30 Q32 -4 53 30" fill="none" stroke="#111" stroke-width="5"/><rect x="6" y="27" width="9" height="13" rx="4" fill="${L.hatColor}" ${st}/><rect x="49" y="27" width="9" height="13" rx="4" fill="${L.hatColor}" ${st}/>`;
  const fat = id === 'dun', rx = fat ? 23 : 19, chin = fat ? `<path d="M17 44 Q32 55 47 44" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>` : '';
  return `<svg viewBox="0 0 64 64" width="${w}" height="${w}" style="vertical-align:middle;overflow:visible">${fat ? `<path d="M10 52 Q32 44 54 52 L58 64 L6 64 Z" fill="${L.cloth}" ${st}/>` : ''}<ellipse cx="32" cy="${fat ? 35 : 34}" rx="${rx}" ry="${fat ? 19 : 18}" fill="${L.skin}" ${st}/>${chin}<rect x="${fat ? 12 : 15}" y="30" width="${fat ? 40 : 34}" height="9" rx="4.5" fill="#111"/><circle cx="25" cy="34.5" r="3" fill="#fff"/><circle cx="39" cy="34.5" r="3" fill="#fff"/>${hair}${acc}${fat ? '' : `<path d="M20 52 Q32 60 44 52 L44 62 L20 62 Z" fill="${L.cloth}" ${st}/>`}</svg>`;
}

/* ---------------------------------------------------------- icons */
function weaponIcon(id, color = '#fff', w = 64, accent = 'var(--c0)') {
  const h = w / 2, st = 'stroke="#111" stroke-width="2.5" stroke-linejoin="round"';
  let body = '';
  if (id === 'rifle') body = `<path d="M3 13 L14 12 L14 21 L5 23 Z" fill="${color}" ${st}/><rect x="13" y="11" width="24" height="9" rx="2.5" fill="${color}" ${st}/><rect x="35" y="12.5" width="12" height="6" rx="2" fill="${color}" ${st}/><rect x="46" y="14" width="14" height="3.5" rx="1.5" fill="${color}" ${st}/><rect x="16" y="19" width="6" height="9" rx="2" fill="${color}" ${st}/><path d="M26 19 L31 19 L33 28 L28 28 Z" style="fill:${accent}" ${st}/><rect x="17" y="6" width="13" height="5" rx="2.5" style="fill:${accent}" ${st}/>`;
  else if (id === 'smg') body = `<rect x="8" y="11" width="26" height="10" rx="3" fill="${color}" ${st}/><rect x="32" y="13" width="10" height="6" rx="2" fill="${color}" ${st}/><rect x="41" y="14.5" width="9" height="3.5" rx="1.5" fill="${color}" ${st}/><path d="M3 12 L9 12 L9 19 L4 21 Z" fill="${color}" ${st}/><rect x="19" y="20" width="7" height="12" rx="2" style="fill:${accent}" ${st}/><rect x="11" y="20" width="5" height="7" rx="2" fill="${color}" ${st}/><path d="M14 11 L18 5 L26 5 L28 11" fill="none" stroke="#111" stroke-width="2.5"/>`;
  else if (id === 'charger') body = `<rect x="4" y="14" width="22" height="9" rx="3" fill="${color}" ${st}/><rect x="24" y="15.5" width="36" height="5" rx="2" fill="${color}" ${st}/><rect x="14" y="7" width="16" height="5" rx="2.5" fill="${color}" ${st}/><rect x="10" y="21" width="6" height="8" rx="2" fill="${color}" ${st}/><circle cx="8" cy="12" r="4.5" style="fill:${accent}" ${st}/>`;
  else if (id === 'splatling') body = `<rect x="4" y="11" width="20" height="14" rx="4" fill="${color}" ${st}/><rect x="22" y="9" width="36" height="4" rx="2" fill="${color}" ${st}/><rect x="22" y="15" width="36" height="4" rx="2" fill="${color}" ${st}/><rect x="22" y="21" width="36" height="4" rx="2" fill="${color}" ${st}/><rect x="30" y="7" width="5" height="20" rx="2" style="fill:${accent}" ${st}/><circle cx="12" cy="8" r="5" style="fill:${accent}" ${st}/>`;
  else if (id === 'blaster') body = `<rect x="4" y="12" width="22" height="10" rx="3" fill="${color}" ${st}/><rect x="22" y="9" width="26" height="16" rx="5" fill="${color}" ${st}/><rect x="46" y="6" width="12" height="22" rx="4" style="fill:${accent}" ${st}/><rect x="10" y="20" width="6" height="9" rx="2" fill="${color}" ${st}/>`;
  else if (id === 'curling') body = `<ellipse cx="32" cy="22" rx="16" ry="6" style="fill:${accent}" ${st}/><rect x="17" y="14" width="30" height="8" rx="3" style="fill:${accent}" ${st}/><path d="M28 14 V8 H38" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/><path d="M28 14 V8 H38" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
  else if (id === 'cover') body = `<rect x="14" y="3" width="36" height="22" rx="3" fill="#2a2b35" ${st}/><path d="M20 18 Q24 6 32 12 T44 8 L44 20 L20 20Z" style="fill:${accent}"/><path d="M19 10 q4 -4 8 0 t8 0" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/><rect x="18" y="25" width="5" height="5" fill="#2a2b35" ${st}/><rect x="41" y="25" width="5" height="5" fill="#2a2b35" ${st}/>`;
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
  data: { v: 1, name: '新人墨仔', weapon: 'rifle', char: 'sa', pal: 0, diff: 1, dur: 180, look: null },
  load() {
    try { const s = localStorage.getItem(PROFILE_KEY); if (s) { const d = JSON.parse(s); if (d && d.v === 1) Object.assign(this.data, d); } } catch (e) { }
    if (!this.data.look) this.data.look = randomLook();
    if (!WEAPON_ORDER.includes(this.data.weapon)) this.data.weapon = 'rifle';
    if (!CHAR_ORDER.includes(this.data.char)) this.data.char = 'sa';
    if (!CHARACTERS[this.data.char].weapons.includes(this.data.weapon)) this.data.weapon = CHARACTERS[this.data.char].weapons[0];
    const d = this.data; GAME.name = d.name; GAME.pal = clamp(d.pal | 0, 0, PALETTES.length - 1); GAME.diff = clamp(d.diff | 0, 0, 2); GAME.dur = [90, 180, 300].includes(d.dur) ? d.dur : 180;
  },
  save() {
    Object.assign(this.data, { name: GAME.name, pal: GAME.pal, diff: GAME.diff, dur: GAME.dur });
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.data)); } catch (e) { }
  }
};

/* --------------------------------------------------------- releases
   Player-facing release notes (short, confirmed changes only).
   Newest first. VERSION shown on the title screen comes from here.   */
const RELEASES = [
  { v: 'v0.9.1', date: '2026-10-02', time: '03:30', title: '石墩削弱 · 冲锋枪', items: [
    '石墩削弱：走路速度和潜墨速度都慢 5%',
    '重型加特林要先转约 0.3 秒才开始连射，按住一直打、松手就停，再按要重新转；有专属的转动音效',
    '阿飒新增第二把主武器「疾风冲锋枪」：射速极快、单发很弱，很费墨但回墨快',
    '选场地时背景会淡入淡出切换成那张场地，不用再重新载入'
  ] },
  { v: 'v0.9.0', date: '2026-10-02', time: '01:50', title: '新地图：墨浪滑板场', items: [
    '新地图「墨浪滑板场」：S 形下沉泳池、波浪外墙、中央高塔和铁网走道',
    '泳池是真正的碗形，能走下去、顺着弧形坡走上来，坡面也能涂墨',
    '新增选场地页面：主页「开始对战」先选场地，背景会换成那张场地',
    '开场镜头直接落在你身后，开场时动鼠标也不会甩镜头',
    '棕榈树会挡子弹，人也穿不过树干；铁网围栏和走道不会再穿模'
  ] },
  { v: 'v0.8.6', date: '2026-09-30', time: '03:01', title: '爬墙', items: [
    '爬墙时鱿鱼会贴着墙面、头朝上',
    '在墙上可以停住，也能往上下左右游',
    '在墙上按跳会跳离墙面，爬到顶会自动跳上去',
    '有人在墙上移动时，墙面会冒出水花'
  ] },
  { v: 'v0.8.5', date: '2026-09-30', time: '02:33', title: '空中副武器', items: [
    '跳起来放涂鸦掩体，会把板子甩出去落到前方地面',
    '跳起来扔冰壶，会先落地再滑出去',
    '潜在自己墨里时更难被 AI 发现和打中',
    '难度「硬核」改名为「地狱」'
  ] },
  { v: 'v0.8.4', date: '2026-09-29', time: '22:48', title: '副武器演示', items: [
    '战前准备新增「副武器」页：用法、优缺点和关键数字一目了然',
    '切到副武器页时，中间会循环播放实机演示，左下角可以重播',
    '副武器说明改成一条一句的要点：绿色是优点、红色是弱点、黄色是限制'
  ] },
  { v: 'v0.8.3', date: '2026-09-29', time: '20:16', title: '角色专属副武器', items: [
    '阿飒的副武器换成冰壶炸弹：贴地滑出一条墨路，潜进去就能跟着冲',
    '满满的副武器换成涂鸦掩体：挡住敌人的子弹，自己人的子弹能穿过去',
    '石墩变胖了：更容易被打中、跳得更低，移速 60%、潜行 70%'
  ] },
  { v: 'v0.8.2', date: '2026-09-29', time: '18:23', title: '角色属性调整', items: [
    '阿飒墨水 80%；满满改为专职狙击手（85 血、潜行更快、墨水 120%）；石墩移速 70%',
    '炸弹消耗降低，墨少的角色也能多扔',
    '墨浪步枪换了新模型，更像一把步枪',
    '属性改名为「移速 / 潜行」，去掉了特点标签'
  ] },
  { v: 'v0.8.1', date: '2026-09-29', time: '17:19', title: '角色 / 武器面板', items: [
    '战前准备左边改成角色头像 + 「角色 / 武器」两页信息面板，属性条和数字带动画',
    '武器页能看到几发击倒、射程、射速和一罐墨能打几发（按角色墨水量算）',
    '切到武器页时角色钻进墨里，武器悬浮在中间旋转展示，可以拖动转',
    '修复预览里满满、石墩少一只手臂；大厅打开时更省性能'
  ] },
  { v: 'v0.8.0', date: '2026-09-29', time: '16:09', title: '角色', items: [
    '新增 3 个角色：阿飒（跑得最快）、满满（墨水最多）、石墩（最耐打），每个角色有自己的武器',
    '战前准备改成选角色：选中的角色会展开，可以看到和切换它的武器',
    '中间的 3D 预览会自动旋转，也可以按住拖动',
    '对阵阵容、Tab 战况和结算页都会显示每个人的角色'
  ] },
  { v: 'v0.7.0', date: '2026-09-29', time: '15:16', title: '重型加特林', items: [
    '新武器「重型加特林」：按住就扫射，射速极快、射程远，但一罐墨只够打约 40 发',
    '加特林有自己专属的射击音效',
    '对局里的 AI 会随机带上重炮狙击或重型加特林'
  ] },
  { v: 'v0.6.1', date: '2026-09-29', time: '14:04', title: '更粗的墨水', items: [
    '子弹变粗变大，打中时溅起更大的墨花',
    '落地墨迹稍微变大，涂地更快一点',
    '默认视野改为 62°：角色更大，远处也看得更清楚（设置里可以调）',
    '镜头稍微抬高，能看到更多地面'
  ] },
  { v: 'v0.6.0', date: '2026-09-29', time: '02:20', title: '结算与战况', items: [
    '结算页按原版流程重做：俯视判定、比例条拉锯、胜方举旗、WIN! / LOSE…',
    '计分板显示涂地、击倒、助攻、阵亡、必杀次数，赢的队伍排在上面',
    '新增奖牌：全场第一金牌、队内第一银牌',
    '新增吐槽奖：打得不好也会被「颁奖」，还附一句毒舌评语',
    '对局中按住 Tab 可以查看双方战况',
    '斜坡侧面和围墙顶部也能涂上墨水了',
    '开局和复活时面朝战场，落地就能开打',
    '阵亡后先看击倒你的人，然后切到队友视角观战',
    '超级跳落地时溅开一大片墨水',
    '暂停时声音渐渐变小变闷',
    '版本日志只展开最近 3 个版本，并显示发布时间'
  ] },
  { v: 'v0.5.2', date: '2026-09-28', time: '19:06', title: '武器差异化', items: [
    '重炮狙击蓄满的一炮更有冲击力：粗光束、大范围溅射、冲击波和震屏',
    '重炮狙击没蓄满时效果更小，只有蓄满才一枪击倒',
    '墨水炸弹扔得更远，跳起来扔能扔得更远',
    '墨浪步枪一罐墨可以打的发数减少（约 108 → 70 发）'
  ] },
  { v: 'v0.5.1', date: '2026-09-28', time: '18:29', title: '打击感', items: [
    '子弹改为连续的墨水流，开枪时能清楚看到墨水喷出去',
    '射程增加约 3 米（有效射程 13 → 16 米），弹道末端的下坠更平滑',
    '开枪时枪口喷墨、枪身后坐、镜头轻微上抬',
    '墨水打到地面和墙上会溅起墨花并发出"啪嗒"声，墙上的墨迹不再慢半拍',
    '打中敌人有专用命中音，对方会被打得一顿，命中标记随伤害变大',
    '开枪声重做，远处的枪声能分出左右',
    '修复被矮墙挡住时准星仍显示能打中的问题'
  ] },
  { v: 'v0.5.0', date: '2026-09-28', time: '16:29', title: '战斗手感收尾', items: [
    '步枪改为 3 枪击倒，对枪节奏更利落',
    '回血按原版调整：潜进自己的墨水约 1 秒回满',
    '踩进敌方墨水掉血更快，并新增脚下冒墨、屏幕底部被墨黏住、咕叽声等提示',
    '打中敌人时，对方身上会沾满你的墨水',
    '新增超级跳：按 M 打开地图点队友，沿弧线飞到他身边；阵亡时也能选',
    '修复潜墨时起跳会突然减速、跳不远的问题'
  ] },
  { v: 'v0.4.0', date: '2026-09-28', time: '15:52', title: '操作手感向原版靠拢', items: [
    '镜头改为居中，准星位于角色头顶上方',
    '修复两个准星上下错开的问题',
    '炸弹改为按住预览抛物线、松开投掷',
    '狙击蓄满后可以潜墨保留蓄力',
    '新增出生点防护罩；阵亡会损失一半必杀充能',
    '受击时屏幕边缘溅上墨水，血越少越多'
  ] },
  { v: 'v0.3.0', date: '2026-09-27', time: '23:58', title: '弹道与瞄准', items: [
    '步枪子弹改为近乎瞬间命中、末端下坠，射程更清楚',
    '狙击改为蓄多少都能发射',
    '新增双准星和"这一枪能打中"的提示',
    '墨水飞溅改为更真实的液体效果'
  ] },
  { v: 'v0.2.0', date: '2026-09-27', time: '20:14', title: '第二把武器', items: [
    '新增重炮狙击：蓄力、激光瞄准线、蓄满一枪击倒',
    '新增战前准备页面：选武器、看阵容、调难度和时长',
    '自动保存名字、武器和设置'
  ] },
  { v: 'v0.1.0', date: '2026-09-27', time: '18:23', title: '首个可玩版本', items: [
    '4 对 4 涂地对战：射击、潜墨、爬墙、炸弹、必杀技',
    '潮汐码头广场地图，完整的开局、对局、结算流程',
    '修复启动后一直停在加载画面的问题'
  ] }
];
const VERSION = RELEASES[0].v;
