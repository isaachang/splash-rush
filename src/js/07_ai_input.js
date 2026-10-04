/* ============================================================ NAV GRAPH
   What the bots know about a map.  A 1 m grid, but each cell can hold up to
   three stacked standing heights (street / under a bridge or arcade / a roof),
   and the links between neighbours are found by actually "walking" the line
   between them in small steps, so stairs, kerbs and ramps are judged the way
   a character would meet them.  Links carry how they are crossed:
     walk · SWIM (squid only: low ceiling, grate fence) · JUMP (a hop up)
     · CLIMB (ink the wall, swim up it) · DROP (a one-way fall)
   Node id = layer * N + cell; layer 0 is the old single-layer grid (NAV.h),
   so navIdx / navPos / astar keep working for callers that only know cells. */
const NAV = { W: 0, H: 0, N: 0, L: 3, h: null, cost: null, nh: null, eT: null, eF: null, eC: null };
const NF = { SWIM: 1, JUMP: 2, CLIMB: 4, DROP: 8 };
const NDX = [1, 1, 0, -1, -1, -1, 0, 1], NDZ = [0, 1, 1, 1, 0, -1, -1, -1];
// the height the AI walks at: the ground under floating blocks (the covered arcade street, the paifang, the mansion gate),
// except blocks marked navTop (bridges), whose top is the way across
function navGround(x, z) {
  let h = groundAt(x, z);
  for (const s of solidsNear(x, z)) if (s.float && !s.navTop && inRect(s, x, z) && s.h >= h - 0.01) h = groundBelow(x, z, s.y0 - 0.05, 0, true);
  return h;
}
// free height above a piece of ground (floating blocks and grate walkways overhead)
function navHead(x, z, g) {
  let c = 99;
  for (const s of solidsNear(x, z)) if (s.float && inRect(s, x, z) && s.y0 > g + 0.05) c = Math.min(c, s.y0 - g);
  for (const b of BRIDGES) if (b.h > g + STEP && inRect(b, x, z)) c = Math.min(c, b.h - 0.06 - g);
  return c;
}
// every height you can stand at over (x, z), highest first
function navLayersAt(x, z) {
  if (TERR.on && terrOob(x, z)) return [];
  const out = []; let y = 80, prev = 1e9;
  for (let n = 0; n < 6; n++) {
    const h = groundBelow(x, z, y, 0); if (h >= prev - 1e-3) break; prev = h;
    if (!solidAt(x, h + 0.3, z) && navHead(x, z, h) >= 0.6) out.push(h);
    if (h <= 0.001) break; y = h - 0.05;
  }
  return out;
}
// walk the straight line from (x0, z0) at height y0 to (x1, z1): the height you arrive at and how you had to move, or null if something is in the way
function navWalk(x0, z0, y0, x1, z1) {
  let y = y0, fl = 0;
  for (let i = 1; i <= 4; i++) {
    const t = i / 4, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    if (Math.abs(x) > XH - 0.3 || Math.abs(z) > ZH - 0.3 || (TERR.on && terrOob(x, z))) return null;
    const g = groundBelow(x, z, y, STEP);
    if (g > y + STEP + 0.01 || solidAt(x, g + 0.75, z)) return null;             // a step too high, or a wall at body height
    const head = navHead(x, z, g); if (head < 0.6) return null; if (head < BODY_H + 0.05) fl |= NF.SWIM;
    for (const f of FENCES) if (x > f.x0 - 0.3 && x < f.x1 + 0.3 && z > f.z0 - 0.3 && z < f.z1 + 0.3 && g < f.h && g + BODY_H > f.y0) fl |= NF.SWIM;
    if (y - g > 0.9) fl |= NF.DROP;
    y = g;
  }
  return { y, fl };
}
// can a character walk the straight line (x0, z0) -> (x1, z1) as a plain walk (no squid-only bits, no drops), with room either side? -> arrival height or -1
function navLine(x0, z0, y0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 1e-3) return y0; const n = Math.ceil(L / 0.25), px = -dz / L * 0.32, pz = dx / L * 0.32;
  let y = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = x0 + dx * t, z = z0 + dz * t;
    if (Math.abs(x) > XH - 0.3 || Math.abs(z) > ZH - 0.3 || (TERR.on && terrOob(x, z))) return -1;
    const g = groundBelow(x, z, y, STEP);
    if (g > y + STEP + 0.01 || y - g > 0.9 || solidAt(x, g + 0.75, z) || navHead(x, z, g) < BODY_H + 0.05) return -1;
    for (const sg of [-1, 1]) { const sx = x + px * sg, sz = z + pz * sg, gs = groundBelow(sx, sz, y, STEP); if (gs > y + STEP + 0.01 || solidAt(sx, gs + 0.75, sz) || g - gs > 0.9) return -1; }      // a wall or a drop right beside the line
    for (const f of FENCES) if (x > f.x0 - 0.4 && x < f.x1 + 0.4 && z > f.z0 - 0.4 && z < f.z1 + 0.4 && g < f.h && g + BODY_H > f.y0) return -1;
    y = g;
  }
  return y;
}
function navLayerOf(cell, y, tol = 0.35) { for (let l = 0; l < NAV.L; l++) { const h = NAV.nh[l * NAV.N + cell]; if (h < 90 && Math.abs(h - y) <= tol) return l * NAV.N + cell; } return -1; }
// called whenever a map is loaded.  Working the graph out takes a good half second, so it is built once per map and kept with it
// (MAP_CACHE): the first load builds it (behind the loading screen, or under the frozen picture of a map switch), after that it is free.
function initNav() { NAV.W = XH * 2; NAV.H = ZH * 2; NAV.N = NAV.W * NAV.H; NAV.ready = false; navEnsure(); }
const NAV_KEEP = ['W', 'H', 'N', 'h', 'cost', 'nh', 'eT', 'eF', 'eC'];
function navEnsure() {
  if (NAV.ready) return; NAV.ready = true;
  const c = MAP_CACHE[MAP_ID] || (MAP_CACHE[MAP_ID] = {});
  if (c.nav) { Object.assign(NAV, c.nav); Object.assign(TAC, c.tac); return; }
  buildNav(); c.nav = {}; NAV_KEEP.forEach(k => c.nav[k] = NAV[k]); c.tac = Object.assign({}, TAC);
}
function buildNav() {
  const W = NAV.W, H = NAV.H, N = NAV.N, L = NAV.L; NAV.h = new Float32Array(N); NAV.cost = new Float32Array(N);
  NAV.nh = new Float32Array(N * L).fill(99); NAV.eT = new Int32Array(N * L * 8).fill(-1); NAV.eF = new Uint8Array(N * L * 8); NAV.eC = new Float32Array(N * L * 8);
  const cx = k => -XH + (k % W) + 0.5, cz = k => -ZH + Math.floor(k / W) + 0.5;
  for (let k = 0; k < N; k++) {
    const x = cx(k), z = cz(k), h = TERR.on && terrOob(x, z) ? 99 : navGround(x, z); NAV.h[k] = NAV.nh[k] = h;   // never path outside the park
    let near = 0;
    for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * Math.PI / 4) * 0.75, pz = z + Math.sin(a * Math.PI / 4) * 0.75; if (Math.abs(px) > XH - 0.3 || Math.abs(pz) > ZH - 0.3) { near = 1; continue; } if (navGround(px, pz) > h + STEP) near = 1; }
    NAV.cost[k] = near ? 3.5 : 1;
    if (h > 90) continue;
    let l = 1; for (const y of navLayersAt(x, z)) if (Math.abs(y - h) > 0.35 && l < L) NAV.nh[l++ * N + k] = y;
  }
  // links
  for (let n = 0; n < N * L; n++) {
    const ha = NAV.nh[n]; if (ha > 90) continue; const k = n % N, x = cx(k), z = cz(k), ix = k % W, iz = Math.floor(k / W);
    for (let d = 0; d < 8; d++) {
      const jx = ix + NDX[d], jz = iz + NDZ[d]; if (jx < 0 || jz < 0 || jx >= W || jz >= H) continue;
      const kb = jz * W + jx, x1 = cx(kb), z1 = cz(kb), e = n * 8 + d, diag = d & 1;
      const w = navWalk(x, z, ha, x1, z1);
      if (w) { const t = navLayerOf(kb, w.y); if (t >= 0) { NAV.eT[e] = t; NAV.eF[e] = w.fl; NAV.eC[e] = (diag ? 1.414 : 1) * NAV.cost[kb] + (w.fl & NF.SWIM ? 2.5 : 0) + (w.fl & NF.DROP ? 0.6 : 0); } continue; }
      if (diag) continue;
      // a hop up (within a jump), or a wall to ink and swim up
      for (let l = 0; l < L; l++) {
        const hb = NAV.nh[l * N + kb], rise = hb - ha; if (hb > 90 || rise <= STEP || rise > 5.6) continue;
        if (solidAt(x1, hb + 0.75, z1) || navHead(x1, z1, hb) < BODY_H || navHead(x, z, ha) < rise + BODY_H) continue;
        if (rise <= 1.2) { NAV.eT[e] = l * N + kb; NAV.eF[e] = NF.JUMP; NAV.eC[e] = 2.5 + rise; break; }
        const dir = NDX[d] > 0 ? '-x' : NDX[d] < 0 ? '+x' : NDZ[d] > 0 ? '-z' : '+z';
        const s = solidsNear(x1, z1).find(o => o.t === 'box' && !o.oob && inRect(o, x1, z1) && Math.abs(o.h - hb) < 0.05 && o.faces && o.faces[dir] && Math.abs(o.faces[dir].plane - (NDX[d] ? (x + x1) / 2 : (z + z1) / 2)) < 0.75);
        if (s) { NAV.eT[e] = l * N + kb; NAV.eF[e] = NF.CLIMB; NAV.eC[e] = 9 + rise * 2.5; break; }
      }
    }
  }
  // no cutting corners: a diagonal needs both of its straight neighbours to be walkable too
  for (let n = 0; n < N * L; n++) for (let d = 1; d < 8; d += 2) { const e = n * 8 + d; if (NAV.eT[e] < 0) continue; const a = NAV.eT[n * 8 + ((d + 7) & 7)], b = NAV.eT[n * 8 + ((d + 1) & 7)]; if (a < 0 || b < 0 || (NAV.eF[n * 8 + ((d + 7) & 7)] | NAV.eF[n * 8 + ((d + 1) & 7)]) & (NF.JUMP | NF.CLIMB)) NAV.eT[e] = -1; }
  initTactics();
}
const navIdx = (x, z) => { const i = clamp(Math.floor(x + XH), 0, NAV.W - 1), j = clamp(Math.floor(z + ZH), 0, NAV.H - 1); return j * NAV.W + i; };
// the node a character standing at (x, y, z) is on: the layer of its cell nearest its feet
function navNode(x, y, z) { navEnsure(); const k = navIdx(x, z); let best = k, bd = 1e9; for (let l = 0; l < NAV.L; l++) { const h = NAV.nh[l * NAV.N + k]; if (h > 90) continue; const d = Math.abs(h - y); if (d < bd) { bd = d; best = l * NAV.N + k; } } return best; }
// where a character really is on the graph.  Standing somewhere the grid does not know at that height (the strip of canal under a kerb,
// a ledge between cells): the nearest node at its own height that it can simply walk to
function navStart(x, y, z) {
  const n = navNode(x, y, z); if (Math.abs(NAV.nh[n] - y) < 0.7) return n;
  let best = n, bd = 1e9; const k0 = navIdx(x, z), ix = k0 % NAV.W, iz = Math.floor(k0 / NAV.W);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= NAV.W || jz >= NAV.H) continue; const k = jz * NAV.W + jx, cx = -XH + jx + 0.5, cz = -ZH + jz + 0.5, d = Math.hypot(cx - x, cz - z); if (d >= bd) continue;
    const w = navWalk(x, z, y, cx, cz); if (!w) continue; const t = navLayerOf(k, w.y); if (t >= 0) { bd = d; best = t; }
  }
  return best;
}
const navPos = n => { navEnsure(); const k = n % NAV.N; return new THREE.Vector3(-XH + (k % NAV.W) + 0.5, NAV.nh[n], -ZH + Math.floor(k / NAV.W) + 0.5); };
// shortest route from node s to node goal.  allow = which special links may be used (default: everything except climbing)
function astar(s, goal, allow = NF.SWIM | NF.JUMP | NF.DROP, from = null) {
  navEnsure();
  const W = NAV.W, NN = NAV.N * NAV.L; if (s < 0 || goal < 0 || NAV.nh[s] > 90 || NAV.nh[goal] > 90) return null;
  const g = astar.g && astar.g.length === NN ? astar.g : (astar.g = new Float32Array(NN)), came = astar.came && astar.came.length === NN ? astar.came : (astar.came = new Int32Array(NN)), closed = astar.cl && astar.cl.length === NN ? astar.cl : (astar.cl = new Uint8Array(NN));
  g.fill(1e9); came.fill(-1); closed.fill(0);
  const heap = []; const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const gc = goal % NAV.N, gx = gc % W, gz = Math.floor(gc / W), hf = n => { const k = n % NAV.N; return Math.hypot((k % W) - gx, Math.floor(k / W) - gz); };
  g[s] = 0; push(hf(s), s);
  while (heap.length) {
    const [, n] = pop(); if (closed[n]) continue; closed[n] = 1;
    if (n === goal) break;
    for (let d = 0; d < 8; d++) {
      const e = n * 8 + d, t = NAV.eT[e]; if (t < 0 || closed[t] || (NAV.eF[e] & ~allow & (NF.SWIM | NF.JUMP | NF.CLIMB))) continue;
      const ng = g[n] + NAV.eC[e];
      if (ng < g[t]) { g[t] = ng; came[t] = n * 8 + d; push(ng + hf(t), t); }
    }
  }
  if (came[goal] < 0 && goal !== s) return null;
  // waypoints: every third cell, plus both ends of anything that is not a plain walk
  const nodes = [], fls = []; let n = goal; while (n !== s) { const e = came[n]; nodes.push(n); fls.push(NAV.eF[e]); n = (e - (e & 7)) / 8; } nodes.reverse(); fls.reverse();
  astar.nodes = nodes; astar.len = g[goal];
  // keep only the corners: a waypoint stays if the straight line from the last kept one to the node after it cannot simply be walked
  // (and both ends of anything that is not a plain walk always stay)
  const out = []; let ax = from ? from.x : navPos(s).x, az = from ? from.z : navPos(s).z, ay = from ? from.y : NAV.nh[s], run = 0;
  for (let i = 0; i < nodes.length; i++) {
    const fl = fls[i] & (NF.SWIM | NF.JUMP | NF.CLIMB), nextFl = i + 1 < nodes.length ? fls[i + 1] & (NF.SWIM | NF.JUMP | NF.CLIMB) : 0, last = i === nodes.length - 1;
    let keep = last || fl || nextFl || ++run >= 8;
    if (!keep) { const q = navPos(nodes[i + 1]), y = navLine(ax, az, ay, q.x, q.z); keep = y < 0 || Math.abs(y - q.y) > 0.35; }
    if (!keep) continue;
    const p = navPos(nodes[i]); p.fl = fl; p.node = nodes[i];
    if (fl & (NF.CLIMB | NF.JUMP)) p.from = navPos(i ? nodes[i - 1] : s);
    out.push(p); ax = p.x; az = p.z; ay = p.y; run = 0;
  }
  return out;
}

/* ---- shooter ballistics helpers for bots (tabulated from the real bullet physics) */
const BALL = { comp: [], time: [] };
// drop-compensation tables for every bullet weapon (rifle and gatling); dropComp(hd, id) looks them up
function buildBallistics(W, maxD) {
  const out = { comp: [], time: [] }, h = 1 / 240;
  const sim = (pitch, hd) => { const b = { W, p: new THREE.Vector3(), v: new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(W.speed), t: 0 }; while (b.t < 1.5) { Proj.stepShot(b, h); if (b.p.z >= hd) return [b.p.y, b.t]; if (b.p.y < -3) return null; } return null; };
  for (let i = 0; i <= maxD * 2; i++) {
    const hd = i * 0.5; let lo = -0.2, hi = 0.6, best = 0.6, t = 0.5, found = false;
    for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2, r = sim(mid, hd); if (r && r[0] >= 0) { best = mid; hi = mid; t = r[1]; found = true; } else lo = mid; }
    const pc = out.comp.length ? out.comp[out.comp.length - 1] : 0, pt = out.time.length ? out.time[out.time.length - 1] : 0;
    out.comp.push(found ? Math.max(0, best) : pc); out.time.push(found ? t : pt);
  }
  return out;
}
function initBallistics() {
  BALL.splatling = buildBallistics(WEAPONS.splatling, 26);
  const W = WEAPONS.rifle, h = 1 / 240;
  const sim = (pitch, hd) => { // returns height at horizontal distance hd (or null if it never gets there) and time
    const b = { W, p: new THREE.Vector3(), v: new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(W.speed), t: 0 };
    while (b.t < 1.5) { Proj.stepShot(b, h); if (b.p.z >= hd) return [b.p.y, b.t]; if (b.p.y < -3) return null; }
    return null;
  };
  for (let i = 0; i <= 40; i++) {
    const hd = i * 0.5; let lo = -0.2, hi = 0.6, best = 0.6, t = 0.5;
    let found = false;
    for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2, r = sim(mid, hd); if (r && r[0] >= 0) { best = mid; hi = mid; t = r[1]; found = true; } else lo = mid; }
    const pc = BALL.comp.length ? BALL.comp[BALL.comp.length - 1] : 0, pt = BALL.time.length ? BALL.time[BALL.time.length - 1] : 0;
    BALL.comp.push(found ? Math.max(0, best) : pc); BALL.time.push(found ? t : pt);
  }
}
const tabLook = (arr, hd) => { const f = clamp(hd * 2, 0, arr.length - 1), i = Math.floor(f), j = Math.min(arr.length - 1, i + 1); return lerp(arr[i], arr[j], f - i); };
const dropComp = (hd, id) => id === 'splatling' ? tabLook(BALL.splatling.comp, hd) : id === 'blaster' ? 0 : tabLook(BALL.comp, hd);
const shotTime = (d, id) => id === 'splatling' ? tabLook(BALL.splatling.time, d) : id === 'blaster' ? d / WEAPONS.blaster.speed : tabLook(BALL.time, d);

/* ============================================================ TACTICS
   What a map looks like to a team, worked out once from the nav graph:
   where each team can get to on foot, the choke points most routes squeeze
   through (bridges, gates, stairs) and the high ground worth holding.     */
const TAC = { chokes: [], highs: [], street: 0, reach: [null, null] };
function navFlood(start, allow) {
  const NN = NAV.N * NAV.L, dist = new Int16Array(NN).fill(-1), q = [start]; if (start < 0 || NAV.nh[start] > 90) return dist; dist[start] = 0;
  for (let i = 0; i < q.length; i++) { const n = q[i]; for (let d = 0; d < 8; d++) { const e = n * 8 + d, t = NAV.eT[e]; if (t < 0 || dist[t] >= 0 || (NAV.eF[e] & ~allow & (NF.SWIM | NF.JUMP | NF.CLIMB))) continue; dist[t] = dist[n] + 1; q.push(t); } }
  return dist;
}
function initTactics() {
  const N = NAV.N, W = NAV.W, WALK = NF.SWIM | NF.JUMP | NF.DROP;
  const sp = SPAWN.map(s => navNode(s.x, s.y, s.z));
  TAC.reach = sp.map(n => navFlood(n, WALK));
  const hs = []; for (let k = 0; k < N; k++) if (TAC.reach[0][k] >= 0) hs.push(NAV.h[k]); hs.sort((a, b) => a - b); TAC.street = hs.length ? hs[hs.length >> 1] : 0;
  // choke points: count how often each cell lies on a route between the two halves (fixed sample, so every load agrees)
  let seed = 20261002; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const side = sgn => { for (let i = 0; i < 80; i++) { const k = Math.floor(rnd() * N), z = -ZH + Math.floor(k / W) + 0.5; if (z * sgn > ZH * 0.3 && TAC.reach[0][k] >= 0 && TAC.reach[1][k] >= 0) return k; } return -1; };
  const cnt = new Uint16Array(N); let top = 0;
  for (let i = 0; i < 26; i++) { const a = side(1), b = side(-1); if (a < 0 || b < 0 || !astar(a, b)) continue; for (const n of astar.nodes) { const k = n % N; if (Math.abs(-ZH + Math.floor(k / W) + 0.5) < ZH * 0.45) top = Math.max(top, ++cnt[k]); } }
  const pickSpread = (cands, gap, max) => { const out = []; cands.sort((a, b) => b.w - a.w); for (const c of cands) { if (out.length >= max) break; if (out.every(o => Math.hypot(o.x - c.x, o.z - c.z) > gap)) out.push(c); } return out; };
  const cc = []; for (let k = 0; k < N; k++) if (cnt[k] >= Math.max(3, top * 0.3)) { const p = navPos(k); cc.push({ x: p.x, y: p.y, z: p.z, w: cnt[k], node: k }); }
  TAC.chokes = pickSpread(cc, 7, 10);
  // high ground: places clearly above the street that someone can reach (on foot, or by inking a wall)
  const climbR = sp.map(n => navFlood(n, WALK | NF.CLIMB)), hc = [];
  for (let n = 0; n < N * NAV.L; n++) {
    const h = NAV.nh[n]; if (h > 90 || h < TAC.street + 1.2 || (climbR[0][n] < 0 && climbR[1][n] < 0)) continue;
    const p = navPos(n); if (DECK.some(d => inRect(d, p.x, p.z)) || SPAWN.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 9)) continue;
    const flat = NAV.eT.subarray(n * 8, n * 8 + 8).filter(t => t >= 0 && Math.abs(NAV.nh[t] - h) < 0.3).length; if (flat < 5) continue;      // (not parapets and ledges: somewhere with room to stand)
    hc.push({ x: p.x, y: h, z: p.z, w: h + flat * 0.1, node: n, climb: [TAC.reach[0][n] < 0, TAC.reach[1][n] < 0] });
  }
  TAC.highs = pickSpread(hc, 7, 14);
}
// difficulty of one team's bots (tests can pit two different levels against each other with G.aiLevels)
const aiStat = (team, k) => { const a = G.aiStat || (G.aiStat = [{}, {}]); a[team][k] = (a[team][k] || 0) + 1; };
// smart mode (SMART): each bot's own level, from the Director.  G.pilotLevel: the bot standing in for the player in tests
function botDiff(team, bot) {
  if (bot && bot.c.isPlayer && G.pilotLevel != null) return DIFF[G.pilotLevel];
  const lv = G.aiLevels ? G.aiLevels[team] : GAME.diff;
  return lv === SMART ? Director.row(team, bot) : DIFF[lv];
}
const depthOf = (team, z) => team === 0 ? -z : z;          // how far toward the enemy's end a spot is (0 = the middle of the map)

/* ============================================================== SQUAD
   One per team: the unseen "caller".  Every half second it looks at the
   whole match - who is alive, where enemies were last seen, the score and
   the clock - and hands each bot a job.  How much of this a team does
   depends on its difficulty (D.team: 0 none, 1 basic split, 2 full).      */
class Squad {
  constructor(team) { this.team = team; this.t = rand(0, 0.4); this.roleT = 0; this.seen = new Map(); this.focus = null; this.posture = 'even'; this.regroupT = 0; this.frontD = 0; this.ownHalf = 0; this.lead = 0; }
  bots() { return G.bots.filter(b => b.c.team === this.team); }
  note(e) { this.seen.set(e, { x: e.pos.x, y: e.pos.y, z: e.pos.z, t: G.time }); }
  // fresh sightings of living enemies (within the last `age` seconds)
  fresh(age = 1.2) { const out = []; for (const [e, s] of this.seen) if (e.alive && e.state === 'play' && G.time - s.t <= age) out.push([e, s]); return out; }
  update(dt) {
    this.t -= dt; this.regroupT -= dt; this.roleT -= dt; if (this.t > 0) return; this.t = 0.4;
    const D = botDiff(this.team), bots = this.bots(), T = G.time, tm = this.team;
    for (const [e, s] of this.seen) if (!e.alive || T - s.t > 5) this.seen.delete(e);
    this.lead = (Paint.teamCells[tm] - Paint.teamCells[1 - tm]) / Math.max(1, Paint.total);
    this.posture = D.endgame && G.left < Director.endWindow() ? 'allout' : D.team >= 2 ? (this.lead < -0.05 ? 'push' : this.lead > 0.12 ? 'hold' : 'even') : 'even';
    // the front: a little short of the nearest enemy anyone has seen, else just past the middle
    const fr = this.fresh(3); let fd = ZH * 0.12; if (fr.length) fd = Math.min(...fr.map(([, s]) => depthOf(tm, s.z))) - 4;
    this.frontD = lerp(this.frontD, clamp(fd + (this.posture === 'push' ? 7 : this.posture === 'hold' ? -5 : 0), -ZH * 0.55, ZH * 0.6), 0.35);
    if (!D.team) { this.focus = null; return; }
    // how much of our own half is ours (decides whether someone stays home to paint)
    let own = 0, tot = 0; for (let i = 0; i < 50; i++) { const k = randi(0, NAV.N - 1), h = NAV.h[k]; if (h > 90) continue; const p = navPos(k); if (depthOf(tm, p.z) > -2) continue; const o = ownerAt(p.x, p.y, p.z); if (o === -2) continue; tot++; if (o === tm) own++; }
    this.ownHalf = tot ? lerp(this.ownHalf, own / tot, 0.5) : this.ownHalf;
    // jobs.  Basic teams keep the stretch of the map each bot was given at the start (front / mid / home).  Full teams re-deal them as the
    // match goes: nobody stays home once home is painted, and the quickest one goes round the side
    if (this.roleT <= 0 && D.team >= 2) {
      this.roleT = 8; const rest = bots.filter(b => !b.c.weapon.charges);
      for (const b of bots) b.role = b.role0;
      if (this.posture === 'allout') bots.forEach(b => b.role = 'front');
      else {
        if (this.ownHalf > 0.7) rest.filter(b => b.role === 'home').forEach(b => b.role = 'mid');
        if (this.posture !== 'hold') { const f = rest.filter(b => b.role === 'front').sort((a, b) => b.c.cs.runK - a.c.cs.runK); if (f.length > 1) f[0].role = 'flank'; }
        if (this.posture === 'push') rest.filter(b => b.role === 'mid').forEach(b => b.role = 'front');
      }
    }
    // everyone shoots the same one: the weakest enemy in sight that most of us can reach
    this.focus = null;
    if (D.focus) { let bs = 0.6; for (const [e, s] of this.fresh(0.8)) { const near = bots.filter(b => b.c.alive && Math.hypot(b.c.pos.x - s.x, b.c.pos.z - s.z) < b.c.weapon.range + 2).length; const sc = (1 - e.hp / e.maxHp) * 2 + near * 0.5; if (near >= 2 && sc > bs) { bs = sc; this.focus = e; } } }
    // too few of us up front against what we can see: fall back and wait for the others
    if (D.team >= 2 && this.posture !== 'allout') {
      const up = CHARS.filter(c => c.team === tm && c.alive && c.state === 'play' && depthOf(tm, c.pos.z) > this.frontD - 14).length, foes = this.fresh(1.5).length;
      if (up <= 1 && foes >= 2) this.regroupT = 4;
    }
  }
  // who a bot should super-jump to when it comes back: the furthest-forward teammate with no enemy on top of them
  jumpPick(c) {
    const D = botDiff(this.team); if (!D.sjump) return Math.random() < 0.15 ? pick(CHARS.filter(m => c.canJumpTo(m) && !m.inOwnBarrier()).concat([null])) : null;
    let best = null, bd = 6; const fr = this.fresh(2);
    for (const m of CHARS) { if (!c.canJumpTo(m) || m.inOwnBarrier()) continue; if (fr.some(([, s]) => Math.hypot(s.x - m.pos.x, s.z - m.pos.z) < 8)) continue; const d = depthOf(this.team, m.pos.z) + ZH; if (d > bd && Math.hypot(m.pos.x - SPAWN[this.team].x, m.pos.z - SPAWN[this.team].z) > 22) { bd = d; best = m; } }
    if (best) aiStat(this.team, 'superJump');
    return best;
  }
}

/* ================================================================= BOT */
class Bot {
  constructor(c, role) {
    this.c = c; c.bot = this; this.role = this.role0 = role; this.path = []; this.target = null; this.retarget = 0; this.enemy = null; this.scanT = rand(0, 0.2);
    this.reactT = 0; this.strafe = 1; this.strafeT = 0; this.err = new THREE.Vector3(); this.errT = 0; this.stuckT = 0; this.lastPos = new THREE.Vector3();
    this.mode = 'paint'; this.sweep = rand(0, 6); this.linger = 0; this.swimT = 0; this.jitter = rand(0.8, 1.2);
    this.wpT = 0; this.fails = 0; this.climb = null; this.noClimbT = 0; this.diveCd = 0; this.footCd = 0; this.footT = 0; this.lurkT = 0; this.lurkCd = 0; this.bombCd = 0; this.retreatT = 0;
  }
  get squad() { return G.squads && G.squads[this.c.team]; }
  canSee(e) { const a = this.c.eye(), b = e.chest(); return !segBlocked(a.x, a.y, a.z, b.x, b.y, b.z, 0.5); }
  findEnemy() {
    const c = this.c, e0 = c.eye(); let best = null, bd = 1e9;
    // smart mode: a team told to paint only takes on enemies close by, one easing off does not go looking either (both still answer whoever shoots them)
    const pf = Director.paintFocus(c.team), rk = G.time - c.lastHurt < 1.5 ? 1 : pf > 0 ? lerp(1, 0.45, pf) : lerp(1, 0.6, -pf);
    for (const e of CHARS) {
      if (e.team === c.team || !e.alive || e.state !== 'play' || e.inOwnBarrier()) continue;
      const d = e.pos.distanceTo(c.pos); if (d > (c.weapon.type === 'charge' ? 30 : (c.weapon.id === 'rifle' || c.weapon.id === 'smg') ? 18 : Math.max(18, c.weapon.range + 4)) * rk || d > bd) continue;
      // hidden in ink: only seen up close (2.5 m), or roughly up to 7 m if swimming fast (ripples); shooting gives you away
      let fuzzy = false;
      if (e.hiddenInInk() && !(G.time - e.lastShot < 0.4)) { const fast = Math.hypot(e.vel.x, e.vel.z) > 6; if (d > (fast ? 7 : 2.5)) continue; fuzzy = fast && d > 2.5; }
      const ch = e.chest(); if (segBlocked(e0.x, e0.y, e0.z, ch.x, ch.y, ch.z, 0.5)) continue;
      best = e; bd = d; this.fuzzyNext = fuzzy;
    }
    this.fuzzy = best ? this.fuzzyNext : false;
    return best;
  }
  // easy bots (and the old behaviour): wander to a random unpainted spot in "their" third of the map
  chooseTargetSimple() {
    const c = this.c; let best = -1, bs = -1e9;
    const enemyDeck = DECK[1 - c.team];
    for (let n = 0; n < 34; n++) {
      const k = randi(0, NAV.N - 1), p = navPos(k); if (NAV.h[k] > 90 || TAC.reach[c.team][k] < 0 || inRect(enemyDeck, p.x, p.z)) continue;
      let s = 0; const own = ownerAt(p.x, p.y, p.z);
      s += own === c.team ? -3 : own === -1 ? 2 : 3;
      for (let a = 0; a < 5; a++) { const o = ownerAt(p.x + Math.cos(a * 1.26) * 2, p.y, p.z + Math.sin(a * 1.26) * 2); if (o !== c.team && o !== -2) s += 0.6; }
      const zRel = (c.team === 0 ? -p.z : p.z) / ZH;
      s += this.role === 'front' ? zRel * 3 : this.role === 'mid' ? 1 - Math.abs(zRel) * 2.2 : -zRel * 2.2;
      s -= p.distanceTo(c.pos) * 0.04; s += rand(0, 1.6) + Director.turfBias(c.team, own, zRel);
      if (c.weapon.type === 'charge') s += NAV.h[k] * 0.9 - (this.role === 'front' ? zRel * 1.5 : 0);
      if (s > bs) { bs = s; best = k; }
    }
    return best;
  }
  // team bots: go where the job says, where there is the most to paint, and not where a teammate is already heading
  chooseTargetTeam(D, S) {
    const c = this.c, tm = c.team, role = this.role, allout = S.posture === 'allout', enemyDeck = DECK[1 - tm], reach = TAC.reach[tm];
    const others = S.bots().filter(b => b !== this && b.target).map(b => b.target), foes = S.fresh(2.5);
    const canClimb = (D.climb >= 2 || (D.climb >= 1 && c.weapon.charges)) && G.time > this.noClimbT;
    let best = -1, bs = -1e9;
    const consider = (n, bonus) => {
      const p = navPos(n); if (inRect(enemyDeck, p.x, p.z)) return;
      const own = ownerAt(p.x, p.y, p.z); if (own === -2 && !bonus) return;
      let s = bonus + (own === tm ? -3 : own === -1 ? 2 : D.team >= 2 ? 3.8 : 3);
      for (let a = 0; a < 5; a++) { const o = ownerAt(p.x + Math.cos(a * 1.26) * 2, p.y, p.z + Math.sin(a * 1.26) * 2); if (o !== tm && o !== -2) s += 0.6; }
      const dep = depthOf(tm, p.z), zRel = dep / ZH, dist = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      if (allout) s -= dist * 0.11;
      else {
        // each job has its stretch of the map: front pushes deep (but not far past the line alone), mid holds the middle, home paints behind
        const fD = S.frontD - (S.regroupT > 0 && role !== 'home' ? 12 : 0);
        if (role === 'home') s -= zRel * 2.2;
        else if (role === 'mid') s += 1 - Math.abs(zRel) * 2.2;
        else if (role === 'flank') s += zRel * 2.4 + Math.abs(p.x) / XH * 2.2;
        else s += zRel * 3 - Math.max(0, dep - fD - (D.team >= 2 ? 14 : 30)) * 0.2 - (S.regroupT > 0 ? Math.max(0, dep - fD) * 0.3 : 0);
        s -= dist * 0.04;
        if (role === 'home') s -= 1.5 * foes.filter(([, f]) => Math.hypot(f.x - p.x, f.z - p.z) < 8).length;
      }
      for (const o of others) if (Math.hypot(o.x - p.x, o.z - p.z) < 8) s -= 1.2;
      s += rand(0, 1.4) + Director.turfBias(tm, own, zRel);
      if (s > bs) { bs = s; best = n; }
    };
    for (let i = 0; i < 46; i++) { const k = randi(0, NAV.N - 1); if (reach[k] >= 0) consider(k, 0); }
    // snipers (and, on the hardest level, anyone holding the line) like the high ground that overlooks the front
    // high ground overlooking where enemies have just been seen: snipers go for it, and on the hardest level so does anyone at the front
    this.perch = false;
    if (!allout && foes.length && (c.weapon.charges ? D.climb >= 1 : D.climb >= 2 && role === 'front' && Math.random() < 0.3)) {
      const b0 = best, s0 = bs;
      for (const h of TAC.highs) { if (h.climb[tm] && !canClimb) continue; const fd = Math.min(...foes.map(([, f]) => Math.hypot(f.x - h.x, f.z - h.z))); if (fd < 8 || fd > 26 || Math.hypot(h.x - c.pos.x, h.z - c.pos.z) > 30) continue; consider(h.node, (c.weapon.charges ? 3.5 : 1.5) + (h.y - TAC.street) * 0.5); }
      this.perch = best !== b0;
    }
    // the flanker (and sometimes anyone on a team that sets ambushes) heads for a choke point on the far side to lie in wait there
    this.ambushAt = null;
    if (!allout && D.ambush && !c.weapon.charges && G.time > this.lurkCd && (role === 'flank' ? Math.random() < 0.6 : Math.random() < D.ambush * 0.2)) {
      const b0 = best;
      for (const k of TAC.chokes) { const dep = depthOf(tm, k.z); if (dep < S.frontD - 12 || dep > S.frontD + 16 || reach[k.node] < 0 || others.some(o => Math.hypot(o.x - k.x, o.z - k.z) < 6)) continue; consider(k.node, 3.2); }
      if (best !== b0) this.ambushAt = best;
    }
    this.allowNext = NF.SWIM | NF.JUMP | NF.DROP | (canClimb ? NF.CLIMB : 0);
    return best;
  }
  chooseTarget() {
    const c = this.c, D = botDiff(c.team, this), S = this.squad;
    this.allowNext = NF.SWIM | NF.JUMP | NF.DROP;
    const best = D.team && S ? this.chooseTargetTeam(D, S) : this.chooseTargetSimple();
    if (best < 0) { this.retarget = 0.5; return; }
    const st = navStart(c.pos.x, c.pos.y, c.pos.z), path = astar(st, best, this.allowNext, c.pos);
    if (path && path.length) { if (Math.abs(NAV.nh[navNode(c.pos.x, c.pos.y, c.pos.z)] - c.pos.y) >= 0.7) path.unshift(navPos(st)); this.setPath(path); this.target = navPos(best); this.retarget = this.perch ? rand(10, 14) : rand(7, 12); this.linger = 0; }
    else { this.retarget = 0.5; if (G.aiLog) G.aiLog.push('nopath ' + c.weapon.id + ' @' + c.pos.x.toFixed(1) + ',' + c.pos.y.toFixed(1) + ',' + c.pos.z.toFixed(1) + ' st ' + st + ' h' + NAV.nh[st].toFixed(1) + ' -> ' + best + ' h' + NAV.nh[best].toFixed(1) + ' at ' + navPos(best).x + ',' + navPos(best).z + ' allow ' + this.allowNext + ' perch ' + this.perch + ' path ' + (path ? path.length : 'null') + ' reach ' + TAC.reach[c.team][best]); }
  }
  setPath(p) { this.path = p; this.wpT = 0; this.climb = null; }
  goTo(node, allow) { const c = this.c, st = navStart(c.pos.x, c.pos.y, c.pos.z), p = astar(st, node, allow, c.pos); if (!p) return false; if (st !== navNode(c.pos.x, c.pos.y, c.pos.z)) p.unshift(navPos(st)); this.setPath(p.length ? p : [navPos(node)]); return true; }
  findRefill() {
    const c = this.c; let best = null, bd = 1e9;
    const ci = Math.floor(c.pos.x + XH), cj = Math.floor(c.pos.z + ZH);
    for (let j = cj - 12; j <= cj + 12; j++) for (let i = ci - 12; i <= ci + 12; i++) {
      if (i < 0 || j < 0 || i >= NAV.W || j >= NAV.H) continue; const k = j * NAV.W + i; if (NAV.h[k] > 90) continue; const p = navPos(k);
      if (ownerAt(p.x, p.y, p.z) !== c.team) continue; const d = p.distanceTo(c.pos); if (d < bd) { bd = d; best = k; }
    }
    if (best === null) return false;
    return this.goTo(best);
  }
  // somewhere to recover: our own ink, away from whoever is shooting, ideally out of their sight and on the way home
  findRetreat(e) {
    const c = this.c, sp = SPAWN[c.team], ci = Math.floor(c.pos.x + XH), cj = Math.floor(c.pos.z + ZH); let best = -1, bs = -1e9;
    const ex = e ? e.pos.x : c.pos.x - (sp.x - c.pos.x), ez = e ? e.pos.z : c.pos.z - (sp.z - c.pos.z), eye = e ? e.eye() : null;
    for (let n = 0; n < 60; n++) {
      const i = ci + randi(-14, 14), j = cj + randi(-14, 14); if (i < 0 || j < 0 || i >= NAV.W || j >= NAV.H) continue;
      const k = j * NAV.W + i; if (NAV.h[k] > 90 || TAC.reach[c.team][k] < 0) continue; const p = navPos(k);
      if (ownerAt(p.x, p.y, p.z) !== c.team) continue;
      const de = Math.hypot(p.x - ex, p.z - ez), dm = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      let s = Math.min(de, 16) * 0.5 - dm * 0.35 - Math.hypot(p.x - sp.x, p.z - sp.z) * 0.04;
      if (eye && segBlocked(eye.x, eye.y, eye.z, p.x, p.y + 0.4, p.z, 0.6)) s += 4;
      if (de < 6) s -= 6;
      if (s > bs) { bs = s; best = k; }
    }
    if (best < 0) best = navNode(sp.x, sp.y, sp.z);
    return this.goTo(best);
  }
  // hold/release trigger: auto weapons just hold; chargers hold until the goal charge then release
  pull(I, goal = 1) {
    const c = this.c;
    if (!c.weapon.charges) { I.fire = true; return; }
    if (!c.charging) { I.fire = true; this.goal = goal; this.holdT = 0; return; }
    this.holdT += 1 / 60;
    I.fire = c.charge < Math.min(this.goal, 0.999) && this.holdT < 3;
  }
  chargerFight(dt, e, d, D) {
    const c = this.c, I = c.intent;
    this.errT -= dt; if (this.errT <= 0) { this.errT = rand(0.3, 0.6); const m = D.err * d * 0.75 * (this.fuzzy ? 2.5 : 1); this.err.set(rand(-m, m), rand(-m, m) * 0.5, rand(-m, m)); }
    const tp = e.chest().addScaledVector(e.vel, 0.08).add(this.err);
    const m = c.muzzle(); const dx = tp.x - m.x, dy = tp.y - m.y, dz = tp.z - m.z, hd = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz), wantPitch = Math.atan2(dy, hd);
    const yawErr = angDiff(c.aimYaw, wantYaw);
    c.aimYaw += clamp(yawErr, -D.turn * 0.8 * dt, D.turn * 0.8 * dt); c.aimPitch = damp(c.aimPitch, wantPitch, 9, dt);
    const close = d < 7;
    const fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw), rx = -fz, rz = fx;
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rand(0.8, 2); }
    const adv = close ? -0.85 : d > 24 ? 0.5 : 0, sw = close ? 0.5 : 0.25;
    I.mx = rx * this.strafe * sw + fx * adv; I.mz = rz * this.strafe * sw + fz * adv;
    this.reactT -= dt;
    const tol = 0.4 / Math.max(d, 1) + 0.02;
    if (this.reactT <= 0 && Math.abs(yawErr) < 0.5) {
      if (!c.charging) { I.fire = true; this.goal = close ? 0.3 : d > 20 ? 1 : 0.8 + Math.random() * 0.2; this.holdT = 0; }
      else { this.holdT += dt; I.fire = (c.charge < Math.min(this.goal, 0.999) || Math.abs(yawErr) > tol) && this.holdT < 2.6; }
    } else if (c.charging) I.fire = true;
    if (c.subId === 'cover') {
      // put a board up between us and a far-off enemy, then charge behind it
      const mine = Cover.list.some(v => v.owner === c);
      if (!mine && !close && d > 10 && !c.charging && c.grounded && Math.abs(yawErr) < 0.5 && c.ink >= SUBS.cover.cost / c.inkK + 20 && (this.coverWant || Math.random() < dt * 0.5)) { I.bomb = true; I.fire = false; this.coverWant = false; this.reactT = Math.max(this.reactT, 0.35); return; }
    } else if (close && c.ink > 75 && Math.random() < dt * 0.5) { I.bomb = true; I.fire = false; }
    if (c.special >= 100 && d < 7 && Math.random() < dt * 2) I.special = true; else I.special = false;
    if (close && c.hp < 50 && ownerAt(c.pos.x, c.pos.y, c.pos.z) === c.team && Math.random() < D.dodge * dt * 3) this.swimT = 0.6;
    if (this.swimT > 0) { this.swimT -= dt; I.swim = true; I.fire = false; I.mx = -fx; I.mz = -fz; }
  }
  // after throwing a curling bomb: swim along its ink path right behind it
  curlFollow(dt, e, d) {
    if (!(this.curlT > 0)) return false;
    const c = this.c, I = c.intent; this.curlT -= dt;
    const dx = e.pos.x - c.pos.x, dz = e.pos.z - c.pos.z, l = Math.hypot(dx, dz) || 1, on = ownerAt(c.pos.x, c.pos.y, c.pos.z) === c.team;
    I.swim = on; I.fire = false; I.mx = dx / l; I.mz = dz / l;
    if (d < 3.5 || (!on && this.curlT < 1.2)) { this.curlT = 0; return false; }
    return true;
  }
  // ink a wall and swim up it (a CLIMB link): stand at its foot, paint a strip to the top, then go up as a squid
  doClimb(I, dt) {
    const c = this.c, k = this.climb, w = k.w, f = w.from, dx = w.x - f.x, dz = w.z - f.z, l = Math.hypot(dx, dz) || 1, nx = dx / l, nz = dz / l, rise = w.y - f.y;
    k.t += dt; I.mx = I.mz = 0; I.swim = false; I.fire = false;
    if (c.pos.y >= w.y - 0.2) { this.climb = null; this.path.shift(); this.wpT = 0; this.fails = 0; aiStat(c.team, 'climbOk'); return true; }        // on top
    if (k.t > 7 || c.ink < 6) { aiStat(c.team, 'climbFail'); this.climb = null; this.path = []; this.noClimbT = G.time + 12; this.retarget = 0; return false; }
    c.aimYaw += angDiff(c.aimYaw, Math.atan2(nx, nz)) * Math.min(1, dt * 12);
    if (k.phase === 'ink') {
      const u = clamp(k.pt / 0.9, 0, 1); k.pt += dt;
      c.aimPitch = damp(c.aimPitch, Math.atan2(lerp(-0.6, rise + 0.2, u) - 0.3, 0.7), 14, dt);
      if (c.weapon.charges) I.fire = Math.floor(k.pt / 0.16) % 2 === 0; else I.fire = true;
      if (k.pt > 1.0) { k.phase = 'swim'; k.y0 = c.pos.y; k.st = 0; }
    } else {
      I.swim = true; I.mx = nx; I.mz = nz; k.st += dt;
      if (k.st > 0.7) { if (c.pos.y < k.y0 + 0.25) { k.phase = 'ink'; k.pt = 0.25; k.tries = (k.tries || 0) + 1; if (k.tries > 2) k.t = 99; } k.y0 = c.pos.y; k.st = 0; }
    }
    return true;
  }
  followPath(I, dt = 1 / 60) {
    const c = this.c;
    if (this.climb) return this.doClimb(I, dt);
    while (this.path.length) {
      const w = this.path[0], hd = Math.hypot(w.x - c.pos.x, w.z - c.pos.z);
      if (w.fl & NF.CLIMB) { if (c.pos.y >= w.y - 0.3 && hd < 1.2) { this.path.shift(); this.wpT = 0; continue; } break; }
      // reached: close enough - and, if there is a next leg, able to walk straight onto it from here (else come right up to the corner first)
      if (hd < 0.9 && Math.abs(w.y - c.pos.y) < 1.3) { const nx = this.path[1]; if (hd < 0.3 || !nx || nx.fl || navLine(c.pos.x, c.pos.z, c.pos.y, nx.x, nx.z) >= 0) { this.path.shift(); this.wpT = 0; this.fails = 0; continue; } }
      break;
    }
    if (!this.path.length) { I.mx = I.mz = 0; return false; }
    const w = this.path[0];
    // not getting to the next waypoint: plan again from where we really are; after a few tries, super-jump out to a teammate
    this.wpT += dt;
    if (this.wpT > 3.5) {
      this.wpT = 0; this.fails++; this.path = []; this.retarget = 0; I.jump = true;
      if (this.fails >= 3) { const m = CHARS.filter(o => c.canJumpTo(o) && !o.inOwnBarrier()); if (m.length && c.startSuperJump(pick(m))) this.fails = 0; }
      I.mx = I.mz = 0; return false;
    }
    if (w.fl & NF.CLIMB) {
      const f = w.from, hd = Math.hypot(f.x - c.pos.x, f.z - c.pos.z);
      if (hd < 0.45 && Math.abs(f.y - c.pos.y) < 0.6) { this.climb = { w, t: 0, pt: 0, phase: 'ink' }; return this.doClimb(I, dt); }
      I.mx = (f.x - c.pos.x) / (hd || 1); I.mz = (f.z - c.pos.z) / (hd || 1); return true;
    }
    const dx = w.x - c.pos.x, dz = w.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
    I.mx = dx / d; I.mz = dz / d;
    if (w.fl & NF.SWIM) I.swim = true;
    if (c.grounded && d < 2 && (w.y > c.pos.y + 0.7 || ((w.fl & NF.JUMP) && d < 1.6 && w.y > c.pos.y + 0.3))) I.jump = true;
    return true;
  }
  aimAt(tp, dt, turn, wid) {
    const c = this.c, m = c.muzzle(), dx = tp.x - m.x, dy = tp.y - m.y, dz = tp.z - m.z, hd = Math.hypot(dx, dz);
    const yawErr = angDiff(c.aimYaw, Math.atan2(dx, dz));
    c.aimYaw += clamp(yawErr, -turn * dt, turn * dt); c.aimPitch = damp(c.aimPitch, Math.atan2(dy, hd) + (wid ? dropComp(hd, wid) : 0), 10, dt);
    return yawErr;
  }
  update(dt) {
    const c = this.c, I = c.intent, D = botDiff(c.team, this), T = G.time, S = this.squad;
    if (!c.alive || c.state !== 'play') { I.fire = I.swim = false; I.mx = I.mz = 0; this.path = []; this.enemy = null; this.climb = null; this.mode = 'paint'; this.lurkT = 0; return; }
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.2; const prev = this.enemy; let e = this.findEnemy(); const found = e;
      // lost them in the ink: keep spraying where they were last seen for ~0.5 s
      if (!e && prev && prev.alive && prev.state === 'play' && prev.hiddenInInk()) this.lastSeen = { p: prev.pos.clone(), t: T };
      if (e) this.lastSeen = null;
      // shot from somewhere unseen: turn on whoever did it (teams that talk to each other)
      if (!e && D.share && T - c.lastHurt < 0.6 && c.lastAttacker && c.lastAttacker.alive && c.lastAttacker.team !== c.team && c.lastAttacker.pos.distanceTo(c.pos) < c.weapon.range + 6 && this.canSee(c.lastAttacker)) e = c.lastAttacker;
      // the squad's shared target, when this bot can hit it too
      if (D.focus && S && S.focus && S.focus !== e && S.focus.alive && S.focus.pos.distanceTo(c.pos) < c.weapon.range + 2 && this.canSee(S.focus) && !S.focus.hiddenInInk()) { e = S.focus; if (e !== this.enemy) aiStat(c.team, 'focus'); }
      if (e && e !== this.enemy) { this.reactT = (this.lurkT > 0 ? 0.3 : 1) * D.react * rand(0.7, 1.3) + (c.weapon.type === 'charge' ? 0.15 : 0); this.coverWant = c.subId === 'cover' && Math.random() < 0.7; }
      this.enemy = e; if (S && D.share) { if (e) S.note(e); if (found && found !== e) S.note(found); }
    }
    const e = this.enemy, chg = !!c.weapon.charges, onOwn = ownerAt(c.pos.x, c.pos.y, c.pos.z) === c.team, allout = S && S.posture === 'allout';
    // ---- low on ink
    if (c.ink < (chg ? 20 : 10) && this.mode === 'paint') { this.mode = 'refill'; this.path = []; if (!this.findRefill()) this.path = []; }
    if (D.inkCare && this.mode === 'paint' && !e && c.ink < 40 && onOwn) { this.mode = 'refill'; this.path = []; }           // a quick top-up while nobody is around
    if (this.mode === 'refill' && c.ink > (D.inkCare ? 80 : 88)) { this.mode = 'paint'; this.path = []; }
    // ---- losing a fight: break off, hide in our own ink, come back healed
    if (D.retreat && this.mode !== 'retreat' && T > this.retreatT) {
      const hurt = T - c.lastHurt < 1.6, foes = S ? S.fresh(1).filter(([, s]) => Math.hypot(s.x - c.pos.x, s.z - c.pos.z) < 10).length : (e ? 1 : 0);
      const alone = D.team >= 2 && foes >= 2 && !CHARS.some(m => m !== c && m.team === c.team && m.alive && m.pos.distanceTo(c.pos) < 9);
      if (((e || hurt) && c.hp < c.maxHp * D.retreat * (allout ? 0.6 : 1)) || (e && c.ink < 7) || (alone && hurt)) {
        aiStat(c.team, 'retreat'); this.mode = 'retreat'; this.retreatEnd = T + 7; this.climb = null; this.lurkT = 0; this.findRetreat(e || c.lastAttacker);
      }
    }
    if (this.mode === 'retreat' && ((c.hp >= c.maxHp * 0.9 && c.ink > 55) || T > this.retreatEnd)) { this.mode = 'paint'; this.path = []; this.retarget = 0; this.retreatT = T + 2.5; }
    // ---- stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1.4) {
      if (this.lastPos.distanceTo(c.pos) < 0.6 && this.path.length && !this.climb && !this.enemy) {            // trying to get somewhere and not moving
        I.jump = true; this.path = []; this.retarget = 0; this.stuckN = (this.stuckN || 0) + 1;
        // really wedged (three goes): super-jump out to a teammate
        if (this.stuckN >= 3) { const m = CHARS.filter(o => c.canJumpTo(o) && !o.inOwnBarrier() && o.pos.distanceTo(c.pos) > 6); if (m.length && c.startSuperJump(pick(m))) { this.stuckN = 0; aiStat(c.team, 'unstickJump'); if (G.aiLog) G.aiLog.push('unstick ' + c.weapon.id + ' @' + c.pos.x.toFixed(1) + ',' + c.pos.y.toFixed(1) + ',' + c.pos.z.toFixed(1) + ' ' + this.mode + '/' + this.role + ' path' + this.path.length + ' tgt ' + (this.target ? this.target.x + ',' + this.target.y.toFixed(1) + ',' + this.target.z : '-') + ' node h' + NAV.nh[navNode(c.pos.x, c.pos.y, c.pos.z)].toFixed(1) + ' start h' + NAV.nh[navStart(c.pos.x, c.pos.y, c.pos.z)].toFixed(1) + (c.swim ? ' swim' : '') + ' ink' + c.ink.toFixed(0)); } }
      } else this.stuckN = 0;
      this.lastPos.copy(c.pos); this.stuckT = 0;
    }
    I.fire = false; I.swim = false; I.aimDir = null;
    if (G.time - (c.fenceT ?? -9) < 0.25) this.fenceSwim = 0.6;                 // bumped a grate fence: squid through it
    if (this.fenceSwim > 0) { this.fenceSwim -= dt; I.swim = true; }
    // ---- retreating: swim for cover; only shoot back at someone right on top of us
    if (this.mode === 'retreat') {
      I.special = false;
      if (c.special >= 100 && e && e.pos.distanceTo(c.pos) < 4.5) I.special = true;                    // cornered: slam
      if (!(e && e.pos.distanceTo(c.pos) < 3.2 && c.ink > 12 && c.hp > c.maxHp * 0.25)) {
        const moving = this.followPath(I, dt);
        if (onOwn) I.swim = true;
        else if (moving && c.ink > 8 && !chg) { c.aimYaw += angDiff(c.aimYaw, Math.atan2(I.mx, I.mz)) * Math.min(1, dt * 10); c.aimPitch = damp(c.aimPitch, -0.75, 12, dt); I.fire = true; }   // lay ink ahead to dive into
        if (!moving) { if (onOwn) { I.mx = Math.sin(T * 0.8 + this.sweep) * 0.25; I.mz = Math.cos(T * 0.8 + this.sweep) * 0.25; } else if (!this.findRetreat(e)) this.mode = 'paint'; }
        return;
      }
    }
    if (e && e.alive && (this.mode !== 'refill' || e.pos.distanceTo(c.pos) < 7 || (chg && c.ink > 22)) && c.ink > 3 && !this.climb) {
      // -------- fight
      const d = e.pos.distanceTo(c.pos); this.lurkT = 0;
      if (c.weapon.charges) { this.chargerFight(dt, e, d, D); this.path = []; return; }
      if (c.subId === 'curling' && this.curlFollow(dt, e, d)) { this.path = []; return; }
      this.errT -= dt; if (this.errT <= 0) { this.errT = rand(0.25, 0.5); const m = D.err * d * (this.fuzzy ? 2.5 : 1); this.err.set(rand(-m, m), rand(-m, m) * 0.6, rand(-m, m)); }
      const wid = c.weapon.id, tt = shotTime(d, wid); const tp = e.chest().addScaledVector(e.vel, tt * 0.9).add(this.err);
      const dy_ = this.aimAt(tp, dt, D.turn, wid);
      this.reactT -= dt;
      if (this.reactT <= 0 && Math.abs(dy_) < 0.25 && d < c.weapon.range + 1.5 && Math.random() < D.fireHold + 0.1) I.fire = true;
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = D.combo ? rand(0.3, 0.9) : rand(0.4, 1.3); }
      const fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw), rx = -fz, rz = fx;
      // keep the range this weapon likes (smarter bots); the old rule otherwise
      const R = c.weapon.range, adv = D.team ? (d > R * 0.8 ? 0.9 : d < R * (wid === 'smg' ? 0.22 : 0.33) ? -0.6 : wid === 'smg' ? 0.35 : 0.1) : (d > 10 ? 0.9 : d < 4.5 ? -0.6 : 0.15);
      I.mx = rx * this.strafe * 0.75 + fx * adv; I.mz = rz * this.strafe * 0.75 + fz * adv;
      const l = Math.hypot(I.mx, I.mz); if (l > 1) { I.mx /= l; I.mz /= l; }
      if (Math.random() < dt * 0.7 * D.dodge && c.grounded) I.jump = true;
      if (c.hp < 45 && onOwn && Math.random() < D.dodge) { this.swimT = Math.max(this.swimT, 0.5); }
      // combos (hard bots): dive under the shots and come up beside them; lay ink at our feet first so there is somewhere to dive
      if (D.combo) {
        if (onOwn && T - c.lastHurt < 0.3 && T > this.diveCd && Math.random() < D.combo) { this.swimT = rand(0.35, 0.55); this.diveSide = this.strafe; this.diveCd = T + rand(1.5, 2.6); aiStat(c.team, 'dive'); }
        if (!onOwn && d > 5 && T > this.footCd && c.ink > 30 && Math.random() < D.combo) { this.footT = 0.24; this.footCd = T + rand(2.5, 4.5); aiStat(c.team, 'inkFeet'); }
        if (this.footT > 0) { this.footT -= dt; c.aimPitch = damp(c.aimPitch, -1.05, 30, dt); I.fire = true; }
      }
      if (this.swimT > 0) { this.swimT -= dt; I.swim = true; I.fire = false; if (this.diveSide) { I.mx = rx * this.diveSide; I.mz = rz * this.diveSide; } if (this.swimT <= 0) this.diveSide = 0; }
      if (c.subId === 'curling') { if (d > 6 && d < 15 && c.ink >= SUBS.curling.cost / c.inkK + 8 && c.grounded && Math.abs(dy_) < 0.2 && Math.random() < dt * 0.7) { I.bomb = true; I.fire = false; this.curlT = 1.3; } }
      else if (d > 5 && d < 12 && c.ink > 75 && Math.random() < dt * 0.35) { I.bomb = true; c.aimPitch += 0.28; }
      // special: when it will catch more than one, or to get out of a losing fight (the old rule for easy bots)
      if (c.special >= 100) {
        const near = CHARS.filter(o => o.team !== c.team && o.alive && o.state === 'play' && o.pos.distanceTo(c.pos) < 6.5).length;
        I.special = D.team ? (near >= 2 || (d < 5 && c.hp < c.maxHp * 0.5) || (d < 4 && Math.random() < dt * 0.8)) : (d < 7 && Math.random() < dt * 2);
      } else I.special = false;
      this.path = [];
      return;
    }
    // just lost them in the ink: spray where they were last seen, drifting off as the trail goes cold (smart bots lob a bomb in after them)
    if (!e && this.lastSeen && T - this.lastSeen.t < 0.5 && c.ink > 5 && !c.weapon.charges && !this.climb) {
      const L = this.lastSeen, m = c.muzzle(), k = (T - L.t) / 0.5, dx = L.p.x - m.x + Math.sin(T * 7) * k * 1.4, dz = L.p.z - m.z + Math.cos(T * 5) * k * 1.4, dy = L.p.y + 0.3 - m.y, hd = Math.hypot(dx, dz);
      c.aimYaw += clamp(angDiff(c.aimYaw, Math.atan2(dx, dz)), -D.turn * dt, D.turn * dt); c.aimPitch = damp(c.aimPitch, Math.atan2(dy, hd) + dropComp(hd, c.weapon.id), 10, dt);
      if (D.bombSmart && c.subId === 'bomb' && hd > 4 && hd < 13 && T > this.bombCd && c.ink >= SUBS.bomb.cost / c.inkK + 10 && Math.abs(angDiff(c.aimYaw, Math.atan2(dx, dz))) < 0.2) { I.bomb = true; c.aimPitch = 0.12 + hd * 0.03; this.bombCd = T + 6; aiStat(c.team, 'bombChase'); }
      else I.fire = true;
      I.mx = I.mz = 0; I.special = false; this.path = []; return;
    }
    I.special = false;
    if (this.mode === 'refill') {
      if (!this.path.length && !onOwn) { if (!this.findRefill()) { // paint own puddle
        if (c.ink > 4) { this.pull(I, 0.3); c.aimPitch = damp(c.aimPitch, -0.9, 8, dt); } I.mx = I.mz = 0; return; } }
      if (onOwn && !this.path.length) { I.swim = true; if (D.inkCare) I.mx = I.mz = 0; else { I.mx = Math.sin(T * 0.8 + this.sweep) * 0.3; I.mz = Math.cos(T * 0.8 + this.sweep) * 0.3; } return; }   // (careful bots sit still under the ink; the others drift about and keep surfacing)
      this.followPath(I, dt); I.swim = I.swim || onOwn; if (D.inkCare && onOwn && c.submerged) { this.path = []; I.mx = I.mz = 0; } return;
    }
    // -------- lying in wait: under the ink at a choke point until someone walks into it
    if (this.lurkT > 0) {
      this.lurkT -= dt; I.swim = true; I.mx = I.mz = 0;
      if (!onOwn || T - c.lastHurt < 0.5) this.lurkT = 0;
      const fr = S ? S.fresh(2).map(([, s]) => s).sort((a, b) => Math.hypot(a.x - c.pos.x, a.z - c.pos.z) - Math.hypot(b.x - c.pos.x, b.z - c.pos.z))[0] : null;
      const sp = SPAWN[1 - c.team], ax = fr ? fr.x : sp.x, az = fr ? fr.z : sp.z;
      c.aimYaw += angDiff(c.aimYaw, Math.atan2(ax - c.pos.x, az - c.pos.z)) * Math.min(1, dt * 4); c.aimPitch = damp(c.aimPitch, -0.05, 5, dt);
      return;
    }
    // -------- paint / roam
    if (this.dawdleT > 0) { this.dawdleT -= dt; c.aimYaw += dt * 1.6 * (this.sweep > 3 ? 1 : -1); I.mx = I.mz = 0; return; }      // beginners stop and look around
    this.retarget -= dt;
    if (!this.path.length && !this.climb) {
      if (this.target && this.linger < (this.perch ? 5 : this.ambushAt != null ? 2.5 : D.team >= 2 ? 0.8 : D.team ? 1.1 : 1.6) && this.target.distanceTo(c.pos) < 2.5) {
        this.linger += dt;
        // arrived by a choke point with our ink underfoot: sometimes dive and wait there
        if (D.ambush && onOwn && T > this.lurkCd && !chg && !allout && (this.ambushAt != null || TAC.chokes.some(k => Math.hypot(k.x - c.pos.x, k.z - c.pos.z) < 7))) { this.lurkCd = T + rand(8, 14); if (this.ambushAt != null || Math.random() < D.ambush * 0.6) { this.lurkT = rand(3, 6); this.ambushAt = null; aiStat(c.team, 'lurk'); } }
      }
      else if ((this.replanT = (this.replanT || 0) - dt) <= 0) { this.replanT = 0.3; if (D.dawdle && !this.dawdled && Director.paintFocus(c.team) < 0.3 && Math.random() < D.dawdle) { this.dawdled = true; this.dawdleT = rand(0.8, 1.8); return; } this.dawdled = false; this.chooseTarget(); }      // nothing to walk to (a fight or a dead end emptied the route): pick again straight away
    }
    const moving = this.followPath(I, dt);
    if (this.climb) return;
    const baseYaw = moving ? Math.atan2(I.mx, I.mz) : c.aimYaw + dt * 2.5;
    const wantYaw = baseYaw + Math.sin(T * 2.3 * this.jitter + this.sweep) * 0.6;
    c.aimYaw += angDiff(c.aimYaw, wantYaw) * Math.min(1, dt * (chg ? 3 : 6)); c.aimPitch = damp(c.aimPitch, (chg ? -0.12 : -0.3) + Math.sin(T * 1.4 + this.sweep) * (chg ? 0.05 : 0.12), 5, dt);
    const ax = c.pos.x + Math.sin(c.aimYaw) * 4, az = c.pos.z + Math.cos(c.aimYaw) * 4;
    const ah = ownerAt(ax, groundBelow(ax, az, c.pos.y + 1, 0), az);
    const nextOwn = this.path.length ? ownerAt(this.path[0].x, this.path[0].y, this.path[0].z) === c.team : false;
    if (I.swim) { /* a squid-only stretch of the route */ }
    else if (!c.charging && onOwn && nextOwn && c.ink > 30 && Math.random() < (D.swimK ?? 0.9) && ah === c.team) { I.swim = true; }
    else if (c.charging) { this.pull(I); if (!I.fire) this.chgRest = T + (D.team ? 1.0 : 0); }
    // (team snipers: one long line, then walk on properly for a second - charging all the time means crawling everywhere)
    else if (chg ? c.ink > 38 && T > (this.chgRest || 0) && (ah !== c.team || (!D.team && Math.random() < 0.15)) : c.ink > 6 && (ah !== c.team || Math.random() < 0.3)) this.pull(I, chg ? (D.team ? rand(0.6, 1) : rand(0.3, 0.7)) : 1);
    if (c.special >= 100 && ((this.target && this.linger > 0.5) || (ah === 1 - c.team && Math.random() < dt * 0.6))) I.special = true;
    if (c.subId === 'bomb' || !c.subId) {
      if (D.bombSmart) {
        // bombs go where enemies have just been seen, or onto a contested choke point - not just anywhere
        if (T > this.bombCd && c.ink > 85 && S) { const fr = S.fresh(2.5).map(([, s]) => s).filter(s => { const d = Math.hypot(s.x - c.pos.x, s.z - c.pos.z); return d > 5 && d < 13; })[0]; if (fr && Math.random() < dt * 1.5) { c.aimYaw = Math.atan2(fr.x - c.pos.x, fr.z - c.pos.z); c.aimPitch = 0.12 + Math.hypot(fr.x - c.pos.x, fr.z - c.pos.z) * 0.03; I.bomb = true; this.bombCd = T + 6; aiStat(c.team, 'bombSeen'); } }
      } else if (c.ink > 90 && Math.random() < dt * 0.08) { I.bomb = true; c.aimPitch = 0.25; }
    }
    else if (c.subId === 'curling' && moving && c.ink > 90 && c.grounded && Math.random() < dt * 0.2) { c.aimYaw = Math.atan2(I.mx, I.mz); c.aimPitch = 0; I.bomb = true; }
  }
}

/* =============================================================== INPUT */
const Input = { keys: {}, fire: false, dx: 0, dy: 0, locked: false, jumpQ: false, bombQ: false, spQ: false, bombHoldKey: false, bombHoldMouse: false, bombWasHeld: false };
function initInput() {
  addEventListener('keydown', e => {
    if (e.repeat) { if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); return; }
    Input.keys[e.code] = true;
    if (e.code === 'Space') { if (!Input.spaceLock) Input.jumpQ = true; e.preventDefault(); }     // (spaceLock: still held from skipping the opening film)
    if (e.code === 'KeyE') Input.bombHoldKey = true;
    if (e.code === 'KeyQ') Input.spQ = true;
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'Backquote' && G.state !== 'title') Director.toggle();
    if (G.mapOpen && /^Digit[1-3]$/.test(e.code)) HUD.pickAlly(+e.code.slice(5) - 1);
    if (G.mapOpen && e.code === 'Escape') toggleMap(false);
    if (e.code === 'Tab') e.preventDefault();
  });
  addEventListener('keyup', e => { Input.keys[e.code] = false; if (e.code === 'KeyE') Input.bombHoldKey = false; if (e.code === 'Space') Input.spaceLock = false; });
  addEventListener('blur', () => { Input.keys = {}; Input.fire = false; Input.bombHoldKey = Input.bombHoldMouse = false; });
  const cv = $('gl');
  addEventListener('mousedown', e => {
    if ((G.state === 'play' || G.state === 'intro') && !G.paused) {
      if (G.mapOpen) return;                      // map is open: clicks go to the map
      if (!Input.locked && !G.paused) { lockPointer(); return; }
      if (e.button === 0) Input.fire = true; if (e.button === 2) Input.bombHoldMouse = true;
    }
  });
  addEventListener('mouseup', e => { if (e.button === 0) Input.fire = false; if (e.button === 2) Input.bombHoldMouse = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => { if (Input.locked) { Input.dx += e.movementX || 0; Input.dy += e.movementY || 0; } });
  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement === cv;
    if (!Input.locked) { Input.fire = false; if ((G.state === 'play' || G.state === 'intro') && !G.mapOpen) pauseGame(); }
  });
}
// big map: frees the mouse so you can click a teammate to super jump to
function toggleMap(force) {
  const open = force === undefined ? !G.mapOpen : force;
  if (open && !(G.state === 'play' && PLAYER)) return;
  G.mapOpen = open; $('minimap').classList.toggle('big', open); $('mapHint').classList.toggle('show', open);
  Input.fire = false; Input.keys = {};
  if (open) { if (document.pointerLockElement) document.exitPointerLock(); HUD.mmT = 0; }
  else if (G.state === 'play' && !G.paused) lockPointer();
}
function lockPointer() { const cv = $('gl'); try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }

/* ============================================================= PLAYER */
const Cam = { bombAim: false, zoom: 1, land: new THREE.Vector3(), lock: false, landDist: 0, showLand: false, onEnemy: false, yaw: Math.PI, pitch: -0.05, pos: new THREE.Vector3(), pivotY: 0, dist: 4.4, aim: new THREE.Vector3(), onEnemy: false };
function playerControl(dt) {
  const c = PLAYER, I = c.intent, k = Input.keys;
  const s = 0.0022 * SETTINGS.sens * Cam.zoom;
  Cam.yaw -= Input.dx * s; Cam.pitch -= Input.dy * s * (SETTINGS.inv ? -1 : 1); Input.dx = Input.dy = 0;
  Cam.pitch = clamp(Cam.pitch, -1.15, 1.2);
  if (!c.alive || c.state !== 'play') { if (Proj.pv) Proj.preview(null); I.mx = I.mz = 0; I.fire = I.swim = false; Input.jumpQ = Input.bombQ = Input.spQ = false; Input.bombWasHeld = false; Cam.bombAim = false; Cam.showLand = false; Cam.lock = false; return; }
  const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  const fx = Math.sin(Cam.yaw), fz = Math.cos(Cam.yaw), rx = -fz, rz = fx;
  let mx = fx * f + rx * r, mz = fz * f + rz * r; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  I.mx = mx; I.mz = mz;
  I.swim = !!(k.ShiftLeft || k.ShiftRight);
  const held = Input.bombHoldKey || Input.bombHoldMouse;
  if (!held && Input.bombWasHeld && !c.swim) Input.bombQ = true;   // throw on release
  Input.bombWasHeld = held; Cam.bombAim = held && !c.swim && !c.sp;
  I.fire = Input.fire && !Cam.bombAim; I.jump = Input.jumpQ; I.bomb = Input.bombQ; I.special = Input.spQ;
  Input.jumpQ = Input.bombQ = Input.spQ = false;
  c.aimYaw = Cam.yaw; c.aimPitch = Cam.pitch;
  // aim ray from camera
  const o = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
  let hitP = null;
  const start = Math.max(0, Cam.pos.distanceTo(c.eye()) - 0.3);
  for (let t = start; t < 60; t += 0.3) {
    const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
    let hitE = false;
    if (t < 20) for (const e of CHARS) if (e.team !== c.team && !e.submerged && Proj.hitChar(e, { x: px, y: py, z: pz }, 0.05)) { hitE = true; break; }
    if (hitE) { hitP = new THREE.Vector3(px, py, pz); break; }
    if (solidAt(px, py, pz)) { hitP = new THREE.Vector3(px, py, pz); break; }
  }
  if (!hitP) hitP = new THREE.Vector3(o.x + d.x * 60, o.y + d.y * 60, o.z + d.z * 60);
  Cam.aim.copy(hitP);
  const mzl = c.muzzle();
  I.aimDir = hitP.clone().sub(mzl).normalize();
  // second reticle: where the ink will actually land; "lock" when an enemy would be hit
  const W = c.weapon;
  const R = c.rangeNow(), D = mzl.distanceTo(hitP);
  // small reticle sits ON the aim line: on the aimed surface if it is within range, otherwise at max range
  if (D <= R) Cam.land.copy(hitP); else Cam.land.copy(mzl).addScaledVector(I.aimDir, R);
  // ...but the ink leaves from the gun, not the camera: if something blocks the gun's line first, stick to that
  const Lr = Math.min(D, R), tb = segBlocked(mzl.x, mzl.y, mzl.z, Cam.land.x, Cam.land.y, Cam.land.z, 0.2);
  Cam.blocked = tb > 0 && tb * Lr < Lr - 0.35;
  if (Cam.blocked) Cam.land.copy(mzl).addScaledVector(I.aimDir, tb * Lr);
  Cam.landDist = Cam.blocked ? tb * Lr : Lr;
  const pr = W.type === 'charge' ? traceRay(c, mzl, I.aimDir, R, 0.3) : Proj.predict(c, mzl, I.aimDir);
  Cam.lock = !!pr.char;
  if (Cam.bombAim) Proj.preview(c, I.aimDir, c.ink >= SUBS[c.subId].cost / c.inkK); else if (Proj.pv) Proj.preview(null);
  Cam.showLand = !c.swim;
}
// teammate to watch while dead: your super-jump pick, else keep the current one, else the nearest
function spectateTarget(c) {
  const ok = m => m && m !== c && m.team === c.team && m.alive && m.state !== 'dead';
  if (ok(c.jumpTarget)) return c.jumpTarget;
  if (ok(Cam.spec)) return Cam.spec;
  let best = null, bd = 1e9; for (const m of CHARS) if (ok(m)) { const d = m.pos.distanceTo(c.pos); if (d < bd) { bd = d; best = m; } }
  return best;
}
// the play camera's pose behind the player on the first frame of a match (same maths as updateCamera at rest)
function startCamPose() {
  const c = PLAYER, cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
  const dir = new THREE.Vector3(Math.sin(Cam.yaw) * cp, sp, Math.cos(Cam.yaw) * cp), pivot = new THREE.Vector3(c.pos.x, c.pos.y + 1.5, c.pos.z);
  const pos = pivot.clone().addScaledVector(dir, -4.6); pos.y += 1.2;
  const t = segBlocked(pivot.x, pivot.y, pivot.z, pos.x, pos.y, pos.z, 0.15); if (t) pos.lerpVectors(pivot, pos, Math.max(0.1, t - 0.08));
  if (pos.y < 0.3) pos.y = 0.3;
  return { pos, look: pivot.clone().addScaledVector(dir, 30) };
}
function updateCamera(dt) {
  const c = PLAYER;
  let px = c.pos.x, py = c.pos.y, pz = c.pos.z;
  if (c.state === 'dead') {
    const t = RESPAWN - c.respawnT;
    // 1) look at whoever knocked you out (like the original) ...
    const k = c.lastAttacker && c.lastAttacker.alive && t < 2.0 ? c.lastAttacker : null;
    // 2) ... then watch a teammate until you respawn (the super-jump pick if you chose one, else the nearest)
    const mate = !k && t > 0.8 ? spectateTarget(c) : null;
    Cam.spec = mate;
    if (mate) {
      const hs = Math.hypot(mate.vel.x, mate.vel.z), wantYaw = hs > 1 && mate.state === 'play' ? Math.atan2(mate.vel.x, mate.vel.z) : mate.aimYaw;
      Cam.specYaw = Cam.specYaw === undefined ? wantYaw : Cam.specYaw + angDiff(Cam.specYaw, wantYaw) * Math.min(1, dt * 2.5);
      const py = mate.pos.y + (mate.swim ? 1.1 : 1.5), fx = Math.sin(Cam.specYaw), fz = Math.cos(Cam.specYaw);
      const want = new THREE.Vector3(mate.pos.x - fx * 5.4, py + 1.5, mate.pos.z - fz * 5.4);
      const tb = segBlocked(mate.pos.x, py, mate.pos.z, want.x, want.y, want.z, 0.15); if (tb) want.lerpVectors(new THREE.Vector3(mate.pos.x, py, mate.pos.z), want, Math.max(0.15, tb - 0.08));
      Cam.pos.lerp(want, 1 - Math.exp(-5 * dt)); camera.position.copy(Cam.pos);
      camera.lookAt(mate.pos.x + fx * 6, py - 0.2, mate.pos.z + fz * 6);
      return;
    }
    Cam.specYaw = undefined;
    const g = c.ghost.position;
    const tgt = k ? k.chest() : new THREE.Vector3(g.x, g.y, g.z);
    const want = new THREE.Vector3(c.pos.x - Math.sin(Cam.yaw) * 6, c.pos.y + 5, c.pos.z - Math.cos(Cam.yaw) * 6);
    Cam.pos.lerp(want, 1 - Math.exp(-3 * dt)); camera.position.copy(Cam.pos); camera.lookAt(tgt);
    return;
  }
  Cam.spec = null; Cam.specYaw = undefined;
  const zt = c.charging ? 1 - 0.24 * c.charge : 1;
  Cam.zoom = damp(Cam.zoom, zt, 10, dt);
  const fv = SETTINGS.fov * Cam.zoom; if (Math.abs(camera.fov - fv) > 0.02) { camera.fov = fv; camera.updateProjectionMatrix(); }
  const targetY = py + (c.swim ? 1.0 : 1.5);
  Cam.pivotY = c.state === 'drop' || c.state === 'sjfly' ? targetY : damp(Cam.pivotY, targetY, 14, dt);
  const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
  const dir = new THREE.Vector3(Math.sin(Cam.yaw) * cp, sp, Math.cos(Cam.yaw) * cp);
  const right = new THREE.Vector3(-Math.cos(Cam.yaw), 0, Math.sin(Cam.yaw));
  const pivot = new THREE.Vector3(px, Cam.pivotY, pz);
  // pull the camera back/up smoothly while super-jumping so you can see the map below
  Cam.fly = damp(Cam.fly || 0, c.state === 'sjfly' ? 1 : 0, 4, dt);
  const dist = (c.swim ? 5.0 : 4.6) + Cam.fly * 5.5;      // with the narrower default FOV (62) the character fills ~30% of the screen, like the original
  const shoulder = right.clone().multiplyScalar(0);
  const want = pivot.clone().addScaledVector(dir, -dist).add(shoulder); want.y += 1.2 + Cam.fly * 4.5;
  const pv = pivot.clone().add(shoulder.clone().multiplyScalar(0.5));
  const t = segBlocked(pv.x, pv.y, pv.z, want.x, want.y, want.z, 0.15);
  if (t) want.lerpVectors(pv, want, Math.max(0.1, t - 0.08));
  if (want.y < 0.3) want.y = 0.3;
  Cam.pos.copy(want);
  camera.position.copy(want);
  if (G.shakeAmt > 0) { camera.position.x += rand(-1, 1) * G.shakeAmt * 0.25; camera.position.y += rand(-1, 1) * G.shakeAmt * 0.25; G.shakeAmt = Math.max(0, G.shakeAmt - dt * 3); }
  Cam.kick = (Cam.kick || 0) * Math.exp(-dt * 22);
  camera.lookAt(pivot.x + dir.x * 30 + shoulder.x, pivot.y + dir.y * 30 + Cam.kick * 30, pivot.z + dir.z * 30 + shoulder.z);
}
