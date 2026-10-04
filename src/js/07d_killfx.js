/* ============================================================ KILL FEEDBACK
   What the player gets for knocking someone out, all in their own team's ink:
     · at the crosshair: the ✕ turns team colour, eight drops fly out and a ring rolls away
     · a splat-shaped badge at the bottom: the weapon (or bomb / special) and the name; up to three stack
     · streaks inside 4.5 s slam a word above it - 双杀 / 三杀 / 四杀, and 团灭 when the whole other team is down
     · where they fell: a team-colour ✕ that shows through walls, pinned to the screen edge with an arrow when out of view
     · the feel: an ink crown at the victim, a quick zoom punch, a tiny hit-stop, the screen edge glowing
   Assists get a small grey badge.  Only the player's own kills - never everyone's.                       */
const KillFX = {
  WINDOW: 4.5, LIFE: 1.8, MARK: 1.9, WORDS: ['', '', '双杀！', '三杀！', '四杀！'],
  reset() {
    this.streak = 0; this.lastT = -99; this.badges = []; this.marks = []; this.wordT = 0;
    $('kxList').innerHTML = ''; $('kxWord').innerHTML = ''; $('kxMarks').innerHTML = '';
    $('hud').style.setProperty('--kc', TEAM_HEX[PLAYER ? PLAYER.team : 0]);
    const b = $('kxBurst'); if (!b.children.length) { let h = ''; for (let i = 0; i < 8; i++) h += `<i style="--a:${i * 45 + 22}deg"></i>`; b.innerHTML = h + '<b></b>'; }
  },
  esc(s) { return String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); },
  // an ink splat stretched into a badge (viewBox 200 x 60): a wobbly outline, a drip or two hanging off the bottom, loose drops
  blob(seed) {
    let d = ''; const n = 30;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, k = 1 + 0.06 * Math.sin(a * 5 + seed) + 0.04 * Math.sin(a * 11 + seed * 2) + (hash(seed + i) > 0.88 ? 0.12 : 0);
      const drip = Math.sin(a) > 0.55 && hash(seed * 3 + i) > 0.72 ? 9 + hash(seed + i * 7) * 8 : 0;
      d += (i ? 'L' : 'M') + (100 + Math.cos(a) * 94 * k).toFixed(1) + ' ' + (30 + Math.sin(a) * 25 * k + drip).toFixed(1);
    }
    let dots = ''; for (let i = 0; i < 3; i++) { const a = hash(seed + i * 13) * Math.PI * 2; dots += `<circle cx="${(100 + Math.cos(a) * 108).toFixed(1)}" cy="${(30 + Math.sin(a) * 34).toFixed(1)}" r="${(3 + hash(seed + i) * 4).toFixed(1)}"/>`; }
    return `<svg class="bg" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="${d}Z"/>${dots}</svg>`;
  },
  badge(html, cls) {
    const el = document.createElement('div'); el.className = 'kxb' + (cls ? ' ' + cls : ''); el.innerHTML = this.blob(Math.random() * 100) + html;
    $('kxList').appendChild(el); this.badges.push({ el, t: 0, out: false });
    // keep three at most: the older ones shrink back, the oldest goes
    while (this.badges.length > 3) { const o = this.badges.shift(); o.el.remove(); }
    this.badges.forEach((b, i) => b.el.classList.toggle('old', i < this.badges.length - 1));
  },
  restart(id, cls) { const e = $(id); e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); },
  onKill(v, via) {
    const P = PLAYER, T = G.time, col = TEAM_HEX[P.team];
    this.streak = T - this.lastT <= this.WINDOW ? this.streak + 1 : 1; this.lastT = T;
    const wipe = CHARS.every(c => c.team === P.team || !c.alive), big = this.streak >= 2 || wipe;
    Sfx.kill(this.streak); if (wipe) Sfx.wipe && Sfx.wipe();
    HUD.hitmark(true); this.restart('kxBurst', 'on'); this.restart('kxFlash', big ? 'big' : 'on');
    this.badge(`<span class="ic">${weaponIcon(via || P.weapon.id, '#fff', 46, col)}</span><b>击倒</b><span class="nm">${this.esc(v.name)}</span>`);
    const word = wipe ? '团灭！' : this.WORDS[Math.min(this.streak, 4)];
    if (word) { $('kxWord').innerHTML = `<span class="${wipe ? 'wipe' : ''}">${word}</span>`; this.wordT = 1.4; }
    // where they fell
    const el = document.createElement('div'); el.className = 'kxm';
    el.innerHTML = `<div class="in"><svg viewBox="0 0 60 60"><path d="${this.markPath()}" style="fill:${col}" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/><path d="M21 21 L39 39 M39 21 L21 39" stroke="#111" stroke-width="7" stroke-linecap="round"/><path d="M21 21 L39 39 M39 21 L21 39" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg><small>${this.esc(v.name)}</small></div><i class="arr" style="border-bottom-color:${col}"></i>`;
    $('kxMarks').appendChild(el); this.marks.push({ el, x: v.pos.x, y: v.pos.y + 1.1, z: v.pos.z, t: 0 });
    // the ink crown at the victim, a punch of the camera, a moment's hit-stop
    const p = v.pos, gy = groundBelow(p.x, p.z, p.y + 0.2, 0.3);
    Fx.burstDir(p.x, p.y + 0.5, p.z, col, big ? 40 : 26, big ? 13 : 10, 0.12, 0, 1, 0, 0.45);
    Fx.ring(p.x, gy + 0.06, p.z, col, big ? 6 : 4.6); Fx.ball(p.x, p.y + 0.9, p.z, '#ffffff', 0.7);
    Cam.punch = Math.max(Cam.punch || 0, big ? 6 : 3.5); G.shake(big ? 0.25 : 0.12);
    G.hitStop = Math.max(G.hitStop || 0, wipe ? 0.14 : big ? 0.09 : 0.05);
  },
  onAssist(v) { this.badge(`<b>助攻</b><span class="nm">${this.esc(v.name)}</span>`, 'assist'); if (Sfx.assist) Sfx.assist(); },
  markPath() { let d = ''; const s = Math.random() * 50; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, r = 25 * (1 + 0.12 * Math.sin(a * 3 + s) + (hash(s + i) > 0.8 ? 0.2 : 0)); d += (i ? 'L' : 'M') + (30 + Math.cos(a) * r).toFixed(1) + ' ' + (30 + Math.sin(a) * r).toFixed(1); } return d + 'Z'; },
  update(dt) {
    for (const b of this.badges) { b.t += dt; if (!b.out && b.t > this.LIFE) { b.out = true; b.el.classList.add('out'); } }
    while (this.badges.length && this.badges[0].t > this.LIFE + 0.45) this.badges.shift().el.remove();
    if (this.wordT > 0 && (this.wordT -= dt) <= 0) $('kxWord').innerHTML = '';
    // markers: projected each frame; out of view (or behind) they sit on the edge of the screen with an arrow pointing at the spot
    const W = innerWidth, H = innerHeight, m = 74;
    for (const k of this.marks) {
      k.t += dt; k.y += dt * 0.25;
      const v = new THREE.Vector3(k.x, k.y, k.z).project(camera), behind = v.z > 1;
      let x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; if (behind) { x = W - x; y = H - y; }
      const edge = behind || x < m || x > W - m || y < m || y > H - m;
      if (edge) { const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy, s = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m) / Math.max(1e-3, Math.abs(dy))); x = cx + dx * s; y = cy + dy * s; k.el.style.setProperty('--ar', Math.atan2(dy, dx) * 180 / Math.PI + 90 + 'deg'); }
      k.el.classList.toggle('edge', edge); k.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
    while (this.marks.length && this.marks[0].t > this.MARK) this.marks.shift().el.remove();
  }
};
