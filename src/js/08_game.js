/* ================================================================ HUD */
const TIPS = ['潜进自己的墨水里，墨水和体力都会飞快恢复', '把墙涂成自己的颜色，潜墨朝墙走就能爬上去', '踩在敌方墨水里会减速掉血——先把脚下涂掉', '涂地可以给必杀技充能，满了按 Q', '炸弹会弹一下再爆炸，适合扔到掩体后面', '获胜看的是地面覆盖率，不是击倒数'];
const HUD = {
  mmT: 0, base: null, img: null, rgb: [[0, 0, 0], [0, 0, 0]], hurtV: 0, lowInkT: 0,
  init() {
    const mm = $('minimap'); mm.width = Math.round(mm.height * XH / ZH); this.ctx = mm.getContext('2d'); this.mw = mm.width; this.mh = mm.height;
    this.img = this.ctx.createImageData(this.mw, this.mh); this.base = new Uint8ClampedArray(this.mw * this.mh * 4);
    for (let y = 0; y < this.mh; y++) for (let x = 0; x < this.mw; x++) {
      const i = Math.floor(x / this.mw * NX), j = Math.floor(y / this.mh * NZ), h = Paint.hgt[j * NX + i];
      const o = (y * this.mw + x) * 4;
      if (h > 50) { this.base[o] = 22; this.base[o + 1] = 30; this.base[o + 2] = 28; this.base[o + 3] = 255; continue; }     // out of bounds
      const v = 58 + h * 22; this.base[o] = v; this.base[o + 1] = v + 2; this.base[o + 2] = v + 12; this.base[o + 3] = 255;
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
    const cr = $('chargeRing'), isC = !!c.weapon.charges, su = c.weapon.spinUp, isS = !!su && c.spinning && c.spin < su;   // gatling: a quick ring while the barrels spin up
    cr.classList.toggle('on', (isC || isS) && c.alive); cr.classList.toggle('full', isC && c.charge >= 1);
    if (isC) $('chargeArc').style.strokeDashoffset = 251.3 * (1 - c.charge); else if (isS) $('chargeArc').style.strokeDashoffset = 251.3 * (1 - c.spin / su);
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
  CHARS.forEach(c => { scene.remove(c.root); scene.remove(c.ghost); if (c.laser) scene.remove(c.laser, c.laserDot); if (c.sjMarker) scene.remove(c.sjMarker); }); CHARS.length = 0; G.bots = []; G.squads = [new Squad(0), new Squad(1)]; G.pilot = null; PLAYER = null;
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
  clearChars(); navEnsure();
  if (!G.roster) rollRoster();
  // where the four stand on the spawn pad: [sideways, back] from its centre (a narrow pad gets a tight 2 x 2)
  const slots = MAP.spawnSlots || [[-4.5, -0.4], [-1.5, 0.8], [1.5, -0.4], [4.5, 0.8]];
  for (let t = 0; t < 2; t++) G.roster[t].forEach((m, i) => {
    const c = new Character(m.name, t, m.isPlayer, { weapon: m.weapon, look: m.look, char: m.char });
    const sp = SPAWN[t], sl = slots[i % slots.length]; c.pos.set(sp.x + sl[0] * (t ? -1 : 1), sp.y, sp.z + (t ? -1 : 1) * sl[1]); c.aimYaw = c.yaw = c.bodyYaw = sp.yaw;
    CHARS.push(c); if (m.isPlayer) PLAYER = c; else G.bots.push(new Bot(c, m.role));
  });
}
function resetFov() { Cam.zoom = 1; camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); }
function startMatch() {
  Sfx.init(); Sfx.stopMusic(); Sfx.duck(false);
  applyPalette(); resetPaint(); Fx.clear(); Proj.clear();
  spawnTeams(); HUD.buildTeams(); ScreenInk.reset(TEAM_HEX[1]);
  try { renderer.compile(scene, camera); } catch (e) { }
  G.left = GAME.dur; G.time = 0; G.state = 'intro'; G.introT = 0; G.paused = false; G.flags = {}; resetFov(); cineUI(false);
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
  resetToAttract(); show('lobby', false); show('mapsel', false); show('title', true); renderLoadCard();
}
function openLobby() {
  resetToAttract(); rollRoster(); G.lobbyTab = 'char'; renderLobby(); setTimeout(lobbyAnimate, 30);
  show('title', false); show('results', false); show('mapsel', false); show('lobby', true);
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
// sub weapon page: what it does, how to use it, key numbers (the 3D preview plays a live demo next to it)
function curlDist(swimK) { let v = 12.8 * swimK, d = 0; for (let t = 0; t < CURL_FUSE; t += 1 / 60) { if (t > CURL_CRUISE) v = Math.max(0, v - 16 / 60); d += v / 60; } return d; }
function subFacts(id, C) {
  const S = SUBS[id], cost = Math.round(S.cost / C.inkCap) + '%';
  if (id === 'curling') return [['消耗', cost], ['滑行', '约 ' + Math.round(curlDist(C.swimK)) + ' 米'], ['伤害', '180 / 70'], ['爆炸范围', '2.9 米']];
  if (id === 'cover') return [['消耗', cost], ['耐久', S.hp + '（步枪 ' + Math.ceil(S.hp / WEAPONS.rifle.dmg) + ' 发）'], ['持续', S.life + ' 秒'], ['宽度', Cover.W + ' 米']];
  return [['消耗', cost], ['伤害', '180 / 80'], ['爆炸范围', '3.6 米'], ['引信', '落地约 1 秒']];
}
// what it does, at a glance: ✔ strengths, ✖ weaknesses, ⏱ limits
const SUB_POINTS = {
  curling: [['ok', '贴地滑出约 15 米，一路铺出一条墨路'], ['ok', '潜进墨路跟在后面冲，速度和你潜行一样'], ['ok', '撞墙会反弹，碰到敌人立刻爆炸'], ['no', '爆炸比墨水炸弹小一圈']],
  cover: [['ok', '挡住敌人的子弹和狙击'], ['ok', '自己人的子弹能穿过去'], ['ok', '脚下铺一片墨，躲在后面潜墨回墨'], ['no', '会被打坏，炸弹对它伤害很大'], ['tm', '最多 10 秒，同时只能立一块']],
  bomb: [['ok', '抛出后弹一下再爆炸，大范围涂墨'], ['ok', '炸在身边直接击倒'], ['ok', '扔到掩体后面，逼敌人走位'], ['no', '落地约 1 秒才爆炸，敌人来得及躲']]
};
const SUB_TIPS = { curling: '按住瞄准，看滑行路线；松开扔出，潜进墨路跟着冲', cover: '按住看放置位置；松开，在准星方向立起掩体', bomb: '按住看抛物线；松开扔出，跳起来扔得更远' };
function subPageHTML(C) {
  const id = C.sub || 'bomb', S = SUBS[id];
  return `<div class="wcards"><div class="wcard2 sel static" style="--r:0s">
    <div class="wtop"><span class="wi">${weaponIcon(id, '#fff', 74)}</span><span class="wn"><b>${S.name}</b><small>副武器 · ${C.name}</small></span><span class="pick ex">专属</span></div>
    <div class="stip"><kbd>E</kbd>${SUB_TIPS[id] || ''}</div>
    <ul class="slist">${(SUB_POINTS[id] || []).map(([k, t]) => `<li><i class="${k}">${{ ok: '✓', no: '✕', tm: '⏱' }[k]}</i>${t}</li>`).join('')}</ul>
    <div class="wfacts">${subFacts(id, C).map(([l, v]) => `<span><small>${l}</small><b>${v}</b></span>`).join('')}</div></div></div>`;
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
  $('pgChar').innerHTML = charPageHTML(CH); $('pgWeap').innerHTML = weapPageHTML(CH); $('pgSub').innerHTML = subPageHTML(CH);
  $('pgChar').classList.toggle('show', tab === 'char'); $('pgWeap').classList.toggle('show', tab === 'weap'); $('pgSub').classList.toggle('show', tab === 'sub');
  const pvb = $('pvCanvas').parentNode; if (pvb && pvb.classList) pvb.classList.toggle('sub', tab === 'sub');
  $('pgWeap').querySelectorAll('.wcard2').forEach(el => el.onclick = () => {
    Sfx.init(); Sfx.click(); if (Profile.data.weapon === el.dataset.w) return;
    Profile.data.weapon = el.dataset.w; Profile.save(); enforceRoster(); renderLobby(); renderLoadCard(); lobbyAnimate();
  });
  // preview: the character on its pedestal; on the weapon page it raises the gun and the camera moves in
  Preview.show(Profile.data.char, cur); Preview.mode = tab;
  const W0 = WEAPONS[cur], S0 = SUBS[CH.sub || 'bomb'], nm = tab === 'weap' ? W0.name : tab === 'sub' ? S0.name : CH.name, rl = tab === 'weap' ? W0.role + ' · ' + CH.name + (CH.weapons.length > 1 ? '可用' : '专属') : tab === 'sub' ? '副武器 · ' + CH.name + '专属' : CH.role + ' · ' + W0.name;
  if ($('pvName').textContent !== nm) { const pn = $('pvName').parentNode; if (pn && pn.classList) { pn.classList.remove('tx'); void pn.offsetWidth; pn.classList.add('tx'); } }
  $('pvName').textContent = nm; $('pvRole').textContent = rl;
  ['rosterA', 'rosterB'].forEach((id, t) => {
    $(id).innerHTML = G.roster[t].map(m => `<div class="rrow${m.isPlayer ? ' me' : ''}" style="border-left-color:${TEAM_HEX[t]}"><span class="cp">${charIcon(m.char, 34, TEAM_HEX[t])}</span><span class="rt"><b>${m.name}${m.isPlayer ? '（你）' : ''}</b><small>${CHARACTERS[m.char].name} · ${WEAPONS[m.weapon].name}</small></span><span class="rw">${weaponIcon(m.weapon, '#fff', 34, TEAM_HEX[t])}</span></div>`).join('');
  });
}
// ---- maps: picked on the map select screen; switching rebuilds the world in place and remembers the choice
const MAP_THUMB = {"canton": "<svg viewBox=\"0 0 64 110\" width=\"64\" height=\"110\"><rect x=\"0\" y=\"0\" width=\"64\" height=\"110\" rx=\"8\" fill=\"#23222f\"/><rect x=\"6.0\" y=\"3.0\" width=\"52.0\" height=\"104.0\" fill=\"#4a4f63\"/><rect x=\"6.0\" y=\"51.5\" width=\"52.0\" height=\"7.0\" fill=\"#2b3a55\"/><rect x=\"20.0\" y=\"56.1\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"41.0\" y=\"53.3\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"52.0\" y=\"56.1\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"9.0\" y=\"53.3\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"40.5\" y=\"55.2\" width=\"10.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"13.0\" y=\"53.6\" width=\"10.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"20.0\" y=\"56.7\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"41.0\" y=\"52.7\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"52.0\" y=\"56.7\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"9.0\" y=\"52.7\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"20.0\" y=\"57.3\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"41.0\" y=\"52.1\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"52.0\" y=\"57.3\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"9.0\" y=\"52.1\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"20.0\" y=\"57.9\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"41.0\" y=\"51.5\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"52.0\" y=\"57.9\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"9.0\" y=\"51.5\" width=\"3.0\" height=\"0.6\" fill=\"#5c6176\"/><rect x=\"25.0\" y=\"51.5\" width=\"14.0\" height=\"7.0\" fill=\"#6e6e7c\"/><rect x=\"46.3\" y=\"51.5\" width=\"3.4\" height=\"2.3\" fill=\"#727280\"/><rect x=\"14.3\" y=\"56.2\" width=\"3.4\" height=\"2.3\" fill=\"#727280\"/><rect x=\"46.3\" y=\"56.2\" width=\"3.4\" height=\"2.3\" fill=\"#727280\"/><rect x=\"14.3\" y=\"51.5\" width=\"3.4\" height=\"2.3\" fill=\"#727280\"/><rect x=\"31.0\" y=\"69.0\" width=\"1.6\" height=\"1.6\" fill=\"#737381\"/><rect x=\"31.4\" y=\"39.4\" width=\"1.6\" height=\"1.6\" fill=\"#737381\"/><rect x=\"37.0\" y=\"68.0\" width=\"6.0\" height=\"5.0\" fill=\"#737381\"/><rect x=\"21.0\" y=\"37.0\" width=\"6.0\" height=\"5.0\" fill=\"#737381\"/><rect x=\"25.0\" y=\"61.0\" width=\"2.0\" height=\"2.0\" fill=\"#737381\"/><rect x=\"37.0\" y=\"47.0\" width=\"2.0\" height=\"2.0\" fill=\"#737381\"/><rect x=\"42.0\" y=\"60.5\" width=\"2.0\" height=\"2.0\" fill=\"#737381\"/><rect x=\"20.0\" y=\"47.5\" width=\"2.0\" height=\"2.0\" fill=\"#737381\"/><rect x=\"46.3\" y=\"53.8\" width=\"3.4\" height=\"2.4\" fill=\"#7b7b89\"/><rect x=\"14.3\" y=\"53.8\" width=\"3.4\" height=\"2.4\" fill=\"#7b7b89\"/><rect x=\"46.0\" y=\"51.5\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"17.7\" y=\"56.2\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"46.0\" y=\"56.2\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"17.7\" y=\"51.5\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"49.7\" y=\"51.5\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"14.0\" y=\"56.2\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"49.7\" y=\"56.2\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"14.0\" y=\"51.5\" width=\"0.3\" height=\"2.3\" fill=\"#7d7d8b\"/><rect x=\"29.0\" y=\"91.0\" width=\"6.0\" height=\"6.0\" fill=\"#7e7e8c\"/><rect x=\"29.0\" y=\"13.0\" width=\"6.0\" height=\"6.0\" fill=\"#7e7e8c\"/><rect x=\"11.5\" y=\"76.0\" width=\"2.5\" height=\"4.0\" fill=\"#7e7e8c\"/><rect x=\"50.0\" y=\"30.0\" width=\"2.5\" height=\"4.0\" fill=\"#7e7e8c\"/><rect x=\"46.0\" y=\"71.0\" width=\"3.0\" height=\"1.0\" fill=\"#7e7e8c\"/><rect x=\"15.0\" y=\"38.0\" width=\"3.0\" height=\"1.0\" fill=\"#7e7e8c\"/><rect x=\"34.5\" y=\"50.8\" width=\"2.5\" height=\"1.7\" fill=\"#7e7e8c\"/><rect x=\"27.0\" y=\"57.5\" width=\"2.5\" height=\"1.7\" fill=\"#7e7e8c\"/><rect x=\"34.0\" y=\"80.0\" width=\"3.0\" height=\"1.6\" fill=\"#80808e\"/><rect x=\"27.0\" y=\"28.4\" width=\"3.0\" height=\"1.6\" fill=\"#80808e\"/><rect x=\"27.0\" y=\"73.0\" width=\"1.5\" height=\"1.6\" fill=\"#828290\"/><rect x=\"35.5\" y=\"35.4\" width=\"1.5\" height=\"1.6\" fill=\"#828290\"/><rect x=\"45.0\" y=\"79.0\" width=\"2.0\" height=\"2.5\" fill=\"#828290\"/><rect x=\"17.0\" y=\"28.5\" width=\"2.0\" height=\"2.5\" fill=\"#828290\"/><rect x=\"17.0\" y=\"67.4\" width=\"5.0\" height=\"3.6\" fill=\"#848492\"/><rect x=\"42.0\" y=\"39.0\" width=\"5.0\" height=\"3.6\" fill=\"#848492\"/><rect x=\"17.0\" y=\"85.0\" width=\"5.0\" height=\"4.0\" fill=\"#848492\"/><rect x=\"42.0\" y=\"21.0\" width=\"5.0\" height=\"4.0\" fill=\"#848492\"/><rect x=\"46.0\" y=\"53.8\" width=\"0.3\" height=\"2.4\" fill=\"#868694\"/><rect x=\"17.7\" y=\"53.8\" width=\"0.3\" height=\"2.4\" fill=\"#868694\"/><rect x=\"49.7\" y=\"53.8\" width=\"0.3\" height=\"2.4\" fill=\"#868694\"/><rect x=\"14.0\" y=\"53.8\" width=\"0.3\" height=\"2.4\" fill=\"#868694\"/><rect x=\"22.0\" y=\"97.0\" width=\"20.0\" height=\"10.0\" fill=\"#9393a1\"/><rect x=\"22.0\" y=\"3.0\" width=\"20.0\" height=\"10.0\" fill=\"#9393a1\"/><rect x=\"42.0\" y=\"97.0\" width=\"16.0\" height=\"10.0\" fill=\"#9393a1\"/><rect x=\"6.0\" y=\"3.0\" width=\"16.0\" height=\"10.0\" fill=\"#9393a1\"/><rect x=\"34.5\" y=\"52.5\" width=\"2.5\" height=\"2.5\" fill=\"#9393a1\"/><rect x=\"27.0\" y=\"55.0\" width=\"2.5\" height=\"2.5\" fill=\"#9393a1\"/><rect x=\"21.0\" y=\"73.0\" width=\"6.0\" height=\"7.0\" fill=\"#9c9caa\"/><rect x=\"37.0\" y=\"30.0\" width=\"6.0\" height=\"7.0\" fill=\"#9c9caa\"/><rect x=\"6.0\" y=\"67.0\" width=\"11.0\" height=\"4.0\" fill=\"#a0a0ae\"/><rect x=\"47.0\" y=\"39.0\" width=\"11.0\" height=\"4.0\" fill=\"#a0a0ae\"/><rect x=\"6.0\" y=\"85.0\" width=\"11.0\" height=\"4.0\" fill=\"#a0a0ae\"/><rect x=\"47.0\" y=\"21.0\" width=\"11.0\" height=\"4.0\" fill=\"#a0a0ae\"/><rect x=\"16.0\" y=\"71.0\" width=\"1.0\" height=\"5.0\" fill=\"#a0a0ae\"/><rect x=\"47.0\" y=\"34.0\" width=\"1.0\" height=\"5.0\" fill=\"#a0a0ae\"/><rect x=\"16.0\" y=\"80.0\" width=\"1.0\" height=\"5.0\" fill=\"#a0a0ae\"/><rect x=\"47.0\" y=\"25.0\" width=\"1.0\" height=\"5.0\" fill=\"#a0a0ae\"/><rect x=\"16.0\" y=\"76.0\" width=\"1.0\" height=\"4.0\" fill=\"#a0a0ae\"/><rect x=\"47.0\" y=\"30.0\" width=\"1.0\" height=\"4.0\" fill=\"#a0a0ae\"/><rect x=\"52.3\" y=\"91.0\" width=\"5.7\" height=\"6.0\" fill=\"#a7a7b5\"/><rect x=\"6.0\" y=\"13.0\" width=\"5.7\" height=\"6.0\" fill=\"#a7a7b5\"/><rect x=\"52.3\" y=\"63.0\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"46.4\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"52.3\" y=\"66.9\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"42.5\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"52.3\" y=\"70.8\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"38.6\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"52.3\" y=\"74.7\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"34.7\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"52.3\" y=\"78.7\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"30.7\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"52.3\" y=\"82.6\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"26.8\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"52.3\" y=\"86.5\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"22.9\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"52.3\" y=\"90.4\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"11.1\" y=\"19.0\" width=\"0.6\" height=\"0.6\" fill=\"#b1b1bf\"/><rect x=\"47.0\" y=\"101.0\" width=\"2.0\" height=\"2.0\" fill=\"#b6b6c4\"/><rect x=\"15.0\" y=\"7.0\" width=\"2.0\" height=\"2.0\" fill=\"#b6b6c4\"/><rect x=\"52.3\" y=\"63.0\" width=\"5.7\" height=\"28.0\" fill=\"#babac8\"/><rect x=\"6.0\" y=\"19.0\" width=\"5.7\" height=\"28.0\" fill=\"#babac8\"/><rect x=\"29.5\" y=\"52.5\" width=\"5.0\" height=\"5.0\" fill=\"#bebecc\"/><rect x=\"6.0\" y=\"71.0\" width=\"3.0\" height=\"14.0\" fill=\"#33364a\"/><rect x=\"55.0\" y=\"25.0\" width=\"3.0\" height=\"14.0\" fill=\"#33364a\"/><rect x=\"27.6\" y=\"85.6\" width=\"0.8\" height=\"0.8\" fill=\"#cbcbd9\"/><rect x=\"35.6\" y=\"23.6\" width=\"0.8\" height=\"0.8\" fill=\"#cbcbd9\"/><rect x=\"35.6\" y=\"85.6\" width=\"0.8\" height=\"0.8\" fill=\"#cbcbd9\"/><rect x=\"27.6\" y=\"23.6\" width=\"0.8\" height=\"0.8\" fill=\"#cbcbd9\"/><rect x=\"27.0\" y=\"85.5\" width=\"10.0\" height=\"1.0\" fill=\"#cbcbd9\"/><rect x=\"27.0\" y=\"23.5\" width=\"10.0\" height=\"1.0\" fill=\"#cbcbd9\"/><rect x=\"52.3\" y=\"63.0\" width=\"0.3\" height=\"28.0\" fill=\"#cecedc\"/><rect x=\"11.4\" y=\"19.0\" width=\"0.3\" height=\"28.0\" fill=\"#cecedc\"/><rect x=\"31.0\" y=\"54.0\" width=\"2.0\" height=\"2.0\" fill=\"#d4d4e2\"/><rect x=\"6.0\" y=\"99.0\" width=\"16.0\" height=\"8.0\" fill=\"#33364a\"/><rect x=\"42.0\" y=\"3.0\" width=\"16.0\" height=\"8.0\" fill=\"#33364a\"/><circle cx=\"32.0\" cy=\"102.0\" r=\"4.5\" fill=\"var(--c0)\" stroke=\"#111\" stroke-width=\"1.5\"/><circle cx=\"32.0\" cy=\"8.0\" r=\"4.5\" fill=\"var(--c1)\" stroke=\"#111\" stroke-width=\"1.5\"/></svg>", "dock": "<svg viewBox=\"0 0 64 110\" width=\"64\" height=\"110\"><rect x=\"0\" y=\"0\" width=\"64\" height=\"110\" rx=\"8\" fill=\"#23222f\"/><rect x=\"18.3\" y=\"88.5\" width=\"6.9\" height=\"1.4\" fill=\"#6b6b79\"/><rect x=\"38.9\" y=\"20.1\" width=\"6.9\" height=\"1.4\" fill=\"#6b6b79\"/><rect x=\"38.9\" y=\"88.5\" width=\"6.9\" height=\"1.4\" fill=\"#6b6b79\"/><rect x=\"18.3\" y=\"20.1\" width=\"6.9\" height=\"1.4\" fill=\"#6b6b79\"/><rect x=\"24.0\" y=\"72.9\" width=\"2.3\" height=\"2.4\" fill=\"#6e6e7c\"/><rect x=\"37.7\" y=\"34.7\" width=\"2.3\" height=\"2.4\" fill=\"#6e6e7c\"/><rect x=\"36.6\" y=\"78.3\" width=\"2.3\" height=\"2.4\" fill=\"#6e6e7c\"/><rect x=\"25.1\" y=\"29.3\" width=\"2.3\" height=\"2.4\" fill=\"#6e6e7c\"/><rect x=\"1.7\" y=\"59.8\" width=\"2.3\" height=\"4.8\" fill=\"#6e6e7c\"/><rect x=\"60.0\" y=\"45.4\" width=\"2.3\" height=\"4.8\" fill=\"#6e6e7c\"/><rect x=\"43.4\" y=\"65.8\" width=\"5.7\" height=\"4.8\" fill=\"#757583\"/><rect x=\"14.9\" y=\"39.5\" width=\"5.7\" height=\"4.8\" fill=\"#757583\"/><rect x=\"21.7\" y=\"99.2\" width=\"20.6\" height=\"10.8\" fill=\"#8a8a98\"/><rect x=\"21.7\" y=\"0.0\" width=\"20.6\" height=\"10.8\" fill=\"#8a8a98\"/><rect x=\"28.6\" y=\"92.1\" width=\"6.9\" height=\"7.2\" fill=\"#686876\"/><rect x=\"28.6\" y=\"10.8\" width=\"6.9\" height=\"7.2\" fill=\"#686876\"/><rect x=\"42.3\" y=\"102.2\" width=\"5.7\" height=\"6.0\" fill=\"#686876\"/><rect x=\"16.0\" y=\"1.8\" width=\"5.7\" height=\"6.0\" fill=\"#686876\"/><rect x=\"16.0\" y=\"102.2\" width=\"5.7\" height=\"6.0\" fill=\"#686876\"/><rect x=\"42.3\" y=\"1.8\" width=\"5.7\" height=\"6.0\" fill=\"#686876\"/><rect x=\"56.0\" y=\"57.4\" width=\"2.3\" height=\"12.0\" fill=\"#90909e\"/><rect x=\"5.7\" y=\"40.7\" width=\"2.3\" height=\"12.0\" fill=\"#90909e\"/><rect x=\"29.1\" y=\"60.4\" width=\"5.7\" height=\"7.2\" fill=\"#6e6e7c\"/><rect x=\"29.1\" y=\"42.4\" width=\"5.7\" height=\"7.2\" fill=\"#6e6e7c\"/><rect x=\"24.0\" y=\"49.6\" width=\"16.0\" height=\"10.8\" fill=\"#9797a5\"/><rect x=\"4.6\" y=\"78.9\" width=\"5.7\" height=\"10.8\" fill=\"#9e9eac\"/><rect x=\"53.7\" y=\"20.3\" width=\"5.7\" height=\"10.8\" fill=\"#9e9eac\"/><rect x=\"51.4\" y=\"76.5\" width=\"9.1\" height=\"3.6\" fill=\"#9e9eac\"/><rect x=\"3.4\" y=\"29.9\" width=\"9.1\" height=\"3.6\" fill=\"#9e9eac\"/><rect x=\"12.6\" y=\"65.8\" width=\"6.9\" height=\"7.2\" fill=\"#acacba\"/><rect x=\"44.6\" y=\"37.1\" width=\"6.9\" height=\"7.2\" fill=\"#acacba\"/><rect x=\"13.7\" y=\"72.9\" width=\"4.6\" height=\"7.2\" fill=\"#797987\"/><rect x=\"45.7\" y=\"29.9\" width=\"4.6\" height=\"7.2\" fill=\"#797987\"/><rect x=\"36.0\" y=\"56.2\" width=\"2.3\" height=\"2.4\" fill=\"#c0c0ce\"/><rect x=\"25.7\" y=\"51.4\" width=\"2.3\" height=\"2.4\" fill=\"#c0c0ce\"/><rect x=\"4.8\" y=\"86.3\" width=\"2.9\" height=\"3.1\" fill=\"#d4d4e2\"/><rect x=\"56.3\" y=\"20.6\" width=\"2.9\" height=\"3.1\" fill=\"#d4d4e2\"/><circle cx=\"32.0\" cy=\"105.2\" r=\"4.5\" fill=\"var(--c0)\" stroke=\"#111\" stroke-width=\"1.5\"/><circle cx=\"32.0\" cy=\"4.8\" r=\"4.5\" fill=\"var(--c1)\" stroke=\"#111\" stroke-width=\"1.5\"/></svg>", "skate": "<svg viewBox=\"0 0 64 110\" width=\"64\" height=\"110\"><rect x=\"0\" y=\"0\" width=\"64\" height=\"110\" rx=\"8\" fill=\"#23222f\"/><rect x=\"39.5\" y=\"2.0\" width=\"4.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.3\" y=\"2.5\" width=\"6.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"37.6\" y=\"3.0\" width=\"7.7\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"37.6\" y=\"3.5\" width=\"8.4\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"37.0\" y=\"4.0\" width=\"9.6\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"36.4\" y=\"5.0\" width=\"0.8\" height=\"3.7\" fill=\"#686876\"/><rect x=\"37.0\" y=\"5.0\" width=\"9.6\" height=\"3.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"8.4\" width=\"13.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"37.0\" y=\"8.4\" width=\"9.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"22.6\" y=\"8.9\" width=\"5.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.2\" y=\"8.9\" width=\"8.4\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"36.4\" y=\"8.9\" width=\"10.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"22.0\" y=\"9.4\" width=\"6.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"28.2\" y=\"9.4\" width=\"8.4\" height=\"1.2\" fill=\"#acacba\"/><rect x=\"36.4\" y=\"9.4\" width=\"10.2\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"21.3\" y=\"10.4\" width=\"7.1\" height=\"3.2\" fill=\"#686876\"/><rect x=\"28.2\" y=\"10.4\" width=\"8.4\" height=\"3.2\" fill=\"#acacba\"/><rect x=\"36.4\" y=\"10.4\" width=\"10.2\" height=\"3.2\" fill=\"#8a8a98\"/><rect x=\"21.3\" y=\"13.4\" width=\"7.7\" height=\"1.2\" fill=\"#686876\"/><rect x=\"28.9\" y=\"13.4\" width=\"7.7\" height=\"1.2\" fill=\"#acacba\"/><rect x=\"36.4\" y=\"13.4\" width=\"10.2\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"20.7\" y=\"14.4\" width=\"8.4\" height=\"1.2\" fill=\"#686876\"/><rect x=\"28.9\" y=\"14.4\" width=\"7.7\" height=\"1.2\" fill=\"#acacba\"/><rect x=\"36.4\" y=\"14.4\" width=\"10.2\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"20.7\" y=\"15.4\" width=\"8.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"15.4\" width=\"7.7\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"36.4\" y=\"15.4\" width=\"10.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"20.1\" y=\"15.9\" width=\"9.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"15.9\" width=\"7.7\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"36.4\" y=\"15.9\" width=\"10.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"19.5\" y=\"16.4\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"20.7\" y=\"16.4\" width=\"0.8\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"21.3\" y=\"16.4\" width=\"9.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"30.1\" y=\"16.4\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"31.4\" y=\"16.4\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"32.6\" y=\"16.4\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"18.2\" y=\"16.8\" width=\"12.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"30.1\" y=\"16.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"30.7\" y=\"16.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"32.0\" y=\"16.8\" width=\"15.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"16.3\" y=\"17.3\" width=\"14.6\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"30.7\" y=\"17.3\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"31.4\" y=\"17.3\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"33.9\" y=\"17.3\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"15.1\" y=\"17.8\" width=\"16.5\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"31.4\" y=\"17.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"32.0\" y=\"17.8\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"35.1\" y=\"17.8\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"14.4\" y=\"18.3\" width=\"17.8\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"32.0\" y=\"18.3\" width=\"2.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"33.9\" y=\"18.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"35.8\" y=\"18.3\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"13.8\" y=\"18.8\" width=\"20.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"33.9\" y=\"18.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"34.5\" y=\"18.8\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"36.4\" y=\"18.8\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"13.2\" y=\"19.3\" width=\"21.5\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"34.5\" y=\"19.3\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"35.1\" y=\"19.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"37.0\" y=\"19.3\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"19.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"13.2\" y=\"19.8\" width=\"22.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.1\" y=\"19.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"35.8\" y=\"19.8\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"37.6\" y=\"19.8\" width=\"14.0\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"20.3\" width=\"23.4\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.8\" y=\"20.3\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"36.4\" y=\"20.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"38.3\" y=\"20.3\" width=\"13.4\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"20.8\" width=\"24.7\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"36.4\" y=\"20.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"37.0\" y=\"20.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"38.3\" y=\"20.8\" width=\"13.4\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"21.3\" width=\"25.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"37.0\" y=\"21.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"21.3\" width=\"12.7\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.3\" y=\"21.8\" width=\"25.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"37.0\" y=\"21.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"37.6\" y=\"21.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"21.8\" width=\"22.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"10.7\" y=\"22.3\" width=\"27.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"37.6\" y=\"22.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"39.5\" y=\"22.3\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"9.4\" y=\"22.8\" width=\"28.4\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"37.6\" y=\"22.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.3\" y=\"22.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"39.5\" y=\"22.8\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"8.8\" y=\"23.3\" width=\"29.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"37.6\" y=\"23.3\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.3\" y=\"23.3\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"39.5\" y=\"23.3\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"8.2\" y=\"23.8\" width=\"29.7\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"37.6\" y=\"23.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.3\" y=\"23.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"39.5\" y=\"23.8\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"7.5\" y=\"24.3\" width=\"30.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"24.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"40.2\" y=\"24.3\" width=\"20.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"6.9\" y=\"24.8\" width=\"31.6\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"24.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.9\" y=\"24.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"40.2\" y=\"24.8\" width=\"20.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"6.3\" y=\"25.3\" width=\"32.2\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"25.3\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"38.9\" y=\"25.3\" width=\"1.5\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"40.2\" y=\"25.3\" width=\"20.9\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"26.3\" width=\"32.8\" height=\"2.2\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"26.3\" width=\"0.8\" height=\"2.2\" fill=\"#686876\"/><rect x=\"38.9\" y=\"26.3\" width=\"1.5\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"40.2\" y=\"26.3\" width=\"20.9\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"28.2\" width=\"30.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.8\" y=\"28.2\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.9\" y=\"28.2\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"40.2\" y=\"28.2\" width=\"20.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"28.7\" width=\"29.7\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.1\" y=\"28.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"35.8\" y=\"28.7\" width=\"4.6\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"40.2\" y=\"28.7\" width=\"20.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"29.2\" width=\"29.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"34.5\" y=\"29.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"35.1\" y=\"29.2\" width=\"5.2\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"40.2\" y=\"29.2\" width=\"20.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"29.7\" width=\"29.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"34.5\" y=\"29.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"35.1\" y=\"29.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"36.4\" y=\"29.7\" width=\"24.7\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"30.2\" width=\"27.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"32.6\" y=\"30.2\" width=\"28.4\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"30.7\" width=\"29.7\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.1\" y=\"30.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"36.4\" y=\"30.7\" width=\"0.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"37.0\" y=\"30.7\" width=\"15.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"30.7\" width=\"9.0\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"31.2\" width=\"30.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.8\" y=\"31.2\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"31.2\" width=\"11.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"50.2\" y=\"31.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"31.2\" width=\"9.0\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"31.7\" width=\"30.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"36.4\" y=\"31.7\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"31.7\" width=\"11.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"50.2\" y=\"31.7\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"31.7\" width=\"9.0\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"32.2\" width=\"30.9\" height=\"2.2\" fill=\"#4a4f63\"/><rect x=\"36.4\" y=\"32.2\" width=\"0.8\" height=\"2.2\" fill=\"#686876\"/><rect x=\"37.0\" y=\"32.2\" width=\"2.1\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"32.2\" width=\"11.5\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"50.2\" y=\"32.2\" width=\"2.1\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"32.2\" width=\"9.0\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"34.2\" width=\"30.9\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"36.4\" y=\"34.2\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"37.0\" y=\"34.2\" width=\"2.1\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"34.2\" width=\"7.1\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"45.8\" y=\"34.2\" width=\"6.5\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"34.2\" width=\"9.0\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"5.6\" y=\"35.2\" width=\"20.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.7\" y=\"35.2\" width=\"10.9\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"36.4\" y=\"35.2\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"37.0\" y=\"35.2\" width=\"2.1\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"35.2\" width=\"7.1\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"45.8\" y=\"35.2\" width=\"5.8\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"51.5\" y=\"35.2\" width=\"3.3\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"35.2\" width=\"6.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"5.6\" y=\"36.2\" width=\"4.6\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"36.2\" width=\"2.1\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"36.2\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"36.2\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"15.7\" y=\"36.2\" width=\"9.6\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"36.2\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.7\" y=\"36.2\" width=\"10.9\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"36.4\" y=\"36.2\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"37.0\" y=\"36.2\" width=\"2.1\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"36.2\" width=\"7.1\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"45.8\" y=\"36.2\" width=\"5.8\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"51.5\" y=\"36.2\" width=\"3.3\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"36.2\" width=\"6.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"5.6\" y=\"37.2\" width=\"4.6\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"37.2\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"37.2\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"37.2\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"37.2\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"37.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"37.2\" width=\"10.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.8\" y=\"37.2\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"37.0\" y=\"37.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"38.9\" y=\"37.2\" width=\"7.1\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"45.8\" y=\"37.2\" width=\"5.8\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"51.5\" y=\"37.2\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"37.2\" width=\"6.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"37.7\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"6.9\" y=\"37.7\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"37.7\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"37.7\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"37.7\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"37.7\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"37.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"37.7\" width=\"10.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"35.8\" y=\"37.7\" width=\"15.9\" height=\"0.7\" fill=\"#686876\"/><rect x=\"51.5\" y=\"37.7\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"37.7\" width=\"6.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"5.6\" y=\"38.2\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"6.9\" y=\"38.2\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"38.2\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"38.2\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"38.2\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"38.2\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"38.2\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"26.4\" y=\"38.2\" width=\"8.4\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"34.5\" y=\"38.2\" width=\"17.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"51.5\" y=\"38.2\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"38.2\" width=\"6.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"5.6\" y=\"38.6\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"6.9\" y=\"38.6\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"38.6\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"38.6\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"38.6\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"38.6\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"38.6\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"27.6\" y=\"38.6\" width=\"5.8\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"33.3\" y=\"38.6\" width=\"18.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"51.5\" y=\"38.6\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"38.6\" width=\"6.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"5.6\" y=\"39.1\" width=\"1.5\" height=\"2.2\" fill=\"#acacba\"/><rect x=\"6.9\" y=\"39.1\" width=\"3.3\" height=\"2.2\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"39.1\" width=\"2.1\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"39.1\" width=\"2.7\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"39.1\" width=\"1.5\" height=\"2.2\" fill=\"#686876\"/><rect x=\"15.7\" y=\"39.1\" width=\"9.6\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"39.1\" width=\"26.6\" height=\"2.2\" fill=\"#686876\"/><rect x=\"51.5\" y=\"39.1\" width=\"3.3\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"39.1\" width=\"6.5\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"5.6\" y=\"41.1\" width=\"1.5\" height=\"2.2\" fill=\"#acacba\"/><rect x=\"6.9\" y=\"41.1\" width=\"3.3\" height=\"2.2\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"41.1\" width=\"2.1\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"41.1\" width=\"2.7\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"41.1\" width=\"1.5\" height=\"2.2\" fill=\"#686876\"/><rect x=\"15.7\" y=\"41.1\" width=\"9.6\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"41.1\" width=\"3.3\" height=\"2.2\" fill=\"#686876\"/><rect x=\"28.2\" y=\"41.1\" width=\"3.3\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"31.4\" y=\"41.1\" width=\"20.3\" height=\"2.2\" fill=\"#686876\"/><rect x=\"51.5\" y=\"41.1\" width=\"3.3\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"41.1\" width=\"6.5\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"5.6\" y=\"43.1\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"6.9\" y=\"43.1\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"43.1\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"43.1\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"43.1\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"43.1\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"43.1\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.2\" y=\"43.1\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"31.4\" y=\"43.1\" width=\"5.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"37.0\" y=\"43.1\" width=\"1.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.3\" y=\"43.1\" width=\"4.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"42.0\" y=\"43.1\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"44.5\" y=\"43.1\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"51.5\" y=\"43.1\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.6\" y=\"43.1\" width=\"6.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"5.6\" y=\"43.6\" width=\"1.5\" height=\"1.2\" fill=\"#acacba\"/><rect x=\"6.9\" y=\"43.6\" width=\"3.3\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"43.6\" width=\"2.1\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"43.6\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"43.6\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"15.7\" y=\"43.6\" width=\"9.6\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"43.6\" width=\"3.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"28.2\" y=\"43.6\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"31.4\" y=\"43.6\" width=\"5.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"37.0\" y=\"43.6\" width=\"1.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"38.3\" y=\"43.6\" width=\"4.0\" height=\"1.2\" fill=\"#686876\"/><rect x=\"42.0\" y=\"43.6\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"44.5\" y=\"43.6\" width=\"7.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"51.5\" y=\"43.6\" width=\"9.6\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"5.6\" y=\"44.6\" width=\"4.6\" height=\"2.7\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"44.6\" width=\"2.1\" height=\"2.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"44.6\" width=\"2.7\" height=\"2.7\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"44.6\" width=\"1.5\" height=\"2.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"44.6\" width=\"8.4\" height=\"2.7\" fill=\"#9a9aa8\"/><rect x=\"23.8\" y=\"44.6\" width=\"13.4\" height=\"2.7\" fill=\"#686876\"/><rect x=\"37.0\" y=\"44.6\" width=\"1.5\" height=\"2.7\" fill=\"#8a8a98\"/><rect x=\"38.3\" y=\"44.6\" width=\"4.0\" height=\"2.7\" fill=\"#686876\"/><rect x=\"42.0\" y=\"44.6\" width=\"2.7\" height=\"2.7\" fill=\"#7c7c8a\"/><rect x=\"44.5\" y=\"44.6\" width=\"7.1\" height=\"2.7\" fill=\"#686876\"/><rect x=\"51.5\" y=\"44.6\" width=\"9.6\" height=\"2.7\" fill=\"#4a4f63\"/><rect x=\"5.6\" y=\"47.1\" width=\"4.6\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"10.0\" y=\"47.1\" width=\"2.1\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"47.1\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"14.4\" y=\"47.1\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"15.7\" y=\"47.1\" width=\"8.4\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"23.8\" y=\"47.1\" width=\"13.4\" height=\"1.2\" fill=\"#686876\"/><rect x=\"37.0\" y=\"47.1\" width=\"1.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"38.3\" y=\"47.1\" width=\"4.0\" height=\"1.2\" fill=\"#686876\"/><rect x=\"42.0\" y=\"47.1\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"44.5\" y=\"47.1\" width=\"2.7\" height=\"1.2\" fill=\"#686876\"/><rect x=\"47.1\" y=\"47.1\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"50.2\" y=\"47.1\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"51.5\" y=\"47.1\" width=\"9.6\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"5.6\" y=\"48.1\" width=\"7.1\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"12.5\" y=\"48.1\" width=\"3.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"15.7\" y=\"48.1\" width=\"8.4\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"23.8\" y=\"48.1\" width=\"13.4\" height=\"1.2\" fill=\"#686876\"/><rect x=\"37.0\" y=\"48.1\" width=\"1.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"38.3\" y=\"48.1\" width=\"4.0\" height=\"1.2\" fill=\"#686876\"/><rect x=\"42.0\" y=\"48.1\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"44.5\" y=\"48.1\" width=\"2.7\" height=\"1.2\" fill=\"#686876\"/><rect x=\"47.1\" y=\"48.1\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"50.2\" y=\"48.1\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"51.5\" y=\"48.1\" width=\"9.6\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"5.6\" y=\"49.1\" width=\"7.1\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"12.5\" y=\"49.1\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"49.1\" width=\"8.4\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"23.8\" y=\"49.1\" width=\"13.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"37.0\" y=\"49.1\" width=\"1.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.3\" y=\"49.1\" width=\"4.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"42.0\" y=\"49.1\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"44.5\" y=\"49.1\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"47.1\" y=\"49.1\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"50.2\" y=\"49.1\" width=\"10.9\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"49.5\" width=\"7.1\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"12.5\" y=\"49.5\" width=\"3.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"15.7\" y=\"49.5\" width=\"8.4\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"23.8\" y=\"49.5\" width=\"9.6\" height=\"1.2\" fill=\"#686876\"/><rect x=\"33.3\" y=\"49.5\" width=\"5.8\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"38.9\" y=\"49.5\" width=\"8.4\" height=\"1.2\" fill=\"#686876\"/><rect x=\"47.1\" y=\"49.5\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"50.2\" y=\"49.5\" width=\"10.9\" height=\"1.2\" fill=\"#686876\"/><rect x=\"5.6\" y=\"50.5\" width=\"10.2\" height=\"0.7\" fill=\"#686876\"/><rect x=\"15.7\" y=\"50.5\" width=\"8.4\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"23.8\" y=\"50.5\" width=\"9.6\" height=\"0.7\" fill=\"#686876\"/><rect x=\"33.3\" y=\"50.5\" width=\"5.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.9\" y=\"50.5\" width=\"8.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"47.1\" y=\"50.5\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"50.2\" y=\"50.5\" width=\"10.9\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"51.0\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"12.5\" y=\"51.0\" width=\"4.0\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"16.3\" y=\"51.0\" width=\"17.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"33.3\" y=\"51.0\" width=\"5.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.9\" y=\"51.0\" width=\"22.2\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"51.5\" width=\"7.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"12.5\" y=\"51.5\" width=\"4.0\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"16.3\" y=\"51.5\" width=\"17.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"33.3\" y=\"51.5\" width=\"5.8\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"38.9\" y=\"51.5\" width=\"15.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"54.0\" y=\"51.5\" width=\"4.6\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"58.4\" y=\"51.5\" width=\"2.7\" height=\"1.2\" fill=\"#686876\"/><rect x=\"5.6\" y=\"52.5\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"12.5\" y=\"52.5\" width=\"4.0\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"16.3\" y=\"52.5\" width=\"14.6\" height=\"0.7\" fill=\"#686876\"/><rect x=\"30.7\" y=\"52.5\" width=\"2.7\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"33.3\" y=\"52.5\" width=\"5.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.9\" y=\"52.5\" width=\"15.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"54.0\" y=\"52.5\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"58.4\" y=\"52.5\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"4.4\" y=\"53.0\" width=\"8.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"12.5\" y=\"53.0\" width=\"4.0\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"16.3\" y=\"53.0\" width=\"13.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"29.5\" y=\"53.0\" width=\"5.2\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"34.5\" y=\"53.0\" width=\"4.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.9\" y=\"53.0\" width=\"15.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"54.0\" y=\"53.0\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"58.4\" y=\"53.0\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"4.4\" y=\"53.5\" width=\"25.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"29.5\" y=\"53.5\" width=\"5.2\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"34.5\" y=\"53.5\" width=\"4.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"38.9\" y=\"53.5\" width=\"15.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"54.0\" y=\"53.5\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"58.4\" y=\"53.5\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"4.4\" y=\"54.0\" width=\"24.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"54.0\" width=\"6.5\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"35.1\" y=\"54.0\" width=\"19.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"54.0\" y=\"54.0\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"58.4\" y=\"54.0\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"4.4\" y=\"54.5\" width=\"24.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"54.5\" width=\"6.5\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"35.1\" y=\"54.5\" width=\"25.9\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"55.0\" width=\"26.6\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"55.0\" width=\"6.5\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"35.1\" y=\"55.0\" width=\"24.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"55.5\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"55.5\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"10.0\" y=\"55.5\" width=\"19.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"55.5\" width=\"6.5\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"35.1\" y=\"55.5\" width=\"24.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"56.0\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"56.0\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"10.0\" y=\"56.0\" width=\"15.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.1\" y=\"56.0\" width=\"4.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"29.5\" y=\"56.0\" width=\"5.2\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"34.5\" y=\"56.0\" width=\"25.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"56.5\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"56.5\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"10.0\" y=\"56.5\" width=\"15.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.1\" y=\"56.5\" width=\"4.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"29.5\" y=\"56.5\" width=\"5.2\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"34.5\" y=\"56.5\" width=\"13.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"47.7\" y=\"56.5\" width=\"4.0\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"51.5\" y=\"56.5\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"57.0\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"5.6\" y=\"57.0\" width=\"4.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"10.0\" y=\"57.0\" width=\"15.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.1\" y=\"57.0\" width=\"5.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"30.7\" y=\"57.0\" width=\"2.7\" height=\"0.7\" fill=\"#cecedc\"/><rect x=\"33.3\" y=\"57.0\" width=\"14.6\" height=\"0.7\" fill=\"#686876\"/><rect x=\"47.7\" y=\"57.0\" width=\"4.0\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"51.5\" y=\"57.0\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"57.5\" width=\"3.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"5.6\" y=\"57.5\" width=\"4.6\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"10.0\" y=\"57.5\" width=\"15.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.1\" y=\"57.5\" width=\"5.8\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"30.7\" y=\"57.5\" width=\"17.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"47.7\" y=\"57.5\" width=\"4.0\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"51.5\" y=\"57.5\" width=\"7.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"2.5\" y=\"58.5\" width=\"22.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.1\" y=\"58.5\" width=\"5.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"30.7\" y=\"58.5\" width=\"17.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"47.7\" y=\"58.5\" width=\"4.0\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"51.5\" y=\"58.5\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"59.0\" width=\"11.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"13.8\" y=\"59.0\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"16.9\" y=\"59.0\" width=\"8.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.1\" y=\"59.0\" width=\"5.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"30.7\" y=\"59.0\" width=\"9.6\" height=\"0.7\" fill=\"#686876\"/><rect x=\"40.2\" y=\"59.0\" width=\"8.4\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"48.3\" y=\"59.0\" width=\"10.2\" height=\"0.7\" fill=\"#686876\"/><rect x=\"2.5\" y=\"59.5\" width=\"11.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"13.8\" y=\"59.5\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"16.9\" y=\"59.5\" width=\"8.4\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.1\" y=\"59.5\" width=\"5.8\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"30.7\" y=\"59.5\" width=\"9.6\" height=\"1.2\" fill=\"#686876\"/><rect x=\"40.2\" y=\"59.5\" width=\"8.4\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"48.3\" y=\"59.5\" width=\"3.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"51.5\" y=\"59.5\" width=\"7.1\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"2.5\" y=\"60.5\" width=\"11.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"13.8\" y=\"60.5\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"16.9\" y=\"60.5\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"19.5\" y=\"60.5\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"22.0\" y=\"60.5\" width=\"4.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"60.5\" width=\"1.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"60.5\" width=\"13.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"40.2\" y=\"60.5\" width=\"8.4\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"48.3\" y=\"60.5\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"51.5\" y=\"60.5\" width=\"7.1\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"2.5\" y=\"60.9\" width=\"10.2\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"12.5\" y=\"60.9\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"13.8\" y=\"60.9\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"16.9\" y=\"60.9\" width=\"2.7\" height=\"1.2\" fill=\"#686876\"/><rect x=\"19.5\" y=\"60.9\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"22.0\" y=\"60.9\" width=\"4.0\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.7\" y=\"60.9\" width=\"1.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"60.9\" width=\"13.4\" height=\"1.2\" fill=\"#686876\"/><rect x=\"40.2\" y=\"60.9\" width=\"8.4\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"48.3\" y=\"60.9\" width=\"3.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"51.5\" y=\"60.9\" width=\"7.1\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"2.5\" y=\"61.9\" width=\"10.2\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"12.5\" y=\"61.9\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"13.8\" y=\"61.9\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"16.9\" y=\"61.9\" width=\"2.7\" height=\"1.2\" fill=\"#686876\"/><rect x=\"19.5\" y=\"61.9\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"22.0\" y=\"61.9\" width=\"4.0\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.7\" y=\"61.9\" width=\"1.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"61.9\" width=\"13.4\" height=\"1.2\" fill=\"#686876\"/><rect x=\"40.2\" y=\"61.9\" width=\"8.4\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"48.3\" y=\"61.9\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"49.6\" y=\"61.9\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"61.9\" width=\"2.1\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"61.9\" width=\"4.6\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"2.5\" y=\"62.9\" width=\"10.2\" height=\"2.7\" fill=\"#4a4f63\"/><rect x=\"12.5\" y=\"62.9\" width=\"7.1\" height=\"2.7\" fill=\"#686876\"/><rect x=\"19.5\" y=\"62.9\" width=\"2.7\" height=\"2.7\" fill=\"#7c7c8a\"/><rect x=\"22.0\" y=\"62.9\" width=\"4.0\" height=\"2.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"62.9\" width=\"1.5\" height=\"2.7\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"62.9\" width=\"13.4\" height=\"2.7\" fill=\"#686876\"/><rect x=\"40.2\" y=\"62.9\" width=\"8.4\" height=\"2.7\" fill=\"#9a9aa8\"/><rect x=\"48.3\" y=\"62.9\" width=\"1.5\" height=\"2.7\" fill=\"#686876\"/><rect x=\"49.6\" y=\"62.9\" width=\"2.7\" height=\"2.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"62.9\" width=\"2.1\" height=\"2.7\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"62.9\" width=\"4.6\" height=\"2.7\" fill=\"#9a9aa8\"/><rect x=\"2.5\" y=\"65.4\" width=\"10.2\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"12.5\" y=\"65.4\" width=\"7.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"19.5\" y=\"65.4\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"22.0\" y=\"65.4\" width=\"4.0\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.7\" y=\"65.4\" width=\"1.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"65.4\" width=\"5.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"32.6\" y=\"65.4\" width=\"3.3\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"35.8\" y=\"65.4\" width=\"3.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"38.9\" y=\"65.4\" width=\"9.6\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"65.4\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"49.6\" y=\"65.4\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"65.4\" width=\"2.1\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"65.4\" width=\"3.3\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"57.1\" y=\"65.4\" width=\"1.5\" height=\"1.2\" fill=\"#acacba\"/><rect x=\"2.5\" y=\"66.4\" width=\"7.1\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"9.4\" y=\"66.4\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"66.4\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"19.5\" y=\"66.4\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"22.0\" y=\"66.4\" width=\"4.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"66.4\" width=\"1.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"66.4\" width=\"5.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"32.6\" y=\"66.4\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"35.8\" y=\"66.4\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.9\" y=\"66.4\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"66.4\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"49.6\" y=\"66.4\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"66.4\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"66.4\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"57.1\" y=\"66.4\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"2.5\" y=\"66.9\" width=\"7.1\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"9.4\" y=\"66.9\" width=\"3.3\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"66.9\" width=\"20.3\" height=\"2.2\" fill=\"#686876\"/><rect x=\"32.6\" y=\"66.9\" width=\"3.3\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"35.8\" y=\"66.9\" width=\"3.3\" height=\"2.2\" fill=\"#686876\"/><rect x=\"38.9\" y=\"66.9\" width=\"9.6\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"66.9\" width=\"1.5\" height=\"2.2\" fill=\"#686876\"/><rect x=\"49.6\" y=\"66.9\" width=\"2.7\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"66.9\" width=\"2.1\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"66.9\" width=\"3.3\" height=\"2.2\" fill=\"#9a9aa8\"/><rect x=\"57.1\" y=\"66.9\" width=\"1.5\" height=\"2.2\" fill=\"#acacba\"/><rect x=\"2.5\" y=\"68.9\" width=\"7.1\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"9.4\" y=\"68.9\" width=\"3.3\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"68.9\" width=\"26.6\" height=\"2.2\" fill=\"#686876\"/><rect x=\"38.9\" y=\"68.9\" width=\"9.6\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"68.9\" width=\"1.5\" height=\"2.2\" fill=\"#686876\"/><rect x=\"49.6\" y=\"68.9\" width=\"2.7\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"68.9\" width=\"2.1\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"68.9\" width=\"3.3\" height=\"2.2\" fill=\"#9a9aa8\"/><rect x=\"57.1\" y=\"68.9\" width=\"1.5\" height=\"2.2\" fill=\"#acacba\"/><rect x=\"2.5\" y=\"70.9\" width=\"7.1\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"9.4\" y=\"70.9\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"70.9\" width=\"18.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"30.7\" y=\"70.9\" width=\"5.8\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"36.4\" y=\"70.9\" width=\"2.7\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.9\" y=\"70.9\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"70.9\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"49.6\" y=\"70.9\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"70.9\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"70.9\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"57.1\" y=\"70.9\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"2.5\" y=\"71.4\" width=\"7.1\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"9.4\" y=\"71.4\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"71.4\" width=\"17.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"29.5\" y=\"71.4\" width=\"8.4\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"37.6\" y=\"71.4\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.9\" y=\"71.4\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"71.4\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"49.6\" y=\"71.4\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"71.4\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"71.4\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"57.1\" y=\"71.4\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"2.5\" y=\"71.8\" width=\"7.1\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"9.4\" y=\"71.8\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"71.8\" width=\"15.9\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.2\" y=\"71.8\" width=\"10.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"71.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.9\" y=\"71.8\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"71.8\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"49.6\" y=\"71.8\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"71.8\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"71.8\" width=\"3.3\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"57.1\" y=\"71.8\" width=\"1.5\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"2.5\" y=\"72.3\" width=\"7.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"9.4\" y=\"72.3\" width=\"3.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"72.3\" width=\"5.8\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"18.2\" y=\"72.3\" width=\"7.1\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"72.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"72.3\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.2\" y=\"72.3\" width=\"10.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"72.3\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"38.9\" y=\"72.3\" width=\"9.6\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"72.3\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"49.6\" y=\"72.3\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"72.3\" width=\"2.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"72.3\" width=\"4.6\" height=\"0.7\" fill=\"#9a9aa8\"/><rect x=\"2.5\" y=\"72.8\" width=\"7.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"9.4\" y=\"72.8\" width=\"3.3\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"72.8\" width=\"5.8\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"18.2\" y=\"72.8\" width=\"7.1\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"72.8\" width=\"2.1\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"72.8\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"27.6\" y=\"72.8\" width=\"10.9\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"72.8\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"38.9\" y=\"72.8\" width=\"9.6\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"48.3\" y=\"72.8\" width=\"1.5\" height=\"1.2\" fill=\"#686876\"/><rect x=\"49.6\" y=\"72.8\" width=\"2.7\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"52.1\" y=\"72.8\" width=\"2.1\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"54.0\" y=\"72.8\" width=\"4.6\" height=\"1.2\" fill=\"#9a9aa8\"/><rect x=\"2.5\" y=\"73.8\" width=\"7.1\" height=\"1.2\" fill=\"#686876\"/><rect x=\"9.4\" y=\"73.8\" width=\"3.3\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"12.5\" y=\"73.8\" width=\"5.8\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"18.2\" y=\"73.8\" width=\"7.1\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"73.8\" width=\"2.1\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"73.8\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"27.6\" y=\"73.8\" width=\"10.9\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"38.3\" y=\"73.8\" width=\"20.3\" height=\"1.2\" fill=\"#686876\"/><rect x=\"2.5\" y=\"74.8\" width=\"9.6\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"74.8\" width=\"6.5\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"18.2\" y=\"74.8\" width=\"7.1\" height=\"1.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"74.8\" width=\"2.1\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"74.8\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"27.6\" y=\"74.8\" width=\"30.9\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"75.8\" width=\"9.6\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"75.8\" width=\"2.1\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"13.8\" y=\"75.8\" width=\"11.5\" height=\"2.2\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"75.8\" width=\"2.1\" height=\"2.2\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"75.8\" width=\"0.8\" height=\"2.2\" fill=\"#686876\"/><rect x=\"27.6\" y=\"75.8\" width=\"30.3\" height=\"2.2\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"77.8\" width=\"9.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"77.8\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"13.8\" y=\"77.8\" width=\"11.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"77.8\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"27.6\" y=\"77.8\" width=\"30.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"78.3\" width=\"9.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"78.3\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"13.8\" y=\"78.3\" width=\"11.5\" height=\"0.7\" fill=\"#2f4a33\"/><rect x=\"25.1\" y=\"78.3\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"28.2\" y=\"78.3\" width=\"30.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"78.8\" width=\"9.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"11.9\" y=\"78.8\" width=\"15.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"78.8\" width=\"0.8\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"78.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"28.9\" y=\"78.8\" width=\"29.7\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"79.3\" width=\"29.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"31.4\" y=\"79.3\" width=\"27.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"79.8\" width=\"25.3\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"79.8\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"28.9\" y=\"79.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"29.5\" y=\"79.8\" width=\"29.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"80.3\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"80.3\" width=\"5.2\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"28.9\" y=\"80.3\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"29.5\" y=\"80.3\" width=\"29.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"80.8\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"80.8\" width=\"4.6\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"28.2\" y=\"80.8\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"80.8\" width=\"29.7\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"81.3\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"81.3\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"25.1\" y=\"81.3\" width=\"3.3\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.2\" y=\"81.3\" width=\"30.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"81.8\" width=\"21.5\" height=\"1.2\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"81.8\" width=\"1.5\" height=\"1.2\" fill=\"#7c7c8a\"/><rect x=\"25.1\" y=\"81.8\" width=\"0.8\" height=\"1.2\" fill=\"#686876\"/><rect x=\"25.7\" y=\"81.8\" width=\"32.8\" height=\"1.2\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"82.7\" width=\"21.5\" height=\"1.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"82.7\" width=\"1.5\" height=\"1.7\" fill=\"#7c7c8a\"/><rect x=\"25.1\" y=\"82.7\" width=\"0.8\" height=\"1.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"82.7\" width=\"32.2\" height=\"1.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"84.2\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"84.2\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"25.1\" y=\"84.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"84.2\" width=\"31.6\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"84.7\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"84.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"25.1\" y=\"84.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"25.7\" y=\"84.7\" width=\"30.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"85.2\" width=\"21.5\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"23.8\" y=\"85.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"25.7\" y=\"85.2\" width=\"30.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"85.7\" width=\"22.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"24.5\" y=\"85.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"25.7\" y=\"85.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"26.4\" y=\"85.7\" width=\"29.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"86.2\" width=\"22.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"24.5\" y=\"86.2\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"25.7\" y=\"86.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"26.4\" y=\"86.2\" width=\"28.4\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"86.7\" width=\"22.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"24.5\" y=\"86.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"25.7\" y=\"86.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"26.4\" y=\"86.7\" width=\"27.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"2.5\" y=\"87.2\" width=\"22.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"24.5\" y=\"87.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"26.4\" y=\"87.2\" width=\"26.6\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"11.9\" y=\"87.7\" width=\"13.4\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"25.1\" y=\"87.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"26.4\" y=\"87.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"27.0\" y=\"87.7\" width=\"25.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"11.9\" y=\"88.2\" width=\"13.4\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"25.1\" y=\"88.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"88.2\" width=\"25.3\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"11.9\" y=\"88.7\" width=\"14.0\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"25.7\" y=\"88.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"27.0\" y=\"88.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"27.6\" y=\"88.7\" width=\"24.0\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"11.9\" y=\"89.2\" width=\"14.0\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"25.7\" y=\"89.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"27.6\" y=\"89.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.2\" y=\"89.2\" width=\"22.8\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"11.9\" y=\"89.7\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"26.4\" y=\"89.7\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"28.2\" y=\"89.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"28.9\" y=\"89.7\" width=\"22.2\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"12.5\" y=\"90.2\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"90.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"28.9\" y=\"90.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"29.5\" y=\"90.2\" width=\"20.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"13.2\" y=\"90.7\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"90.7\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"29.5\" y=\"90.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"30.1\" y=\"90.7\" width=\"19.7\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"13.8\" y=\"91.2\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"28.2\" y=\"91.2\" width=\"2.1\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"30.1\" y=\"91.2\" width=\"2.1\" height=\"0.7\" fill=\"#686876\"/><rect x=\"32.0\" y=\"91.2\" width=\"17.1\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"14.4\" y=\"91.7\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"28.9\" y=\"91.7\" width=\"3.3\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"32.0\" y=\"91.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"32.6\" y=\"91.7\" width=\"15.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"15.7\" y=\"92.2\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"30.1\" y=\"92.2\" width=\"2.7\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"32.6\" y=\"92.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"33.3\" y=\"92.2\" width=\"13.4\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"16.3\" y=\"92.7\" width=\"15.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"32.0\" y=\"92.7\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"33.3\" y=\"92.7\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"33.9\" y=\"92.7\" width=\"10.9\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"16.9\" y=\"93.2\" width=\"14.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"31.4\" y=\"93.2\" width=\"1.5\" height=\"0.7\" fill=\"#686876\"/><rect x=\"32.6\" y=\"93.2\" width=\"1.5\" height=\"0.7\" fill=\"#7c7c8a\"/><rect x=\"33.9\" y=\"93.2\" width=\"9.0\" height=\"0.7\" fill=\"#686876\"/><rect x=\"42.7\" y=\"93.2\" width=\"0.8\" height=\"0.7\" fill=\"#4a4f63\"/><rect x=\"43.3\" y=\"93.2\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"16.9\" y=\"93.6\" width=\"10.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"93.6\" width=\"7.7\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"35.1\" y=\"93.6\" width=\"8.4\" height=\"0.7\" fill=\"#686876\"/><rect x=\"16.9\" y=\"94.1\" width=\"10.9\" height=\"2.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"94.1\" width=\"7.7\" height=\"2.7\" fill=\"#acacba\"/><rect x=\"35.1\" y=\"94.1\" width=\"7.7\" height=\"2.7\" fill=\"#686876\"/><rect x=\"16.9\" y=\"96.6\" width=\"10.9\" height=\"2.2\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"96.6\" width=\"8.4\" height=\"2.2\" fill=\"#acacba\"/><rect x=\"35.8\" y=\"96.6\" width=\"7.1\" height=\"2.2\" fill=\"#686876\"/><rect x=\"16.9\" y=\"98.6\" width=\"10.9\" height=\"1.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"98.6\" width=\"8.4\" height=\"1.7\" fill=\"#acacba\"/><rect x=\"35.8\" y=\"98.6\" width=\"6.5\" height=\"1.7\" fill=\"#686876\"/><rect x=\"16.9\" y=\"100.1\" width=\"10.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"100.1\" width=\"8.4\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"35.8\" y=\"100.1\" width=\"5.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"16.9\" y=\"100.6\" width=\"10.9\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.6\" y=\"100.6\" width=\"8.4\" height=\"0.7\" fill=\"#acacba\"/><rect x=\"35.8\" y=\"100.6\" width=\"5.2\" height=\"0.7\" fill=\"#686876\"/><rect x=\"16.9\" y=\"101.1\" width=\"10.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"27.0\" y=\"101.1\" width=\"0.8\" height=\"0.7\" fill=\"#686876\"/><rect x=\"16.9\" y=\"101.6\" width=\"10.2\" height=\"3.7\" fill=\"#8a8a98\"/><rect x=\"17.6\" y=\"105.0\" width=\"9.6\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"17.6\" y=\"105.5\" width=\"9.0\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"18.2\" y=\"106.0\" width=\"8.4\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"18.8\" y=\"106.5\" width=\"7.1\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"19.5\" y=\"107.0\" width=\"5.2\" height=\"0.7\" fill=\"#8a8a98\"/><rect x=\"20.7\" y=\"107.5\" width=\"2.7\" height=\"0.7\" fill=\"#8a8a98\"/><circle cx=\"22.2\" cy=\"103.5\" r=\"4.5\" fill=\"var(--c0)\" stroke=\"#111\" stroke-width=\"1.5\"/><circle cx=\"41.8\" cy=\"6.5\" r=\"4.5\" fill=\"var(--c1)\" stroke=\"#111\" stroke-width=\"1.5\"/></svg>"};
function renderMaps() {
  const cur = MAP_ID;
  $('titleMapThumb').innerHTML = MAP_THUMB[cur] || ''; $('titleMapName').textContent = MAP.name; $('titleMapSub').textContent = '涂地对战 · 4 V 4 · ' + MAP.en;
  $('lobbySub').textContent = '涂地对战 · ' + MAP.name;
  const sel = cur;
  $('mapCards').innerHTML = Object.values(MAP_LIST).map(m => `<button class="mscard${m.id === sel ? ' sel' : ''}" data-id="${m.id}"><span class="mt">${MAP_THUMB[m.id] || ''}</span><span class="mn"><b>${m.name}</b><small>${m.en}</small><em>${m.desc}</em><span class="chips"><span class="sz">${m.size || ''}</span>${(m.tags || []).map(t => `<span>${t}</span>`).join('')}</span></span>${m.id === cur ? '<i class="mon">当前</i>' : ''}</button>`).join('');
  $('mapCards').querySelectorAll('.mscard').forEach(el => { el.onclick = () => { Sfx.init(); Sfx.click(); if (el.dataset.id !== MAP_ID) switchMap(el.dataset.id); }; el.ondblclick = () => { if (el.dataset.id === MAP_ID) mapSelNext(); }; });
}
// the lobby and map select are laid out for ~1500 x 860: on a smaller window shrink them as a whole instead of squeezing
function fitMenus() { const k = Math.min(1, innerWidth / 1500, innerHeight / 860); ['lobby', 'mapsel'].forEach(id => { const el = $(id); if (el) el.style.zoom = k < 0.999 ? k.toFixed(3) : ''; }); }
addEventListener('resize', fitMenus);
// map select screen: title -> pick a map (the background turns into it straight away) -> lobby
function openMapSel() { renderMaps(); show('title', false); show('lobby', false); show('results', false); show('mapsel', true); }
function mapSelNext() { Sfx.init(); Sfx.click(); show('mapsel', false); openLobby(); }
// switch map in place: no page reload, the new park simply replaces the old one behind the menus
function switchMap(id) {
  if (!MAP_LIST[id] || id === MAP_ID) return;
  try { localStorage.setItem(MAP_KEY, id); } catch (e) { }
  const fade = mapFadeHold();
  loadMap(id); renderMaps();
  fade();
}
// cross-fade between maps: freeze the current view on an overlay, build the new map under it, then let the overlay dissolve
function mapFadeHold() {
  const f = $('glFade'), gl = renderer.domElement; let ok = false;
  try { renderer.render(scene, camera); f.width = gl.width; f.height = gl.height; f.getContext('2d').drawImage(gl, 0, 0); ok = true; } catch (e) { }
  if (!ok) return () => { };
  clearTimeout(mapFadeHold.t); f.style.transition = 'none'; f.style.display = 'block'; f.style.opacity = 1; f.style.transform = 'scale(1)';
  return () => {
    const go = () => {
      f.style.transition = 'opacity .75s cubic-bezier(.4,0,.2,1), transform 1s cubic-bezier(.2,.7,.2,1)'; f.style.opacity = 0; f.style.transform = 'scale(1.06)';
      clearTimeout(mapFadeHold.t); mapFadeHold.t = setTimeout(() => { f.style.display = 'none'; }, 1100);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go)); else go();   // two frames: the new map is on screen under the overlay before it starts to fade
  };
}
// tear down the map-specific scene (arena, sea / plaza, decor) and build the chosen map's
function loadMap(id) {
  resetToAttract(); Fx.clear(); Proj.clear();
  const keep = new Set(Object.values(TEX)); for (const k in MAP_CACHE) if (MAP_CACHE[k].layout) keep.add(MAP_CACHE[k].layout);
  (WORLD.objs || []).forEach(o => {
    scene.remove(o);
    o.traverse(m => {
      if (m.geometry) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      mats.forEach(mt => { for (const k in mt) { const v = mt[k]; if (v && v.isTexture && !keep.has(v)) v.dispose(); } mt.dispose(); });
    });
  });
  Object.assign(WORLD, { objs: [], spawnFx: [], buoys: [], sea: null, flags: null });
  setMap(id);
  defineMap();
  TEX.layout = layoutTex();
  initPaint();
  buildWorld();
  initNav(); HUD.init();
  Barrier.meshes.forEach((m, t) => m.position.set(SPAWN[t].x, BARRIER_H / 2 - 0.05, SPAWN[t].z));
  G.roster = null;                // (the title camera keeps orbiting where it was, so the two maps line up through the cross-fade)
  applyPalette(); resetPaint();
  renderer.compile(scene, camera);
}
// the map-specific part of the scene; remembered so a map switch can take it down again
function buildWorld() {
  const before = new Set(scene.children);
  buildSea(); buildArena(); buildDecor();
  WORLD.objs = scene.children.filter(o => !before.has(o));
}
// feedback for pressing Enter in the name box.  One special name switches mode A on: the box fills with running ink, a
// stamp slams onto it, splats fly out across the screen, the park behind gets drenched in both colours, and a rising jingle plays.
// Changing it back makes the stamp fall off.  Any other name just gets a small "saved" pulse.
function nameConfirm() {
  const w = $('pnameWrap'), inp = $('pname'); Sfx.init();
  const cls = (...c) => { w.classList.remove('shake', 'slam', 'drop', 'ok'); void w.offsetWidth; c.forEach(k => w.classList.add(k)); };
  // her code: the letters turn into her name one by one, then the welcome plays
  if (isVipCode(GAME.name)) { vipWelcome(); return; }
  if (Profile.data.vip && GAME.name !== VIP_NAME) { Profile.data.vip = null; Profile.save(); }
  const on = devGod(), vip = vipOn(), was = G.modeWas || '', now = on ? 'dev' : vip ? 'vip' : ''; G.modeWas = now;
  w.classList.toggle('dev', on); w.classList.toggle('vip', vip);
  if (vip) { vipWelcome(); return; }                                     // Enter again on her name: play it again
  if (!now && !was) { cls('ok'); Sfx.click(); return; }
  if (!now) { w.classList.add(was === 'vip' ? 'wasVip' : 'wasDev'); cls('drop'); Sfx.cheat(false); setTimeout(() => w.classList.remove('drop', 'wasVip', 'wasDev'), 750); return; }
  cls('shake', 'slam'); Sfx.cheat(true); flash(0.55);
  // ink splats bursting out from the name box, and the words
  try {
    const fx = $('devFx'), r = $('pname').getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2; fx.innerHTML = ''; fx.className = '';
    const cols = [TEAM_HEX[0], TEAM_HEX[1], '#ffe45c'];
    for (let i = 0; i < 14; i++) {
      const x = rand(0.04, 0.9) * innerWidth, y = rand(0.04, 0.86) * innerHeight, sz = rand(90, 260), c = cols[i % 3];
      let d = ''; for (let a = 0; a < 6.28; a += 0.16) { const rr = 36 * (1 + 0.22 * Math.sin(a * 3 + i) + 0.13 * Math.sin(a * 7 + i * 2) + 0.06 * Math.sin(a * 13 + i)); d += (a ? 'L' : 'M') + (50 + Math.cos(a) * rr).toFixed(1) + ' ' + (50 + Math.sin(a) * rr).toFixed(1); }
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.setAttribute('viewBox', '0 0 100 100'); el.setAttribute('width', sz); el.setAttribute('height', sz);
      el.innerHTML = `<path d="${d}Z" fill="${c}" stroke="#111" stroke-width="3" stroke-linejoin="round"/><circle cx="${rand(8, 22).toFixed(0)}" cy="${rand(12, 30).toFixed(0)}" r="${rand(3, 7).toFixed(0)}" fill="${c}" stroke="#111" stroke-width="2.5"/><circle cx="${rand(80, 92).toFixed(0)}" cy="${rand(70, 88).toFixed(0)}" r="${rand(2, 5).toFixed(0)}" fill="${c}" stroke="#111" stroke-width="2.5"/>`;
      el.style.left = x - sz / 2 + 'px'; el.style.top = y - sz / 2 + 'px'; el.style.setProperty('--fx', (ox - x).toFixed(0) + 'px'); el.style.setProperty('--fy', (oy - y).toFixed(0) + 'px'); el.style.setProperty('--fr', rand(-40, 40).toFixed(0) + 'deg'); el.style.animationDelay = (i * 0.035).toFixed(2) + 's';
      fx.appendChild(el);
    }
    const word = document.createElement('div'); word.className = 'devWord'; word.innerHTML = '墨水管够！<small>开发者模式 · 不掉血 · 墨水无限</small>'; fx.appendChild(word);
    clearTimeout(nameConfirm.t); nameConfirm.t = setTimeout(() => { fx.innerHTML = ''; }, 2200);
  } catch (e) { }
  // and the park behind the menu takes a soaking
  if (G.state === 'title') for (let i = 0; i < 46; i++) setTimeout(() => { if (G.state !== 'title') return; const x = rand(-XH + 1, XH - 1), z = rand(-ZH + 1, ZH - 1), tm = i % 2, y = groundAt(x, z); splatFloor(x, y, z, rand(2.2, 4.6), tm, 0.5, true); Fx.burst(x, y + 0.3, z, TEAM_HEX[tm], 14, 7, 0.22); }, i * 22);
}
// Karita's welcome.  Her code in the name box: the letters flip into "Karita" one at a time (a soft tick each), the box turns rose,
// a heart stamp lands on it; then hearts of ink float up the screen, "欢迎回来，Karita" writes itself across the middle with what the
// mode gives her underneath, a music-box tune plays, and on the park behind the menu a big heart is painted splat by splat.
function vipWelcome() {
  const w = $('pnameWrap'), inp = $('pname'), from = String(inp.value || ''), flip = isVipCode(from);
  GAME.name = VIP_NAME; Profile.data.vip = VIP_NAME; Profile.save(); G.modeWas = 'vip'; Sfx.init();
  w.classList.remove('dev', 'shake', 'slam', 'drop', 'ok'); void w.offsetWidth;
  const show = () => {
    inp.value = VIP_NAME; w.classList.add('vip', 'slam'); Sfx.welcome(); flash(0.35);
    try {
      const fx = $('devFx'); fx.innerHTML = ''; fx.className = 'vipFx';
      const heart = 'M50 86 C20 62 6 44 6 28 C6 14 17 6 28 6 C38 6 46 12 50 21 C54 12 62 6 72 6 C83 6 94 14 94 28 C94 44 80 62 50 86Z', cols = ['#ff5a8a', '#ff8fb1', TEAM_HEX[0], '#ffe45c', '#ffffff'];
      for (let i = 0; i < 26; i++) {
        const sz = rand(34, 120), el = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.setAttribute('viewBox', '0 0 100 100'); el.setAttribute('width', sz); el.setAttribute('height', sz);
        el.innerHTML = `<path d="${heart}" fill="${cols[i % cols.length]}" stroke="#111" stroke-width="5" stroke-linejoin="round"/><ellipse cx="30" cy="26" rx="9" ry="6" fill="rgba(255,255,255,.7)" transform="rotate(-30 30 26)"/>`;
        el.style.left = rand(2, 94) + 'vw'; el.style.setProperty('--sw', rand(-40, 40).toFixed(0) + 'px'); el.style.setProperty('--fr', rand(-25, 25).toFixed(0) + 'deg'); el.style.animationDelay = (i * 0.07).toFixed(2) + 's'; el.style.animationDuration = rand(2.4, 3.6).toFixed(2) + 's';
        fx.appendChild(el);
      }
      const word = document.createElement('div'); word.className = 'vipWord';
      word.innerHTML = '<i>欢迎回来</i><b>' + VIP_NAME.split('').map((ch, i) => `<span style="animation-delay:${(0.35 + i * 0.09).toFixed(2)}s">${ch}</span>`).join('') + '<em>♥</em></b><small>专属模式已开启 · 血量 ×' + VIP_HP + ' · 墨水 ×' + VIP_INK + '</small><u>这片场地，今天都是你的颜色</u>';
      fx.appendChild(word);
      clearTimeout(nameConfirm.t); nameConfirm.t = setTimeout(() => { fx.innerHTML = ''; fx.className = ''; }, 4200);
    } catch (e) { }
    // a heart painted on the park, one splat after another (outline first, then filled in)
    if (G.state === 'title') {
      resetPaint(); const R = Math.min(XH, ZH) * 0.5, pts = [];
      for (let k = 0; k < 44; k++) { const t = k / 44 * Math.PI * 2; pts.push([16 * Math.pow(Math.sin(t), 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17, 2.6]); }
      for (let k = 0; k < 40; k++) { const t = rand(0, Math.PI * 2), q = Math.sqrt(rand(0, 1)) * 0.85; pts.push([16 * Math.pow(Math.sin(t), 3) / 17 * q, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 * q, 3.4]); }
      pts.forEach(([hx, hz, r], i) => setTimeout(() => { if (G.state !== 'title') return; const x = hx * R, z = hz * R * 1.05, y = groundAt(x, z); if (Math.abs(x) > XH - 1 || Math.abs(z) > ZH - 1) return; splatFloor(x, y, z, r, 0, 0.5, true); if (i % 3 === 0) Fx.burst(x, y + 0.3, z, '#ff8fb1', 8, 5, 0.2); }, 500 + i * 28));
    }
  };
  if (!flip) { show(); return; }
  // the typed letters turn into the name, one at a time
  let i = 0; const step = () => { i++; inp.value = VIP_NAME.slice(0, i) + from.slice(i); Sfx.tick(i); w.classList.remove('ok'); void w.offsetWidth; w.classList.add('ok'); if (i < VIP_NAME.length) vipWelcome.t = setTimeout(step, 110); else vipWelcome.t = setTimeout(show, 260); };
  inp.value = from; clearTimeout(vipWelcome.t);
  if (typeof setTimeout !== 'function') { show(); return; }
  vipWelcome.t = setTimeout(step, 120);
}
// replay the entrance animations of the visible page (bars fill, numbers count up)
function lobbyAnimate() {
  const pg = $({ char: 'pgChar', weap: 'pgWeap', sub: 'pgSub' }[G.lobbyTab || 'char']); if (!pg) return;
  pg.classList.remove('anim'); void pg.offsetWidth; pg.classList.add('anim');
  const nums = pg.querySelectorAll ? pg.querySelectorAll('em[data-n]') : [];
  nums.forEach(el => { const n = +el.dataset.n, u = el.dataset.u; let t0 = null; const step = ts => { if (t0 === null) t0 = ts; const k = Math.min(1, (ts - t0) / 450), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(n * e) + u; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
}
function renderLoadCard() {
  const w = WEAPONS[Profile.data.weapon], C = CHARACTERS[Profile.data.char];
  $('lcIcon').innerHTML = charIcon(C.id, 58) + `<span class="lcw">${weaponIcon(w.id, '#fff', 40)}</span>`; $('lcName').textContent = C.name + ' · ' + w.name; $('lcRole').textContent = C.role + ' / ' + w.role;
  $('lcKit').textContent = SUBS[C.sub || w.sub].name + ' · ' + SPECIALS[w.special].name;
}
/* ------------------------------------------------ lobby sub-weapon demo
   A short looping clip played live in the preview: the chosen character
   uses its sub weapon on a training dummy. Same models as the match, but
   its own tiny effects (pooled decals / droplets) so the real paint grid
   and effect pools are never touched.                                 */
const DEMO_A = new THREE.Vector3(-1.3, 0, 0.55), DEMO_D = new THREE.Vector3(1.45, 0, -0.85);
const SubDemo = {
  t: -0.4, f: {},
  init(sc) {
    this.sc = sc; const g = this.g = new THREE.Group(); sc.add(g); g.visible = false;
    this.decalGeo = new THREE.CircleGeometry(1, 16); this.decalM = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
    this.decals = []; for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(this.decalGeo, this.decalM[0]); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; g.add(m); this.decals.push(m); }
    this.dn = 0;
    this.partGeo = new THREE.IcosahedronGeometry(1, 1); this.parts = [];
    for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(this.partGeo, TEAMMAT[0]); m.visible = false; g.add(m); this.parts.push({ m, v: new THREE.Vector3(), life: 0 }); }
    this.ballM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }); this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), this.ballM); this.ball.visible = false; g.add(this.ball);
    this.ball2M = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }); this.ball2 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.ball2M); this.ball2.visible = false; g.add(this.ball2);
    this.ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }); this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), this.ringM); this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; g.add(this.ring);
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); this.beamGeo.rotateX(Math.PI / 2); this.beamGeo.translate(0, 0, 0.5);
    this.beams = [0, 1, 2].map(() => { const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); m.visible = false; g.add(m); return m; });
    this.bullets = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(GEO.sphere, TEAMMAT[1]); m.visible = false; g.add(m); this.bullets.push({ m, on: false }); }
    const cu = Proj.curlMesh(0); this.curl = cu.g; this.curlLight = cu.light; this.curl.visible = false; g.add(this.curl);
    const bo = Proj.bombMesh(0); this.bomb = bo.g; this.bombLight = bo.light; this.bomb.visible = false; this.bomb.scale.setScalar(1.3); g.add(this.bomb);
    this.pv = { team: 0 };
  },
  // actors: the previewed character + a training dummy on the enemy team
  setup(c) {
    this.c = c;
    if (!this.dummy) {
      const d = new Character('dummy', 1, true, { weapon: 'rifle', char: 'dummy' });
      scene.remove(d.root); scene.remove(d.ghost); if (d.laser) scene.remove(d.laser, d.laserDot);
      d.pos.copy(DEMO_D); d.grounded = true; d.state = 'play'; d.lastShot = -99; this.g.add(d.root); this.dummy = d;
    }
    const sub = c.subId || 'bomb';
    if (sub !== this.sub) { this.sub = sub; this.restart(); }
    if (sub === 'cover' && !this.board) { const b = Cover.build(0); this.board = b.g; this.boardFace = b.face; this.board.visible = false; this.g.add(this.board); this.boardDecals = []; }
  },
  restart() { this.t = -0.35; this.f = {}; this.clearFx(true); },
  // squid form on/off for the demo (the squid stays visible, gliding through the ink)
  setSw(c, on) { if (!!c._dsw === on) return; c._dsw = on; c.swim = on; c.submerged = false; c.human.visible = !on; c.blob.visible = on; c.swimPop = 1; if (on) this.burst(c.pos.clone().setY(0.3), c.team, 6, 2.5, 0.07); },
  once(k, at) { if (this.t >= at && !this.f[k]) { this.f[k] = 1; return true; } return false; },
  colors() { this.decalM.forEach((m, t) => m.color.set(TEAM_HEX[t])); },
  // ---- tiny effects
  decal(x, z, r, team) { const m = this.decals[this.dn++ % this.decals.length]; m.material = this.decalM[team]; m.visible = true; m.position.set(x, 0.012 + (this.dn % 23) * 0.0007, z); m.scale.setScalar(r); m.userData.r = r; },
  splat(x, z, r, team) { this.decal(x, z, r, team); const n = 4 + Math.round(r * 3); for (let k = 0; k < n; k++) { const a = rand(0, 6.28), d = r * rand(0.75, 1.25); this.decal(x + Math.cos(a) * d, z + Math.sin(a) * d, r * rand(0.16, 0.34), team); } },
  burst(p, team, n, sp, size, up = 0.5) {
    for (let i = 0; i < n; i++) {
      const q = this.parts.find(q => q.life <= 0) || this.parts[i % this.parts.length];
      const a = rand(0, 6.28), u = rand(-0.1, 1), s = sp * rand(0.35, 1);
      q.m.material = TEAMMAT[team]; q.m.visible = true; q.m.position.copy(p); q.v.set(Math.cos(a) * s * 0.8, u * s * up + s * 0.35, Math.sin(a) * s * 0.8); q.life = q.max = rand(0.35, 0.75); q.s = size * rand(0.6, 1.3);
    }
  },
  boom(p, team, R) {
    this.ball.visible = this.ball2.visible = this.ring.visible = true; this.boomT = 0; this.boomR = R;
    this.ballM.color.set(TEAM_HEX[team]); this.ball2M.color.set('#ffffff'); this.ringM.color.set(TEAM_HEX[team]);
    this.ball.position.copy(p); this.ball2.position.copy(p); this.ring.position.set(p.x, 0.03, p.z);
    this.burst(p, team, 34, 6, 0.1, 0.8); this.splat(p.x, p.z, R * 0.55, team);
    const v = 0.35; Sfx.boom(v);
  },
  beam(i, a, b, team, w, op = 1) { const m = this.beams[i]; m.visible = true; m.material.color.set(team < 0 ? '#ffffff' : TEAM_HEX[team]); m.material.opacity = op; m.position.copy(a); m.lookAt(b); m.scale.set(w, w, a.distanceTo(b)); },
  hitDummy(dir, big) { const d = this.dummy; d.hurtFlash = 0.14; d.flinch = 1; d.flinchDir = dir.clone(); this.burst(d.pos.clone().setY(1.0), 0, big ? 22 : 12, big ? 5 : 3.5, 0.09); },
  clearFx(all) {
    this.decals.forEach(m => m.visible = false); this.parts.forEach(q => { q.life = 0; q.m.visible = false; });
    [this.ball, this.ball2, this.ring, this.curl, this.bomb].forEach(m => m && (m.visible = false)); this.beams.forEach(m => m.visible = false); this.bullets.forEach(b => { b.on = false; b.m.visible = false; });
    if (this.board) { this.board.visible = false; (this.boardDecals || []).forEach(m => this.board.remove(m)); this.boardDecals = []; }
    if (this.c) { this.setSw(this.c, false); this.c.charging = false; this.c.charge = 0; }
  },
  // ---- per-frame
  update(dt, vis) {
    const c = this.c, d = this.dummy; if (!c || !d) return;
    this.g.visible = vis > 0.01; if (!this.g.visible) return;
    this.colors();
    const dir = DEMO_D.clone().sub(DEMO_A).setY(0).normalize(), yaw = Math.atan2(dir.x, dir.z), pk = clamp((vis - 0.35) / 0.65, 0, 1);
    // dummy pops onto the stage, faces the character
    const dk = pk <= 0 ? 0 : 1 + 2.2 * Math.pow(pk - 1, 3) + 1.2 * Math.pow(pk - 1, 2); d.root.visible = pk > 0.01;
    d.bodyYaw = d.aimYaw = yaw + Math.PI; d.aimPitch = -0.35; d.pos.copy(DEMO_D);
    if (vis >= 0.99) this.t += dt;
    const t = this.t, S = this.sub;
    this.wantSwim = false; c.lastShot = -99; c.aimPitch = -0.3; c.bodyYaw = c.aimYaw = yaw; c.vel.set(0, 0, 0);
    let cp = DEMO_A.clone();
    if (S === 'curling') cp = this.runCurling(dt, t, dir, c, d);
    else if (S === 'cover') this.runCover(dt, t, dir, c, d);
    else this.runBomb(dt, t, dir, c, d);
    // loop
    const L = { curling: 3.6, cover: 4.1, bomb: 3.6 }[S] || 3.6;
    if (t > L - 0.45) { const k = clamp((L - t) / 0.45, 0, 1); this.decals.forEach(m => { if (m.visible) m.scale.setScalar(m.userData.r * k); }); }
    if (t > L) this.restart();
    c.pos.copy(cp); this.setSw(c, this.wantSwim);
    // particles / explosion
    for (const q of this.parts) { if (q.life <= 0) continue; q.life -= dt; if (q.life <= 0) { q.m.visible = false; continue; } q.v.y -= 16 * dt; q.m.position.addScaledVector(q.v, dt); if (q.m.position.y < 0.02) { q.m.position.y = 0.02; q.v.set(0, 0, 0); } q.m.scale.setScalar(q.s * Math.min(1, q.life / q.max * 1.6)); }
    if (this.ball.visible) {
      this.boomT += dt; const k = this.boomT / 0.3;
      if (k >= 1) this.ball.visible = this.ball2.visible = false;
      else { const e = 0.35 + 0.65 * (1 - Math.pow(1 - k, 2)); this.ball.scale.setScalar(this.boomR * e); this.ball2.scale.setScalar(this.boomR * 0.55 * e); this.ballM.opacity = 0.75 * (1 - k); this.ball2M.opacity = 0.8 * (1 - k); }
      const kr = this.boomT / 0.5; if (kr >= 1) this.ring.visible = false; else { this.ring.scale.setScalar(this.boomR * 1.6 * (0.3 + 0.7 * (1 - Math.pow(1 - kr, 3)))); this.ringM.opacity = 0.9 * (1 - kr); }
    }
    d.hurtFlash = Math.max(0, (d.hurtFlash || 0) - dt); d.syncModel(dt); d.root.scale.setScalar(Math.max(0.001, dk));
    d.arms[1].rotation.set(0.12, 0, 0.14);
  },
  // 阿飒: curling slides out laying ink, she swims right behind it, it blows up on the dummy
  runCurling(dt, t, dir, c, d) {
    const sp = 3.6, start = DEMO_A.clone().addScaledVector(dir, 0.6);
    if (this.once('throw', 0.2)) { this.curl.visible = true; this.curl.position.copy(start); this.lastDecal = start.clone(); c.recoil = 2; Sfx.throwB(0.4); }
    let cp = DEMO_A.clone();
    if (this.curl.visible) {
      const run = t - 0.2, reach = DEMO_A.distanceTo(DEMO_D) - 1.15, s = Math.min(run * sp, reach);
      this.curl.position.copy(start).addScaledVector(dir, s); this.curl.rotation.y += dt * 9;
      if (this.curl.position.distanceTo(this.lastDecal) > 0.2) { this.lastDecal.copy(this.curl.position); this.decal(this.curl.position.x + rand(-0.04, 0.04), this.curl.position.z + rand(-0.04, 0.04), rand(0.26, 0.32), 0); if (Math.random() < 0.5) this.burst(this.curl.position.clone().setY(0.1), 0, 1, 1.2, 0.04); }
      if (s >= reach) { this.fuseT = (this.fuseT || 0) + dt; this.curlLight.emissiveIntensity = Math.sin(t * 50) > 0 ? 2.5 : 0; } else { this.fuseT = 0; this.curlLight.emissiveIntensity = 0.4; }
      if (this.fuseT > 0.18) { this.curl.visible = false; this.boom(this.curl.position.clone().setY(0.2), 0, 1.7); this.hitDummy(dir, true); this.f.boomAt = t; }
    }
    // she dives in and follows the trail at the bomb's speed, surfaces when it goes off
    if (t > 0.45 && !this.f.boomAt) { this.wantSwim = true; const s = Math.min((t - 0.45) * sp, DEMO_A.distanceTo(DEMO_D) - 2.0); cp = DEMO_A.clone().addScaledVector(dir, Math.max(0, s)); c.vel.copy(dir).multiplyScalar(sp * 3); this.swimS = s; }
    else if (this.f.boomAt) { cp = DEMO_A.clone().addScaledVector(dir, Math.max(0, this.swimS || 0)); if (this.once('surface', this.f.boomAt)) c.swimPop = 1; if (t - this.f.boomAt > 0.35) { c.lastShot = G.time; c.aimPitch = -0.05; } }
    return cp;
  },
  // 满满: the board goes up and the dummy's shots all stop on it (she just stays safe behind it)
  runCover(dt, t, dir, c, d) {
    const B = this.board, bp = DEMO_A.clone().addScaledVector(dir, 1.15);
    if (this.once('place', 0.2)) {
      B.visible = true; B.position.copy(bp); B.rotation.y = Math.atan2(dir.x, dir.z); this.bGrow = 0; this.bWob = 0; c.recoil = 2;
      this.splat(DEMO_A.x + dir.x * 0.45, DEMO_A.z + dir.z * 0.45, 0.62, 0); for (let k = 0; k < 5; k++) this.burst(bp.clone().add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((k / 4 - 0.5) * 2)).setY(0.1), 0, 3, 3, 0.06, 1.2);
      Sfx.spray(0.5);
    }
    if (B && B.visible) {
      this.bGrow = Math.min(1, this.bGrow + dt / 0.32); const k = this.bGrow, ob = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
      this.bWob = Math.max(0, this.bWob - dt * 3); B.scale.set(0.8, Math.max(0.02, ob) * 0.8, 0.8); B.rotation.z = Math.sin(t * 45) * 0.04 * this.bWob;
      this.boardFace.emissive.setScalar(Math.max(0, this.bWob - 0.5) * 0.5);
      if (t > 3.0) B.visible = Math.sin(t * 26) > -0.4;
    }
    // the dummy keeps shooting at her: every shot splashes on the board
    for (let i = 0; i < 6; i++) { const at = 0.8 + i * 0.28; if (this.once('shot' + i, at)) { const b = this.bullets.find(b => !b.on) || this.bullets[0]; b.on = true; b.m.visible = true; b.p = DEMO_D.clone().setY(rand(0.8, 1.15)).addScaledVector(dir, -0.5); b.p.x += rand(-0.15, 0.15); b.m.position.copy(b.p); d.recoil = 1; Sfx.shoot(0.2); } }
    if (t > 0.75 && t < 2.4) d.lastShot = G.time;
    for (const b of this.bullets) {
      if (!b.on) continue; b.p.addScaledVector(dir, -dt * 11); b.m.position.copy(b.p); b.m.scale.set(0.16, 0.16, 0.16);
      if (b.p.clone().sub(bp).dot(dir) < 0.08) {     // reached the board: splash + an ink mark on it
        b.on = false; b.m.visible = false; this.bWob = 1; this.burst(b.p.clone(), 1, 8, 3, 0.07);
        const m = new THREE.Mesh(this.decalGeo, this.decalM[1]); m.position.set(rand(-0.7, 0.7), clamp(b.p.y - bp.y, 0.3, 1.2) + rand(-0.1, 0.1), Cover.T / 2 + 0.01); m.scale.setScalar(rand(0.13, 0.2)); B.add(m); this.boardDecals.push(m); Sfx.impact(0.35);
      }
    }
    // she crouches safely behind it
    c.aimPitch = -0.45;
    if (this.once('break', 3.45)) { B.visible = false; for (let k = 0; k < 4; k++) this.burst(bp.clone().add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((k / 3 - 0.5) * 1.8)).setY(0.7), 0, 8, 4, 0.1); Sfx.crack(0.45); }
    return DEMO_A.clone();
  },
  // 石墩: lob the bomb, one bounce, it flashes and goes off next to the dummy
  runBomb(dt, t, dir, c, d) {
    const land = DEMO_D.clone().addScaledVector(dir, -0.75), from = DEMO_A.clone().setY(1.0).addScaledVector(dir, 0.4), T0 = 0.25, T1 = 0.85, T2 = 1.1;
    if (this.once('throw', T0)) { this.bomb.visible = true; c.recoil = 2; Sfx.throwB(0.4); }
    if (this.bomb.visible) {
      let p;
      if (t < T1) { const k = (t - T0) / (T1 - T0); p = from.clone().lerp(land, k); p.y = lerp(from.y, 0.26, k) + Math.sin(Math.PI * k) * 1.1; }
      else if (t < T2) { const k = (t - T1) / (T2 - T1); p = land.clone().addScaledVector(dir, 0.35 * k); p.y = 0.26 + Math.sin(Math.PI * k) * 0.25; if (this.once('bounce', T1)) this.splat(land.x, land.z, 0.18, 0); }
      else { p = land.clone().addScaledVector(dir, 0.35); p.y = 0.26; const k = (t - T2) / 0.7; this.bomb.scale.setScalar(1.3 * (1 + k * 0.35)); this.bombLight.emissiveIntensity = Math.sin(t * 40) > 0 ? 2.5 : 0; }
      this.bomb.position.copy(p); this.bomb.rotation.x += dt * 7;
      if (this.once('boom', T2 + 0.7)) { this.bomb.visible = false; this.bomb.scale.setScalar(1.3); this.bombLight.emissiveIntensity = 0; this.boom(p.clone(), 0, 2.2); this.hitDummy(dir, true); }
    }
    if (t < T0 + 0.25 && t > T0 - 0.1) { c.lastShot = G.time; c.aimPitch = 0.35; }
    return DEMO_A.clone();
  }
};
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
    this.shots = []; SubDemo.init(sc);
    const ev = (n, f) => cv.addEventListener && cv.addEventListener(n, f);
    ev('pointerdown', e => { if (this.mode === 'sub') return; const wm = this.mode === 'weap'; this.drag = { x: e.clientX, wm, yaw: wm ? (this.wYaw === undefined ? Math.PI / 2 : this.wYaw) : this.yaw }; if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (_) { } });
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
    if (this.c) { this.sc.remove(this.c.root); }
    const c = new Character('pv', 0, true, { weapon: weaponId, char: charId });
    scene.remove(c.root); scene.remove(c.ghost); if (c.laser) scene.remove(c.laser, c.laserDot);
    c.pos.set(0, 0, 0); c.vel.set(0, 0, 0); c.grounded = true; c.state = 'play'; c.lastShot = -99; this.sc.add(c.root); this.c = c; SubDemo.setup(c);
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
    // sub-weapon page: the pedestal grows into a small stage, the camera pulls back and a demo loops on it
    const ps0 = this.ps || 0; this.ps = clamp(ps0 + (this.mode === 'sub' ? dt : -dt) / 0.7, 0, 1); const es = sm(this.ps);
    // camera: full body <-> centred on the floating weapon <-> wide shot of the demo stage
    const e = sm(this.ph), dist = lerp(4.7, 4.25, e), ka = clamp(1.12 / this.cam.aspect, 1, 1.8);
    this.cam.position.set(lerp(0, 0.3 * ka, es), lerp(lerp(1.35, 1.32, e), 2.6 * ka, es), lerp(dist, 5.5 * ka, es)); this.look.set(lerp(0, 0.1, es), lerp(lerp(0.82, 1.0, e), 0.72, es), lerp(0, -0.1, es)); this.cam.lookAt(this.look);
    const fov = lerp(30, 36, es); if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    SubDemo.update(dt, this.ps);
    // character: slow turntable; on the way out it squashes and sinks into the pedestal ink
    if (!this.drag && this.idleT <= 0 && this.ps < 0.01) this.yaw += dt * 0.55;
    const ck = 1 - sm(a); c.root.visible = ck > 0.01;
    if (c.root.visible) {
      this.raise = damp(this.raise, 0.15, 6, dt); this.enter = Math.min(1, (this.enter || 0) + dt * 3.5);
      if (this.ps > 0.01) {         // demo pose, blended in from the turntable pose
        const dp = c.pos.clone(), dy = c.bodyYaw; c.pos.set(0, 0, 0).lerp(dp, es); c.bodyYaw = c.aimYaw = this.yaw + angDiff(this.yaw, dy) * es;
        if (this.ps >= 0.999) this.yaw = dy;
      } else { c.bodyYaw = c.aimYaw = this.yaw; c.aimPitch = lerp(-0.5, -0.03, this.raise); c.pos.set(0, 0, 0); c.lastShot = -99; SubDemo.setSw(c, false); c.charging = false; }
      c.syncModel(dt); c.root.position.set(c.pos.x, (1 - this.enter) * -0.25 - a * a * 0.5, c.pos.z);
      const ek = (0.85 + 0.15 * (1 - Math.pow(1 - this.enter, 3))), sq = 1 + 0.3 * Math.sin(Math.PI * a), bw = c.look.bodyW || 1, bh = c.look.bodyH || 1;
      c.root.scale.set(bw * ek * sq * Math.max(ck, 0.2), bh * ek * Math.max(ck, 0.001), bw * ek * sq * Math.max(ck, 0.2));
      if (!c.swim && !c.charging && (this.ps < 0.5 || G.time - c.lastShot > 0.3)) c.arms[1].rotation.set(0.12, 0, 0.14);
      if (this.ps < 0.5) c.torso.rotation.y *= this.raise;
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
    this.pop = Math.max(0, (this.pop || 0) - dt * 4); const s = 1 + this.pop * 0.12, sw = lerp(1, 2.9, es); this.ped.scale.set(s * sw, s, s * sw); this.splatM.opacity = 0.85 * (1 - es);
    const pk = sm(clamp((this.ph - 0.25) / 0.6, 0, 1)); this.ped.position.y = -1.9 * pk; this.ped.visible = pk < 0.99;
    this.r.render(this.sc, this.cam);
  }
};

/* ------------------------------------------------------------- update */
/* 西關大屋's opening film: three held shots of the landmarks (hard cuts, slow moves, a long lens), then one unbroken move through the
   paifang and round to the play camera. Letterbox bars, a caption per shot; hold Space to skip to the landing. */
const CINE = { T: 7.0, shots: [
  { t0: 0.0, t1: 1.5, p0: [-13.5, 1.0, 0.4], p1: [-12.7, 4.4, 0.9], l0: [0, 5.2, 0], l1: [0, 7.6, 0], fov: 38, cap: ['鎮海樓', 'ZHENHAI TOWER'] },
  { t0: 1.5, t1: 3.0, p0: [-4.2, 3.7, -16.6], p1: [-3.6, 3.9, -23.4], l0: [5, 4.1, -19.8], l1: [5, 4.3, -22.6], fov: 40, cap: ['廣州酒家', 'GUANGZHOU RESTAURANT'] },
  { t0: 3.0, t1: 4.5, p0: [22.3, 3.75, 29.5], p1: [22.3, 3.75, 20.5], l0: [26, 3.6, 24.5], l1: [26, 3.6, 15.5], fov: 46, cap: ['腸粉街', 'RICE-ROLL ARCADE'] },
  { t0: 4.5, t1: 5.8, p0: [0.6, 3.5, 22.5], p1: [0, 4.3, 33.5], l0: [0, 6.0, 31], l1: [0, 5.4, 47], fov: 44, cap: ['獵德牌坊', 'LIEDE ARCHWAY'], own: true } ] };
function cineUI(on) { const h = $('hud'); if (!h || !h.classList) return; if (on) { h.classList.add('cine'); h.classList.add('cbars'); } else { h.classList.remove('cine'); h.classList.remove('cbars'); $('cineTitle').classList.remove('on'); $('cineCap').classList.remove('on'); } }
function updateCine(dt) {
  const C = CINE, sg = PLAYER.team ? -1 : 1, V = (a, own) => new THREE.Vector3(a[0] * (own ? sg : 1), a[1], a[2] * (own ? sg : 1)), sm = k => k * k * (3 - 2 * k);
  const end = startCamPose(), F = G.flags;
  Input.dx = Input.dy = 0; Input.jumpQ = false;
  if (!F.cine) { F.cine = 1; F.shot = -1; F.hold = 0; cineUI(true); }
  // hold Space to skip: the ring fills in 0.6 s, then the camera goes straight to the landing
  if (!F.skip && G.introT < C.T - 1.3) { F.hold = Input.keys.Space ? F.hold + dt : 0; const r = $('cineRing'); if (r && r.style) r.style.strokeDashoffset = String(88 * (1 - clamp(F.hold / 0.6, 0, 1)));
    if (F.hold >= 0.6) { F.skip = { t: 0, p: camera.position.clone(), l: (F.look || end.look).clone(), fov: camera.fov }; Input.spaceLock = true; $('cineTitle').classList.remove('on'); $('cineCap').classList.remove('on'); } }
  let pos, look, fov;
  const land = (k, p, l, f0) => {      // the last move: rise, swing round the player, settle on the play camera
    const e = sm(clamp(k, 0, 1)), mid = new THREE.Vector3((p.x + end.pos.x) / 2 + 7 * sg, Math.max(p.y, end.pos.y) + 3.2, (p.z + end.pos.z) / 2 + 3 * sg);
    pos = p.clone().lerp(mid, e).lerp(mid.clone().lerp(end.pos, e), e); look = l.clone().lerp(new THREE.Vector3(PLAYER.pos.x, PLAYER.pos.y + 1.4, PLAYER.pos.z), Math.sin(e * Math.PI) * 0.6).lerp(end.look, e * e); fov = lerp(f0, SETTINGS.fov, e);
    if (k > 0.35 && !F.bars) { F.bars = 1; $('hud').classList.remove('cbars'); $('cineCap').classList.remove('on'); }
  };
  if (F.skip) { F.skip.t += dt; land(F.skip.t / 0.9, F.skip.p, F.skip.l, F.skip.fov); if (F.skip.t >= 0.9) G.introT = Math.max(G.introT, C.T); else G.introT = Math.min(G.introT, C.T - 0.01); }
  else { G.introT += dt; const t = G.introT, last = C.shots[C.shots.length - 1];
    if (t < last.t1) { let i = C.shots.findIndex(s => t < s.t1); const s = C.shots[i], k = (t - s.t0) / (s.t1 - s.t0), e = s.own ? sm(k) * 0.5 + k * 0.5 : k * 0.85 + sm(k) * 0.15;
      pos = V(s.p0, s.own).lerp(V(s.p1, s.own), e); look = V(s.l0, s.own).lerp(V(s.l1, s.own), e); fov = s.fov;
      if (F.shot !== i) { F.shot = i; const c = $('cineCap'); c.classList.remove('on'); if (c.children && c.children[0]) { c.children[0].textContent = s.cap[0]; c.children[1].textContent = s.cap[1]; } F.capAt = t + 0.12; }
      if (F.capAt && t >= F.capAt) { F.capAt = 0; $('cineCap').classList.add('on'); }
      if (i === 0) { if (t > 0.15 && !F.ttl) { F.ttl = 1; $('cineTitle').classList.add('on'); } if (t > 1.15 && F.ttl === 1) { F.ttl = 2; $('cineTitle').classList.remove('on'); } }
    } else land((t - last.t1) / (C.T - last.t1), V(last.p1, true), V(last.l1, true), last.fov);
  }
  if (G.introT < C.T) { F.look = look; camera.position.copy(pos); camera.lookAt(look); if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); } return; }
  // landed: the usual READY / GO
  if (!F.done) { F.done = 1; cineUI(false); resetFov(); camera.position.copy(end.pos); camera.lookAt(end.look); }
  if (F.skip) G.introT += dt;
  const t = G.introT;
  if (!F.t2) { F.t2 = 1; HUD.center('READY?', '', 1000); Sfx.beep(false); }
  if (t > C.T + 1.0) { G.state = 'play'; HUD.center('GO!', '', 900); Sfx.whistle(); Sfx.beep(true); flash(0.35); Sfx.music('game'); Cam.pos.copy(camera.position); Input.jumpQ = false; }
}
function updateIntro(dt) {
  if (MAP_ID === 'canton') return updateCine(dt);
  G.introT += dt; const t = G.introT;
  Input.dx = Input.dy = 0;            // no looking around during the opening shot (it used to pile up and swing the camera at GO)
  const k = clamp(t / 3.0, 0, 1), e = k * k * (3 - 2 * k);
  // fly from enemy side high over arena down behind player
  // ... and land exactly where the play camera starts (behind the player, not the pad's centre), so GO doesn't jump
  const end = startCamPose(), p0 = new THREE.Vector3(18, 26, -ZH - 4), p1 = new THREE.Vector3(-12, 18, 0), p2 = end.pos;
  const a = p0.clone().lerp(p1, e), b = p1.clone().lerp(p2, e), pos = a.lerp(b, e);
  camera.position.copy(pos); const look = new THREE.Vector3(0, 0, -10).lerp(end.look, e);
  camera.lookAt(look);
  if (t > 0.2 && !G.flags.t1) { G.flags.t1 = 1; HUD.center('涂地对战', MAP.name + ' · 4 V 4', 2400); }
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
  if (!G.pilot) playerControl(dt);                // (G.pilot: an all-bot match for the AI benchmark; the player is driven by a Bot in G.bots)
  if (G.squads) for (const q of G.squads) q.update(dt);
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
  // Enter confirms the name; the secret name gets a proper fanfare
  $('pname').addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); e.stopPropagation(); e.target.blur(); nameConfirm(); });
  $('pname').addEventListener('input', () => { if (Profile.data.vip && GAME.name !== VIP_NAME) { Profile.data.vip = null; Profile.save(); $('pnameWrap').classList.remove('vip'); } });
  $('pnameWrap').classList.toggle('dev', devGod()); $('pnameWrap').classList.toggle('vip', vipOn()); G.modeWas = devGod() ? 'dev' : vipOn() ? 'vip' : '';
  $('btnStart').onclick = () => { Sfx.init(); Sfx.click(); openMapSel(); };
  $('titleMap').onclick = () => { Sfx.init(); Sfx.click(); openMapSel(); };
  $('btnMsBack').onclick = () => { Sfx.click(); show('mapsel', false); show('title', true); renderLoadCard(); };
  $('btnMsNext').onclick = mapSelNext;
  fitMenus();
  $('btnChangeMap').onclick = () => { Sfx.click(); Profile.save(); openMapSel(); };
  renderMaps();
  $('loadCard').onclick = () => { Sfx.init(); Sfx.click(); openLobby(); };
  $('btnBack').onclick = () => { Sfx.click(); show('lobby', false); show('title', true); renderLoadCard(); };
  $('pvReplay').onclick = () => { Sfx.init(); Sfx.click(); SubDemo.restart(); };
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
  prebuildMaps();                 // the other maps' terrain + floor layout now, so switching maps later is instant
  buildTextures();
  initPaint();
  initGeo();
  buildSkyEnv(); buildWorld();
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
