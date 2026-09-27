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
    $('vignette').style.background = `radial-gradient(ellipse at center, transparent 55%, ${ec}99 135%)`; $('vignette').style.opacity = clamp((70 - hp) / 70, 0, 0.8);
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
    for (const ch of CHARS) {
      if (!ch.alive || ch.team !== PLAYER.team) continue; const [x, y] = toM(ch.pos.x, ch.pos.z);
      if (ch.isPlayer) {
        g.save(); g.translate(x, y); g.rotate(-Cam.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.stroke(); g.fill(); g.restore();
      } else { g.fillStyle = TEAM_HEX[ch.team]; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); g.stroke(); }
    }
  },
  hurt(amount = 25) {
    this.hurtV = 1;
    // ink splattered on the screen edges in the attacker's colour
    const el = $('inkScreen'), col = TEAM_HEX[1 - PLAYER.team], n = amount >= 60 ? 3 : amount >= 25 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 200 200');
      const side = Math.floor(Math.random() * 4), size = rand(22, 38), along = rand(5, 95);
      const x = side === 0 ? -size * 0.35 : side === 1 ? 100 - size * 0.65 : along - size / 2, y = side === 2 ? -size * 0.35 : side === 3 ? 100 - size * 0.65 : along - size / 2;
      s.style.cssText = `left:${side < 2 ? x + 'vw' : x + 'vw'};top:${y}vh;width:${size}vmin;height:${size}vmin;transform:rotate(${rand(0, 360)}deg)`;
      let inner = `<path d="${blobPath(Math.random() * 50, 58)}" style="fill:${col}"/>`;
      for (let k = 0; k < 5; k++) { const a = Math.random() * 6.28, d = rand(66, 92); inner += `<circle cx="${100 + Math.cos(a) * d}" cy="${100 + Math.sin(a) * d}" r="${rand(4, 11)}" style="fill:${col}"/>`; }
      s.innerHTML = inner; el.appendChild(s); setTimeout(() => s.remove(), 1400);
    }
    for (let k = el.children.length - 8; k > 0; k--) { const old = el.children[0]; if (old && old.remove) old.remove(); }
  },
  tip(t) { const el = $('tip'); el.textContent = t; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 1100); },
  hitmark(kill) { const h = $('hitmark'); h.classList.remove('on', 'kill'); void h.offsetWidth; h.classList.add(kill ? 'kill' : 'on'); },
  lowInk() { if (this.lowInkT <= 0) Sfx.beep(false); this.lowInkT = 0.8; },
  killfeed(k, v, via) {
    const el = document.createElement('div'); el.className = 'kf';
    const nm = c => `<span style="color:${TEAM_HEX[c.team]};-webkit-text-stroke:.5px #000">${c.name}</span>`;
    el.innerHTML = (k ? nm(k) : '???') + (via ? weaponIcon(via, '#fff', 34, TEAM_HEX[k ? k.team : 1 - v.team]) : '') + '<span class="x">✕</span>' + nm(v);
    const f = $('killfeed'); f.prepend(el); while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => el.remove(), 4500);
  },
  died(k, via) {
    const vn = via && (WEAPONS[via] || SUBS[via] || SPECIALS[via]);
    $('death').classList.add('show'); $('deathBy').innerHTML = k ? `被 <span style="color:${TEAM_HEX[k.team]}">${k.name}</span> ${vn ? '用「' + vn.name + '」' : ''}击倒了！` : '你被击倒了！';
    $('deathTip').textContent = '提示：' + pick(TIPS);
  },
  respawned() { $('death').classList.remove('show'); },
  center(msg, sub, ms) {
    const el = $('center'); el.innerHTML = `<span class="msg pop">${msg}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`;
    clearTimeout(this._ct); if (ms) this._ct = setTimeout(() => el.innerHTML = '', ms);
  }
};

/* ============================================================== GAME */
const G = { roster: null, state: 'boot', time: 0, left: 180, shakeAmt: 0, paused: false, introT: 0, endT: 0, bots: [], titleT: 0, flags: {}, shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); } };
function show(id, on) { $(id).classList.toggle('show', on); }
function flash(a = 0.8) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
function applyPalette() {
  const p = PALETTES[GAME.pal]; TEAM_HEX[0] = p[0]; TEAM_HEX[1] = p[1];
  setTeamColors(p[0], p[1]); setTeamMats(p[0], p[1]);
}
function clearChars() {
  CHARS.forEach(c => { scene.remove(c.root); scene.remove(c.ghost); if (c.laser) scene.remove(c.laser, c.laserDot); }); CHARS.length = 0; G.bots = []; PLAYER = null;
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
  spawnTeams(); HUD.buildTeams();
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
  G.paused = false; show('pause', false); show('hud', false); show('results', false);
  if (document.pointerLockElement) document.exitPointerLock();
  gotoTitle();
}
function endMatch() {
  G.state = 'end'; G.endT = 0; Sfx.whistle(); Sfx.stopMusic(); flash(0.6);
  HUD.center('比赛结束！', '', 0);
  CHARS.forEach(c => { c.intent.fire = false; c.intent.swim = false; c.intent.mx = c.intent.mz = 0; });
  if (Proj.pv) Proj.preview(null); Cam.bombAim = false;
}
function showResults() {
  G.state = 'results'; show('hud', false); show('results', true); resetFov();
  if (document.pointerLockElement) document.exitPointerLock();
  const p0 = Paint.teamCells[0] / Paint.total * 100, p1 = Paint.teamCells[1] / Paint.total * 100;
  const A = $('barA'), B = $('barB'), V = $('verdict'), bd = $('board'), rb = $('resBtns');
  A.style.transition = B.style.transition = 'none'; A.style.width = B.style.width = '0%'; A.textContent = B.textContent = '';
  A.style.background = TEAM_HEX[0]; B.style.background = TEAM_HEX[1];
  V.className = ''; V.style.opacity = 0; bd.classList.remove('show'); rb.classList.remove('show');
  $('judge').textContent = '裁判判定中…';
  const sum = Math.max(p0 + p1, 1);
  let beeps = 0; const bi = setInterval(() => { Sfx.beep(false); if (++beeps > 8) clearInterval(bi); }, 220);
  setTimeout(() => { A.style.transition = B.style.transition = ''; A.style.width = (p0 / sum * 100) + '%'; B.style.width = (p1 / sum * 100) + '%'; }, 400);
  setTimeout(() => {
    A.textContent = p0.toFixed(1) + '%'; B.textContent = p1.toFixed(1) + '%';
    const win = p0 >= p1; V.textContent = win ? '胜利！' : '失败…'; V.style.color = win ? TEAM_HEX[0] : '#9aa0b5'; V.style.opacity = 1; V.classList.add('show');
    $('judge').textContent = win ? '你的队伍赢下了这片广场！' : '对手的颜色更胜一筹……';
    Sfx.fanfare(win); flash(0.4);
  }, 2900);
  setTimeout(() => {
    bd.innerHTML = [0, 1].map(t => {
      const rows = CHARS.filter(c => c.team === t).sort((a, b) => b.paint - a.paint).map(c => `<div class="r${c.isPlayer ? ' me' : ''}"><span>${weaponIcon(c.weapon.id, '#fff', 30, TEAM_HEX[t])}${c.name}</span><span>${Math.round(c.paint)}p</span><span>${c.kills}</span><span>${c.deaths}</span></div>`).join('');
      return `<div class="tbl" style="border-color:${TEAM_HEX[t]}"><h4 style="color:${TEAM_HEX[t]}">${t === 0 ? '我方' : '对手'} · ${(t ? p1 : p0).toFixed(1)}%</h4><div class="r h"><span>名字</span><span>涂地</span><span>击倒</span><span>阵亡</span></div>${rows}</div>`;
    }).join('');
    bd.classList.add('show'); rb.classList.add('show');
  }, 4200);
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
    else if (G.state === 'results') { const a = t * 0.05; camera.position.set(Math.sin(a) * 18, 78, Math.cos(a) * 18 + 8); camera.lookAt(0, 0, 0); }
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
  addEventListener('keydown', e => { if (e.code === 'Escape') { show('howto', false); show('settings', false); } });
  document.addEventListener('pointerdown', () => { Sfx.init(); if (G.state === 'title') Sfx.music('title'); }, { once: true });
  titleSplats(); renderLoadCard();
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
  Fx.init(); Proj.init(); Barrier.init(); initBallistics(); initNav(); HUD.init(); initInput(); initUI();
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
