/* ============================================================ CAMPAIGN · 闯关
   One stage (西关早茶) of three rounds played back to back; only round 1 is built so far.
   Round 1 · 霸铺头: on 西關大屋, 1:30.  Five buildings can be held - two shops on each side and 鎮海樓 in
   the middle.  Shooting a building pushes a tug-of-war between the two colours (by damage, from 15 m at most,
   bombs and blasts count): first wash the other colour back to the middle, then fill it with yours; full = held.
   A building just taken can't be pushed for 2 s, and a held one splashes ink at its door now and then.  Holding
   at least three when the time runs out clears the round.  The player's teammates help, at a little under
   full strength - the player should be the one doing it.                                                    */
const CAMPAIGN = {
  xiguan: {
    id: 'xiguan', no: 1, name: '西关早茶', en: 'XIGUAN MORNING TEA', map: 'canton',
    desc: '早上六点，西关街坊出门揾食。一关三轮，连着打。',
    rounds: [
      { no: 1, name: '霸铺头', nameT: '霸鋪頭', en: 'GRAB THE SHOPS', dur: 90, need: 3, goal: '1:30 内霸住至少 3 间铺头', sub: '时间到时还在手里的才算' },
      { no: 2, name: '制作中', locked: true },
      { no: 3, name: '制作中', locked: true }
    ]
  }
};
const ROUND_NO = ['', '第一轮', '第二轮', '第三轮'], ROUND_NO_T = ['', '第一輪', '第二輪', '第三輪'];     // (the opening film's captions are in traditional characters, like the map's signs)
const Camp = {
  on: false, stage: null, round: null, last: null,
  // into the campaign: its map, its match length (the player's own 4v4 settings are kept aside, not overwritten)
  enter(id) {
    const S = CAMPAIGN[id]; if (!S) return false;
    if (!this.on) { this.durWas = GAME.dur; this.mapWas = MAP_ID; }
    this.on = true; this.stage = S; this.round = S.rounds[0]; GAME.dur = this.round.dur;
    if (MAP_ID !== S.map) { const fade = mapFadeHold(); loadMap(S.map); renderMaps(); fade(); }
    return true;
  },
  // back to 4v4: the player's own match length and map come back
  exit() {
    if (!this.on) return; this.on = false;
    GAME.dur = this.durWas ?? GAME.dur;
    if (this.mapWas && MAP_ID !== this.mapWas && MAP_LIST[this.mapWas]) { const fade = mapFadeHold(); loadMap(this.mapWas); renderMaps(); fade(); }
    this.stage = this.round = null;
  },
  // the round is over: did we hold enough?
  finish() { const n = Shops.held(PLAYER.team); this.last = { round: this.round, held: n, need: this.round.need, pass: n >= this.round.need }; return this.last; },
  // ---------------------------------------------------------------- what the screens show
  goalCard() {
    const R = this.round;
    return `<div class="goalCard"><span class="gk">${ROUND_NO[R.no]} · 目标</span><b>${R.goal}</b><small>${R.sub}</small><div class="gshops">${Shops.defs().map(d => `<i class="${d.side === 0 ? 'm' : d.side === 1 ? 't' : 'c'}">${d.name}</i>`).join('')}</div></div>`;
  },
  pauseCard() {
    const P = $('pause'); P.classList.toggle('camp', this.on); if (!this.on) { $('pauseGoal').innerHTML = ''; return; }
    const R = this.round, n = PLAYER ? Shops.held(PLAYER.team) : 0;
    $('pauseGoal').innerHTML = `<div class="goalCard"><span class="gk">${this.stage.name} · ${ROUND_NO[R.no]} · ${R.name}</span><b>${R.goal}</b><small>${R.sub}</small><div class="gnow${n >= R.need ? ' ok' : ''}">现在霸住 <em>${n}</em> / ${R.need} 间</div></div>`;
  },
  // (placeholder until all three rounds exist: the result, and a note that the real results screen is still being designed)
  showResults() {
    G.state = 'results'; show('hud', false); show('campres', true); resetFov();
    if (document.pointerLockElement) document.exitPointerLock();
    const L = this.last || this.finish(), col = L.pass ? TEAM_HEX[PLAYER.team] : '#8f94a8';
    $('crHead').innerHTML = `<span>${this.stage.name}</span><b>${ROUND_NO[L.round.no]} · ${L.round.name}</b>`;
    $('crVerdict').innerHTML = `<svg viewBox="0 0 200 200"><path d="${blobPath(L.pass ? 3.1 : 5.3, 70)}" fill="${col}" stroke="#111" stroke-width="4"/></svg><span>${L.pass ? '过关！' : '未过关'}</span>`;
    $('crVerdict').className = 'crVerdict ' + (L.pass ? 'win' : 'lose');
    $('crLine').innerHTML = `霸住 <b>${L.held}</b> 间铺头 · 目标 ${L.need} 间`;
    Sfx.fanfare(L.pass); flash(L.pass ? 0.4 : 0.2);
  }
};
// the campaign select screen: the stages as cards, the first one with its three rounds in a row (played one after another)
function openCampSel() {
  resetToAttract(); G.campPick = 'xiguan';
  const S = CAMPAIGN.xiguan;
  const rounds = S.rounds.map((r, i) => `${i ? '<span class="csArr">›</span>' : ''}<span class="csRound${r.locked ? ' lock' : ''}"><small>${ROUND_NO[r.no]}</small><b>${r.name}</b>${r.dur ? `<em>${Math.floor(r.dur / 60)}:${String(r.dur % 60).padStart(2, '0')}</em>` : '<em>未开放</em>'}</span>`).join('');
  $('campCards').innerHTML = `<button class="cscard sel" data-id="xiguan"><span class="csNo">第一关</span><span class="mt">${MAP_THUMB[S.map] || ''}</span><span class="mn"><b>${S.name}</b><small>${S.en}</small><em>${S.desc}</em><span class="csRounds">${rounds}</span></span></button>`
    + [2, 3].map(n => `<div class="cscard lock"><span class="csNo">第${['', '一', '二', '三'][n]}关</span><span class="mn"><b>敬请期待</b><small>COMING SOON</small></span></div>`).join('');
  show('title', false); show('lobby', false); show('results', false); show('campres', false); show('mapsel', false); show('campsel', true);
}

/* ------------------------------------------------------------ the buildings */
const Shops = {
  RANGE: 15, CAP: 800, PROTECT: 2, MATE: 0.6, POUR: 4,
  WK: { charger: 1.6 },                                                     // (the cannon fires slowly: each of its hits counts for more)
  list: [], meshes: [],
  get on() { return Camp.on && this.list.length > 0; },
  // the five, worked out from the map's own blocks (heights included - the street is not at 0)
  defs() {
    const Y0 = groundAt(0, 10), find = (x0, x1, z0, z1) => SOLIDS.find(s => !s.bound && Math.abs(s.x0 - x0) < 0.01 && Math.abs(s.x1 - x1) < 0.01 && Math.abs(s.z0 - z0) < 0.01 && Math.abs(s.z1 - z1) < 0.01);
    const B = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 }), grow = (b, m) => B(b.x0 - m, b.x1 + m, b.y0 - m, b.y1 + m, b.z0 - m, b.z1 + m);
    const box = s => B(s.x0, s.x1, Math.max(s.y0 || 0, Y0), s.h, s.z0, s.z1);          // (a block standing on the street starts at the street)
    // a block's sides and roof, for the ink to show on
    const sides = (b, roof = true) => {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, cy = (b.y0 + b.y1) / 2, h = b.y1 - b.y0, w = b.x1 - b.x0, d = b.z1 - b.z0, o = 0.04;
      const f = [{ p: [b.x1 + o, cy, cz], w: d, h, ry: Math.PI / 2 }, { p: [b.x0 - o, cy, cz], w: d, h, ry: -Math.PI / 2 }, { p: [cx, cy, b.z1 + o], w, h, ry: 0 }, { p: [cx, cy, b.z0 - o], w, h, ry: Math.PI }];
      if (roof) f.push({ p: [cx, b.y1 + o, cz], w, h: d, roof: true });
      return f;
    };
    const shop = (id, name, side, b, faces, door, size = 1) => ({ id, name, side, boxes: [grow(b, 0.3)], faces, door, size });
    const house0 = find(-11, -5, 18, 25), house1 = find(5, 11, -25, -18), base = find(-2.5, 2.5, -2.5, 2.5), top = find(-1, 1, -1, 1);
    const hb0 = house0 ? box(house0) : B(-11, -5, Y0, Y0 + 2.4, 18, 25), hb1 = house1 ? box(house1) : B(5, 11, Y0, Y0 + 2.4, -25, -18);
    const tb = base ? box(base) : B(-2.5, 2.5, Y0, Y0 + 4, -2.5, 2.5), tt = top ? B(-1, 1, tb.y1, top.h, -1, 1) : B(-1, 1, tb.y1, tb.y1 + 4.2, -1, 1);
    const out = [
      shop('wuxi', '吳系茶餐廳', 0, hb0, sides(hb0), [-3.3, 21.5]),
      shop('yuanji', '源記腸粉', 0, B(25.3, 26.6, Y0, Y0 + 3.4, 16, 26), [{ p: [25.93, Y0 + 1.3, 21], w: 10, h: 2.6, ry: -Math.PI / 2 }], [23.2, 21]),
      { id: 'zhl', name: '鎮海樓', side: -1, boxes: [grow(tb, 0.3), grow(tt, 0.3)], faces: sides(tb).concat(sides(tt)), door: [[3.8, 0], [-3.8, 0], [0, 3.8], [0, -3.8]], size: 1.8 },
      shop('chentianji', '陳添記魚皮', 1, B(-26.6, -25.3, Y0, Y0 + 3.4, -26, -18), [{ p: [-25.93, Y0 + 1.3, -22], w: 8, h: 2.6, ry: Math.PI / 2 }], [-23.2, -22]),
      shop('gzjj', '廣州酒家', 1, hb1, sides(hb1), [3.3, -21.5])
    ];
    return out;
  },
  reset() {
    this.clear(); if (!Camp.on) return;
    this.list = this.defs().map(d => Object.assign(d, { v: 0, owner: -1, prot: 0, pourT: rand(0, this.POUR), hitT: [-9, -9], pHitT: -9, by: new Map(), caps: 0, shown: null }));
    for (const s of this.list) this.build(s);
    this.stats = { pHits: 0, botHits: [0, 0], caps: [0, 0], lost: [0, 0] };
    this.tickT = 0; this.buildHUD();
  },
  clear() { for (const m of this.meshes) { scene.remove(m); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } if (m.geometry) m.geometry.dispose(); } this.meshes = []; this.list = []; },
  // the ink on a building: one canvas per side, redrawn when the share changes; a set of splats in a fixed order, so it fills up, not flickers
  build(s) {
    let seed = s.id.length * 7 + s.name.charCodeAt(0); const rn = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    s.skins = s.faces.map(f => {
      const px = 22, cw = Math.max(16, Math.min(256, Math.round(f.w * px))), ch = Math.max(16, Math.min(256, Math.round(f.h * px)));
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.35, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), mat); m.position.set(f.p[0], f.p[1], f.p[2]);
      if (f.roof) m.rotation.x = -Math.PI / 2; else m.rotation.y = f.ry;
      m.renderOrder = 2; scene.add(m); this.meshes.push(m);
      const n = Math.max(10, Math.round(f.w * f.h * 1.1)), spl = [];
      for (let i = 0; i < n; i++) spl.push({ x: rn(), y: rn(), r: 0.16 + rn() * 0.12, k: rn() });
      return { cv, g: cv.getContext('2d'), tex, mat, spl, n };
    });
    this.paint(s);
  },
  // how far it has come, drawn: |v| of the splats in the leaning colour; held = the whole side in colour and glowing
  paint(s) {
    const lean = s.v > 0 ? 0 : 1, a = Math.abs(s.v), held = s.owner >= 0, key = (held ? 'h' + s.owner : lean) + ':' + Math.round(a * 30);
    if (s.shown === key) return; s.shown = key;
    const col = TEAM_HEX[held ? s.owner : lean];
    for (const k of s.skins) {
      const { g, cv, spl } = k, W = cv.width, H = cv.height; if (!g || !g.clearRect) { k.tex.needsUpdate = true; continue; }
      g.clearRect(0, 0, W, H); g.fillStyle = col;
      if (held) { g.globalAlpha = 0.42; g.fillRect(0, 0, W, H); }
      g.globalAlpha = 0.82;                                                   // (the shop front still shows through the ink)
      const n = held ? spl.length : Math.round(a * spl.length), R = Math.max(W, H);
      for (let i = 0; i < n; i++) { const p = spl[i], r = p.r * Math.min(R, Math.max(W, H) * 0.6) * 0.5 + 4; g.beginPath(); g.arc(p.x * W, p.y * H, r, 0, 7); g.fill(); g.beginPath(); g.arc(p.x * W + Math.cos(p.k * 6.28) * r * 1.2, p.y * H + Math.sin(p.k * 6.28) * r * 1.2, r * 0.32, 0, 7); g.fill(); }
      g.globalAlpha = 1; k.tex.needsUpdate = true; k.mat.emissive.set(col); k.mat.emissiveIntensity = held ? 0.45 : 0.08;
    }
  },
  // ---------------------------------------------------------------- being shot
  near(s, p) { let best = null, bd = 1e9; for (const b of s.boxes) { const q = new THREE.Vector3(clamp(p.x, b.x0, b.x1), clamp(p.y, b.y0, b.y1), clamp(p.z, b.z0, b.z1)), d = q.distanceTo(p); if (d < bd) { bd = d; best = q; } } return { q: best, d: bd }; },
  at(p) { for (const s of this.list) for (const b of s.boxes) if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1 && p.z >= b.z0 && p.z <= b.z1) return s; return null; },
  hit(owner, p, dmg, s = this.at(p)) {
    if (!this.on || !s || !owner || G.state !== 'play' || !(dmg > 0)) return false;
    if (owner.pos.distanceTo(p) > this.RANGE) return false;                    // too far off to count
    const T = G.time, tm = owner.team, sg = tm === 0 ? 1 : -1;
    if (s.owner >= 0 && s.owner !== tm && T < s.prot) return false;        // just taken: can't be pushed for a moment
    const k = dmg * (this.WK[owner.weapon.id] || 1) / (this.CAP * s.size) * (owner.isPlayer || tm !== PLAYER.team ? 1 : this.MATE);
    s.v = clamp(s.v + sg * k, -1, 1); s.hitT[tm] = T; s.by.set(owner, (s.by.get(owner) || 0) + k);
    if (owner.isPlayer) { s.pHitT = T; this.stats.pHits++; this.feel(s); } else if (owner.bot) this.stats.botHits[tm]++;
    if (s.owner >= 0 && s.owner !== tm && (s.owner === 0 ? s.v <= 0 : s.v >= 0)) this.lose(s);
    if (s.owner !== tm && s.v * sg >= 1 - 1e-9) this.take(s, tm);
    this.paint(s);
    return true;
  },
  // a blast (bomb, blaster shell): everything within reach of it
  blast(owner, p, R, dmg) {
    if (!this.on) return;
    for (const s of this.list) { const { q, d } = this.near(s, p); if (d < R) this.hit(owner, q, dmg * (1 - 0.5 * d / R), s); }
  },
  take(s, tm) {
    const T = G.time; s.owner = tm; s.v = tm === 0 ? 1 : -1; s.prot = T + this.PROTECT; s.caps++; this.stats.caps[tm]++; s.shown = null; s.pourT = 0.6;
    const col = TEAM_HEX[tm], mine = tm === PLAYER.team;
    for (const [x, z] of this.doors(s)) { const y = groundBelow(x, z, groundAt(0, 10) + 1.5, 1); splatFloor(x, y, z, 3.4, tm, 1.4); Fx.burst(x, y + 0.6, z, col, 46, 11, 0.2); Fx.ring(x, y + 0.06, z, col, 5.5); }
    if (mine) { Sfx.gong && Sfx.gong(true); this.banner(`霸住 <b>${s.name}</b>！`, tm); if (s.pHitT > T - 3) { Cam.punch = Math.max(Cam.punch || 0, 3); G.shake(0.15); } }
    else { Sfx.gong && Sfx.gong(false); this.banner(`<b>${s.name}</b> 被对面霸了！`, tm, true); }
  },
  lose(s) { const was = s.owner; s.owner = -1; s.shown = null; this.stats.lost[was]++; if (was === PLAYER.team) { this.banner(`<b>${s.name}</b> 被抢了！`, 1 - was, true); Sfx.beep(false); } },
  doors(s) { return Array.isArray(s.door[0]) ? s.door : [s.door]; },
  held(tm) { return this.list.filter(s => s.owner === tm).length; },
  // ---------------------------------------------------------------- every frame: held ones splash ink at the door; the HUD
  update(dt) {
    if (!this.on) return;
    if (G.state === 'play') for (const s of this.list) {
      if (s.owner < 0 || (s.pourT -= dt) > 0) continue; s.pourT = this.POUR;
      for (const [x, z] of this.doors(s)) { const y = groundBelow(x, z, groundAt(0, 10) + 1.5, 1); splatFloor(x + rand(-0.6, 0.6), y, z + rand(-0.6, 0.6), 2.6, s.owner, 1.2); Fx.burst(x, y + 0.3, z, TEAM_HEX[s.owner], 14, 5, 0.14); }
    }
    this.hud(dt);
  },
  // the player's own hits: a softer ✕ in the team colour and a dull knock (not the sound of hitting someone)
  feel(s) {
    const h = $('hitmark'); h.classList.remove('on', 'kill', 'shop'); void h.offsetWidth; h.style.setProperty('--hs', 0.8); h.classList.add('shop');
    const T = G.time; if (T - (this.knockT || -9) > 0.07) { this.knockT = T; Sfx.shopHit && Sfx.shopHit(); }
  },
  banner(html, tm, bad) {
    const el = $('shopBanner'); el.innerHTML = `<span class="${bad ? 'bad' : ''}" style="--bc:${TEAM_HEX[tm]}">${html}</span>`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.remove('on'), 2200);
  },
  // ---------------------------------------------------------------- HUD: the strip under the clock, the ring round the crosshair, markers
  buildHUD() {
    const ord = this.list.slice().sort((a, b) => (a.side === PLAYER.team ? 0 : a.side < 0 ? 1 : 2) - (b.side === PLAYER.team ? 0 : b.side < 0 ? 1 : 2));
    $('shopBar').innerHTML = `<div class="sbN" id="sbN"></div>` + ord.map(s => `<div class="sb" id="sb_${s.id}"><b>${s.name}</b><i><u></u></i></div>`).join('');
    $('shopMarks').innerHTML = this.list.map(s => `<div class="shm" id="shm_${s.id}"><div class="in"><b>!</b><small>${s.name}</small></div><i class="arr"></i></div>`).join('');
  },
  hud() {
    const T = G.time, me = PLAYER.team, need = Camp.round ? Camp.round.need : 3, n = this.held(me);
    const sn = $('sbN'); if (sn) { sn.innerHTML = `<b>${n}</b><small>/ ${need}</small>`; sn.classList.toggle('ok', n >= need); }
    for (const s of this.list) {
      const el = $('sb_' + s.id); if (!el) continue; const lean = s.v > 0 ? 0 : 1, col = TEAM_HEX[s.owner >= 0 ? s.owner : lean];
      el.style.setProperty('--sc', col); el.style.setProperty('--sf', (Math.abs(s.v) * 100).toFixed(1) + '%');
      el.classList.toggle('own0', s.owner === 0); el.classList.toggle('own1', s.owner === 1);
      const att = s.owner >= 0 ? T - s.hitT[1 - s.owner] < 1.2 && T >= s.prot : false; el.classList.toggle('att', att);
      el.classList.toggle('mine', s.owner === me);
    }
    // the ring: the building the player has been hitting, in the colour it leans to
    const last = this.list.reduce((a, s) => s.pHitT > (a ? a.pHitT : -9) ? s : a, null), ring = $('capRing');
    const on = !!last && T - last.pHitT < 1.5 && PLAYER.alive;
    ring.classList.toggle('on', on);
    if (on) { const a = Math.abs(last.v), col = TEAM_HEX[last.owner >= 0 ? last.owner : last.v > 0 ? 0 : 1]; const arc = $('capArc'); arc.style.strokeDashoffset = (339.3 * (1 - a)).toFixed(1); arc.style.stroke = col; ring.classList.toggle('full', last.owner >= 0); ring.classList.toggle('lock', T < last.prot); }
    // markers: one of ours under attack - on it, or on the screen edge pointing at it
    const W = innerWidth, H = innerHeight, m = 80;
    for (const s of this.list) {
      const el = $('shm_' + s.id); if (!el || !el.style) continue;
      const show = s.owner === me && T - s.hitT[1 - me] < 1.5 && T >= s.prot; el.classList.toggle('on', show); if (!show) continue;
      const b = s.boxes[s.boxes.length - 1], v = new THREE.Vector3((b.x0 + b.x1) / 2, b.y1 + 0.6, (b.z0 + b.z1) / 2).project(camera), behind = v.z > 1;
      let x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; if (behind) { x = W - x; y = H - y; }
      const edge = behind || x < m || x > W - m || y < m || y > H - m;
      if (edge) { const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy, k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m) / Math.max(1e-3, Math.abs(dy))); x = cx + dx * k; y = cy + dy * k; el.style.setProperty('--ar', Math.atan2(dy, dx) * 180 / Math.PI + 90 + 'deg'); }
      el.classList.toggle('edge', edge); el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  },
  // the minimap: each building in its colour (grey while nobody holds it), outlined yellow when one of ours is under attack
  drawMap(g, toM) {
    if (!this.on) return; const T = G.time;
    for (const s of this.list) {
      const b = s.boxes[0], [a, c] = toM(b.x0, b.z0), [e, d] = toM(b.x1, b.z1);
      g.fillStyle = s.owner >= 0 ? TEAM_HEX[s.owner] : '#9aa0b4'; g.fillRect(a, c, e - a, d - c);
      g.lineWidth = 2; g.strokeStyle = s.owner >= 0 && T - s.hitT[1 - s.owner] < 1.2 ? '#ffe45c' : '#fff'; g.strokeRect(a, c, e - a, d - c);
    }
  },
  // ---------------------------------------------------------------- what the bots ask
  // a building worth shooting from here: not ours already (or ours and being taken), in range and in sight - nearest first
  botTarget(bot) {
    if (!this.on) return null; const c = bot.c, e = c.eye(), tm = c.team; let best = null, bs = 1e9;
    for (const s of this.list) {
      const ours = tm === 0 ? s.v >= 0.999 : s.v <= -0.999; if (ours) continue;
      if (s.owner >= 0 && s.owner !== tm && G.time < s.prot) continue;
      const { q, d } = this.near(s, e); if (d > this.RANGE - 2) continue;
      const aim = q.clone(); aim.y = clamp(e.y + rand(-0.4, 0.4), s.boxes[0].y0 + 0.5, s.boxes[0].y1 - 0.3);
      const back = aim.clone().sub(e).normalize().multiplyScalar(0.45), chk = aim.clone().sub(back);
      if (segBlocked(e.x, e.y, e.z, chk.x, chk.y, chk.z, 0.4)) continue;
      const sc = d - (s.owner === tm ? 6 : 0) - (s.owner >= 0 && s.owner !== tm ? 2 : 0);        // ours being taken first, then theirs
      if (sc < bs) { bs = sc; best = { s, aim }; }
    }
    return best;
  },
  // where to go painting: near a building that still needs us
  bias(team, p) {
    if (!this.on || !p) return 0; let b = 0;
    for (const s of this.list) {
      const need = team === 0 ? 1 - s.v : 1 + s.v; if (need < 0.01) continue;
      const { d } = this.near(s, p); if (d < 12) b += (3 + (s.owner === team ? 2 : 0)) * (1 - d / 12) * Math.min(1, need);
    }
    return b;
  }
};
