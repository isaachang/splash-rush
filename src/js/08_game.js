/* ================================================================ HUD */
const TIPS = ['潜进自己的墨水里，墨水和体力都会飞快恢复', '把墙涂成自己的颜色，潜墨朝墙走就能爬上去', '踩在敌方墨水里会减速掉血——先把脚下涂掉', '涂地可以给必杀技充能，满了按 Q', '炸弹会弹一下再爆炸，适合扔到掩体后面', '获胜看的是地面覆盖率，不是击倒数'];
const HUD = {
  mmT: 0, base: null, img: null, rgb: [[0, 0, 0], [0, 0, 0]], hurtV: 0, lowInkT: 0,
  init() {
    const mm = $('minimap'); this.ctx = mm.getContext('2d'); this.mw = mm.width; this.mh = mm.height;
    this.img = this.ctx.createImageData(this.mw, this.mh); this.base = new Uint8ClampedArray(this.mw * this.mh * 4);
    for (let y = 0; y < this.mh; y++) for (let x = 0; x < this.mw; x++) {
      const i = Math.floor(x / this.mw * NX), j = Math.floor(y / this.mh * NZ), h = Paint.hgt[j * NX + i];
      const v = 58 + h * 22, o = (y * this.mw + x) * 4; this.base[o] = v; this.base[o + 1] = v + 2; this.base[o + 2] = v + 12; this.base[o + 3] = 255;
    }
  },
  buildTeams() {
    ['teamA', 'teamB'].forEach((id, t) => {
      const el = $(id); el.innerHTML = '';
      CHARS.filter(c => c.team === t).forEach(c => { const d = document.createElement('div'); d.className = 'ticon' + (c.isPlayer ? ' me' : ''); d.style.background = TEAM_HEX[t]; d.innerHTML = '<div class="face"></div><div class="rs"></div><div class="wb">' + weaponIcon(c.weapon.id, '#fff', 30, TEAM_HEX[t]) + '</div>'; el.appendChild(d); c.icon = d; });
    });
    const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    this.rgb = [hx(TEAM_HEX[0]), hx(TEAM_HEX[1])];
    $('killfeed').innerHTML = '';
  },
  update(dt) {
    const c = PLAYER; if (!c) return;
    const L = Math.max(0, G.left), m = Math.floor(Math.ceil(L) / 60), s = Math.ceil(L) % 60;
    $('timer').textContent = m + ':' + String(s).padStart(2, '0');
    $('timer').classList.toggle('hurry', L <= 60 && G.state === 'play');
    $('inkfill').style.height = c.ink + '%';
    $('inkbar').classList.toggle('low', c.ink < 20);
    $('inkbar').style.opacity = c.ink > 99.5 && !c.swim ? 0.45 : 1;
    this.lowInkT = Math.max(0, this.lowInkT - dt); $('inkwarn').style.opacity = this.lowInkT > 0 ? 1 : 0;
    $('subw').classList.toggle('no', c.ink < SUBS[c.subId].cost / c.inkK);
    $('spRing').style.strokeDashoffset = 264 * (1 - c.special / 100);
    $('special').classList.toggle('ready', c.special >= 100);
    const hp = c.alive ? c.hp / c.maxHp * 100 : 100; this.hurtV = Math.max(0, this.hurtV - dt * 2);
    const vig = clamp((100 - hp) / 100 * 0.9 + this.hurtV * 0.4, 0, 0.95);
    const ec = TEAM_HEX[1 - c.team];
    $('vignette').style.opacity = 0;
    ScreenInk.update(dt, c.alive ? c.hp / c.maxHp * 100 : Cam.spec ? 100 : 0, c.alive && c.inEnemy && !c.invuln());     // watching a teammate: clear the ink off the screen
    const st = $('specTag'), sn = !c.alive && Cam.spec ? '正在观看：' + Cam.spec.name : '';
    if (st.textContent !== sn) { st.textContent = sn; st.classList.toggle('on', !!sn); }
    $('crosshair').classList.toggle('enemy', Cam.lock);
    const r2 = $('ret2');
    if (Cam.showLand && c.alive && c.state === 'play') {
      const v = Cam.land.clone().project(camera);
      if (v.z < 1) {
        const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
        const camD = camera.position.distanceTo(Cam.land), fpx = innerHeight / 2 / Math.tan(camera.fov * Math.PI / 360);
        const Wc = c.weapon, wr = Wc.retR ? Wc.retR : Wc.type === 'charge' ? 0.12 : Wc.spread * Cam.landDist + 0.12;
        const px = clamp(wr * fpx / Math.max(camD, 0.5), 7, 60);
        r2.style.display = 'block'; r2.style.transform = `translate(${x}px, ${y}px)`; r2.style.setProperty('--rs', px * 2 + 'px');
        r2.classList.toggle('lock', Cam.lock);
      } else r2.style.display = 'none';
    } else r2.style.display = 'none';
    const cr = $('chargeRing'), isC = !!c.weapon.charges;
    cr.classList.toggle('on', isC && c.alive); cr.classList.toggle('full', isC && c.charge >= 1);
    if (isC) $('chargeArc').style.strokeDashoffset = 251.3 * (1 - c.charge);
    cr.classList.toggle('stored', isC && c.stored > 0);
    $('crosshair').style.display = c.alive && c.state === 'play' ? 'block' : 'none';
    for (const ch of CHARS) if (ch.icon) {
      ch.icon.classList.toggle('dead', !ch.alive); ch.icon.classList.toggle('special', ch.alive && ch.special >= 100);
      ch.icon.querySelector('.rs').textContent = !ch.alive ? Math.ceil(ch.respawnT) : '';
    }
    if (!c.alive) { $('deathCd').textContent = Math.max(1, Math.ceil(c.respawnT)); }
    this.mmT -= dt; if (this.mmT <= 0) { this.mmT = 0.2; this.drawMap(); }
    // hold Tab: live scoreboard
    const tabOn = !!Input.keys.Tab && (G.state === 'play' || G.state === 'intro') && !G.paused;
    $('scoreTab').classList.toggle('show', tabOn);
    if (tabOn) { this.tabT = (this.tabT || 0) - dt; if (this.tabT <= 0) { this.tabT = 0.25; this.renderTab(); } } else this.tabT = 0;
  },
  renderTab() {
    const mine = PLAYER.team;
    [0, 1].forEach(t => {
      const list = CHARS.filter(c => c.team === t).sort((a, b) => b.paint - a.paint), K = list.reduce((a, c) => a + c.kills, 0);
      const row = c => {
        const ready = c.special >= 100, sp = ready ? '<b>就绪</b>' : t === mine ? Math.floor(c.special) + '%' : '—';     // enemies: only "ready", like the top icons
        return `<div class="st-r${c.isPlayer ? ' me' : ''}${c.alive ? '' : ' dead'}"><span class="w">${weaponIcon(c.weapon.id, '#fff', 34, TEAM_HEX[t])}</span><span class="n">${charIcon(c.cs.id, 24, TEAM_HEX[t])}${c.name}${c.isPlayer ? '<i>你</i>' : ''}${c.alive ? '' : '<em>' + Math.max(1, Math.ceil(c.respawnT)) + '</em>'}</span><span>${c.kills}</span><span>${c.assists}</span><span>${c.deaths}</span><span>${Math.round(c.paint)}p</span><span class="sp${ready ? ' on' : ''}">${sp}</span></div>`;
      };
      $(t ? 'stB' : 'stA').innerHTML = `<div class="st-th" style="--tc:${TEAM_HEX[t]}"><b>${t === mine ? '我方' : '对手'}</b><span>共击倒 ${K}</span></div>` + list.map(row).join('');
    });
    $('stTime').textContent = '剩余 ' + $('timer').textContent;
  },
  drawMap() {
    const D = this.img.data, B = this.base, O = Paint.owner, W = this.mw, H = this.mh, R = this.rgb;
    for (let y = 0; y < H; y++) {
      const j = Math.floor(y / H * NZ);
      for (let x = 0; x < W; x++) {
        const i = Math.floor(x / W * NX), o = (y * W + x) * 4, t = O[j * NX + i];
        if (t >= 0) { const c = R[t]; D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; } else { D[o] = B[o]; D[o + 1] = B[o + 1]; D[o + 2] = B[o + 2]; }
        D[o + 3] = 255;
      }
    }
    const g = this.ctx; g.putImageData(this.img, 0, 0);
    const toM = (x, z) => [(x + XH) / (2 * XH) * W, (z + ZH) / (2 * ZH) * H];
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1;
    for (const s of SOLIDS) { if (s.bound) continue; const [a, b] = toM(s.x0, s.z0), [c2, d] = toM(s.x1, s.z1); g.strokeRect(a, b, c2 - a, d - b); }
    HUD.mapAllies = [];
    for (const ch of CHARS) {
      if (!ch.alive || ch.team !== PLAYER.team || ch.state === 'dead') continue; const [x, y] = toM(ch.pos.x, ch.pos.z);
      if (!ch.isPlayer) HUD.mapAllies.push({ c: ch, x, y });
      if (ch.isPlayer) {
        g.save(); g.translate(x, y); g.rotate(-Cam.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.stroke(); g.fill(); g.restore();
      } else {
        const sel = PLAYER.jumpTarget === ch, big = G.mapOpen, rr = big ? 5.5 : 3.5;
        g.fillStyle = TEAM_HEX[ch.team]; g.strokeStyle = sel ? '#ffe45c' : '#fff'; g.lineWidth = sel ? 3 : 2; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.stroke();
        if (big) { g.font = '900 8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111'; g.fillText(String(HUD.mapAllies.length), x, y + 0.5); }
      }
    }
  },
  mapAllies: [],
  // choose a teammate (index in map order) to super jump to
  pickAlly(i) {
    const a = this.mapAllies[i]; if (!a || !PLAYER) return;
    if (PLAYER.alive && PLAYER.state === 'play') { if (PLAYER.startSuperJump(a.c)) { toggleMap(false); HUD.center('超级跳！', '→ ' + a.c.name, 900); } else this.tip('现在无法超级跳'); }
    else { PLAYER.jumpTarget = a.c; this.tip('复活后将跳到 ' + a.c.name + ' 身边'); $('deathTip').textContent = '复活后将超级跳到 ' + a.c.name + ' 身边'; this.mmT = 0; }
  },
  mapClick(e) {
    if (!G.mapOpen) return;
    const cv = $('minimap'), r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * cv.width, y = (e.clientY - r.top) / r.height * cv.height;
    let best = -1, bd = 14;
    this.mapAllies.forEach((a, i) => { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) this.pickAlly(best);
  },
  hurt(amount = 25, src = null) { this.hurtV = 1; ScreenInk.hit(amount, src); },
  tip(t) { const el = $('tip'); el.textContent = t; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 1100); },
  hitmark(kill, dmg = 36) {
    const h = $('hitmark'); h.classList.remove('on', 'kill'); void h.offsetWidth;
    h.style.setProperty('--hs', kill ? 1.6 : clamp(0.85 + dmg / 90, 0.9, 1.6)); h.classList.add(kill ? 'kill' : 'on');
  },
  lowInk() { if (this.lowInkT <= 0) Sfx.beep(false); this.lowInkT = 0.8; },
  killfeed(k, v, via) {
    const el = document.createElement('div'); el.className = 'kf';
    const nm = c => `<span style="color:${TEAM_HEX[c.team]};-webkit-text-stroke:.5px #000">${c.name}</span>`;
    el.innerHTML = (k ? nm(k) : '???') + (via ? weaponIcon(via, '#fff', 34, TEAM_HEX[k ? k.team : 1 - v.team]) : '') + '<span class="x">✕</span>' + nm(v);
    const f = $('killfeed'); f.prepend(el); while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => el.remove(), 4500);
  },
  died(k, via) {
    ScreenInk.death();
    const vn = via && (WEAPONS[via] || SUBS[via] || SPECIALS[via]);
    $('death').classList.add('show'); $('deathBy').innerHTML = k ? `被 <span style="color:${TEAM_HEX[k.team]}">${k.name}</span> ${vn ? '用「' + vn.name + '」' : ''}击倒了！` : '你被击倒了！';
    $('deathTip').textContent = '按 M 打开地图，点击队友可在复活时直接超级跳过去';
  },
  respawned() { $('death').classList.remove('show'); ScreenInk.clear(); if (G.mapOpen) toggleMap(false); },
  center(msg, sub, ms) {
    const el = $('center'); el.innerHTML = `<span class="msg pop">${msg}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`;
    clearTimeout(this._ct); if (ms) this._ct = setTimeout(() => el.innerHTML = '', ms);
  }
};

/* ========================================================== SCREEN INK
   Damage feedback like the original: the screen edges get splattered with
   the attacker's ink.  Wet look (rim + gloss + drips), appears instantly on
   the side you were hit from, stays while you're hurt and fades as you heal. */
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
// draws one wet ink splat into its own canvas (static part); returns {cv, size}
function makeSplat(r, col, seed) {
  const rnd = (k) => hash(seed * 13.7 + k * 7.31);
  const S = Math.ceil(r * 4.2), c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cx = S / 2, cy = S / 2;
  const lobes = [], nl = 5 + Math.floor(rnd(1) * 4);
  for (let f = 0; f < nl; f++) lobes.push({ a: rnd(10 + f) * Math.PI * 2, amp: r * (0.14 + rnd(20 + f) * 0.4), w: 0.22 + rnd(30 + f) * 0.2 });
  const drops = [];
  lobes.forEach((l, f) => { if (l.amp > r * 0.3) { const d = r + l.amp + r * (0.12 + rnd(70 + f) * 0.15); drops.push([Math.cos(l.a) * d, Math.sin(l.a) * d, r * (0.07 + rnd(80 + f) * 0.07)]); } });
  for (let k = 0; k < 5; k++) { const a = rnd(40 + k) * Math.PI * 2, d = r * (1.2 + rnd(50 + k) * 0.5); drops.push([Math.cos(a) * d, Math.sin(a) * d, r * (0.03 + rnd(60 + k) * 0.05)]); }
  const shape = () => {
    g.beginPath(); const n = 96;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      let rr = r * (1 + 0.08 * Math.sin(3 * a + rnd(2) * 6) + 0.05 * Math.sin(5 * a + rnd(3) * 6));
      for (const l of lobes) { const d = angDiff(a, l.a) / l.w; rr += l.amp * Math.exp(-d * d * 2.5); }
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    for (const [dx, dy, rr] of drops) { g.moveTo(cx + dx + rr, cy + dy); g.arc(cx + dx, cy + dy, rr, 0, Math.PI * 2); }
  };
  // rim
  shape(); g.lineJoin = 'round'; g.lineWidth = Math.max(2, r * 0.05); g.strokeStyle = shadeHex(col, 0.5); g.stroke();
  // body with depth gradient
  shape(); const gr = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 1.5);
  gr.addColorStop(0, shadeHex(col, 1.18)); gr.addColorStop(0.6, col); gr.addColorStop(1, shadeHex(col, 0.72)); g.fillStyle = gr; g.fill();
  // gloss highlights
  g.save(); g.globalAlpha = 0.38; g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(cx - r * 0.32, cy - r * 0.38, r * 0.34, r * 0.13, -0.5, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.7; g.beginPath(); g.arc(cx + r * 0.15, cy - r * 0.52, r * 0.06, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.25; g.beginPath(); g.ellipse(cx + r * 0.3, cy + r * 0.35, r * 0.25, r * 0.08, 0.6, 0, Math.PI * 2); g.fill();
  g.restore();
  return { cv: c, size: S };
}
const ScreenInk = {
  splats: [], frame: [], col: '#3346ff', deathT: 0, canvas: null, ctx: null, scale: 0.75,
  init() { this.canvas = $('inkCanvas'); this.ctx = this.canvas.getContext('2d'); this.resize(); addEventListener('resize', () => this.resize()); },
  resize() { if (!this.canvas) return; this.canvas.width = Math.round(innerWidth * this.scale); this.canvas.height = Math.round(innerHeight * this.scale); },
  reset(col) {
    this.col = col; this.splats = []; this.deathT = 0; this.sticky = 0;
    this.bottom = []; for (let i = 0; i < 10; i++) this.bottom.push({ t: (i + 0.5) / 10 + rand(-0.03, 0.03), r: rand(40, 72), seed: rand(0, 999), img: null });
    // blobs that form the "ink frame" around the screen at low health
    this.frame = [];
    for (let i = 0; i < 22; i++) {
      const side = i % 4, t = (Math.floor(i / 4) + 0.5) / 6 + rand(-0.06, 0.06);
      this.frame.push({ side, t, r: rand(38, 70), seed: rand(0, 999), img: null });
    }
  },
  clear() { this.splats = []; this.deathT = 0; },
  hit(amount, src) {
    const P = PLAYER; if (!P) return;
    // which side of the screen: direction of the attacker relative to the camera
    let side = pick([0, 1, 2]);
    if (src && src.pos) {
      const rel = angDiff(Cam.yaw, Math.atan2(src.pos.x - P.pos.x, src.pos.z - P.pos.z));
      side = Math.abs(rel) < Math.PI / 4 ? 2 : Math.abs(rel) > Math.PI * 0.75 ? 3 : rel < 0 ? 1 : 0;   // 0 left 1 right 2 top 3 bottom
    }
    const n = amount >= 90 ? 3 : amount >= 30 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const W = this.canvas.width, H = this.canvas.height, m = Math.min(W, H);
      const r = m * rand(0.07, 0.11) * (0.8 + Math.min(amount, 100) / 160), along = rand(0.12, 0.88);
      const x = side === 0 ? rand(0.03, 0.12) * W : side === 1 ? W - rand(0.03, 0.12) * W : along * W;
      const y = side === 2 ? rand(0.04, 0.14) * H : side === 3 ? H - rand(0.04, 0.12) * H : along * H;
      const sp = makeSplat(r, this.col, Math.random() * 999);
      const drips = []; const nd = randi(1, 3);
      for (let k = 0; k < nd; k++) drips.push({ dx: rand(-0.4, 0.4) * r, w: r * rand(0.12, 0.2), max: r * rand(0.6, 1.6), len: 0, delay: rand(0.15, 0.5) });
      this.splats.push({ x, y, r, rot: rand(0, Math.PI * 2), sp, drips, age: 0 });
    }
    while (this.splats.length > 14) this.splats.shift();
    G.shake(0.12 + Math.min(amount, 100) / 100 * 0.35);
  },
  death() {
    // the whole screen gets drenched for a moment
    const W = this.canvas.width, H = this.canvas.height, m = Math.min(W, H);
    for (let i = 0; i < 9; i++) {
      const r = m * rand(0.22, 0.34), sp = makeSplat(r, this.col, Math.random() * 999);
      this.splats.push({ x: rand(0.1, 0.9) * W, y: rand(0.1, 0.9) * H, r, rot: rand(0, 6.28), sp, drips: [{ dx: 0, w: r * 0.12, max: r * 1.6, len: 0, delay: 0.1 }], age: 0, death: true });
    }
    this.deathT = 1.6;
  },
  update(dt, hp, stuck = false) {
    const g = this.ctx; if (!g) return;
    const W = this.canvas.width, H = this.canvas.height;
    g.clearRect(0, 0, W, H);
    // standing in enemy ink: goo creeps up from the bottom of the screen
    this.sticky = damp(this.sticky || 0, stuck ? 1 : 0, stuck ? 3 : 2.5, dt);
    if (this.sticky > 0.02 && this.bottom) {
      const m = Math.min(W, H), sk = this.sticky;
      const gr = g.createLinearGradient(0, H, 0, H * 0.78); gr.addColorStop(0, shadeHex(this.col, 0.8)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = sk * 0.55; g.fillStyle = gr; g.fillRect(0, H * 0.78, W, H * 0.22);
      for (const b of this.bottom) {
        if (!b.img) b.img = makeSplat(b.r * m / 800, this.col, b.seed);
        const y = H + b.img.size * 0.5 * (0.62 - sk * 0.42) + Math.sin(G.time * 2 + b.seed) * 3;
        g.globalAlpha = sk * 0.85; g.drawImage(b.img.cv, b.t * W - b.img.size / 2, y - b.img.size / 2);
      }
    }
    const L = clamp((100 - hp) / 100, 0, 1);            // how hurt we are
    if (hp >= 99.5 && this.deathT <= 0) this.splats = this.splats.filter(s => s.death);
    this.deathT = Math.max(0, this.deathT - dt);
    // low-health ink frame (replaces the old coloured vignette)
    const fa = clamp((L - 0.3) / 0.45, 0, 1);
    if (fa > 0 && this.frame.length) {
      const m = Math.min(W, H);
      for (const f of this.frame) {
        if (!f.img) f.img = makeSplat(f.r * m / 800, this.col, f.seed);
        const inset = (fa * 0.42 - 0.5) * f.img.size * 0.5;
        const x = f.side === 0 ? inset : f.side === 1 ? W - inset : f.t * W, y = f.side === 2 ? inset : f.side === 3 ? H - inset : f.t * H;
        g.globalAlpha = fa * 0.8; g.drawImage(f.img.cv, x - f.img.size / 2, y - f.img.size / 2);
      }
    }
    // hit splats
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i]; s.age += dt;
      let a;
      if (s.death) { a = clamp(this.deathT / 0.8, 0, 1) * 0.97; if (this.deathT <= 0) { this.splats.splice(i, 1); continue; } }
      else a = clamp(0.3 + L * 1.1, 0, 0.85) * clamp(1.4 - s.age * 0.04, 0.55, 1);
      const pop = s.age < 0.08 ? 1.12 - s.age * 1.5 : 1;          // instant splat with a tiny "burst"
      g.save(); g.globalAlpha = a; g.translate(s.x, s.y);
      g.save(); g.rotate(s.rot); g.scale(pop, pop);
      g.drawImage(s.sp.cv, -s.sp.size / 2, -s.sp.size / 2);
      g.restore();
      // drips run downward out of the bottom of the splat (screen space)
      for (const d of s.drips) {
        if (s.age < d.delay) continue;
        d.len = d.max * (1 - Math.exp(-(s.age - d.delay) * 0.9));
        const x0 = d.dx, y0 = s.r * 0.72, y1 = y0 + d.len;
        const lg = g.createLinearGradient(x0 - d.w, 0, x0 + d.w, 0); lg.addColorStop(0, shadeHex(this.col, 0.6)); lg.addColorStop(0.35, shadeHex(this.col, 1.12)); lg.addColorStop(1, shadeHex(this.col, 0.7));
        g.fillStyle = lg; g.beginPath(); g.moveTo(x0 - d.w / 2, y0 - d.w); g.lineTo(x0 + d.w / 2, y0 - d.w); g.lineTo(x0 + d.w * 0.4, y1); g.arc(x0, y1, d.w * 0.6, 0, Math.PI); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(x0 - d.w * 0.15, y1 - d.w * 0.05, d.w * 0.13, d.w * 0.2, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }
};

/* ============================================================== GAME */
const G = { mapOpen: false, roster: null, state: 'boot', time: 0, left: 180, shakeAmt: 0, paused: false, introT: 0, endT: 0, bots: [], titleT: 0, flags: {}, shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); } };
function show(id, on) { $(id).classList.toggle('show', on); if (id === 'lobby') G.lobbyOpen = on; }
function flash(a = 0.8) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
function applyPalette() {
  const p = PALETTES[GAME.pal]; TEAM_HEX[0] = p[0]; TEAM_HEX[1] = p[1];
  setTeamColors(p[0], p[1]); setTeamMats(p[0], p[1]);
}
function clearChars() {
  CHARS.forEach(c => { scene.remove(c.root); scene.remove(c.ghost); if (c.laser) scene.remove(c.laser, c.laserDot); if (c.sjMarker) scene.remove(c.sjMarker); }); CHARS.length = 0; G.bots = []; PLAYER = null;
}
// roster = who plays with what; rolled when entering the lobby so it can be shown before the match
function rollRoster() {
  const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  const roles = ['front', 'mid', 'home', 'front'];
  const R = [[], []];
  for (let t = 0; t < 2; t++) {
    const slots = t === 0 ? [0, 2, 3] : [0, 1, 2, 3];
    for (let i = 0; i < 4; i++) {
      const isP = t === 0 && i === 1;
      R[t].push({ name: isP ? (GAME.name || '玩家') : names.pop(), isPlayer: isP, ...(() => { if (isP) { const pc = CHARACTERS[Profile.data.char] || CHARACTERS.sa; if (!pc.weapons.includes(Profile.data.weapon)) Profile.data.weapon = pc.weapons[0]; return { weapon: Profile.data.weapon, char: Profile.data.char }; } const ch = GAME.uniformChars ? Profile.data.char : pick(CHAR_ORDER); return { char: ch, weapon: GAME.uniformChars ? pick(['rifle', 'rifle', 'charger', 'splatling']) : pick(CHARACTERS[ch].weapons) }; })(), look: isP ? Profile.data.look : randomLook(), role: roles[(i + t) % 4] });
    }
  }
  G.roster = R; enforceRoster();
}
function enforceRoster() {
  // at most one charger per team (the player's own pick takes priority)
  const me = G.roster[0][1]; me.weapon = Profile.data.weapon; me.char = Profile.data.char; me.name = GAME.name || '玩家';
  // at most one sniper and one gatling per team; extra ones swap to 阿飒 + rifle
  for (const w of ['charger', 'splatling']) G.roster.forEach(team => { let seen = team.some(m => m.isPlayer && m.weapon === w); team.forEach(m => { if (m.isPlayer) return; if (m.weapon === w) { if (seen) { m.weapon = 'rifle'; if (!CHARACTERS[m.char].weapons.includes('rifle')) m.char = 'sa'; } seen = true; } }); });
}
function spawnTeams() {
  clearChars();
  if (!G.roster) rollRoster();
  const offs = [-4.5, -1.5, 1.5, 4.5];
  for (let t = 0; t < 2; t++) G.roster[t].forEach((m, i) => {
    const c = new Character(m.name, t, m.isPlayer, { weapon: m.weapon, look: m.look, char: m.char });
    const sp = SPAWN[t]; c.pos.set(sp.x + offs[i] * (t ? -1 : 1), sp.y, sp.z + (t ? -1 : 1) * (i % 2 ? 0.8 : -0.4)); c.aimYaw = c.yaw = c.bodyYaw = sp.yaw;
    CHARS.push(c); if (m.isPlayer) PLAYER = c; else G.bots.push(new Bot(c, m.role));
  });
}
function resetFov() { Cam.zoom = 1; camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); }
function startMatch() {
  Sfx.init(); Sfx.stopMusic(); Sfx.duck(false);
  applyPalette(); resetPaint(); Fx.clear(); Proj.clear();
  spawnTeams(); HUD.buildTeams(); ScreenInk.reset(TEAM_HEX[1]);
  try { renderer.compile(scene, camera); } catch (e) { }
  G.left = GAME.dur; G.time = 0; G.state = 'intro'; G.introT = 0; G.paused = false; G.flags = {}; resetFov();
  const W = PLAYER.weapon; $('weapTag').innerHTML = weaponIcon(W.id, '#fff', 48, TEAM_HEX[0]) + W.name;
  $('subw').innerHTML = '<i></i>' + SUBS[PLAYER.subId].short;
  Cam.yaw = SPAWN[0].yaw; Cam.pitch = -0.08; Cam.pivotY = SPAWN[0].y + 1.5;
  show('title', false); show('lobby', false); show('results', false); show('pause', false); show('hud', true);
  $('death').classList.remove('show'); $('center').innerHTML = '';
  $('hint').style.display = 'block';
  lockPointer();
}
function pauseGame() { if (G.state !== 'play' && G.state !== 'intro') return; G.paused = true; show('pause', true); Input.keys = {}; Sfx.duck(true); }
function resumeGame() { G.paused = false; show('pause', false); clock.getDelta(); lockPointer(); Sfx.duck(false); }
function quitToTitle() {
  if (G.mapOpen) { G.mapOpen = false; $('minimap').classList.remove('big'); $('mapHint').classList.remove('show'); }
  G.paused = false; show('pause', false); show('hud', false); show('results', false); Sfx.duck(false);
  if (document.pointerLockElement) document.exitPointerLock();
  gotoTitle();
}
function endMatch() {
  G.state = 'end'; G.endT = 0; Sfx.whistle(); Sfx.stopMusic(); flash(0.6);
  HUD.center('比赛结束！', '', 0);
  CHARS.forEach(c => { c.intent.fire = false; c.intent.swim = false; c.intent.mx = c.intent.mz = 0; });
  if (Proj.pv) Proj.preview(null); Cam.bombAim = false; if (G.mapOpen) toggleMap(false);
}
// medals, like the original's awards: gold = best in the match, silver = best on your team
const MEDALS = [
  { t: '涂地最多', v: c => c.paint, ok: c => c.paint > 0 },
  { t: '击倒最多', v: c => c.kills, ok: c => c.kills > 0 },
  { t: '助攻最多', v: c => c.assists, ok: c => c.assists > 0 },
  { t: '必杀技最多', v: c => c.specials, ok: c => c.specials > 0 },
  { t: '最少阵亡', v: c => -c.deaths, ok: c => c.deaths <= 2 },
  { t: '超级跳最多', v: c => c.sjumps, ok: c => c.sjumps > 0 }
];
// the other side of the awards: a cheeky "roast" badge when things went badly
const ROASTS = [
  { t: '送分快递', ok: c => c.deaths >= 4 && c.deaths >= Math.max(...CHARS.map(o => o.deaths)), say: ['对面的击倒数，有一半是你送的快递。', '倒下的次数比开枪的次数还让人印象深刻。', '复活点都快认识你了。'] },
  { t: '和平主义者', ok: c => c.kills === 0 && c.assists === 0, say: ['一个人都没打倒，你是来劝架的吗？', '对面应该给你颁一个「最友善对手」奖。', '枪是拿来涂地的没错，但偶尔也可以对准人。'] },
  { t: '路过的游客', ok: c => c.paint <= Math.min(...CHARS.map(o => o.paint)) + 0.5, say: ['这片广场好像跟你没什么关系。', '你涂的地，裁判拿放大镜才找到。', '来都来了，好歹多涂两下再走嘛。'] },
  { t: '必杀收藏家', ok: c => c.specials === 0 && c.special >= 100, say: ['必杀技攒满了一局，舍不得按 Q？', 'Q 键：我一直在等你。'] }
];
const PRAISE = {
  '涂地最多': ['整片广场都是你的颜色，裁判都看呆了！', '你一个人涂的地，够对面四个人加起来了。'],
  '击倒最多': ['对面听到你的脚步声就想跑。', '全场最危险的人，就是你。'],
  '助攻最多': ['没有你，队友的击倒至少少一半。', '最默契的队友，说的就是你。'],
  '必杀技最多': ['Q 键都快被你按坏了！', '必杀技一个接一个，对面根本喘不过气。'],
  '最少阵亡': ['全场最难打倒的人，就是你。', '稳！对面想打倒你都找不到机会。'],
  '超级跳最多': ['哪里需要你，你就出现在哪里。', '空中飞人，全场到处都是你的身影。']
};
function roastsFor(c) { return ROASTS.filter(R => R.ok(c)).slice(0, 2); }
// one line for the player: praise if you earned a medal, a cheeky roast if the match went badly
function verdictLine(c) {
  const md = medalsFor(c), rs = roastsFor(c), g = md.find(m => m.gold);
  if (g) return { good: true, text: pick(PRAISE[g.t]) };
  if (rs.length) return { good: false, text: pick(rs[0].say) };
  if (md.length) return { good: true, text: pick(PRAISE[md[0].t]) };
  return { good: true, text: '中规中矩，下一局争取拿块奖牌！' };
}
function medalsFor(c) {
  const out = [];
  for (const M of MEDALS) {
    if (!M.ok(c)) continue; const v = M.v(c);
    if (v >= Math.max(...CHARS.map(M.v))) out.push({ t: M.t, gold: true });
    else if (v >= Math.max(...CHARS.filter(o => o.team === c.team).map(M.v))) out.push({ t: M.t, gold: false });
  }
  return out.sort((a, b) => b.gold - a.gold).slice(0, 3);
}
// results, following the original's flow: top-down judging → meter tug-of-war → WIN!/LOSE… → scoreboard (winners first) → your medals
function showResults() {
  G.state = 'results'; show('hud', false); show('results', true); resetFov();
  if (document.pointerLockElement) document.exitPointerLock();
  const rid = G.rid = (G.rid || 0) + 1, later = (ms, fn) => setTimeout(() => { if (G.rid === rid && G.state === 'results') fn(); }, ms);
  const p0 = Paint.teamCells[0] / Paint.total * 100, p1 = Paint.teamCells[1] / Paint.total * 100, win = p0 >= p1;
  const R = $('results'), A = $('barA'), B = $('barB'), V = $('verdict'), bd = $('board'), aw = $('awards'), rb = $('resBtns');
  R.className = 'screen show judging';
  A.style.transition = B.style.transition = 'none'; A.style.width = B.style.width = '0%'; A.style.background = TEAM_HEX[0]; B.style.background = TEAM_HEX[1];
  $('pctA').textContent = $('pctB').textContent = ''; V.className = ''; V.innerHTML = ''; bd.innerHTML = ''; aw.innerHTML = '';
  bd.classList.remove('show'); aw.classList.remove('show'); rb.classList.remove('show');
  $('judge').textContent = '裁判判定中…';
  const sum = Math.max(p0 + p1, 1e-6), fa = p0 / sum * 100, fb = 100 - fa;
  // tug of war: both colours creep in from the ends, see-saw in the middle, then snap to the real split
  const steps = [[500, 20, 20], [1150, 36, 33], [1650, 40, 44], [2150, 46, 42], [2750, fa, fb]];
  steps.forEach(([t, a, b], i) => later(t, () => {
    const last = i === steps.length - 1;
    A.style.transition = B.style.transition = last ? 'width .8s cubic-bezier(.2,.9,.3,1.15)' : 'width .45s ease-in-out';
    A.style.width = a + '%'; B.style.width = b + '%'; Sfx.beep(last);
  }));
  later(3450, () => { $('pctA').textContent = p0.toFixed(1) + '%'; $('pctB').textContent = p1.toFixed(1) + '%'; R.classList.add('revealed', win ? 'winA' : 'winB'); });
  later(3900, () => {
    const col = win ? TEAM_HEX[0] : '#8f94a8';
    V.style.setProperty('--vc', col);
    V.innerHTML = `<svg class="vsplash" viewBox="0 0 200 200"><path d="${blobPath(win ? 2.2 : 5.3, 70)}" fill="${col}" stroke="#111" stroke-width="4"/></svg><span class="vt">${win ? 'WIN!' : 'LOSE…'}</span>`;
    V.classList.add('show', win ? 'win' : 'lose');
    $('judge').textContent = win ? '你的队伍赢下了这片广场！' : '对手的颜色更胜一筹……';
    Sfx.fanfare(win); flash(win ? 0.45 : 0.2);
  });
  later(5800, () => {
    R.classList.add('boarded');
    const team = t => {
      const won = (t === 0) === win, rows = CHARS.filter(c => c.team === t).sort((a, b) => b.paint - a.paint).map((c, i) => {
        const md = medalsFor(c).map(m => `<b class="${m.gold ? 'g' : 's'}" title="${m.t}（${m.gold ? '全场第一' : '队内第一'}）"></b>`).join('') + roastsFor(c).map(r => `<b class="x" title="${r.t}"></b>`).join('');
        return `<div class="r${c.isPlayer ? ' me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${charIcon(c.cs.id, 26, TEAM_HEX[t])}${weaponIcon(c.weapon.id, '#fff', 34, TEAM_HEX[t])}${c.name}${c.isPlayer ? '<i>你</i>' : ''}</span><span>${Math.round(c.paint)}p</span><span>${c.kills}<small>${c.assists ? ' +' + c.assists : ''}</small></span><span>${c.deaths}</span><span>${c.specials}</span><span class="md">${md}</span></div>`;
      }).join('');
      return `<div class="tbl ${won ? 'won' : 'lost'}" style="--tc:${TEAM_HEX[t]}"><div class="th"><b>${won ? 'WIN!' : 'LOSE…'}</b><span>${t === 0 ? '我方' : '对手'}</span><em>${(t ? p1 : p0).toFixed(1)}%</em></div><div class="r h"><span></span><span>名字</span><span>涂地</span><span>击倒 +助攻</span><span>阵亡</span><span>必杀</span><span>奖牌</span></div>${rows}</div>`;
    };
    bd.innerHTML = win ? team(0) + team(1) : team(1) + team(0);
    bd.classList.add('show');
  });
  later(6600, () => {
    const me = medalsFor(PLAYER), rs = roastsFor(PLAYER), line = verdictLine(PLAYER);
    const chips = me.map(m => `<div class="mdl ${m.gold ? 'g' : 's'}"><b></b><div><span>${m.t}</span><small>${m.gold ? '全场第一' : '队内第一'}</small></div></div>`).concat(rs.map(r => `<div class="mdl x"><b></b><div><span>${r.t}</span><small>吐槽奖</small></div></div>`));
    aw.innerHTML = `<div class="awrow"><h4>你的表现</h4>${chips.length ? chips.join('') : '<div class="mdl none"><span>这局没有拿到奖牌</span></div>'}</div><div class="quip ${line.good ? 'good' : 'bad'}">${line.text}</div>`;
    aw.querySelectorAll('.mdl').forEach((el, i) => el.style.animationDelay = i * 0.12 + 's');
    aw.classList.add('show'); rb.classList.add('show');
    if (me.some(m => m.gold)) Sfx.chargeFull && Sfx.chargeFull();
  });
}
function resetToAttract() {
  if (G.state === 'title') return;
  G.state = 'title'; G.titleT = 0; clearChars(); resetFov();
  Fx.clear(); Proj.clear(); applyPalette(); resetPaint();
  show('hud', false); show('results', false);
  Sfx.music('title');
}
function gotoTitle() {
  resetToAttract(); show('lobby', false); show('title', true); renderLoadCard();
}
function openLobby() {
  resetToAttract(); rollRoster(); G.lobbyTab = 'char'; renderLobby(); setTimeout(lobbyAnimate, 30);
  show('title', false); show('results', false); show('lobby', true);
}
function statBars(v) { let s = '<div class="bar">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= v ? 'on' : ''}"></i>`; return s + '</div>'; }
// ---- loadout screen: portrait row, then a panel with a "character" and a "weapon" page
// key numbers for a weapon in the hands of a given character (ink tank size matters)
function weaponFacts(W, C) {
  const hp = 100, k = C.inkCap;
  if (W.type === 'charge') return [['击倒', '满蓄 1 枪'], ['射程', W.minRange + '–' + W.maxRange + ' 米'], ['蓄满', W.chargeTime + ' 秒'], ['一罐墨', '满蓄 ' + Math.floor(100 * k / W.costFull) + ' 枪']];
  return [['击倒', Math.ceil(hp / W.dmg) + ' 发'], ['射程', W.range + ' 米'], ['射速', Math.round(1 / W.interval) + ' 发/秒'], ['一罐墨', Math.floor(100 * k / W.cost) + ' 发']];
}
function barsHTML(v) { let s = '<div class="sbar">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= v ? 'on' : ''}" style="--d:${i * 0.045}s"></i>`; return s + '</div>'; }
function charPageHTML(C) {
  const pc = v => Math.round(v * 100), cls = (v, b) => v > b ? 'up' : v < b ? 'dn' : '';
  const rows = [['生命', C.bars.hp, C.hp, cls(C.hp, 100), ''], ['移速', C.bars.speed, pc(C.runK), cls(pc(C.runK), 100), '%'], ['潜行', C.bars.speed, pc(C.swimK), cls(pc(C.swimK), 100), '%'], ['墨水', C.bars.ink, pc(C.inkCap), cls(pc(C.inkCap), 100), '%']];
  return `<div class="phead"><b>${C.name}</b><span class="en">${C.en}</span><em>${C.role}</em></div><p class="pdesc">${C.desc}</p>
    <div class="srows">${rows.map(([l, b, v, c, u], i) => `<div class="srow" style="--r:${i * 0.06}s"><span>${l}</span>${barsHTML(clamp(b, 1, 5))}<em class="${c}" data-n="${v}" data-u="${u}">${v}${u}</em></div>`).join('')}</div>
`;
}
function weapPageHTML(C) {
  return `<div class="wcards">${C.weapons.map((w, i) => {
    const W = WEAPONS[w], on = w === Profile.data.weapon;
    return `<div class="wcard2${on ? ' sel' : ''}" data-w="${w}" style="--r:${i * 0.08}s">
      <div class="wtop"><span class="wi">${weaponIcon(w, '#fff', 74)}</span><span class="wn"><b>${W.name}</b><small>${W.role}</small></span>${C.weapons.length > 1 ? `<span class="pick">${on ? '使用中' : '点击换上'}</span>` : '<span class="pick ex">专属</span>'}</div>
      <div class="wfacts">${weaponFacts(W, C).map(([l, v]) => `<span><small>${l}</small><b>${v}</b></span>`).join('')}</div>
      <div class="wstats">${STAT_LABELS.map(([k, l]) => `<span>${l}</span>${barsHTML(W.stats[k])}`).join('')}</div>
      <div class="wkit"><span>副武器 <b>${SUBS[C.sub || W.sub].name}</b></span><span>必杀技 <b>${SPECIALS[W.special].name}</b></span></div>
      <p class="wd">${W.desc}</p></div>`;
  }).join('')}</div>`;
}
function renderLobby() {
  const CH = CHARACTERS[Profile.data.char];
  if (!CH.weapons.includes(Profile.data.weapon)) Profile.data.weapon = CH.weapons[0];
  const cur = Profile.data.weapon, tab = G.lobbyTab || 'char';
  $('charPick').innerHTML = CHAR_ORDER.map(id => { const C = CHARACTERS[id]; return `<button class="ctile${id === CH.id ? ' sel' : ''}" data-id="${id}"><span class="pt">${charIcon(id, 64)}</span><b>${C.name}</b><small>${C.role}</small></button>`; }).join('');
  $('charPick').querySelectorAll('.ctile').forEach(el => el.onclick = () => {
    Sfx.init(); Sfx.click(); if (Profile.data.char === el.dataset.id) return;
    Profile.data.char = el.dataset.id; Profile.data.weapon = CHARACTERS[el.dataset.id].weapons[0]; Profile.save(); enforceRoster(); renderLobby(); renderLoadCard(); lobbyAnimate();
  });
  $('infoTabs').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.tab === tab));
  $('infoTabs').dataset.tab = tab;
  $('pgChar').innerHTML = charPageHTML(CH); $('pgWeap').innerHTML = weapPageHTML(CH);
  $('pgChar').classList.toggle('show', tab === 'char'); $('pgWeap').classList.toggle('show', tab === 'weap');
  $('pgWeap').querySelectorAll('.wcard2').forEach(el => el.onclick = () => {
    Sfx.init(); Sfx.click(); if (Profile.data.weapon === el.dataset.w) return;
    Profile.data.weapon = el.dataset.w; Profile.save(); enforceRoster(); renderLobby(); renderLoadCard(); lobbyAnimate();
  });
  // preview: the character on its pedestal; on the weapon page it raises the gun and the camera moves in
  Preview.show(Profile.data.char, cur); Preview.mode = tab;
  const W0 = WEAPONS[cur], nm = tab === 'weap' ? W0.name : CH.name, rl = tab === 'weap' ? W0.role + ' · ' + CH.name + (CH.weapons.length > 1 ? '可用' : '专属') : CH.role + ' · ' + W0.name;
  if ($('pvName').textContent !== nm) { const pn = $('pvName').parentNode; if (pn && pn.classList) { pn.classList.remove('tx'); void pn.offsetWidth; pn.classList.add('tx'); } }
  $('pvName').textContent = nm; $('pvRole').textContent = rl;
  ['rosterA', 'rosterB'].forEach((id, t) => {
    $(id).innerHTML = G.roster[t].map(m => `<div class="rrow${m.isPlayer ? ' me' : ''}" style="border-left-color:${TEAM_HEX[t]}"><span class="cp">${charIcon(m.char, 34, TEAM_HEX[t])}</span><span class="rt"><b>${m.name}${m.isPlayer ? '（你）' : ''}</b><small>${CHARACTERS[m.char].name} · ${WEAPONS[m.weapon].name}</small></span><span class="rw">${weaponIcon(m.weapon, '#fff', 34, TEAM_HEX[t])}</span></div>`).join('');
  });
}
// replay the entrance animations of the visible page (bars fill, numbers count up)
function lobbyAnimate() {
  const pg = $((G.lobbyTab || 'char') === 'char' ? 'pgChar' : 'pgWeap'); if (!pg) return;
  pg.classList.remove('anim'); void pg.offsetWidth; pg.classList.add('anim');
  const nums = pg.querySelectorAll ? pg.querySelectorAll('em[data-n]') : [];
  nums.forEach(el => { const n = +el.dataset.n, u = el.dataset.u; let t0 = null; const step = ts => { if (t0 === null) t0 = ts; const k = Math.min(1, (ts - t0) / 450), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(n * e) + u; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
}
function renderLoadCard() {
  const w = WEAPONS[Profile.data.weapon], C = CHARACTERS[Profile.data.char];
  $('lcIcon').innerHTML = charIcon(C.id, 58) + `<span class="lcw">${weaponIcon(w.id, '#fff', 40)}</span>`; $('lcName').textContent = C.name + ' · ' + w.name; $('lcRole').textContent = C.role + ' / ' + w.role;
  $('lcKit').textContent = SUBS[C.sub || w.sub].name + ' · ' + SPECIALS[w.special].name;
}
/* ------------------------------------------------ lobby 3D preview
   Its own small renderer: the chosen character on a pedestal, slowly
   turning; drag to spin it.                                          */
const Preview = {
  key: '', yaw: 0.5, drag: null, idleT: 0, mode: 'char', raise: 0.2, ph: 0, wIn: 1, wSpin: 0.6,
  init() {
    const cv = $('pvCanvas'); this.cv = cv;
    try { this.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { this.r = null; return; }
    if (this.r.setPixelRatio) this.r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));     // small panel: 1.5x is plenty
    if (this.r.outputColorSpace !== undefined) this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = this.sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xe8f2ff, 0x3a3150, 1.1));
    const key = new THREE.DirectionalLight(0xfff2de, 2.4); key.position.set(2.5, 5, 4); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 1.2); rim.position.set(-3, 3, -4); sc.add(rim);
    const ped = new THREE.Group(); sc.add(ped); this.ped = ped;
    ped.add(mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.16, 40), new THREE.MeshStandardMaterial({ color: 0x24223f, roughness: 0.5, metalness: 0.3 }), 0, -0.08, 0));
    this.ringM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.05, 8, 48), this.ringM); ring.rotation.x = Math.PI / 2; ped.add(ring);
    this.splatM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const sp = new THREE.Mesh(new THREE.CircleGeometry(0.7, 28), this.splatM); sp.rotation.x = -Math.PI / 2; sp.position.y = 0.005; ped.add(sp);
    // weapon page backdrop: a flat team-colour ink splat behind the floating weapon (the pedestal slides away)
    this.bdM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const bd = this.bd = new THREE.Group(); bd.position.set(0, 1.0, -1.2); sc.add(bd); const cg = new THREE.CircleGeometry(1, 28);
    const blob = (x, y, r) => { const m = new THREE.Mesh(cg, this.bdM); m.position.set(x, y, 0); m.scale.set(r, r, 1); bd.add(m); };
    blob(0, 0, 0.78); let sd = 7; const rn = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + rn() * 0.4, d = 0.62 + rn() * 0.18; blob(Math.cos(a) * d, Math.sin(a) * d, 0.16 + rn() * 0.16); }
    for (let k = 0; k < 6; k++) { const a = rn() * Math.PI * 2, d = 1.05 + rn() * 0.35; blob(Math.cos(a) * d, Math.sin(a) * d, 0.04 + rn() * 0.06); }
    bd.visible = false;
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); this.cam.position.set(0, 1.35, 4.7); this.cam.lookAt(0, 0.82, 0); this.look = new THREE.Vector3(0, 0.82, 0);
    this.shots = [];
    const ev = (n, f) => cv.addEventListener && cv.addEventListener(n, f);
    ev('pointerdown', e => { const wm = this.mode === 'weap'; this.drag = { x: e.clientX, wm, yaw: wm ? (this.wYaw === undefined ? Math.PI / 2 : this.wYaw) : this.yaw }; if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (_) { } });
    ev('pointermove', e => { if (this.drag) { const y = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; if (this.drag.wm) { this.wYaw = y; this.wSpin = 0.6; } else this.yaw = y; this.idleT = 2.5; } });
    const up = () => { this.drag = null; }; ev('pointerup', up); ev('pointercancel', up);
  },
  show(charId, weaponId) {
    if (!this.r) return;
    const key = charId + '/' + weaponId + '/' + TEAM_HEX[0];
    this.ringM.color.set(TEAM_HEX[0]); this.splatM.color.set(TEAM_HEX[0]); this.bdM.color.set(TEAM_HEX[0]);
    if (key === this.key && this.c) return;
    this.key = key;
    const sameChar = this.c && this.c.cs.id === charId;
    if (this.c) { this.ped.remove(this.c.root); }
    const c = new Character('pv', 0, true, { weapon: weaponId, char: charId });
    scene.remove(c.root); scene.remove(c.ghost); if (c.laser) scene.remove(c.laser, c.laserDot);
    c.pos.set(0, 0, 0); c.vel.set(0, 0, 0); c.grounded = true; c.state = 'play'; c.lastShot = -99; this.ped.add(c.root); this.c = c;
    this.pop = sameChar ? 0.4 : 1; this.enter = sameChar ? 1 : 0;
    if (this.wId !== weaponId) this.swapWeapon(weaponId, c.look.trim);
  },
  // the floating showcase weapon (weapon page): same model as in the hands, centred on its own bounds
  swapWeapon(id, trim) {
    if (this.wOld) this.dropW(this.wOld.g);
    this.wOld = this.wp && this.ph > 0.3 ? { g: this.wp.g, t: 1, s0: this.wp.g.scale.x } : null; if (this.wp && !this.wOld) this.dropW(this.wp.g);
    const inner = buildWeaponModel(id, TEAMMAT[0], trim); inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    inner.position.sub(ctr); inner.traverse(o => { o.castShadow = false; });
    const tilt = new THREE.Group(); tilt.add(inner); const g = new THREE.Group(); g.add(tilt); this.sc.add(g);
    this.wp = { g, tilt, size: Math.sqrt(size.z * size.y), spin: inner.userData.spin || null };     // one scale rule for every weapon: same visual weight (length x height)
    this.wId = id; this.wIn = this.ph > 0.3 ? -0.35 : 1; this.wSpin = 7;     // a new weapon on the weapon page: pops in with a flourish spin
  },
  dropW(g) {
    this.sc.remove(g);
    g.traverse(o => { if (!o.isMesh) return; if (o.material && !TEAMMAT.includes(o.material)) o.material.dispose(); if (!Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); });
  },
  update(dt) {
    if (!this.r || !this.c || !$('lobby').classList.contains('show')) return;
    const cv = this.cv, w = cv.clientWidth || 400, h = cv.clientHeight || 400;
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    const wm = this.mode === 'weap', c = this.c, sm = k => k * k * (3 - 2 * k); this.t = (this.t || 0) + dt;
    this.idleT = Math.max(0, this.idleT - dt);
    // phase 0 = character on the pedestal, 1 = weapon floating alone; the character dives into the ink, then the weapon rises out of it
    const ph0 = this.ph || 0; this.ph = clamp(ph0 + (wm ? dt : -dt) / 0.8, 0, 1);
    const a = clamp(this.ph / 0.42, 0, 1), b = clamp((this.ph - 0.34) / 0.66, 0, 1);
    if ((ph0 < 0.2) !== (this.ph < 0.2)) this.pop = Math.max(this.pop || 0, 0.7);       // ink splash pulse as the character dives / resurfaces
    // camera: full body <-> centred on the floating weapon
    const e = sm(this.ph), dist = lerp(4.7, 4.25, e);
    this.cam.position.set(0, lerp(1.35, 1.32, e), dist); this.look.set(0, lerp(0.82, 1.0, e), 0); this.cam.lookAt(this.look);
    // character: slow turntable; on the way out it squashes and sinks into the pedestal ink
    if (!this.drag && this.idleT <= 0) this.yaw += dt * 0.55;
    const ck = 1 - sm(a); c.root.visible = ck > 0.01;
    if (c.root.visible) {
      this.raise = damp(this.raise, 0.15, 6, dt); this.enter = Math.min(1, (this.enter || 0) + dt * 3.5);
      c.bodyYaw = c.aimYaw = this.yaw; c.aimPitch = lerp(-0.5, -0.03, this.raise); c.pos.set(0, 0, 0); c.lastShot = -99;
      c.syncModel(dt); c.root.position.set(0, (1 - this.enter) * -0.25 - a * a * 0.5, 0);
      const ek = (0.85 + 0.15 * (1 - Math.pow(1 - this.enter, 3))), sq = 1 + 0.3 * Math.sin(Math.PI * a), bw = c.look.bodyW || 1, bh = c.look.bodyH || 1;
      c.root.scale.set(bw * ek * sq * Math.max(ck, 0.2), bh * ek * Math.max(ck, 0.001), bw * ek * sq * Math.max(ck, 0.2));
      c.arms[1].rotation.set(0.12, 0, 0.14); c.torso.rotation.y *= this.raise;
    }
    // weapon: rises out of the ink with a little overshoot, then floats, bobs and turns; sized to fit the panel
    const W = this.wp;
    if (W) {
      this.wIn = Math.min(1, this.wIn + dt / 0.5); const wi = clamp(this.wIn, 0, 1), k = Math.min(b, wi);
      const ob = k <= 0 ? 0 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);       // ease-out-back
      W.g.visible = k > 0;
      if (W.g.visible) {
        const visW = 2 * dist * Math.tan(this.cam.fov * Math.PI / 360) * this.cam.aspect, fit = Math.min(0.6, visW * 0.33) / W.size;
        if (!this.drag && this.idleT <= 0) { this.wSpin = damp(this.wSpin, 0.6, 2.2, dt); this.wYaw = (this.wYaw === undefined ? Math.PI / 2 : this.wYaw) + this.wSpin * dt; }
        W.g.rotation.y = this.wYaw === undefined ? Math.PI / 2 : this.wYaw;
        W.g.position.set(0, lerp(0.15, 1.0, 1 - Math.pow(1 - k, 3)) + Math.sin(this.t * 1.7 + 1) * 0.035 * k, 0);
        W.g.scale.setScalar(fit * Math.max(0.001, ob)); W.tilt.rotation.x = 0.16 + Math.sin(this.t * 1.1) * 0.05; W.tilt.rotation.z = Math.sin(this.t * 0.9) * 0.05;
        if (W.spin) W.spin.rotation.z += dt * (2 + this.wSpin * 3);
      }
      const bk = clamp(this.ph * 1.6 - 0.5, 0, 1), bo = bk <= 0 ? 0 : 1 + 1.7 * Math.pow(bk - 1, 3) + 0.7 * Math.pow(bk - 1, 2);
      this.bd.visible = bk > 0; this.bdM.opacity = 0.2 * bk; this.bd.scale.setScalar(Math.max(0.001, bo)); this.bd.rotation.z += dt * 0.12;
    }
    // the previous weapon (weapon swapped on the weapon page) spins off and shrinks away
    if (this.wOld) {
      this.wOld.t -= dt / 0.22; const o = this.wOld;
      if (o.t <= 0) { this.dropW(o.g); this.wOld = null; }
      else { o.g.rotation.y += dt * 14; o.g.scale.setScalar(Math.max(0.001, o.s0 * o.t * o.t)); o.g.position.y += dt * 0.6; }
    }
    this.pop = Math.max(0, (this.pop || 0) - dt * 4); const s = 1 + this.pop * 0.12; this.ped.scale.set(s, s, s);
    const pk = sm(clamp((this.ph - 0.25) / 0.6, 0, 1)); this.ped.position.y = -1.9 * pk; this.ped.visible = pk < 0.99;
    this.r.render(this.sc, this.cam);
  }
};

/* ------------------------------------------------------------- update */
function updateIntro(dt) {
  G.introT += dt; const t = G.introT;
  const k = clamp(t / 3.0, 0, 1), e = k * k * (3 - 2 * k);
  // fly from enemy side high over arena down behind player
  const p0 = new THREE.Vector3(18, 26, -52), p1 = new THREE.Vector3(-12, 18, 0), p2 = new THREE.Vector3(0, SPAWN[0].y + 2.7, SPAWN[0].z + 4.6);
  const a = p0.clone().lerp(p1, e), b = p1.clone().lerp(p2, e), pos = a.lerp(b, e);
  camera.position.copy(pos); const look = new THREE.Vector3(0, 0, -10).lerp(new THREE.Vector3(0, SPAWN[0].y + 1.4, SPAWN[0].z - 20), e);
  camera.lookAt(look);
  if (t > 0.2 && !G.flags.t1) { G.flags.t1 = 1; HUD.center('涂地对战', '潮汐码头广场 · 4 V 4', 2400); }
  if (t > 3.1 && !G.flags.t2) { G.flags.t2 = 1; HUD.center('READY?', '', 1000); Sfx.beep(false); }
  if (t > 4.1) {
    G.state = 'play'; HUD.center('GO!', '', 900); Sfx.whistle(); Sfx.beep(true); flash(0.35); Sfx.music('game');
    Cam.pos.copy(camera.position);
  }
}
function updatePlay(dt) {
  G.time += dt; const prev = G.left; G.left -= dt;
  if (prev > 60 && G.left <= 60) { HUD.center('还剩 1 分钟！', '冲刺阶段', 1600); Sfx.music('hurry'); Sfx.beep(true); }
  if (G.left <= 10 && Math.ceil(G.left) !== Math.ceil(prev) && G.left > 0) { HUD.center(String(Math.ceil(G.left)), '', 700); Sfx.beep(G.left < 1); }
  if (G.left <= 0) { G.left = 0; endMatch(); return; }
  if (G.time > 8) $('hint').style.display = 'none';
  playerControl(dt);
  for (const b of G.bots) b.update(dt);
}
function updateTitle(dt) {
  G.titleT += dt; const t = G.titleT;
  camera.position.set(Math.sin(t * 0.08) * 62, 34 + Math.sin(t * 0.13) * 5, Math.cos(t * 0.08) * 62); camera.lookAt(0, 0, 0);
  if (Math.random() < dt * 14) {
    const x = rand(-XH + 1, XH - 1), z = rand(-ZH + 1, ZH - 1), team = Math.random() < 0.5 ? 0 : 1;
    splatFloor(x, groundAt(x, z), z, rand(1.2, 3.2), team, 0.5, true);
    if (Math.random() < 0.3) Fx.burst(x, groundAt(x, z) + 0.2, z, TEAM_HEX[team], 10, 5, 0.18);
  }
  if ((Paint.teamCells[0] + Paint.teamCells[1]) / Paint.total > 0.62) resetPaint();
}
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 1 / 30), t = clock.elapsedTime;
  if (!G.paused) {
    Preview.update(dt);
    if (G.state === 'title') updateTitle(dt);
    else if (G.state === 'intro') updateIntro(dt);
    else if (G.state === 'play') updatePlay(dt);
    else if (G.state === 'end') { G.endT += dt; if (G.endT > 2.6) showResults(); }
    else if (G.state === 'results') { camera.position.set(0, 84, 10 + Math.sin(t * 0.2) * 0.6); camera.lookAt(0, 0, 0); }   // judges look at the map from straight above
    if (G.state === 'intro' || G.state === 'play' || G.state === 'end') {
      for (const c of CHARS) c.step(dt);
      // separation
      for (let i = 0; i < CHARS.length; i++) for (let j = i + 1; j < CHARS.length; j++) {
        const a = CHARS[i], b = CHARS[j]; if (!a.alive || !b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.8 && d > 1e-4 && Math.abs(a.pos.y - b.pos.y) < 1.2) { const p = (0.8 - d) / 2 / d; a.pos.x -= dx * p; a.pos.z -= dz * p; b.pos.x += dx * p; b.pos.z += dz * p; }
      }
      if (G.state !== 'intro') updateCamera(dt);
      HUD.update(dt);
    }
    Proj.update(dt); Cover.update(dt); Fx.update(dt); Barrier.update(dt, t);
    uploadPaint(); updateWorld(t, dt);
  }
  G.frameN = (G.frameN || 0) + 1;
  if (!G.lobbyOpen || G.frameN % 6 === 0) renderer.render(scene, camera);
}

/* ------------------------------------------------------------ UI wiring */
function blobPath(seed, r) {
  let d = ''; const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, rr = r * (1 + 0.16 * Math.sin(a * 3 + seed) + 0.09 * Math.sin(a * 7 + seed * 2) + (hash(seed + i) > 0.82 ? 0.35 : 0));
    d += (i ? 'L' : 'M') + (Math.cos(a) * rr + 100).toFixed(1) + ' ' + (Math.sin(a) * rr + 100).toFixed(1);
  }
  return d + 'Z';
}
function titleSplats() {
  const el = $('titleSplats'); el.innerHTML = '';
  const spots = [[-4, 58, 360, 0], [70, -8, 300, 1], [82, 62, 220, 0], [30, 82, 180, 1], [52, 30, 120, 0], [-6, -6, 200, 1]];
  spots.forEach(([x, y, s, t], i) => {
    const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 200 200');
    sv.style.cssText = `left:${x}vw;top:${y}vh;width:${s}px;height:${s}px;opacity:.9;transform:rotate(${i * 47}deg)`;
    let inner = `<path d="${blobPath(i * 3.7 + 1, 62)}" style="fill:var(--c${t})" stroke="#111" stroke-width="5"/>`;
    for (let k = 0; k < 4; k++) { const a = hash(i * 9 + k) * 6.28, dd = 80 + hash(i + k * 3) * 14; inner += `<circle cx="${100 + Math.cos(a) * dd}" cy="${100 + Math.sin(a) * dd}" r="${5 + hash(k + i) * 8}" style="fill:var(--c${t})" stroke="#111" stroke-width="3"/>`; }
    sv.innerHTML = inner; el.appendChild(sv);
  });
}
function initUI() {
  const sw = $('swatches');
  PALETTES.forEach((p, i) => { const d = document.createElement('div'); d.className = 'sw' + (i === GAME.pal ? ' sel' : ''); d.innerHTML = `<span style="background:${p[0]}"></span><span style="background:${p[1]}"></span>`; d.onclick = () => { GAME.pal = i; [...sw.children].forEach((c, k) => c.classList.toggle('sel', k === i)); applyPalette(); Profile.save(); if ($('lobby').classList.contains('show')) renderLobby(); Sfx.init(); Sfx.click(); }; sw.appendChild(d); });
  const seg = (id, fn) => { const el = $(id); el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); fn(+b.dataset.v); Sfx.init(); Sfx.click(); }); };
  seg('diff', v => { GAME.diff = v; Profile.save(); }); seg('dur', v => { GAME.dur = v; Profile.save(); });
  const selSeg = (id, v) => $(id).querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.v === v));
  selSeg('diff', GAME.diff); selSeg('dur', GAME.dur);
  seg('sQual', v => { SETTINGS.qual = v; applyQuality(); }); seg('sInv', v => SETTINGS.inv = v);
  const rng = (id, vid, key, fmt, after) => { const el = $(id); el.oninput = () => { SETTINGS[key] = +el.value; $(vid).textContent = fmt(+el.value); after && after(); }; };
  rng('sSens', 'vSens', 'sens', v => v.toFixed(2)); rng('sFov', 'vFov', 'fov', v => v, () => { camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); });
  rng('sVol', 'vVol', 'vol', v => Math.round(v * 100), () => Sfx.setVol()); rng('sMus', 'vMus', 'mus', v => Math.round(v * 100), () => Sfx.setVol());
  $('minimap').addEventListener('mousedown', e => { e.stopPropagation(); HUD.mapClick(e); });
  $('pname').value = GAME.name;
  $('pname').oninput = e => { GAME.name = e.target.value.trim().slice(0, 8); Profile.save(); };
  $('btnStart').onclick = () => { Sfx.init(); Sfx.click(); openLobby(); };
  $('loadCard').onclick = () => { Sfx.init(); Sfx.click(); openLobby(); };
  $('btnBack').onclick = () => { Sfx.click(); show('lobby', false); show('title', true); renderLoadCard(); };
  $('infoTabs').querySelectorAll('button').forEach(b => b.onclick = () => { Sfx.init(); Sfx.click(); if (G.lobbyTab === b.dataset.tab) return; G.lobbyTab = b.dataset.tab; renderLobby(); lobbyAnimate(); });
  $('btnGo').onclick = () => { Sfx.click(); Profile.save(); enforceRoster(); startMatch(); };
  $('btnChange').onclick = () => { Sfx.click(); openLobby(); };
  $('btnHow').onclick = () => { Sfx.init(); Sfx.click(); show('howto', true); };
  $('btnSet').onclick = $('btnSet2').onclick = () => { Sfx.init(); Sfx.click(); show('settings', true); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { Sfx.click(); show(b.dataset.close, false); });
  $('btnResume').onclick = () => { Sfx.click(); resumeGame(); };
  $('btnQuit').onclick = () => { Sfx.click(); quitToTitle(); };
  $('btnAgain').onclick = () => { Sfx.click(); rollRoster(); startMatch(); };
  $('btnMenu').onclick = () => { Sfx.click(); quitToTitle(); };
  addEventListener('keydown', e => { if (e.code === 'Escape') { show('howto', false); show('settings', false); show('changelog', false); } });
  document.addEventListener('pointerdown', () => { Sfx.init(); if (G.state === 'title') Sfx.music('title'); }, { once: true });
  titleSplats(); renderLoadCard();
  // version badge + release notes
  $('verTxt').textContent = VERSION; $('pauseVer').textContent = 'SPLASH RUSH ' + VERSION;
  const LOG_SHOW = 3, logItem = (r, i) => `<div class="logv${i === 0 ? ' cur' : ''}"><div class="hd"><b>${r.v}</b><span>${r.title}</span>${i === 0 ? '<i>当前版本</i>' : ''}<small>${r.date} ${r.time || ''}</small></div><ul>${r.items.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
  const logOld = RELEASES.slice(LOG_SHOW);
  $('logList').innerHTML = RELEASES.slice(0, LOG_SHOW).map(logItem).join('') + (logOld.length ? `<button class="logmore" id="logMore">更早的版本（${logOld.length}）<em>▾</em></button><div class="logold" id="logOld">${logOld.map((r, i) => logItem(r, i + LOG_SHOW)).join('')}</div>` : '');
  const logFold = open => { const o = $('logOld'), b = $('logMore'); if (!o) return; o.classList.toggle('show', open); b.classList.toggle('open', open); b.firstChild.textContent = open ? '收起更早的版本 ' : `更早的版本（${logOld.length}）`; };
  if ($('logMore')) $('logMore').onclick = () => { Sfx.click(); const open = !$('logOld').classList.contains('show'); logFold(open); if (open && $('logMore').scrollIntoView) $('logMore').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('btnLog').onclick = () => { Sfx.init(); Sfx.click(); logFold(false); $('logList').parentNode.scrollTop = 0; show('changelog', true); };
}

/* ---------------------------------------------------------------- boot */
function boot() {
  Profile.load();
  initRenderer();
  defineMap();
  buildTextures();
  initPaint();
  initGeo();
  buildSkyEnv(); buildSea(); buildArena(); buildDecor();
  Fx.init(); Proj.init(); Barrier.init(); ScreenInk.init(); initBallistics(); initNav(); HUD.init(); initInput(); initUI(); Preview.init();
  applyPalette();
  renderer.compile(scene, camera);
  G.state = 'title';
  show('loading', false); show('title', true);
  loop();
}
function showFatal(msg) {
  const l = $('loading'); l.classList.add('show'); l.style.zIndex = 200;
  l.querySelector('p').innerHTML = '出错了：' + String(msg).replace(/</g, '&lt;') + '<br><small style="opacity:.7">请把这段文字截图发给我</small>';
}
window.addEventListener('error', e => { if (G.state === 'boot') showFatal(e.message); console.error(e.error || e.message); });
window.addEventListener('load', () => {
  try { boot(); }
  catch (e) { console.error(e); showFatal(e.message + '（请使用最新版 Chrome / Edge / Safari 打开）'); }
});
