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
    $('subw').classList.toggle('no', c.ink < 70);
    $('spRing').style.strokeDashoffset = 264 * (1 - c.special / 100);
    $('special').classList.toggle('ready', c.special >= 100);
    const hp = c.alive ? c.hp : 100; this.hurtV = Math.max(0, this.hurtV - dt * 2);
    const vig = clamp((100 - hp) / 100 * 0.9 + this.hurtV * 0.4, 0, 0.95);
    const ec = TEAM_HEX[1 - c.team];
    $('vignette').style.opacity = 0;
    ScreenInk.update(dt, c.alive ? c.hp : Cam.spec ? 100 : 0, c.alive && c.inEnemy && !c.invuln());     // watching a teammate: clear the ink off the screen
    const st = $('specTag'), sn = !c.alive && Cam.spec ? '正在观看：' + Cam.spec.name : '';
    if (st.textContent !== sn) { st.textContent = sn; st.classList.toggle('on', !!sn); }
    $('crosshair').classList.toggle('enemy', Cam.lock);
    const r2 = $('ret2');
    if (Cam.showLand && c.alive && c.state === 'play') {
      const v = Cam.land.clone().project(camera);
      if (v.z < 1) {
        const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
        const camD = camera.position.distanceTo(Cam.land), fpx = innerHeight / 2 / Math.tan(camera.fov * Math.PI / 360);
        const wr = c.weapon.type === 'charge' ? 0.12 : c.weapon.spread * Cam.landDist + 0.12;
        const px = clamp(wr * fpx / Math.max(camD, 0.5), 7, 60);
        r2.style.display = 'block'; r2.style.transform = `translate(${x}px, ${y}px)`; r2.style.setProperty('--rs', px * 2 + 'px');
        r2.classList.toggle('lock', Cam.lock);
      } else r2.style.display = 'none';
    } else r2.style.display = 'none';
    const cr = $('chargeRing'), isC = c.weapon.type === 'charge';
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
        return `<div class="st-r${c.isPlayer ? ' me' : ''}${c.alive ? '' : ' dead'}"><span class="w">${weaponIcon(c.weapon.id, '#fff', 34, TEAM_HEX[t])}</span><span class="n">${c.name}${c.isPlayer ? '<i>你</i>' : ''}${c.alive ? '' : '<em>' + Math.max(1, Math.ceil(c.respawnT)) + '</em>'}</span><span>${c.kills}</span><span>${c.assists}</span><span>${c.deaths}</span><span>${Math.round(c.paint)}p</span><span class="sp${ready ? ' on' : ''}">${sp}</span></div>`;
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
function show(id, on) { $(id).classList.toggle('show', on); }
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
    const chargerSlot = Math.random() < 0.65 ? pick(slots) : -1;
    for (let i = 0; i < 4; i++) {
      const isP = t === 0 && i === 1;
      R[t].push({ name: isP ? (GAME.name || '玩家') : names.pop(), isPlayer: isP, weapon: isP ? Profile.data.weapon : (i === chargerSlot ? 'charger' : 'rifle'), look: isP ? Profile.data.look : randomLook(), role: roles[(i + t) % 4] });
    }
  }
  G.roster = R; enforceRoster();
}
function enforceRoster() {
  // at most one charger per team (the player's own pick takes priority)
  const me = G.roster[0][1]; me.weapon = Profile.data.weapon; me.name = GAME.name || '玩家';
  G.roster.forEach(team => { let seen = team.some(m => m.isPlayer && m.weapon === 'charger'); team.forEach(m => { if (m.isPlayer) return; if (m.weapon === 'charger') { if (seen) m.weapon = 'rifle'; seen = true; } }); });
}
function spawnTeams() {
  clearChars();
  if (!G.roster) rollRoster();
  const offs = [-4.5, -1.5, 1.5, 4.5];
  for (let t = 0; t < 2; t++) G.roster[t].forEach((m, i) => {
    const c = new Character(m.name, t, m.isPlayer, { weapon: m.weapon, look: m.look });
    const sp = SPAWN[t]; c.pos.set(sp.x + offs[i] * (t ? -1 : 1), sp.y, sp.z + (t ? -1 : 1) * (i % 2 ? 0.8 : -0.4)); c.aimYaw = c.yaw = c.bodyYaw = sp.yaw;
    CHARS.push(c); if (m.isPlayer) PLAYER = c; else G.bots.push(new Bot(c, m.role));
  });
}
function resetFov() { Cam.zoom = 1; camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); }
function startMatch() {
  Sfx.init(); Sfx.stopMusic();
  applyPalette(); resetPaint(); Fx.clear(); Proj.clear();
  spawnTeams(); HUD.buildTeams(); ScreenInk.reset(TEAM_HEX[1]);
  try { renderer.compile(scene, camera); } catch (e) { }
  G.left = GAME.dur; G.time = 0; G.state = 'intro'; G.introT = 0; G.paused = false; G.flags = {}; resetFov();
  const W = PLAYER.weapon; $('weapTag').innerHTML = weaponIcon(W.id, '#fff', 48, TEAM_HEX[0]) + W.name;
  Cam.yaw = SPAWN[0].yaw; Cam.pitch = -0.08; Cam.pivotY = SPAWN[0].y + 1.5;
  show('title', false); show('lobby', false); show('results', false); show('pause', false); show('hud', true);
  $('death').classList.remove('show'); $('center').innerHTML = '';
  $('hint').style.display = 'block';
  lockPointer();
}
function pauseGame() { if (G.state !== 'play' && G.state !== 'intro') return; G.paused = true; show('pause', true); Input.keys = {}; }
function resumeGame() { G.paused = false; show('pause', false); clock.getDelta(); lockPointer(); }
function quitToTitle() {
  if (G.mapOpen) { G.mapOpen = false; $('minimap').classList.remove('big'); $('mapHint').classList.remove('show'); }
  G.paused = false; show('pause', false); show('hud', false); show('results', false);
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
        const md = medalsFor(c).map(m => `<b class="${m.gold ? 'g' : 's'}" title="${m.t}（${m.gold ? '全场第一' : '队内第一'}）"></b>`).join('');
        return `<div class="r${c.isPlayer ? ' me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${weaponIcon(c.weapon.id, '#fff', 34, TEAM_HEX[t])}${c.name}${c.isPlayer ? '<i>你</i>' : ''}</span><span>${Math.round(c.paint)}p</span><span>${c.kills}<small>${c.assists ? ' +' + c.assists : ''}</small></span><span>${c.deaths}</span><span>${c.specials}</span><span class="md">${md}</span></div>`;
      }).join('');
      return `<div class="tbl ${won ? 'won' : 'lost'}" style="--tc:${TEAM_HEX[t]}"><div class="th"><b>${won ? 'WIN!' : 'LOSE…'}</b><span>${t === 0 ? '我方' : '对手'}</span><em>${(t ? p1 : p0).toFixed(1)}%</em></div><div class="r h"><span></span><span>名字</span><span>涂地</span><span>击倒 +助攻</span><span>阵亡</span><span>必杀</span><span>奖牌</span></div>${rows}</div>`;
    };
    bd.innerHTML = win ? team(0) + team(1) : team(1) + team(0);
    bd.classList.add('show');
  });
  later(6600, () => {
    const me = medalsFor(PLAYER);
    aw.innerHTML = '<h4>你的奖牌</h4>' + (me.length ? me.map((m, i) => `<div class="mdl ${m.gold ? 'g' : 's'}" style="animation-delay:${i * 0.12}s"><b></b><div><span>${m.t}</span><small>${m.gold ? '全场第一' : '队内第一'}</small></div></div>`).join('') : '<div class="mdl none"><span>这局没有拿到奖牌，下次加油！</span></div>');
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
  resetToAttract(); rollRoster(); renderLobby();
  show('title', false); show('results', false); show('lobby', true);
}
function statBars(v) { let s = '<div class="bar">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= v ? 'on' : ''}"></i>`; return s + '</div>'; }
function renderLobby() {
  const cur = Profile.data.weapon;
  $('weapList').innerHTML = WEAPON_ORDER.map(id => {
    const w = WEAPONS[id];
    return `<div class="wcard${id === cur ? ' sel' : ''}" data-id="${id}">
      <div class="wic">${weaponIcon(id, '#fff', 110)}<span class="tag">${id === cur ? '已装备' : '点击装备'}</span></div>
      <div class="winfo"><b>${w.name}</b><span class="en">${w.en}</span><span class="role">${w.role}</span>
        <div class="stats">${STAT_LABELS.map(([k, l]) => `<span>${l}</span>${statBars(w.stats[k])}`).join('')}</div>
        <div class="kit">副武器：${SUBS[w.sub].name} · 必杀技：${SPECIALS[w.special].name}</div>
        <div class="wdesc">${w.desc}</div></div></div>`;
  }).join('');
  $('weapList').querySelectorAll('.wcard').forEach(el => el.onclick = () => {
    if (Profile.data.weapon === el.dataset.id) return;
    Profile.data.weapon = el.dataset.id; Profile.save(); Sfx.init(); Sfx.click(); enforceRoster(); renderLobby(); renderLoadCard();
  });
  ['rosterA', 'rosterB'].forEach((id, t) => {
    $(id).innerHTML = G.roster[t].map(m => `<div class="rrow${m.isPlayer ? ' me' : ''}" style="border-left-color:${TEAM_HEX[t]}">${weaponIcon(m.weapon, '#fff', 40, TEAM_HEX[t])}<span>${m.name}${m.isPlayer ? '（你）' : ''}</span><span class="wn">${WEAPONS[m.weapon].name}</span></div>`).join('');
  });
}
function renderLoadCard() {
  const w = WEAPONS[Profile.data.weapon];
  $('lcIcon').innerHTML = weaponIcon(w.id, '#fff', 72); $('lcName').textContent = w.name; $('lcRole').textContent = w.role;
  $('lcKit').textContent = SUBS[w.sub].name + ' · ' + SPECIALS[w.special].name;
}

/* ------------------------------------------------------------- update */
function updateIntro(dt) {
  G.introT += dt; const t = G.introT;
  const k = clamp(t / 3.0, 0, 1), e = k * k * (3 - 2 * k);
  // fly from enemy side high over arena down behind player
  const p0 = new THREE.Vector3(18, 26, -52), p1 = new THREE.Vector3(-12, 18, 0), p2 = new THREE.Vector3(0, SPAWN[0].y + 2.2, SPAWN[0].z + 5);
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
    Proj.update(dt); Fx.update(dt); Barrier.update(dt, t);
    uploadPaint(); updateWorld(t, dt);
  }
  renderer.render(scene, camera);
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
  Fx.init(); Proj.init(); Barrier.init(); ScreenInk.init(); initBallistics(); initNav(); HUD.init(); initInput(); initUI();
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
