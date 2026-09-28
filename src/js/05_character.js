/* ============================================================ CHARACTERS */
const CHARS = [];
let PLAYER = null;
const STEP = 0.55, GRAV = 24, RESPAWN = 5.5, SPECIAL_AREA = 42;
const BOT_NAMES = ['小墨', '咕噜', '泡泡', '阿飞', '闪电', '橘子汽水', '海苔', '奶昔', '跳跳糖', '大橙', '蓝莓', '噗噗', '墨鱼丸'];
const TEAMMAT = [0, 1].map(() => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0xffffff, emissiveIntensity: 0.16 }));
const TEAMGHOST = [0, 1].map(() => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.38, depthWrite: false, emissive: 0xffffff, emissiveIntensity: 0.3 }));
const GEO = {};
function initGeo() {
  GEO.sphere = new THREE.SphereGeometry(1, 20, 14);
  GEO.sphereLo = new THREE.IcosahedronGeometry(1, 1);
  GEO.cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
  GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 16);
  GEO.beam = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
}
function buildWeaponModel(id, T, trimHex) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x2c2f3b, roughness: 0.35, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: trimHex, roughness: 0.4 });
  const rx = (m, a = Math.PI / 2) => { m.rotation.x = a; return m; };
  if (id === 'charger') {
    g.add(mesh(new THREE.BoxGeometry(0.11, 0.14, 0.44), body, 0, 0.02, 0.06));
    g.add(rx(mesh(GEO.cyl, trim, 0, 0.04, 0.64, 0.034, 0.76, 0.034)));
    g.add(rx(mesh(GEO.cyl, body, 0, 0.04, 1.0, 0.052, 0.09, 0.052)));
    g.add(rx(mesh(GEO.cyl, body, 0, 0.04, 0.46, 0.045, 0.05, 0.045)));
    g.add(mesh(new THREE.BoxGeometry(0.035, 0.05, 0.36), trim, 0, -0.04, 0.44));
    g.add(rx(mesh(GEO.cyl, body, 0, 0.145, 0.12, 0.034, 0.28, 0.034)));
    g.add(rx(mesh(GEO.cyl, T, 0, 0.145, 0.265, 0.03, 0.012, 0.03)));
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), body, 0, 0.1, 0.08));
    g.add(rx(mesh(GEO.cyl, T, 0, -0.01, -0.24, 0.065, 0.22, 0.065)));
    g.add(rx(mesh(new THREE.TorusGeometry(0.066, 0.012, 6, 16), trim, 0, -0.01, -0.3), 0));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.13, 0.06), body, 0, -0.085, 0.02));
  } else {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.12, 0.36), body, 0, 0.02, 0.12));
    g.add(rx(mesh(GEO.cyl, trim, 0, 0.03, 0.36, 0.035, 0.18, 0.035)));
    g.add(rx(mesh(GEO.cyl, T, 0, 0.12, 0.08, 0.05, 0.16, 0.05)));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), body, 0, -0.07, 0.02));
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), trim, 0, 0.03, 0.46));
  }
  return g;
}
function aimVec(c) { return new THREE.Vector3(Math.sin(c.aimYaw) * Math.cos(c.aimPitch), Math.sin(c.aimPitch), Math.cos(c.aimYaw) * Math.cos(c.aimPitch)); }
// march a straight ray (charger); returns end point, hit character or solid
function traceRay(owner, o, dir, range, step = 0.2) {
  let prev = o.clone(), p = o.clone();
  for (let t = step; t <= range; t += step) {
    p.set(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t);
    if (inBarrier(1 - owner.team, p)) return { end: p.clone(), barrier: true, t };
    for (const e of CHARS) if (e.team !== owner.team && Proj.hitChar(e, p, 0.12)) return { end: p.clone(), char: e, t };
    const s = solidAt(p.x, p.y, p.z);
    if (s) return { end: p.clone(), solid: s, prev: prev.clone(), t };
    prev.copy(p);
  }
  return { end: p.clone(), t: range };
}
function setTeamMats(c0, c1) {
  [c0, c1].forEach((c, i) => { TEAMMAT[i].color.set(c); TEAMMAT[i].emissive.set(c); TEAMGHOST[i].color.set(c); TEAMGHOST[i].emissive.set(c); });
}
function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m;
}
class Character {
  constructor(name, team, isPlayer, opts = {}) {
    this.name = name; this.team = team; this.isPlayer = !!isPlayer;
    this.weapon = WEAPONS[opts.weapon] || WEAPONS.rifle; this.look = opts.look || randomLook();
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.aimYaw = 0; this.aimPitch = 0; this.bodyYaw = 0;
    this.intent = { mx: 0, mz: 0, fire: false, swim: false, jump: false, bomb: false, special: false, aimDir: null };
    this.kills = 0; this.deaths = 0; this.paint = 0; this.id = CHARS.length;
    this.buildModel(); this.reset();
  }
  reset() {
    this.hp = 100; this.ink = 100; this.special = 0; this.alive = true; this.state = 'play';
    this.swim = false; this.submerged = false; this.climbing = false; this.grounded = true;
    this.fireCd = 0; this.bombCd = 0; this.lastHurt = -99; this.lastShot = -99; this.invulnT = 0; this.respawnT = 0;
    this.sp = null; this.hurtFlash = 0; this.phase = 0; this.recoil = 0; this.swimPop = 0; this.inEnemy = false; this.lastAttacker = null;
    this.vel.set(0, 0, 0); this.kills = 0; this.deaths = 0; this.paint = 0; this.charge = 0; this.charging = false; this.stored = 0; this.lastVia = null;
    this.root.visible = true; this.ghost.visible = false;
  }
  buildModel() {
    const L = this.look;
    const skin = new THREE.MeshStandardMaterial({ color: L.skin, roughness: 0.55 });
    const cloth = new THREE.MeshStandardMaterial({ color: L.cloth, roughness: 0.75 });
    const cloth2 = new THREE.MeshStandardMaterial({ color: L.cloth2, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: L.pants, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.18, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.3, metalness: 0.8 });
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false });
    this.mats = { skin, cloth, cloth2, pants };
    const T = TEAMMAT[this.team];
    const root = new THREE.Group(); this.root = root;
    const human = new THREE.Group(); root.add(human); this.human = human;
    // legs
    this.legs = [-1, 1].map(s => {
      const hip = new THREE.Group(); hip.position.set(s * 0.12, 0.5, 0); human.add(hip);
      hip.add(mesh(GEO.cap(0.085, 0.26), pants, 0, -0.2, 0));
      const shoe = mesh(GEO.cap(0.09, 0.14), white, 0, -0.44, 0.05, 1.1, 1, 1); shoe.rotation.x = Math.PI / 2; hip.add(shoe);
      const sole = mesh(GEO.cap(0.092, 0.14), T, 0, -0.47, 0.05, 1.12, 0.45, 1.02); sole.rotation.x = Math.PI / 2; hip.add(sole);
      return hip;
    });
    // torso
    const torso = new THREE.Group(); torso.position.y = 0.5; human.add(torso); this.torso = torso;
    torso.add(mesh(GEO.cap(0.215, 0.22), cloth, 0, 0.27, 0, 1.08, 1, 0.92));
    const hood = mesh(new THREE.TorusGeometry(0.15, 0.06, 8, 16), cloth2, 0, 0.53, -0.02); hood.rotation.x = Math.PI / 2; torso.add(hood);
    const emb = mesh(new THREE.CircleGeometry(0.06, 16), T, 0, 0.33, 0.205); torso.add(emb);
    const belt = mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 20), dark, 0, 0.08, 0); belt.rotation.x = Math.PI / 2; torso.add(belt);
    // backpack ink tank
    const tank = new THREE.Group(); tank.position.set(0, 0.3, -0.26); torso.add(tank);
    tank.add(mesh(GEO.cyl, glass, 0, 0, 0, 0.12, 0.34, 0.12));
    this.tankInk = mesh(GEO.cyl, T, 0, 0, 0, 0.1, 0.32, 0.1); tank.add(this.tankInk);
    tank.add(mesh(GEO.cyl, metal, 0, 0.19, 0, 0.13, 0.05, 0.13)); tank.add(mesh(GEO.cyl, metal, 0, -0.19, 0, 0.13, 0.05, 0.13));
    [-1, 1].forEach(s => { const st = mesh(new THREE.BoxGeometry(0.04, 0.42, 0.03), dark, s * 0.1, 0.28, -0.19); st.rotation.x = 0.2; torso.add(st); });
    // head
    const head = new THREE.Group(); head.position.y = 0.62; torso.add(head); this.head = head;
    head.add(mesh(GEO.sphere, skin, 0, 0.2, 0, 0.27, 0.26, 0.26));
    const visor = mesh(new THREE.CylinderGeometry(0.276, 0.276, 0.13, 24, 1, true, -1.9, 3.8), dark, 0, 0.21, 0); visor.material = dark; head.add(visor);
    visor.material.side = THREE.DoubleSide;
    this.eyes = [-1, 1].map(s => { const e = mesh(GEO.sphere, eyeM, s * 0.095, 0.215, 0.262, 0.045, 0.05, 0.02); head.add(e); return e; });
    const ear = [-1, 1].map(s => mesh(GEO.sphere, skin, s * 0.265, 0.18, 0, 0.05, 0.07, 0.05)); ear.forEach(e => head.add(e));
    // jelly crest
    const crest = new THREE.Group(); crest.position.set(0, 0.34, -0.03); head.add(crest); this.crest = crest;
    crest.add(mesh(GEO.sphere, T, 0, 0, 0, 0.25, 0.14, 0.28));
    crest.add(mesh(GEO.sphere, T, 0, 0.02, 0.17, 0.14, 0.1, 0.12));
    this.drips = [[0, -0.12, -0.24, 0.1, 0.16], [0.14, -0.1, -0.19, 0.08, 0.13], [-0.14, -0.1, -0.19, 0.08, 0.13], [0.2, -0.05, -0.05, 0.07, 0.1], [-0.2, -0.05, -0.05, 0.07, 0.1]].map(([x, y, z, r, h]) => { const d = mesh(GEO.sphere, T, x, y, z, r, h, r); crest.add(d); return d; });
    // headgear
    const hat = L.hat, hc = new THREE.MeshStandardMaterial({ color: L.hatColor, roughness: 0.6 });
    if (hat === 'phones') { const b = mesh(new THREE.TorusGeometry(0.29, 0.025, 6, 24, Math.PI), dark, 0, 0.22, 0); b.rotation.z = 0; head.add(b); [-1, 1].forEach(s => head.add(mesh(GEO.cyl, hc, s * 0.285, 0.2, 0, 0.09, 0.06, 0.09)).rotation && 0); head.children.slice(-2).forEach(c => c.rotation.z = Math.PI / 2); }
    else if (hat === 'band') { const b = mesh(new THREE.TorusGeometry(0.265, 0.035, 6, 24), hc, 0, 0.3, 0); b.rotation.x = Math.PI / 2 - 0.15; head.add(b); }
    else if (hat === 'goggles') { [-1, 1].forEach(s => { const g = mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 14), metal, s * 0.08, 0.36, 0.2); g.rotation.x = -0.6; head.add(g); const l = mesh(GEO.sphere, T, s * 0.08, 0.36, 0.2, 0.05, 0.05, 0.02); l.rotation.x = -0.6; head.add(l); }); }
    else if (hat === 'cap') { const brim = mesh(GEO.cyl, hc, 0, 0.3, 0.2, 0.2, 0.02, 0.14); brim.rotation.x = 0.15; head.add(brim); }
    // arms
    this.arms = [-1, 1].map(s => {
      const sh = new THREE.Group(); sh.position.set(s * 0.27, 0.43, 0); torso.add(sh);
      sh.add(mesh(GEO.cap(0.07, 0.2), cloth, 0, -0.15, 0));
      sh.add(mesh(GEO.sphere, white, 0, -0.3, 0, 0.075));
      return sh;
    });
    // sockets: weapons attach here (keeps weapon models independent of the body model)
    const handR = new THREE.Group(); handR.position.set(0, -0.33, 0); handR.rotation.x = Math.PI / 2; this.arms[0].add(handR);
    const handL = new THREE.Group(); handL.position.set(0, -0.33, 0); this.arms[1].add(handL);
    this.sockets = { handR, handL, back: tank };
    this.gun = handR;
    handR.add(buildWeaponModel(this.weapon.id, T, L.trim));
    // charger laser sight (visible to everyone)
    if (this.weapon.type === 'charge') {
      this.laserMat = new THREE.MeshBasicMaterial({ color: TEAM_HEX[this.team], transparent: true, opacity: 0.5, depthWrite: false, fog: false });
      this.laser = new THREE.Mesh(GEO.beam, this.laserMat); this.laser.visible = false; this.laser.renderOrder = 3; scene.add(this.laser);
      this.laserDot = new THREE.Mesh(GEO.sphere, this.laserMat); this.laserDot.visible = false; scene.add(this.laserDot);
    }
    // blob (swim form)
    const blob = new THREE.Group(); root.add(blob); blob.visible = false; this.blob = blob;
    this.blobBody = new THREE.Group(); blob.add(this.blobBody);
    this.blobBody.add(mesh(GEO.sphere, T, 0, 0.26, 0, 0.42, 0.28, 0.46));
    this.blobBody.add(mesh(GEO.sphere, T, 0, 0.42, -0.14, 0.2, 0.18, 0.22));
    this.blobBody.add(mesh(GEO.sphere, T, 0, 0.55, -0.24, 0.08, 0.1, 0.08));
    [-1, 1].forEach(s => { this.blobBody.add(mesh(GEO.sphere, eyeM, s * 0.14, 0.38, 0.34, 0.085, 0.1, 0.06)); this.blobBody.add(mesh(GEO.sphere, dark, s * 0.14, 0.38, 0.39, 0.04, 0.055, 0.03)); });
    this.blobGhost = mesh(GEO.sphere, TEAMGHOST[this.team], 0, 0.12, 0, 0.45, 0.14, 0.5); this.blobGhost.castShadow = false; blob.add(this.blobGhost);
    // death ghost
    const ghost = new THREE.Group(); this.ghost = ghost; ghost.visible = false;
    ghost.add(mesh(GEO.sphere, TEAMGHOST[this.team], 0, 0, 0, 0.3, 0.36, 0.3));
    ghost.add(mesh(new THREE.ConeGeometry(0.3, 0.4, 16), TEAMGHOST[this.team], 0, -0.36, 0)); ghost.children[1].rotation.x = Math.PI;
    [-1, 1].forEach(s => ghost.add(mesh(GEO.sphere, eyeM, s * 0.1, 0.05, 0.26, 0.05, 0.07, 0.03)));
    scene.add(ghost);
    // ally name tag
    if (!this.isPlayer) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 72; const g = c.getContext('2d');
      g.font = '900 34px "PingFang SC","Microsoft YaHei",sans-serif'; g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = '#111'; g.fillStyle = '#fff';
      g.strokeText(this.name, 128, 36); g.fillText(this.name, 128, 36);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(116, 50); g.lineTo(140, 50); g.lineTo(128, 66); g.closePath(); g.lineWidth = 4; g.stroke(); g.fill();
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true, sizeAttenuation: false }));
      this.tag.scale.set(0.11, 0.031, 1); this.tag.position.y = 2.05; this.tag.renderOrder = 5; root.add(this.tag);
    }
    root.traverse(o => { if (o.isMesh && o.material && o.material.transparent) o.castShadow = false; });
    scene.add(root);
  }
  get fwd() { return new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)); }
  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.swim ? 0.5 : 1.3), this.pos.z); }
  chest() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.swim ? 0.3 : 0.95), this.pos.z); }
  muzzle() {
    const y = this.aimYaw, cp = Math.cos(this.aimPitch), sp = Math.sin(this.aimPitch);
    const rx = -Math.cos(y), rz = Math.sin(y), fx = Math.sin(y), fz = Math.cos(y);
    const f = this.weapon.muzzleF;
    return new THREE.Vector3(this.pos.x + rx * 0.27 + fx * f * cp, this.pos.y + 0.93 + sp * f, this.pos.z + rz * 0.27 + fz * f * cp);
  }
  onOwnDeck() { const d = DECK[this.team]; return this.pos.y > 1.9 && inRect(d, this.pos.x, this.pos.z); }
  inOwnBarrier() { return inBarrier(this.team, this.pos); }
  invuln() { return this.invulnT > 0 || !!this.sp || this.state === 'drop' || this.inOwnBarrier(); }
  setSwim(on) {
    if (on === this.swim) return;
    this.swim = on; this.swimPop = 1;
    this.human.visible = !on; this.blob.visible = on;
    if (on) Fx.burst(this.pos.x, this.pos.y + 0.3, this.pos.z, TEAM_HEX[this.team], 10, 3, 0.1);
    if (this.isPlayer) on ? Sfx.swimIn() : Sfx.swimOut();
  }
  damage(amount, src, via) {
    if (!this.alive || this.invuln() || G.state !== 'play') return false;
    this.hp -= amount; this.lastHurt = G.time; this.hurtFlash = 0.14; this.lastAttacker = src; this.lastVia = via || (src && src.weapon.id);
    if (this.isPlayer) { Sfx.hurt(); HUD.hurt(amount, src); }
    if (src && src.isPlayer) { Sfx.hit(); HUD.hitmark(false); }
    if (this.hp <= 0) this.die(src, this.lastVia);
    return true;
  }
  die(killer, via) {
    this.alive = false; this.state = 'dead'; this.respawnT = RESPAWN; this.deaths++; this.hp = 0;
    this.setSwim(false); this.sp = null; this.climbing = false; this.stopCharge(); this.stored = 0;
    this.special = Math.floor(this.special * (1 - this.weapon.spLoss));
    const kc = killer ? killer.team : 1 - this.team;
    if (killer) killer.kills++;
    const gy = groundBelow(this.pos.x, this.pos.z, this.pos.y + 0.2, 0.3);
    splatFloor(this.pos.x, gy, this.pos.z, 2.2, kc, 1.0);
    Fx.burst(this.pos.x, this.pos.y + 0.8, this.pos.z, TEAM_HEX[kc], 42, 9, 0.2);
    Fx.burst(this.pos.x, this.pos.y + 0.8, this.pos.z, TEAM_HEX[this.team], 16, 6, 0.14);
    Fx.ring(this.pos.x, gy + 0.05, this.pos.z, TEAM_HEX[kc], 3.2);
    this.root.visible = false;
    this.ghost.visible = true; this.ghost.position.set(this.pos.x, this.pos.y + 1, this.pos.z); this.ghostT = 0;
    const v = sndVol(this.pos); Sfx.death && v > 0.05 && Sfx.death();
    HUD.killfeed(killer, this, via);
    if (killer && killer.isPlayer) { Sfx.kill(); HUD.hitmark(true); }
    if (this.isPlayer) HUD.died(killer, via);
  }
  respawn() {
    const sp = SPAWN[this.team]; this.state = 'drop'; this.alive = true; this.hp = 100; this.ink = 100;
    this.pos.set(sp.x + rand(-2.5, 2.5), sp.y + 24, sp.z + rand(-1.5, 1.5)); this.vel.set(0, -30, 0);
    this.aimYaw = this.yaw = this.bodyYaw = sp.yaw; this.aimPitch = 0;
    this.root.visible = true; this.ghost.visible = false; this.human.visible = true; this.blob.visible = false; this.swim = false;
    if (this.isPlayer) { Sfx.superJump(); HUD.respawned(); Cam.yaw = sp.yaw; Cam.pitch = -0.1; }
  }
  stopCharge() {
    this.charge = 0; this.charging = false;
    if (this.laser) { this.laser.visible = false; this.laserDot.visible = false; }
    if (this.isPlayer) Sfx.chargeStop();
  }
  startSpecial() {
    this.special = 0; this.sp = { phase: 0, t: 0 }; this.setSwim(false); this.stopCharge();
    this.vel.set(this.vel.x * 0.3, 13, this.vel.z * 0.3); this.grounded = false;
    if (sndVol(this.pos) > 0.05) Sfx.special();
    Fx.burst(this.pos.x, this.pos.y + 0.5, this.pos.z, TEAM_HEX[this.team], 20, 6, 0.15);
    if (this.isPlayer) HUD.center('墨浪冲击！', '', 900);
  }
  step(dt) {
    const I = this.intent;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.state === 'dead') {
      this.respawnT -= dt; this.ghostT += dt;
      this.ghost.position.y += dt * 1.2; this.ghost.rotation.y += dt * 2; this.ghost.position.x += Math.sin(this.ghostT * 4) * dt * 0.5;
      const s = Math.max(0, 1 - this.ghostT / 2.2); this.ghost.scale.setScalar(0.3 + s * 0.8); if (this.ghostT > 2.2) this.ghost.visible = false;
      if (this.respawnT <= 0 && G.state === 'play') this.respawn();
      return;
    }
    if (this.state === 'drop') {
      this.pos.y += this.vel.y * dt;
      if (Math.random() < 0.8) Fx.spark(this.pos.x, this.pos.y + 0.8, this.pos.z, TEAM_HEX[this.team]);
      const sp = SPAWN[this.team];
      if (this.pos.y <= sp.y) {
        this.pos.y = sp.y; this.vel.set(0, 0, 0); this.state = 'play'; this.grounded = true; this.invulnT = 1.5;
        splatFloor(this.pos.x, sp.y, this.pos.z, 2.3, this.team, 0.3, false);
        Fx.burst(this.pos.x, this.pos.y + 0.3, this.pos.z, TEAM_HEX[this.team], 18, 5, 0.12); Fx.ring(this.pos.x, sp.y + 0.05, this.pos.z, TEAM_HEX[this.team], 2.6);
        if (sndVol(this.pos) > 0.1) Sfx.land(sndVol(this.pos));
      }
      this.syncModel(dt); return;
    }
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.fireCd -= dt; this.bombCd -= dt;
    const T = G.time;
    // ----- special
    if (this.sp) {
      const s = this.sp; s.t += dt;
      if (s.phase === 0 && s.t > 0.5) { s.phase = 1; s.t = 0; this.vel.y = 0; }
      if (s.phase === 1) { this.vel.y = 0; this.vel.x *= 0.9; this.vel.z *= 0.9; if (s.t > 0.28) { s.phase = 2; this.vel.y = -34; } }
    } else if (I.special && this.special >= 100 && this.alive && G.state === 'play') this.startSpecial();
    // ----- swim state
    const wantSwim = I.swim && !this.sp;
    this.setSwim(wantSwim);
    const fo = this.grounded ? ownerAt(this.pos.x, this.pos.y, this.pos.z) : -3;
    this.submerged = this.swim && ((this.grounded && fo === this.team) || this.climbing);
    this.inEnemy = this.grounded && fo === 1 - this.team && !this.climbing;
    const W = this.weapon;
    const firing = (I.fire && !this.swim && !this.sp && T - this.lastShot < 0.25) || this.charging;
    // ----- movement
    let maxSp;
    if (this.swim) maxSp = this.submerged ? 12.8 : this.inEnemy ? 2.0 : 3.4;
    else maxSp = this.inEnemy ? 2.3 : this.charging ? W.moveCharge : firing ? W.moveFire : 6.4;
    if (this.sp) maxSp = 3;
    const acc = this.grounded ? (this.submerged ? 75 : 48) : 16;
    const mlen = Math.min(1, Math.hypot(I.mx, I.mz));
    const tx = I.mx * maxSp, tz = I.mz * maxSp;
    const ax = tx - this.vel.x, az = tz - this.vel.z, al = Math.hypot(ax, az), maxA = acc * dt;
    if (al > maxA) { this.vel.x += ax / al * maxA; this.vel.z += az / al * maxA; } else { this.vel.x = tx; this.vel.z = tz; }
    if (I.jump && this.grounded && !this.sp) { this.vel.y = this.swim ? 9.8 : 8.3; this.grounded = false; if (this.isPlayer) Sfx.jump(); if (this.swim) Fx.burst(this.pos.x, this.pos.y + 0.1, this.pos.z, TEAM_HEX[this.team], 6, 3, 0.08); }
    I.jump = false;
    // horizontal integrate + collide
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const hit = this.collide();
    // climbing
    this.climbing = false;
    if (this.swim && hit && hit.s.t === 'box' && hit.s.faces && mlen > 0.2 && !this.sp) {
      const d = hit.nx > 0.5 ? '+x' : hit.nx < -0.5 ? '-x' : hit.nz > 0.5 ? '+z' : hit.nz < -0.5 ? '-z' : null;
      const f = d && hit.s.faces[d];
      const into = -(I.mx * hit.nx + I.mz * hit.nz) / (mlen || 1);
      if (f && into > 0.3) {
        const along = f.ax ? this.pos.z : this.pos.x;
        if (wallOwner(f, along - f.a0, this.pos.y + 0.35) === this.team || wallOwner(f, along - f.a0, this.pos.y + 0.05) === this.team && this.pos.y > 0.05) {
          this.climbing = true; this.vel.y = 7.5 * into; this.submerged = true;
          if (this.pos.y + 0.35 >= f.h) { this.vel.y = 6.5; this.pos.x -= hit.nx * 0.45; this.pos.z -= hit.nz * 0.45; this.climbing = false; }
          if (Math.random() < 0.3) Fx.spark(this.pos.x + hit.nx * 0.1, this.pos.y + 0.3, this.pos.z + hit.nz * 0.1, TEAM_HEX[this.team]);
        }
      }
    }
    // vertical
    if (!this.climbing) this.vel.y -= GRAV * dt;
    const wasG = this.grounded;
    this.pos.y += this.vel.y * dt;
    const g = groundBelow(this.pos.x, this.pos.z, Math.max(this.pos.y, this.pos.y - this.vel.y * dt), STEP);
    if (this.pos.y <= g) {
      if (!wasG && this.vel.y < -12 && this.isPlayer) Sfx.land(0.5);
      this.pos.y = g; if (this.vel.y < 0) this.vel.y = 0; this.grounded = true;
      if (this.sp && this.sp.phase === 2) this.specialSlam();
    } else if (wasG && this.vel.y <= 0 && this.pos.y - g < 0.35 && !this.climbing) { this.pos.y = g; this.vel.y = 0; this.grounded = true; }
    else this.grounded = false;
    if (this.pos.y < -10) { this.die(this.lastAttacker); return; }
    // ----- ink / hp
    if (this.submerged) { this.ink = Math.min(100, this.ink + 40 * dt); }
    else if (T - this.lastShot > 0.6) this.ink = Math.min(100, this.ink + (this.swim ? 12 : 6.5) * dt);
    if (T - this.lastHurt > 1.3) this.hp = Math.min(100, this.hp + (this.submerged ? 65 : 16) * dt);
    if (this.inEnemy && !this.invuln()) { if (this.hp > 40) { this.hp = Math.max(40, this.hp - 16 * dt); this.lastHurt = T - 0.6; } }
    // ----- aiming / facing
    const turnK = this.swim ? 14 : 20;
    if (this.swim && mlen > 0.1) this.bodyYaw += angDiff(this.bodyYaw, Math.atan2(I.mx, I.mz)) * Math.min(1, dt * turnK);
    else if (!this.swim) this.bodyYaw += angDiff(this.bodyYaw, this.aimYaw) * Math.min(1, dt * turnK);
    // ----- weapons
    if (W.type === 'auto') {
      if (I.fire && !this.swim && !this.sp && this.fireCd <= 0 && G.state === 'play') {
        if (this.ink >= W.cost) {
          this.fireCd = W.interval; this.ink -= W.cost; this.lastShot = T; this.recoil = 1;
          const m = this.muzzle();
          const dir = I.aimDir ? I.aimDir.clone() : aimVec(this);
          const spread = this.grounded ? W.spread : W.airSpread;
          dir.x += rand(-spread, spread); dir.y += rand(-spread, spread) * 0.6; dir.z += rand(-spread, spread); dir.normalize();
          Proj.shot(this, m, dir);
          const v = sndVol(this.pos) * (this.isPlayer ? 1 : 0.55); if (v > 0.03) Sfx.shoot(v);
        } else if (this.isPlayer) HUD.lowInk();
      }
    } else if (W.type === 'charge') this.updateCharge(dt, I, T);
    if (I.bomb && !this.swim && !this.sp && this.bombCd <= 0 && G.state === 'play') {
      if (this.ink >= 70) {
        this.ink -= 70; this.bombCd = 0.6; this.lastShot = T;
        const dir = I.aimDir ? I.aimDir.clone() : new THREE.Vector3(Math.sin(this.aimYaw) * Math.cos(this.aimPitch), Math.sin(this.aimPitch), Math.cos(this.aimYaw) * Math.cos(this.aimPitch));
        Proj.bomb(this, this.muzzle(), dir);
      } else if (this.isPlayer) HUD.lowInk();
    }
    I.bomb = false;
    this.syncModel(dt);
  }
  updateCharge(dt, I, T) {
    const W = this.weapon;
    // storing a full charge while submerged
    if (this.swim && this.charging && this.charge >= 1 && I.fire) { this.charging = false; this.stored = W.storeTime; if (this.laser) { this.laser.visible = this.laserDot.visible = false; } if (this.isPlayer) Sfx.chargeStop(); }
    if (this.stored > 0) {
      if (!I.fire || this.sp || !this.alive) { this.stored = 0; this.charge = 0; }
      else if (this.swim) { this.stored -= dt; if (this.stored <= 0) { this.stored = 0; this.charge = 0; } return; }
      else { this.stored = 0; this.charging = true; this.charge = 1; this.lastShot = T; if (this.isPlayer) { Sfx.chargeStart(); Sfx.chargeSet(1); } return; }
    }
    const can = I.fire && !this.swim && !this.sp && G.state === 'play';
    if (can && (this.charging || this.fireCd <= 0)) {
      if (!this.charging) {
        if (this.ink < W.costMin) { if (this.isPlayer) HUD.lowInk(); return; }
        this.charging = true; this.charge = 0; if (this.isPlayer) Sfx.chargeStart();
      }
      const mc = W.minCharge, maxC = mc + (1 - mc) * clamp((this.ink - W.costMin) / (W.costFull - W.costMin), 0, 1);
      const before = this.charge;
      this.charge = Math.min(maxC, this.charge + dt / W.chargeTime);
      if (before < 1 && this.charge >= 1 && this.isPlayer) Sfx.chargeFull();
      if (this.isPlayer) Sfx.chargeSet(this.charge);
      this.lastShot = T;
    } else if (this.charging) {
      const c = this.charge, live = !this.swim && !this.sp && G.state === 'play';
      this.stopCharge();
      if (live) { this.fireCharger(c, I); this.fireCd = 0.18; }
    }
  }
  chargeT(c) { const W = this.weapon; return clamp((Math.max(c, W.minCharge) - W.minCharge) / (1 - W.minCharge), 0, 1); }
  rangeNow() { const W = this.weapon; return W.type === 'charge' ? lerp(W.minRange, W.maxRange, this.chargeT(this.charge)) : W.range; }
  fireCharger(c, I) {
    const W = this.weapon, T = G.time, ct = this.chargeT(c);
    this.ink = Math.max(0, this.ink - lerp(W.costMin, W.costFull, ct)); this.lastShot = T; this.recoil = 1.6;
    const m = this.muzzle(), dir = I.aimDir ? I.aimDir.clone() : aimVec(this);
    if (c < 1) { const s = 0.01 * (1 - c); dir.x += rand(-s, s); dir.y += rand(-s, s); dir.z += rand(-s, s); dir.normalize(); }
    const range = lerp(W.minRange, W.maxRange, ct);
    const tr = traceRay(this, m, dir, range, 0.2);
    // ink line along the path
    let gained = 0; const lr = W.lineR * (0.7 + 0.3 * c);
    for (let t = 1.0; t < tr.t - 0.6; t += 0.75) {
      const qx = m.x + dir.x * t, qy = m.y + dir.y * t, qz = m.z + dir.z * t;
      if (Math.abs(qx) > XH || Math.abs(qz) > ZH) continue;
      const gy = groundBelow(qx, qz, qy, 0); if (qy - gy > 7) continue;
      gained += splatFloor(qx + rand(-0.1, 0.1), gy, qz + rand(-0.1, 0.1), lr * rand(0.8, 1.15), this.team, 0.7, false);
    }
    this.addPaint(gained);
    const ir = lerp(W.impactR[0], W.impactR[1], ct), col = TEAM_HEX[this.team];
    if (tr.char) {
      const dmg = c >= 0.999 ? W.dmgFull : lerp(W.dmgMin, W.dmgMax, ct);
      const e = tr.char; e.damage(dmg, this, W.id);
      Proj.splash(this, new THREE.Vector3(e.pos.x, groundBelow(e.pos.x, e.pos.z, e.pos.y + 0.3, 0.3), e.pos.z), new THREE.Vector3(0, 1, 0), dir, ir * 0.6, 'floor');
      Fx.burstDir(tr.end.x, tr.end.y, tr.end.z, col, 16, 5, 0.1, dir.x, dir.y + 0.3, dir.z, 0.6);
    } else if (tr.solid) {
      const h = Proj.classify(tr.solid, tr.prev, tr.end);
      if (h.type === 'floor') Proj.splash(this, new THREE.Vector3(tr.end.x, h.y, tr.end.z), h.n, dir, ir, 'floor');
      else if (h.type === 'wall') Proj.splash(this, h.pt, h.n, dir, ir * 0.85, 'wall', h.face);
      if (c >= 0.999 && h.type === 'floor') Fx.ring(tr.end.x, h.y + 0.06, tr.end.z, col, ir * 1.3);
    } else if (tr.barrier) {
      Fx.burst(tr.end.x, tr.end.y, tr.end.z, col, 8, 3, 0.07); Barrier.flash(1 - this.team);
    } else {
      // out of range: the ink slug loses energy and falls, splashing where it lands
      Proj.spray(this, tr.end, dir.clone().multiplyScalar(11), ir * 0.7, true);
    }
    Fx.beam(m, tr.end, col, 0.035 + 0.05 * c);
    Fx.burst(m.x, m.y, m.z, col, 6, 3, 0.07);
    const v = sndVol(this.pos) * (this.isPlayer ? 1 : 0.7); if (v > 0.03) Sfx.cannon(v, c);
    if (this.isPlayer) G.shake(0.25 + 0.35 * c);
  }
  updateLaser() {
    if (!this.laser) return;
    const on = this.charging && this.alive && !this.swim;
    this.laser.visible = this.laserDot.visible = on;
    if (!on) return;
    const W = this.weapon, R = this.rangeNow(), ready = this.charge >= W.minCharge;
    const m = this.muzzle(), dir = this.intent.aimDir ? this.intent.aimDir.clone() : aimVec(this);
    const tr = traceRay(this, m, dir, R, 0.3);
    const len = Math.max(0.1, m.distanceTo(tr.end)), full = this.charge >= 1;
    const w = full ? 0.022 + Math.sin(G.time * 30) * 0.006 : ready ? 0.013 + this.charge * 0.006 : 0.008;
    this.laser.position.copy(m); this.laser.lookAt(tr.end); this.laser.scale.set(w, w, len);
    this.laserDot.position.copy(tr.end); this.laserDot.scale.setScalar(full ? 0.12 : 0.07);
    this.laserMat.opacity = full ? 0.9 : ready ? 0.35 + this.charge * 0.4 : 0.18;
  }
  specialSlam() {
    const p = this.pos; this.sp = null; this.invulnT = 0.6;
    const g = this.pos.y;
    const gained = splatFloor(p.x, g, p.z, 6.8, this.team, 2.2);
    this.addPaint(gained, false);
    Fx.burst(p.x, g + 0.4, p.z, TEAM_HEX[this.team], 90, 14, 0.26); Fx.ring(p.x, g + 0.08, p.z, TEAM_HEX[this.team], 9); Fx.ring(p.x, g + 0.08, p.z, '#ffffff', 6);
    const v = sndVol(p); Sfx.boom(Math.max(0.3, v)); G.shake(this.isPlayer ? 1.2 : 0.9 * v);
    for (const c of CHARS) { if (c.team === this.team || !c.alive) continue; const d = c.pos.distanceTo(p); if (d < 5.5) c.damage(d < 3.6 ? 220 : lerp(120, 40, (d - 3.6) / 1.9), this, 'surge'); }
  }
  addPaint(cells, charge = true) {
    const a = cells * CELL * CELL; this.paint += a;
    if (charge && !this.sp) this.special = Math.min(100, this.special + a / this.weapon.spArea * 100);
  }
  collide() {
    const r = 0.38; let hit = null;
    for (const s of SOLIDS) {
      let x = this.pos.x, z = this.pos.z;
      if (x + r < s.x0 || x - r > s.x1 || z + r < s.z0 || z - r > s.z1) continue;
      const cx = clamp(x, s.x0, s.x1), cz = clamp(z, s.z0, s.z1);
      if (topAt(s, cx, cz) <= this.pos.y + STEP) continue;
      let dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), nx, nz;
      if (d > 1e-5) { if (d >= r) continue; nx = dx / d; nz = dz / d; this.pos.x = cx + nx * r; this.pos.z = cz + nz * r; }
      else {
        const pl = x - s.x0, pr = s.x1 - x, pb = z - s.z0, pf = s.z1 - z, m = Math.min(pl, pr, pb, pf);
        if (m === pl) { nx = -1; nz = 0; this.pos.x = s.x0 - r; } else if (m === pr) { nx = 1; nz = 0; this.pos.x = s.x1 + r; }
        else if (m === pb) { nx = 0; nz = -1; this.pos.z = s.z0 - r; } else { nx = 0; nz = 1; this.pos.z = s.z1 + r; }
      }
      const vn = this.vel.x * nx + this.vel.z * nz; if (vn < 0) { this.vel.x -= nx * vn; this.vel.z -= nz * vn; }
      hit = { s, nx, nz };
    }
    { const sp = SPAWN[1 - this.team], dx = this.pos.x - sp.x, dz = this.pos.z - sp.z, d = Math.hypot(dx, dz), R = BARRIER_R + 0.4;
      if (d < R && this.pos.y < BARRIER_H && d > 1e-4) { const nx = dx / d, nz = dz / d; this.pos.x = sp.x + nx * R; this.pos.z = sp.z + nz * R; const vn = this.vel.x * nx + this.vel.z * nz; if (vn < 0) { this.vel.x -= nx * vn; this.vel.z -= nz * vn; } Barrier.flash(1 - this.team); } }
    const lim = 0.38;
    if (this.pos.x > XH - lim) { this.pos.x = XH - lim; this.vel.x = Math.min(0, this.vel.x); }
    if (this.pos.x < -XH + lim) { this.pos.x = -XH + lim; this.vel.x = Math.max(0, this.vel.x); }
    if (this.pos.z > ZH - lim) { this.pos.z = ZH - lim; this.vel.z = Math.min(0, this.vel.z); }
    if (this.pos.z < -ZH + lim) { this.pos.z = -ZH + lim; this.vel.z = Math.max(0, this.vel.z); }
    return hit;
  }
  syncModel(dt) {
    const T = G.time;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.bodyYaw;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const run = clamp(hs / 6, 0, 1);
    this.phase += hs * dt * 2.3;
    this.swimPop = Math.max(0, this.swimPop - dt * 4);
    if (!this.swim) {
      const air = !this.grounded;
      const sw = Math.sin(this.phase);
      this.legs[0].rotation.x = air ? -0.6 : sw * 0.9 * run;
      this.legs[1].rotation.x = air ? 0.35 : -sw * 0.9 * run;
      this.human.position.y = air ? 0 : Math.abs(Math.cos(this.phase)) * 0.06 * run;
      this.torso.rotation.x = 0.1 * run;
      const pitch = this.aimPitch, rel = angDiff(this.bodyYaw, this.aimYaw);
      this.torso.rotation.y = clamp(rel, -0.6, 0.6);
      this.recoil = Math.max(0, this.recoil - dt * 12);
      this.arms[0].rotation.set(-Math.PI / 2 - pitch + this.recoil * 0.12, 0, 0);
      this.gun.position.y = -0.33 + this.recoil * 0.04;
      const firing = G.time - this.lastShot < 0.3;
      if (this.weapon.cls === 'charger') {
        // two-handed long gun: left hand supports the barrel; crouch while charging
        this.arms[1].rotation.set(-Math.PI / 2 * 0.97 - pitch, 0, -0.62);
        const cr = this.charging ? 0.05 + this.charge * 0.04 : 0;
        this.human.position.y -= cr; this.torso.rotation.x += cr * 2.5;
        this.gun.position.y = -0.33 + this.recoil * 0.07;
      } else if (firing) this.arms[1].rotation.set(-Math.PI / 2 * 0.85 - pitch, 0, -0.55);
      else this.arms[1].rotation.set(-sw * 0.8 * run + (air ? -1.2 : 0), 0, air ? 0.5 : 0.08);
      this.head.rotation.x = -pitch * 0.4;
      this.crest.scale.set(1, 1 + Math.sin(T * 9 + this.id) * 0.04 - this.vel.y * 0.012, 1);
      this.drips.forEach((d, i) => d.position.y = -0.1 - (i === 0 ? 0.02 : 0) + Math.sin(T * 7 + i) * 0.012 - Math.max(0, this.vel.y) * 0.004);
      const k = 1 + this.swimPop * 0.25; this.human.scale.set(k, 2 - k, k);
      this.tankInk.scale.y = 0.32 * clamp(this.ink / 100, 0.02, 1); this.tankInk.position.y = -0.16 + this.tankInk.scale.y / 2;
      const fl = this.hurtFlash > 0 ? 0.8 : 0; this.mats.cloth.emissive.setRGB(fl, fl * 0.3, fl * 0.3); this.mats.skin.emissive.setRGB(fl, fl * 0.3, fl * 0.3);
    } else {
      const sub = this.submerged;
      const showBody = !sub;
      this.blobBody.visible = showBody;
      this.blobGhost.visible = sub && this.isPlayer;
      const wob = Math.sin(T * 14) * 0.08 * run;
      const pop = 1 + this.swimPop * 0.5;
      this.blobBody.scale.set((1 + wob) * pop, (1 - wob) / pop, (1 + run * 0.18) * pop);
      this.blobBody.rotation.x = this.climbing ? -1.2 : 0;
      if (sub && hs > 3 && Math.random() < 0.35) Fx.wake(this.pos.x, this.pos.y + 0.05, this.pos.z, TEAM_HEX[this.team]);
    }
    if (this.tag) this.tag.visible = this.team === PLAYER.team && this.alive;
    this.updateLaser();
  }
}
