/* ============================================================ STRATEGIST (smart mode)
   The enemy team reads how the player plays and picks a plan against it, like rock-paper-scissors:
     the player hunts people        -> 抢地 paint: most of them avoid fights and take the map
     the player paints and avoids   -> 围猎 hunt: a couple of them go and make the player fight
     the player dives deep          -> 绕后 flank: someone slips round to the player's own half
     the player keeps to one route  -> 封路 block: someone lies in wait on it
     the player flips their side    -> 反推 retake: someone goes back and paints it again
   Keeping the score close comes first, so the plans only run while the game is close: once one side pulls
   away the Director's own lever takes over (the side behind keeps to painting, the side ahead eases off) -
   measured against bots, every way of mixing the plans into that made runaways more likely, not less.
   Within a close game stronger bots counter harder and read the player quicker.                        */
const PLAN_NAME = { paint: '抢地', hunt: '围猎', flank: '绕后', block: '封路', retake: '反推' };
const Strategist = {
  NX: 3, NZ: 4, zoneCache: {},
  reset() {
    this.zoneMap();
    this.alive = 0; this.fs = 0.35; this.depth = 0; this.lanes = [1 / 3, 1 / 3, 1 / 3]; this.choke = TAC.chokes.map(() => 0);
    this.hist = []; this.shareT = 0; this.evalT = 6; this.assignT = 0; this.plan = null; this.plan2 = null; this.planT = 0; this.k = 0; this.prof = null; this.scores = null;
    for (const b of G.bots) b.task = null;
  },
  get on() { return Director.on && !this.off; },                          // (off: tests comparing with and without plans)
  team() { return 1 - PLAYER.team; },                                       // the side that reads and counters
  laneOf(x) { return clamp(Math.floor((x + XH) / (2 * XH) * this.NX), 0, this.NX - 1); },
  bandOf(z) { return clamp(Math.floor((z + ZH) / (2 * ZH) * this.NZ), 0, this.NZ - 1); },
  // the map in 3 lanes x 4 bands, with a sample of standing spots in each (worked out once per map)
  zoneMap() {
    const c = this.zoneCache[MAP_ID]; if (c) { this.zones = c; return; }
    const zs = []; for (let i = 0; i < this.NX * this.NZ; i++) zs.push({ id: i, lane: Math.floor(i / this.NZ), band: i % this.NZ, nodes: [], x: 0, z: 0 });
    for (let k = 0; k < NAV.N; k++) { if (NAV.h[k] > 90 || TAC.reach[0][k] < 0 && TAC.reach[1][k] < 0) continue; const p = navPos(k), z = zs[this.laneOf(p.x) * this.NZ + this.bandOf(p.z)]; z.nodes.push(k); z.x += p.x; z.z += p.z; }
    for (const z of zs) { const n = Math.max(1, z.nodes.length); z.x /= n; z.z /= n; if (z.nodes.length > 400) z.nodes = z.nodes.sort(() => Math.random() - 0.5).slice(0, 400); }
    this.zones = this.zoneCache[MAP_ID] = zs.filter(z => z.nodes.length >= 6);
  },
  // share of a zone that is ours (the countering side's) and theirs, from a handful of spots
  sample(z, team) { let m = 0, t = 0, n = 0; for (let i = 0; i < 10; i++) { const p = navPos(z.nodes[randi(0, z.nodes.length - 1)]), o = ownerAt(p.x, p.y, p.z); if (o === -2) continue; n++; if (o === team) m++; else if (o === 1 - team) t++; } return n ? [m / n, t / n] : [0, 0]; },
  // ---------------------------------------------------------------- reading the player
  observe(dt) {
    const P = PLAYER, T = G.time, tm = this.team();
    if (P.alive && P.state === 'play' && !Director.idle()) {
      this.alive += dt; const a = t => 1 - Math.exp(-dt / t);
      let fighting = false; for (const [, f] of Director.fights) if (T - f.last < 2) fighting = true;
      this.fs += ((fighting ? 1 : 0) - this.fs) * a(40);
      this.depth += (depthOf(P.team, P.pos.z) / ZH - this.depth) * a(30);
      const ln = this.laneOf(P.pos.x); for (let i = 0; i < this.NX; i++) this.lanes[i] += ((i === ln ? 1 : 0) - this.lanes[i]) * a(40);
      TAC.chokes.forEach((k, i) => { this.choke[i] += ((Math.hypot(k.x - P.pos.x, k.z - P.pos.z) < 7 ? 1 : 0) - this.choke[i]) * a(45); });
    }
    if ((this.shareT -= dt) <= 0) { this.shareT = 1; this.hist.push(this.zones.map(z => this.sample(z, tm))); if (this.hist.length > 25) this.hist.shift(); }
  },
  profile() {
    const tm = this.team(), now = this.hist[this.hist.length - 1], old = this.hist[0], R = Director.raw || {};
    // where their side is being turned over fastest
    let hot = null, drop = 0;
    if (now && this.hist.length >= 10) this.zones.forEach((z, i) => { if (depthOf(tm, z.z) > 0) return; const d = (old[i][0] - now[i][0]) + (now[i][1] - old[i][1]) * 0.5; if (d > drop) { drop = d; hot = z; } });
    const laneTop = Math.max(...this.lanes), lane = this.lanes.indexOf(laneTop), ci = this.choke.length ? this.choke.indexOf(Math.max(...this.choke)) : -1;
    return {
      hunter: clamp((this.fs - 0.25) / 0.3, 0, 1),
      painter: clamp((0.35 - this.fs) / 0.25, 0, 1) * (R.paint == null || R.paint > -0.3 ? 1 : 0.4),      // keeping out of fights but not painting either is not a painter
      diver: clamp((this.depth - 0.1) / 0.3, 0, 1),
      steady: clamp((laneTop - 0.45) / 0.35, 0, 1), lane, choke: ci >= 0 && this.choke[ci] > 0.15 ? TAC.chokes[ci] : null,
      hot: clamp((drop - 0.08) / 0.2, 0, 1), hotZone: hot                // (some of their side always gets painted; only a real run on one zone counts)
    };
  },
  // ---------------------------------------------------------------- choosing a plan
  choose() {
    const p = this.prof = this.profile(), lv = Director.teamLevel(this.team());
    const s = this.scores = { paint: p.hunter, hunt: p.painter, flank: p.diver, block: p.choke ? p.steady * 0.85 : 0, retake: p.hot };
    const order = Object.keys(s).sort((a, b) => s[b] - s[a]), hold = 18 * clamp(Math.sqrt(GAME.dur / 180), 0.75, 1.2);
    const keep = this.plan && s[this.plan] >= 0.2 && G.time - this.planT < hold;
    const best = s[order[0]] >= 0.3 ? order[0] : null;
    if (!keep && best !== this.plan) { this.plan = best; this.planT = G.time; aiStat(this.team(), 'plan_' + (best || 'none')); }
    // the stronger ones run a second plan alongside when there is a clear case for it
    const second = order.find(k => k !== this.plan && s[k] >= 0.45);
    this.plan2 = lv >= 1.3 && this.plan ? second || null : null;
    // and read the player more often
    this.evalT = lerp(30, 10, clamp((lv - 0.5) / 1.5, 0, 1)) * clamp(Math.sqrt(GAME.dur / 180), 0.75, 1.2);
  },
  // how hard to lean on it, 0..1: by level (a team that does not know teamwork yet does not counter at all), and only in a close
  // game - fading out as the Director starts telling either side to paint or ease off
  intensity() {
    const tm = this.team(), row = Director.teamRow ? Director.teamRow[tm] : DIFF[1], lv = Director.teamLevel(tm), pf = Math.abs(Director.paintFocus(tm));
    if (!row.team || Director.mode() === 0) return 0;                       // (and never on easy)
    return clamp((lv - 0.5) / 1.3, 0.25, 1) * clamp(1 - pf / 0.3, 0, 1);
  },
  // ---------------------------------------------------------------- handing out the jobs
  assign() {
    const tm = this.team(), k = this.k = this.intensity(), plan = this.plan, plan2 = this.plan2;
    // hunting goes in pairs (a strong player just picks off a lone hunter), and never after a beginner (being chased about is no fun)
    const count = id => id === 'hunt' ? (Director.skill >= 0.9 && k * 2.4 >= 1 ? 2 : 0) : Math.round(k * (id === 'paint' ? 4 : 1.6));
    const want = []; if (plan) for (let i = 0; i < count(plan); i++) want.push(plan);
    if (plan2 && plan2 !== 'hunt' && k >= 0.5) want.push(plan2);
    this.live = [want.includes(plan) ? plan : null, want.includes(plan2) ? plan2 : null];
    this.give(tm, want);
  },
  give(tm, want) {
    const bots = G.bots.filter(b => b.c.team === tm && !b.c.isPlayer), free = bots.slice(), out = new Map();
    want = want.slice();
    // a bot already on a job keeps it while it is still wanted
    for (const id of want.slice()) { const b = free.find(o => o.task && o.task.id === id && !this.done(o.task)); if (b) { out.set(b, b.task); free.splice(free.indexOf(b), 1); want.splice(want.indexOf(id), 1); } }
    for (const id of want) {
      const pickBy = f => free.filter(b => id === 'paint' || !b.c.weapon.charges).sort((a, b) => f(a) - f(b))[0];
      const near = (x, z) => b => Math.hypot(b.c.pos.x - x, b.c.pos.z - z);
      const task = this.makeTask(id, tm); if (!task) continue;
      const b = id === 'flank' ? pickBy(b => -b.c.cs.runK) : pickBy(near(task.x, task.z)); if (!b) continue;
      out.set(b, task); free.splice(free.indexOf(b), 1);
    }
    for (const b of bots) { const t = out.get(b) || null; if (t && b.task && b.task.id === t.id) Object.assign(b.task, this.refresh(t)); else b.task = t; }
  },
  // the share of a zone that is `tm`'s and the other side's, from the latest sample (taken from the countering side's point of view)
  shareOf(i, tm) { const now = this.hist[this.hist.length - 1], sh = now ? now[i] : [0, 0]; return tm === this.team() ? sh : [sh[1], sh[0]]; },
  // where each job is: a zone (or a choke, or the player) to work in
  makeTask(id, tm = this.team()) {
    const p = this.prof;
    if (id === 'hunt') { const s = this.lastSeen(); return { id, tm, x: s.x, z: s.z, r: 7, bonus: 5 }; }
    if (id === 'block') { const c = p.choke; return c ? { id, tm, node: c.node, x: c.x, z: c.z, r: 3, bonus: 5 } : null; }
    if (id === 'retake') { const z = p.hotZone; return z ? { id, tm, zone: z, x: z.x, z: z.z, bonus: 4.5 } : null; }
    if (id === 'flank') {
      // the player's own half, away from the lane the player uses
      let best = null, bs = -1e9; for (const z of this.zones) { if (depthOf(tm, z.z) < ZH * 0.15) continue; const s = Math.abs(z.lane - p.lane) * 1.5 + depthOf(tm, z.z) / ZH + rand(0, 0.5); if (s > bs) { bs = s; best = z; } }
      return best ? { id, tm, zone: best, x: best.x, z: best.z, bonus: 4 } : null;
    }
    // paint: the zone with the most to take - theirs counts double (they lose it and we gain it) - nearer the middle first
    let best = null, bs = -1e9; this.zones.forEach((z, i) => { const sh = this.shareOf(i, tm), s = (1 - sh[0] - sh[1]) + sh[1] * 2 - Math.abs(depthOf(tm, z.z) / ZH) * 0.6 + rand(0, 0.3); if (s > bs) { bs = s; best = z; } });
    return best ? { id, tm, zone: best, x: best.x, z: best.z, bonus: 3.5 } : null;
  },
  // a zone job is done once the zone is mostly ours again
  done(t) { if (!t.zone) return false; const i = this.zones.indexOf(t.zone); return i >= 0 && this.hist.length > 0 && this.shareOf(i, t.tm)[0] >= 0.65; },
  refresh(t) { if (t.id === 'hunt') { const s = this.lastSeen(); return { x: s.x, z: s.z }; } return {}; },
  // where the player was last seen by this side (they do not see through walls); never seen yet: the middle of their favourite lane
  lastSeen() {
    const S = G.squads && G.squads[this.team()], s = S && S.seen.get(PLAYER);
    if (s) return s;
    const lx = -XH + (this.prof ? this.prof.lane + 0.5 : 1.5) * (2 * XH / this.NX); return { x: lx, z: 0 };
  },
  // ---------------------------------------------------------------- what the bots ask
  taskId(b) { return this.on && b.task ? b.task.id : null; },
  // spots to consider for this bot's job, and the bonus they get
  taskNodes(b) {
    const t = b.task, out = []; if (!t) return out;
    if (t.node != null) out.push(t.node);
    else if (t.zone) for (let i = 0; i < 12; i++) out.push(t.zone.nodes[randi(0, t.zone.nodes.length - 1)]);
    else for (let i = 0; i < 12; i++) { const k = navIdx(t.x + rand(-t.r, t.r), t.z + rand(-t.r, t.r)); if (NAV.h[k] < 90 && TAC.reach[b.c.team][k] >= 0) out.push(k); }
    return out;
  },
  update(dt) {
    if (!this.on || !PLAYER || !this.zones) return;
    this.observe(dt);
    if (this.alive < 20) return;
    if ((this.evalT -= dt) <= 0) this.choose();
    if ((this.assignT -= dt) <= 0) { this.assignT = 2; this.assign(); }
  },
  panelLines() {
    if (!this.on) return '';
    const p = this.prof, pc = v => Math.round(v * 100) + '%';
    if (!p) { const w = Math.ceil(20 - this.alive); return `<div>对面在观察你的打法…${w > 0 ? '（还需 ' + w + 's）' : '正在判断'}</div>`; }
    const tags = [['打人', p.hunter], ['涂地', p.painter], ['冲得深', p.diver], ['常走' + ['左', '中', '右'][p.lane] + '路', p.steady], ['翻色热点', p.hot]].filter(t => t[1] >= 0.3).map(t => t[0] + ' ' + pc(t[1]));
    const jobs = {}; for (const b of G.bots) if (b.c.team === this.team() && b.task) jobs[b.task.id] = (jobs[b.task.id] || 0) + 1;
    const [lp, lp2] = this.live || [], why = Math.abs(Director.paintFocus(this.team())) >= 0.3 ? '比分拉开了，先按比分调' : this.plan === 'hunt' && Director.skill < 0.9 ? '不追着新手打' : '力度不够，暂不派人';
    const plan = lp ? PLAN_NAME[lp] + (lp2 ? ' + ' + PLAN_NAME[lp2] : '') : this.plan ? PLAN_NAME[this.plan] + '·暂停（' + why + '）' : '无（按常规打）';
    return `<div>对面看你：${tags.length ? tags.join(' · ') : '还看不出明显习惯'}</div><div>对面对策：${plan} · 力度 ${pc(this.k)}${Object.keys(jobs).length ? '（' + Object.entries(jobs).map(([k, n]) => PLAN_NAME[k] + ' ' + n + ' 人').join('，') + '）' : ''}</div>`;
  }
};
