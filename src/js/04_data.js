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

/* --------------------------------------------------------- releases
   Player-facing release notes (short, confirmed changes only).
   Newest first. VERSION shown on the title screen comes from here.   */
const RELEASES = [
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
