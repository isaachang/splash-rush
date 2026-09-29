/* ================================================================ MAP
   Several maps: the one in use is picked before the world is built (the
   lobby saves the choice and reloads the page), so every system below just
   reads XH / ZH / SOLIDS / SPAWN / DECK as before.                        */
const MAP_LIST = {
  dock: { id: 'dock', name: '潮汐码头广场', en: 'TIDE DOCK PLAZA', XH: 28, ZH: 46, desc: '码头上的集装箱广场，中路开阔、两侧有高台' },
  skate: { id: 'skate', name: '墨浪滑板场', en: 'RUSH SKATEPARK', XH: 22, ZH: 48, cull: true, desc: '城市滑板公园：下沉泳池、中央高塔、铁网桥和绕后小巷' }
};
const MAP_KEY = 'splashrush.map';
const MAP_ID = (() => {
  if (typeof SR_MAP !== 'undefined' && MAP_LIST[SR_MAP]) return SR_MAP;     // tests / tools
  try { const q = new URLSearchParams(location.search).get('map'); if (q && MAP_LIST[q]) return q; } catch (e) { }
  try { const v = localStorage.getItem(MAP_KEY); if (v && MAP_LIST[v]) return v; } catch (e) { }
  return 'dock';
})();
const MAP = MAP_LIST[MAP_ID];
const XH = MAP.XH, ZH = MAP.ZH, CELL = 0.14;
const NX = Math.ceil(XH * 2 / CELL), NZ = Math.ceil(ZH * 2 / CELL);
const PSX = NX * CELL, PSZ = NZ * CELL;
const SOLIDS = [];
// see-through grate pieces kept apart from SOLIDS: bridges (stand on them in human form, squids and ink fall through)
// and fences (block people, squids and ink pass)
const BRIDGES = [], FENCES = [];
function box(x0, x1, z0, z1, h, style, top) { return { t: 'box', x0, x1, z0, z1, h, style, top: top || 'concrete' }; }
function ramp(x0, x1, z0, z1, axis, h0, h1, top) { return { t: 'ramp', x0, x1, z0, z1, axis, h0, h1, style: 'stone', top: top || 'grate' }; }
function mirrorSolid(s) { const m = Object.assign({}, s, { x0: -s.x1, x1: -s.x0, z0: -s.z1, z1: -s.z0 }); if (s.t === 'ramp') { m.h0 = s.h1; m.h1 = s.h0; } return m; }
function defineMap() { if (MAP_ID === 'skate') defineSkate(); else defineDock(); buildSolidGrid(); }
// coarse grid over the arena: which solids touch each 4 m cell (padded), so ground / collision lookups stay cheap
const SG = { S: 4, W: 0, H: 0, cells: null };
function buildSolidGrid() {
  SG.W = Math.ceil(XH * 2 / SG.S); SG.H = Math.ceil(ZH * 2 / SG.S); SG.cells = Array.from({ length: SG.W * SG.H }, () => []);
  const ci = (v, n, E) => clamp(Math.floor((v + E) / SG.S), 0, n - 1);
  for (const s of SOLIDS) { const i0 = ci(s.x0 - 0.6, SG.W, XH), i1 = ci(s.x1 + 0.6, SG.W, XH), j0 = ci(s.z0 - 0.6, SG.H, ZH), j1 = ci(s.z1 + 0.6, SG.H, ZH); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) SG.cells[j * SG.W + i].push(s); }
}
function solidsNear(x, z) { if (!SG.cells) return SOLIDS; return SG.cells[clamp(Math.floor((z + ZH) / SG.S), 0, SG.H - 1) * SG.W + clamp(Math.floor((x + XH) / SG.S), 0, SG.W - 1)]; }
function defineDock() {
  const half = [
    box(-9, 9, 37, 46, 2.0, 'deck', 'deck'),
    ramp(-3, 3, 31, 37, 'z', 0, 2.0),
    ramp(9, 14, 39.5, 44.5, 'x', 2.0, 0),
    ramp(-14, -9, 39.5, 44.5, 'x', 0, 2.0),
    box(-12, -6, 28, 29.2, 1.1, 'panel'),
    box(6, 12, 28, 29.2, 1.1, 'panel'),
    box(-24, -19, 20, 29, 2.6, 'contR', 'grate'),
    box(-23.8, -21.3, 26.2, 28.8, 5.2, 'contY', 'grate'),
    box(17, 25, 18, 21, 2.6, 'contB', 'grate'),
    box(-17, -11, 9, 15, 3.0, 'stone', 'concrete'),
    ramp(-16, -12, 15, 21, 'z', 3.0, 0),
    box(10, 15, 9, 13, 1.4, 'crate', 'crate'),
    box(21, 23, 2, 12, 2.2, 'panel'),
    box(-7, -5, 15, 17, 1.2, 'crate', 'crate'),
    box(4, 6, 19.5, 21.5, 1.2, 'crate', 'crate'),
    box(-26.5, -24.5, 4, 8, 1.2, 'contG', 'grate'),
    box(3.5, 5.5, 1, 3, 3.6, 'stone', 'concrete'),
    ramp(-2.5, 2.5, 4.5, 10.5, 'z', 2.4, 0),
  ];
  half.forEach(s => { SOLIDS.push(s); SOLIDS.push(mirrorSolid(s)); });
  SOLIDS.push(box(-7, 7, -4.5, 4.5, 2.4, 'panel', 'grate'));
  // perimeter walls (only inner face paintable)
  const B = 1.6;
  SOLIDS.push(Object.assign(box(XH, XH + 1.5, -ZH, ZH, B, 'panel'), { bound: '-x' }));
  SOLIDS.push(Object.assign(box(-XH - 1.5, -XH, -ZH, ZH, B, 'panel'), { bound: '+x' }));
  SOLIDS.push(Object.assign(box(-XH, XH, ZH, ZH + 1.5, B, 'panel'), { bound: '-z' }));
  SOLIDS.push(Object.assign(box(-XH, XH, -ZH - 1.5, -ZH, B, 'panel'), { bound: '+z' }));
  SOLIDS.forEach((s, i) => { s.id = i; s.maxH = s.t === 'ramp' ? Math.max(s.h0, s.h1) : s.h; });
}
/* ---- 墨浪滑板场 (skatepark): structure after the classic skatepark stage — rotationally symmetric,
   raised street level with a sunken skate bowl on each side, a climb-only tower in the middle, a grate
   bridge over a pit on each flank, a fenced pocket by the tower, spawn decks offset to one side. */
const SL = 1.0;    // street level (the bowls and pits are sunk below it)
function defineSkate() {
  const oob = (x0, x1, z0, z1, h = 3.6) => Object.assign(box(x0, x1, z0, z1, h, 'hedge', 'grass'), { oob: true });
  const holes = [[-5.5, 19, 17, 32], [-20, -12.5, 5.3, 9.7]];           // team-0 bowl and flank pit (rotated for team 1)
  const half = [
    // out of bounds: gardens, grandstands
    oob(-22, -12, 34, 48), oob(-22, -19, 10, 34), oob(-22, -20, 0, 10), oob(10, 22, 40, 48), oob(14, 22, 35, 40), oob(19, 22, 0, 35), oob(-1, 10, 46.5, 48),
    // spawn deck, the upper platform in front of it and the flank ledge along the wall
    box(-12, -1, 35, 46.5, 2.4, 'deck', 'deck'),
    box(-19, -5.5, 21, 35, 2.0, 'panel', 'concrete'),
    box(-12, -5.5, 15, 21, 2.0, 'panel', 'concrete'),
    box(-9, -7, 16.5, 19, 3.2, 'hedge', 'grass'),
    box(-19, -14.5, 10, 21, 2.0, 'stone', 'concrete'),
    // right of the spawn: the lower alley down to the bowl, with a high perch overlooking it
    ramp(-1, 2.5, 40, 44, 'x', 2.4, SL, 'skate'),
    box(-1, 2, 36, 38.5, 2.2, 'crate', 'crate'), box(3, 5, 44.5, 46.5, 1.9, 'crate', 'crate'),
    box(5, 10, 33.5, 38.5, 2.9, 'contR', 'grate'),
    ramp(5, 10, 38.5, 42, 'z', 2.9, SL, 'wood'),
    // the bowl: quarter pipes on the spawn side and along the outer wall, two humps, ways out toward the middle
    ramp(-5.5, 19, 29.3, 31, 'z', 0, 0.4, 'skate'), ramp(-5.5, 19, 31, 32, 'z', 0.4, SL, 'skate'),
    ramp(16.3, 17.8, 17, 32, 'x', 0, 0.4, 'skate'), ramp(17.8, 19, 17, 32, 'x', 0.4, SL, 'skate'),
    ramp(-3.5, 4.5, 17, 19.5, 'z', SL, 0, 'skate'), ramp(11.5, 16.3, 17, 18.5, 'z', SL, 0, 'skate'),
    ramp(0, 6, 20.5, 22.5, 'z', 0, 0.55, 'skate'), box(0, 6, 22.5, 24.5, 0.55, 'stone', 'skate'), ramp(0, 6, 24.5, 26.5, 'z', 0.55, 0, 'skate'),
    ramp(8.5, 10.5, 21.5, 28, 'x', 0, 0.55, 'skate'), box(10.5, 12.5, 21.5, 28, 0.55, 'stone', 'skate'), ramp(12.5, 14.5, 21.5, 28, 'x', 0.55, 0, 'skate'),
    // palm planter (out of bounds) with a wooden walkway along its middle side
    oob(4.5, 11.5, 9, 17, 4.2),
    box(3, 11.5, 7.5, 9, 2.2, 'crate', 'wood'), ramp(11.5, 15, 7.5, 9, 'x', 2.2, SL, 'wood'),
    // centre-side blocks
    box(10, 18, -5, 1.6, 2.2, 'contB', 'grate'), ramp(12, 17, 1.6, 4.5, 'z', 2.2, SL, 'wood'),
    ramp(-10, -6.5, 5, 10, 'z', SL, 2.0, 'wood'), box(-10, -6.5, 10, 15, 2.0, 'crate', 'wood'),
    box(-5, -0.5, 2.8, 5, 1.9, 'panel', 'concrete'), box(-4, -2, 6.5, 10, 1.6, 'stone', 'concrete'),
    // flank pit under the grate bridge: a ramp to climb back out
    ramp(-12.5, -10.5, 5.3, 9.7, 'x', 0, SL, 'skate'),
    // tower balcony (the tower itself is added once, below)
    box(2.3, 3.6, -1.3, 1.3, 1.9, 'panel', 'concrete'),
  ];
  // raised street level: the whole floor minus the sunken bowls / pits, as a few big slabs
  const H = holes.concat(holes.map(([x0, x1, z0, z1]) => [-x1, -x0, -z1, -z0]));
  const xs = [...new Set([-XH, XH].concat(...H.map(h => [h[0], h[1]])))].sort((a, b) => a - b), zs = [...new Set([-ZH, ZH].concat(...H.map(h => [h[2], h[3]])))].sort((a, b) => a - b);
  const inHole = (x, z) => H.some(h => x > h[0] && x < h[1] && z > h[2] && z < h[3]);
  let prev = null;
  for (let j = 0; j < zs.length - 1; j++) {
    const cz = (zs[j] + zs[j + 1]) / 2, runs = [];
    for (let i = 0; i < xs.length - 1; i++) { const cx = (xs[i] + xs[i + 1]) / 2; if (inHole(cx, cz)) continue; const r = runs[runs.length - 1]; if (r && r[1] === xs[i]) r[1] = xs[i + 1]; else runs.push([xs[i], xs[i + 1]]); }
    const key = runs.map(r => r.join(',')).join('|');
    if (prev && prev.key === key) prev.boxes.forEach(b => b.z1 = zs[j + 1]);
    else { prev = { key, boxes: runs.map(([x0, x1]) => box(x0, x1, zs[j], zs[j + 1], SL, 'stone', 'concrete')) }; prev.boxes.forEach(b => SOLIDS.push(b)); }
  }
  half.forEach(s => { SOLIDS.push(s); SOLIDS.push(mirrorSolid(s)); });
  SOLIDS.push(box(-2.3, 2.3, -2.3, 2.3, 4.0, 'panel', 'concrete'));                       // the tower: only by climbing its inked walls
  // grate bridge over each flank pit; fenced pocket beside the tower
  const br = { x0: -17.5, x1: -15.5, z0: 5, z1: 10, h: 2.1 }; BRIDGES.push(br, Object.assign({}, br, { x0: -br.x1, x1: -br.x0, z0: -br.z1, z1: -br.z0 }));
  const fz = [[4.5, 8.5, 2.8, 2.92], [4.5, 8.5, 6.08, 6.2], [4.5, 4.62, 2.8, 6.2], [8.38, 8.5, 2.8, 6.2]];
  fz.forEach(([x0, x1, z0, z1]) => { FENCES.push({ x0, x1, z0, z1, y0: SL, h: SL + 1.25 }, { x0: -x1, x1: -x0, z0: -z1, z1: -z0, y0: SL, h: SL + 1.25 }); });
  const B = 1.6 + SL;
  SOLIDS.push(Object.assign(box(XH, XH + 1.5, -ZH, ZH, B, 'panel'), { bound: '-x' }));
  SOLIDS.push(Object.assign(box(-XH - 1.5, -XH, -ZH, ZH, B, 'panel'), { bound: '+x' }));
  SOLIDS.push(Object.assign(box(-XH, XH, ZH, ZH + 1.5, B, 'panel'), { bound: '-z' }));
  SOLIDS.push(Object.assign(box(-XH, XH, -ZH - 1.5, -ZH, B, 'panel'), { bound: '+z' }));
  SOLIDS.forEach((s, i) => { s.id = i; s.maxH = s.t === 'ramp' ? Math.max(s.h0, s.h1) : s.h; });
}
// yaw = facing the battlefield (team 0 looks toward -z, team 1 toward +z)
const SPAWN = MAP_ID === 'skate' ? [{ x: -6.5, z: 42.5, y: 2.4, yaw: Math.PI }, { x: 6.5, z: -42.5, y: 2.4, yaw: 0 }] : [{ x: 0, z: 42, y: 2.0, yaw: Math.PI }, { x: 0, z: -42, y: 2.0, yaw: 0 }];
const DECK = MAP_ID === 'skate' ? [{ x0: -12, x1: -1, z0: 35, z1: 46.5 }, { x0: 1, x1: 12, z0: -46.5, z1: -35 }] : [{ x0: -9, x1: 9, z0: 37, z1: 46 }, { x0: -9, x1: 9, z0: -46, z1: -37 }];
function inRect(s, x, z) { return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1; }
function topAt(s, x, z) {
  if (s.t === 'box') return s.h;
  const t = s.axis === 'x' ? (x - s.x0) / (s.x1 - s.x0) : (z - s.z0) / (s.z1 - s.z0);
  return lerp(s.h0, s.h1, clamp(t, 0, 1));
}
function groundAt(x, z) { let h = 0; for (const s of solidsNear(x, z)) if (!s.bound && inRect(s, x, z)) { const t = topAt(s, x, z); if (t > h) h = t; } return h; }
// highest walkable ground under (x,z) that is not above y+step
function groundBelow(x, z, y, step, noBridge) {
  let h = 0; for (const s of solidsNear(x, z)) if (inRect(s, x, z)) { const t = topAt(s, x, z); if (t > h && t <= y + step) h = t; }
  if (!noBridge) for (const b of BRIDGES) if (b.h > h && b.h <= y + step && inRect(b, x, z)) h = b.h;
  return h;
}
// is point inside solid geometry?
function solidAt(x, y, z) {
  if (y < 0) return true;
  for (const s of solidsNear(x, z)) if (inRect(s, x, z) && y < topAt(s, x, z)) return s;
  return null;
}
function segBlocked(ax, ay, az, bx, by, bz, stepLen = 0.4) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); const n = Math.max(1, Math.ceil(L / stepLen));
  for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(ax + dx * t, ay + dy * t, az + dz * t)) return t; }
  return 0;
}

/* ============================================================ PAINT */
const Paint = {
  data: null, owner: null, hgt: null, tex: null, dirty: false, teamCells: [0, 0], total: NX * NZ,
  wdata: null, wtex: null, wdirty: false, W: 1024, H: 1024, PX: 8, faces: []
};
function initPaint() {
  Paint.data = new Uint8Array(NX * NZ * 4);
  Paint.owner = new Int8Array(NX * NZ).fill(-1);
  Paint.hgt = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) Paint.hgt[j * NX + i] = groundAt((i + 0.5) * CELL - XH, (j + 0.5) * CELL - ZH);
  const OOB = SOLIDS.filter(s => s.oob);
  if (OOB.length) {           // out of bounds: never takes ink, doesn't count toward the turf total
    let n = 0;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = (i + 0.5) * CELL - XH, z = (j + 0.5) * CELL - ZH; if (OOB.some(o => inRect(o, x, z))) Paint.hgt[j * NX + i] = 99; else n++; }
    Paint.total = n;
  }
  for (let k = 0; k < NX * NZ; k++) Paint.data[k * 4 + 3] = 255;
  Paint.tex = new THREE.DataTexture(Paint.data, NX, NZ, THREE.RGBAFormat);
  Paint.tex.magFilter = THREE.LinearFilter; Paint.tex.minFilter = THREE.LinearFilter; Paint.tex.generateMipmaps = false; Paint.tex.needsUpdate = true;
  buildWallAtlas();
}
function resetPaint() {
  Paint.data.fill(0); for (let k = 0; k < NX * NZ; k++) Paint.data[k * 4 + 3] = 255;
  Paint.owner.fill(-1); Paint.teamCells = [0, 0]; Paint.dirty = true;
  Paint.wdata.fill(0); for (let k = 3; k < Paint.wdata.length; k += 4) Paint.wdata[k] = 255; Paint.wdirty = true;
}
function buildWallAtlas() {
  const faces = [];
  for (const s of SOLIDS) {
    if (s.t === 'ramp') { rampFaces(s, faces); continue; }
    if (s.t !== 'box') continue; s.faces = {};
    if (s.oob) continue;                                   // out-of-bounds blocks: not paintable, not climbable
    const dirs = s.bound ? [s.bound] : ['+x', '-x', '+z', '-z'];
    for (const d of dirs) {
      if (MAP.cull && !s.bound && faceHidden(s, d)) continue;
      if (!s.bound) {
        if (d === '+x' && s.x1 >= XH - 0.01) continue; if (d === '-x' && s.x0 <= -XH + 0.01) continue;
        if (d === '+z' && s.z1 >= ZH - 0.01) continue; if (d === '-z' && s.z0 <= -ZH + 0.01) continue;
      }
      const ax = d[1] === 'x';
      const f = { s, d, ax, plane: d === '+x' ? s.x1 : d === '-x' ? s.x0 : d === '+z' ? s.z1 : s.z0, a0: ax ? s.z0 : s.x0, a1: ax ? s.z1 : s.x1, h: s.h, nx: d === '+x' ? 1 : d === '-x' ? -1 : 0, nz: d === '+z' ? 1 : d === '-z' ? -1 : 0 };
      if (s.bound) { f.a0 = ax ? -ZH : -XH; f.a1 = ax ? ZH : XH; }
      s.faces[d] = f; faces.push(f);
    }
    // top of the perimeter walls: a flat paintable strip (u along the wall, v = distance from the inner edge)
    if (s.bound) {
      const ax = s.bound[1] === 'x', sgn = s.bound[0] === '-' ? 1 : -1;
      const f = { s, cap: true, ax, inner: ax ? (sgn > 0 ? s.x0 : s.x1) : (sgn > 0 ? s.z0 : s.z1), sgn, a0: ax ? s.z0 : s.x0, a1: ax ? s.z1 : s.x1, h: ax ? s.x1 - s.x0 : s.z1 - s.z0, capY: s.h };
      s.cap = f; faces.push(f);
    }
  }
  let PX = 10, ok = false, W = Paint.W, H = 1024, used = 0;
  while (!ok) {
    let x = 0, y = 0, rowH = 0; ok = true;
    const sorted = faces.slice().sort((a, b) => b.h - a.h);
    for (const f of sorted) {
      const w = Math.ceil((f.a1 - f.a0) * PX) + 2, h = Math.ceil(f.h * PX) + 2;
      if (x + w > W) { x = 0; y += rowH; rowH = 0; }
      if (w > W || y + h > H) { ok = false; break; }
      f.rx = x; f.ry = y; f.rw = w; f.rh = h; x += w; rowH = Math.max(rowH, h);
    }
    used = y + rowH;
    if (!ok) PX -= 1;
  }
  H = Paint.H = Math.max(64, Math.ceil(used / 16) * 16);
  Paint.PX = PX; Paint.faces = faces;
  Paint.wdata = new Uint8Array(W * H * 4); for (let k = 3; k < Paint.wdata.length; k += 4) Paint.wdata[k] = 255;
  Paint.wtex = new THREE.DataTexture(Paint.wdata, W, H, THREE.RGBAFormat);
  Paint.wtex.magFilter = THREE.LinearFilter; Paint.wtex.minFilter = THREE.LinearFilter; Paint.wtex.generateMipmaps = false; Paint.wtex.needsUpdate = true;
}
// a box face that can't be seen: every point just outside it is inside something at least as tall,
// or a taller face in the same plane covers its whole length (avoids flicker where blocks sit on the street slab)
function faceHidden(s, d) {
  const ax = d[1] === 'x', sg = d[0] === '+' ? 1 : -1, plane = d === '+x' ? s.x1 : d === '-x' ? s.x0 : d === '+z' ? s.z1 : s.z0, a0 = ax ? s.z0 : s.x0, a1 = ax ? s.z1 : s.x1;
  let all = true;
  for (let k = 0; k <= 8 && all; k++) {
    const a = lerp(a0 + 0.04, a1 - 0.04, k / 8), px = ax ? plane + sg * 0.05 : a, pz = ax ? a : plane + sg * 0.05;
    if (!SOLIDS.some(o => o !== s && !o.bound && inRect(o, px, pz) && topAt(o, px, pz) >= s.h - 0.05)) all = false;
  }
  if (all) return true;
  const iv = [];
  for (const o of SOLIDS) {
    if (o === s || o.t !== 'box' || o.bound || o.oob || o.h < s.h - 0.01) continue;
    const op = d === '+x' ? o.x1 : d === '-x' ? o.x0 : d === '+z' ? o.z1 : o.z0; if (Math.abs(op - plane) > 0.02) continue;
    iv.push([ax ? o.z0 : o.x0, ax ? o.z1 : o.x1]);
  }
  iv.sort((p, q) => p[0] - q[0]); let reach = a0;
  for (const [b0, b1] of iv) { if (b0 > reach + 0.02) break; reach = Math.max(reach, b1); }
  return reach >= a1 - 0.02;
}
// ramps: the two triangular sides and the tall end are paintable walls too (skipped where another block covers them)
function rampFaces(s, faces) {
  s.faces = {}; const hi = Math.max(s.h0, s.h1), zAx = s.axis === 'z';
  const highD = zAx ? (s.h1 > s.h0 ? '+z' : '-z') : (s.h1 > s.h0 ? '+x' : '-x');
  for (const d of (zAx ? ['+x', '-x'] : ['+z', '-z']).concat([highD])) {
    if (d === '+x' && s.x1 >= XH - 0.01) continue; if (d === '-x' && s.x0 <= -XH + 0.01) continue;
    if (d === '+z' && s.z1 >= ZH - 0.01) continue; if (d === '-z' && s.z0 <= -ZH + 0.01) continue;
    const ax = d[1] === 'x', nx = d === '+x' ? 1 : d === '-x' ? -1 : 0, nz = d === '+z' ? 1 : d === '-z' ? -1 : 0;
    const plane = d === '+x' ? s.x1 : d === '-x' ? s.x0 : d === '+z' ? s.z1 : s.z0, a0 = ax ? s.z0 : s.x0, a1 = ax ? s.z1 : s.x1;
    // covered by a neighbouring block?  (sample just outside the face, low down)
    const am = (a0 + a1) / 2, ox = ax ? plane + nx * 0.05 : am, oz = ax ? am : plane + nz * 0.05;
    if (d === highD && SOLIDS.some(o => o !== s && !o.bound && inRect(o, ox, oz) && topAt(o, ox, oz) >= hi - 0.05)) continue;
    const f = { s, d, ax, plane, a0, a1, h: hi, nx, nz, ramp: true, side: d !== highD };
    s.faces[d] = f; faces.push(f);
  }
}
function makeShape(r) {
  const sh = { p1: rand(0, 6.28), p2: rand(0, 6.28), p3: rand(0, 6.28), sats: [] };
  const n = r > 0.6 ? randi(2, 5) : 0;
  for (let i = 0; i < n; i++) { const a = rand(0, 6.28), d = r * rand(1.0, 1.55); sh.sats.push([Math.cos(a) * d, Math.sin(a) * d, r * rand(0.1, 0.26)]); }
  return sh;
}
function shapeVal(sh, dx, dz, r, fade) {
  const d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  const R = r * (1 + 0.13 * Math.sin(3 * a + sh.p1) + 0.08 * Math.sin(5 * a + sh.p2) + 0.05 * Math.sin(8 * a + sh.p3));
  let s = (R - d) / fade + 0.5;
  for (const q of sh.sats) { const v = (q[2] - Math.hypot(dx - q[0], dz - q[1])) / fade + 0.5; if (v > s) s = v; }
  return s < 0 ? 0 : s > 1 ? 1 : s;
}
function splatFloor(x, y, z, r, team, tol = 0.7, wallsToo = true, dir = null) {
  const D = Paint.data, O = Paint.owner, Hg = Paint.hgt, TC = Paint.teamCells;
  const sh = makeShape(r), fade = CELL * 2.2;
  // dir = {ux, uz, k}: stretch the splat k times along the travel direction (grazing hits)
  const k = dir ? dir.k : 1, ux = dir ? dir.ux : 1, uz = dir ? dir.uz : 0;
  if (dir) { x += ux * r * (k - 1) * 0.55; z += uz * r * (k - 1) * 0.55; }
  const ci = Math.floor((x + XH) / CELL), cj = Math.floor((z + ZH) / CELL), rc = Math.ceil(r * 1.85 * k / CELL) + 1;
  let gained = 0;
  const i0 = Math.max(0, ci - rc), i1 = Math.min(NX - 1, ci + rc), j0 = Math.max(0, cj - rc), j1 = Math.min(NZ - 1, cj + rc);
  for (let j = j0; j <= j1; j++) {
    const dz = (j + 0.5) * CELL - ZH - z;
    for (let i = i0; i <= i1; i++) {
      const q = j * NX + i;
      if (Math.abs(Hg[q] - y) > tol) continue;
      let ddx = (i + 0.5) * CELL - XH - x, ddz = dz;
      if (dir) { const a = (ddx * ux + ddz * uz) / k, b = -ddx * uz + ddz * ux; ddx = a; ddz = b; }
      const s = shapeVal(sh, ddx, ddz, r, fade);
      if (s <= 0) continue;
      const o = q * 4, sv = s * 255, cap = 255 - sv;
      if (D[o + team] < sv) D[o + team] = sv;
      if (D[o + 1 - team] > cap) D[o + 1 - team] = cap;
      const now = D[o] >= 128 ? 0 : D[o + 1] >= 128 ? 1 : -1, prev = O[q];
      if (now !== prev) { if (prev >= 0) TC[prev]--; if (now >= 0) TC[now]++; O[q] = now; if (now === team) gained++; }
    }
  }
  Paint.dirty = true;
  if (wallsToo) {
    for (const f of Paint.faces) {
      if (f.cap) {
        if (Math.abs(y - f.capY) > 0.45) continue;
        const along = f.ax ? z : x, across = ((f.ax ? x : z) - f.inner) * f.sgn;
        if (across < -r || across > f.h + r || along < f.a0 - r || along > f.a1 + r) continue;
        splatWall(f, along - f.a0, across, r, team, sh); continue;
      }
      if (y > f.h + 0.3 || y < -0.1) continue;
      const dist = f.ax ? (x - f.plane) * f.nx : (z - f.plane) * f.nz;
      if (dist < -0.05 || dist > r) continue;
      const along = f.ax ? z : x; if (along < f.a0 - r || along > f.a1 + r) continue;
      if (f.s.bound === undefined && (f.ax ? (z < f.s.z0 - r || z > f.s.z1 + r) : (x < f.s.x0 - r || x > f.s.x1 + r))) continue;
      const rr = Math.sqrt(Math.max(0, r * r - dist * dist)) * 0.85;
      if (rr > 0.15) splatWall(f, along - f.a0, y, rr, team, sh);
    }
  }
  return gained;
}
function splatWall(f, u, v, r, team, shIn) {
  const W = Paint.W, D = Paint.wdata, PX = Paint.PX, sh = shIn || makeShape(r), fade = 2.2 / PX;
  const cu = u * PX, cv = v * PX, rp = Math.ceil(r * 1.85 * PX) + 1;
  const i0 = Math.max(0, Math.floor(cu - rp)), i1 = Math.min(f.rw - 3, Math.ceil(cu + rp));
  const j0 = Math.max(0, Math.floor(cv - rp)), j1 = Math.min(f.rh - 3, Math.ceil(cv + rp));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const s = shapeVal(sh, (i + 0.5) / PX - u, (j + 0.5) / PX - v, r, fade); if (s <= 0) continue;
    const o = ((f.ry + 1 + j) * W + f.rx + 1 + i) * 4, sv = s * 255, cap = 255 - sv;
    if (D[o + team] < sv) D[o + team] = sv; if (D[o + 1 - team] > cap) D[o + 1 - team] = cap;
  }
  Paint.wdirty = true;
}
function wallOwner(f, u, v) {
  const PX = Paint.PX; const i = clamp(Math.floor(u * PX), 0, f.rw - 3), j = clamp(Math.floor(v * PX), 0, f.rh - 3);
  const o = ((f.ry + 1 + j) * Paint.W + f.rx + 1 + i) * 4, D = Paint.wdata;
  return D[o] >= 128 ? 0 : D[o + 1] >= 128 ? 1 : -1;
}
function cellIndex(x, z) { const i = Math.floor((x + XH) / CELL), j = Math.floor((z + ZH) / CELL); if (i < 0 || j < 0 || i >= NX || j >= NZ) return -1; return j * NX + i; }
function ownerAt(x, y, z) { const k = cellIndex(x, z); if (k < 0) return -1; if (Math.abs(Paint.hgt[k] - y) > 0.4) return -2; return Paint.owner[k]; }
function uploadPaint() {
  if (Paint.dirty) { Paint.tex.needsUpdate = true; Paint.dirty = false; }
  if (Paint.wdirty) { Paint.wtex.needsUpdate = true; Paint.wdirty = false; }
}

/* ==================================================== PAINT MATERIALS */
const PU = {
  noiseMap: { value: null }, teamCol0: { value: new THREE.Color() }, teamCol1: { value: new THREE.Color() },
  paintOrigin: { value: new THREE.Vector2(-XH, -ZH) }, paintSize: { value: new THREE.Vector2(PSX, PSZ) },
  floorPaint: { value: null }, wallPaint: { value: null }, layoutMap: { value: null }
};
function paintMat(opts, mode, layout) {
  const m = new THREE.MeshStandardMaterial(opts);
  const floor = mode === 'floor';
  m.onBeforeCompile = sh => {
    sh.uniforms.paintMap = floor ? PU.floorPaint : PU.wallPaint;
    ['noiseMap', 'teamCol0', 'teamCol1', 'paintOrigin', 'paintSize', 'layoutMap'].forEach(k => sh.uniforms[k] = PU[k]);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec2 vPUv; varying vec2 vNUv; uniform vec2 paintOrigin; uniform vec2 paintSize;
${floor ? '' : 'attribute vec2 paintUv; attribute vec2 noiseUv;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${floor ? 'vec4 pwp = modelMatrix * vec4(transformed, 1.0); vPUv = (pwp.xz - paintOrigin) / paintSize; vNUv = pwp.xz;' : 'vPUv = paintUv; vNUv = noiseUv;'}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D paintMap; uniform sampler2D noiseMap; uniform sampler2D layoutMap; uniform vec3 teamCol0; uniform vec3 teamCol1;
varying vec2 vPUv; varying vec2 vNUv;
float inkNoise(vec2 n){ return texture2D(noiseMap, n*0.21).r*0.62 + texture2D(noiseMap, n*0.83+0.37).r*0.38; }
float inkField(vec2 uv, vec2 n){ vec4 p = texture2D(paintMap, uv); return max(p.r, p.g) + (inkNoise(n)-0.5)*0.34; }
vec3 inkPerturb(vec3 sp, vec3 sn, vec2 dH, float fd){
  vec3 sx = dFdx(sp); vec3 sy = dFdy(sp); vec3 r1 = cross(sy, sn); vec3 r2 = cross(sn, sx);
  float det = dot(sx, r1) * fd; vec3 gr = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * sn - gr);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
${layout ? 'vec4 lay = texture2D(layoutMap, vPUv); diffuseColor.rgb = mix(diffuseColor.rgb, lay.rgb, lay.a);' : ''}
vec4 pp = texture2D(paintMap, vPUv);
float fld = max(pp.r, pp.g) + (inkNoise(vNUv)-0.5)*0.34;
float inkA = smoothstep(0.46, 0.54, fld);
vec3 inkC = mix(teamCol0, teamCol1, smoothstep(-0.1, 0.1, pp.g - pp.r));
inkC *= mix(0.7, 1.05, smoothstep(0.5, 0.95, fld));
diffuseColor.rgb = mix(diffuseColor.rgb, inkC, inkA);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.13, inkA);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.0, inkA);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 dx = dFdx(vPUv), dy = dFdy(vPUv), nx = dFdx(vNUv), ny = dFdy(vNUv);
  float H0 = smoothstep(0.4, 0.8, inkField(vPUv, vNUv));
  float Hx = smoothstep(0.4, 0.8, inkField(vPUv + dx, vNUv + nx));
  float Hy = smoothstep(0.4, 0.8, inkField(vPUv + dy, vNUv + ny));
  normal = inkPerturb(-vViewPosition, normal, vec2(Hx - H0, Hy - H0) * 0.9, faceDirection); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += inkC * 0.07 * inkA;`);
  };
  m.customProgramCacheKey = () => 'paint_' + mode + (layout ? '_L' : '');
  return m;
}

/* ===================================================== LAYOUT TEXTURE */
function makeLayoutTex() { return MAP_ID === 'skate' ? makeLayoutSkate() : makeLayoutDock(); }
// skatepark: the only bare floor is the sunken bowls and pits — pale pool concrete with painted S-curves
function makeLayoutSkate() {
  const W = 1024, H = Math.round(1024 * PSZ / PSX);
  const t = canvasTex(W, H, (g) => {
    const m2p = (x, z) => [(x + XH) / PSX * W, (z + ZH) / PSZ * H], s = W / PSX;
    const bowls = [[-5.5, 19, 17, 32], [-19, 5.5, -32, -17]];
    for (const [x0, x1, z0, z1] of bowls) {
      const [a, b] = m2p(x0, z0), [c, d] = m2p(x1, z1);
      g.fillStyle = 'rgba(214,232,240,.85)'; g.fillRect(a, b, c - a, d - b);
      g.save(); g.beginPath(); g.rect(a, b, c - a, d - b); g.clip();
      const cx = (a + c) / 2, cy = (b + d) / 2, sg = z0 > 0 ? 1 : -1;
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = s * 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - sg * s * 11, cy - sg * s * 6); g.bezierCurveTo(cx - sg * s * 2, cy - sg * s * 9, cx - sg * s * 4, cy + sg * s * 6, cx + sg * s * 5, cy + sg * s * 4); g.bezierCurveTo(cx + sg * s * 10, cy + sg * s * 3, cx + sg * s * 9, cy - sg * s * 5, cx + sg * s * 12, cy - sg * s * 6); g.stroke();
      g.strokeStyle = 'rgba(120,160,185,.55)'; g.lineWidth = s * 0.35; g.stroke();
      // drain + cracks
      const [dx, dz] = m2p((x0 + x1) / 2 + sg * 4, (z0 + z1) / 2); g.fillStyle = 'rgba(50,60,70,.8)'; g.beginPath(); g.arc(dx, dz, s * 0.5, 0, 7); g.fill();
      g.restore();
      // soft shade under the coping
      g.strokeStyle = 'rgba(40,50,70,.35)'; g.lineWidth = s * 0.8; g.strokeRect(a, b, c - a, d - b);
    }
    [[-20, -12.5, 5.3, 9.7], [12.5, 20, -9.7, -5.3]].forEach(([x0, x1, z0, z1]) => { const [a, b] = m2p(x0, z0), [c, d] = m2p(x1, z1); g.fillStyle = 'rgba(55,60,72,.8)'; g.fillRect(a, b, c - a, d - b); g.fillStyle = 'rgba(255,198,41,.8)'; for (let y = b; y < d; y += s * 1.2) g.fillRect(a, y, s * 0.4, s * 0.6); });
  }, false);
  t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function makeLayoutDock() {
  const W = 1024, H = Math.round(1024 * PSZ / PSX);
  const t = canvasTex(W, H, (g) => {
    const m2p = (x, z) => [(x + XH) / PSX * W, (z + ZH) / PSZ * H], s = W / PSX;
    // contact shadows (fake AO)
    g.save(); const OFF = W * 3; g.shadowOffsetX = OFF; g.shadowBlur = Math.round(s * 1.1); g.fillStyle = '#000';
    g.shadowColor = 'rgba(10,12,25,.6)';
    for (const so of SOLIDS) { if (so.bound) continue; const [a, b] = m2p(so.x0, so.z0), [c, d] = m2p(so.x1, so.z1); const pad = s * 0.2; g.fillRect(a - pad - OFF, b - pad, c - a + pad * 2, d - b + pad * 2); }
    g.shadowColor = 'rgba(10,12,25,.5)'; const e = s * 0.5;
    g.fillRect(-OFF - e, -e, W + 2 * e, e * 2); g.fillRect(-OFF - e, H - e, W + 2 * e, e * 2); g.fillRect(-OFF - e, -e, e * 2, H + 2 * e); g.fillRect(W - e - OFF, -e, e * 2, H + 2 * e);
    g.restore();
    // court lines
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = s * 0.22;
    g.strokeRect(s * 1.2, s * 1.2, W - s * 2.4, H - s * 2.4);
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    g.setLineDash([s * 1.2, s * 0.9]); g.strokeStyle = 'rgba(255,214,60,.9)';
    [-18.5, 18.5].forEach(x => { const [px] = m2p(x, 0); g.beginPath(); g.moveTo(px, s * 3); g.lineTo(px, H - s * 3); g.stroke(); });
    g.setLineDash([]);
    [[-14, 26], [14, -26]].forEach(([x, z]) => { const [px, pz] = m2p(x, z); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = s * 0.2; g.beginPath(); g.arc(px, pz, s * 3.2, 0, 7); g.stroke(); g.beginPath(); g.arc(px, pz, s * 1.4, 0, 7); g.stroke(); });
    // hazard strips around ramps' feet
    const haz = (x0, z0, x1, z1) => { const [a, b] = m2p(x0, z0), [c, d] = m2p(x1, z1); g.save(); g.beginPath(); g.rect(a, b, c - a, d - b); g.clip(); g.fillStyle = 'rgba(30,30,40,.8)'; g.fillRect(a, b, c - a, d - b); g.fillStyle = 'rgba(255,205,40,.95)'; for (let k = -200; k < 400; k += s * 0.9) { g.beginPath(); g.moveTo(a + k, b); g.lineTo(a + k + s * 0.45, b); g.lineTo(a + k + s * 0.45 - (d - b), d); g.lineTo(a + k - (d - b), d); g.fill(); } g.restore(); };
    haz(-3, 30.2, 3, 31); haz(-3, -31, 3, -30.2); haz(-2.5, 10.5, 2.5, 11.3); haz(-2.5, -11.3, 2.5, -10.5);
    // big stencil text
    g.save(); g.font = `900 ${Math.round(s * 3.4)}px Arial Black, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,.32)';
    let [px, pz] = m2p(12, 32); g.translate(px, pz); g.rotate(Math.PI); g.fillText('SPLASH', 0, 0); g.restore();
    g.save(); g.font = `900 ${Math.round(s * 3.4)}px Arial Black, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.32)';
    [px, pz] = m2p(-12, -32); g.translate(px, pz); g.fillText('RUSH!', 0, 0); g.restore();
    // drains
    [[-20, 12], [20, -12], [8, 30], [-8, -30], [-24, 36], [24, -36]].forEach(([x, z]) => { const [a, b] = m2p(x, z); g.fillStyle = 'rgba(40,44,55,.85)'; g.beginPath(); g.arc(a, b, s * 0.55, 0, 7); g.fill(); g.strokeStyle = 'rgba(160,165,175,.9)'; g.lineWidth = s * 0.08; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(a - s * 0.4, b + k * s * 0.16); g.lineTo(a + s * 0.4, b + k * s * 0.16); g.stroke(); } });
  }, false);
  t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* =================================================== ARENA GEOMETRY */
function quadGeo(p, uv, puv, nuv, n) {
  // p: 4 Vector3-like arrays; auto-fix winding to match normal n
  const g = new THREE.BufferGeometry();
  const pos = [], nor = [], U = [], PU_ = [], NU = [];
  for (let i = 0; i < 4; i++) { pos.push(...p[i]); nor.push(...n); U.push(...uv[i]); if (puv) { PU_.push(...puv[i]); NU.push(...nuv[i]); } }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  if (puv) { g.setAttribute('paintUv', new THREE.Float32BufferAttribute(PU_, 2)); g.setAttribute('noiseUv', new THREE.Float32BufferAttribute(NU, 2)); }
  const a = new THREE.Vector3(...p[0]), b = new THREE.Vector3(...p[1]), c = new THREE.Vector3(...p[2]);
  const cr = b.clone().sub(a).cross(c.clone().sub(a));
  g.setIndex(cr.dot(new THREE.Vector3(...n)) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  return g;
}
function mergeGeos(list) {
  if (!list.length) return null;
  const out = new THREE.BufferGeometry(); const attrs = Object.keys(list[0].attributes); const idx = []; let off = 0;
  const data = {}; attrs.forEach(a => data[a] = []);
  for (const g of list) { attrs.forEach(a => data[a].push(...g.attributes[a].array)); g.index.array.forEach(i => idx.push(i + off)); off += g.attributes.position.count; }
  attrs.forEach(a => out.setAttribute(a, new THREE.Float32BufferAttribute(data[a], list[0].attributes[a].itemSize)));
  out.setIndex(idx); out.computeBoundingSphere(); return out;
}
const WALL_STYLE = {
  panel: { tex: 'panel', su: 2.5, vFull: true, color: 0xffffff, rough: 0.7 },
  deck: { tex: 'panel', su: 3, vFull: true, color: 0xb9c0d6, rough: 0.65 },
  contR: { tex: 'contR', su: 3, vFull: true, color: 0xffffff, rough: 0.55, metal: 0.25 },
  contB: { tex: 'contB', su: 3, vFull: true, color: 0xffffff, rough: 0.55, metal: 0.25 },
  contY: { tex: 'contY', su: 3, vFull: true, color: 0xffffff, rough: 0.55, metal: 0.25 },
  contG: { tex: 'contG', su: 3, vFull: true, color: 0xffffff, rough: 0.55, metal: 0.25 },
  crate: { tex: 'crate', su: 0, vFull: true, color: 0xffffff, rough: 0.8 },
  stone: { tex: 'stone', su: 3, vFull: false, color: 0xffffff, rough: 0.85 },
  hedge: { tex: 'hedge', su: 2, vFull: false, color: 0xffffff, rough: 0.95 },
};
const TOP_STYLE = { skate: { tex: 'skate', s: 6, rough: 0.55 }, wood: { tex: 'wood', s: 3, rough: 0.75 }, grass: { tex: 'grass', s: 4, rough: 1 }, concrete: { tex: 'concrete', s: 8, rough: 0.9 }, grate: { tex: 'grate', s: 2, rough: 0.45, metal: 0.4 }, deck: { tex: 'deck', s: 4, rough: 0.6, metal: 0.2 }, crate: { tex: 'crate', s: 2, rough: 0.8 } };
let arenaGroup;
function buildArena() {
  arenaGroup = new THREE.Group(); scene.add(arenaGroup);
  PU.noiseMap.value = TEX.noise; PU.floorPaint.value = Paint.tex; PU.wallPaint.value = Paint.wtex; PU.layoutMap.value = TEX.layout;
  // floor
  const fg = quadGeo([[-XH, 0, -ZH], [XH, 0, -ZH], [XH, 0, ZH], [-XH, 0, ZH]], [[-XH / 8, -ZH / 8], [XH / 8, -ZH / 8], [XH / 8, ZH / 8], [-XH / 8, ZH / 8]], null, null, [0, 1, 0]);
  const floor = new THREE.Mesh(fg, paintMat({ map: TEX.concrete, roughness: 0.92, color: 0xffffff }, 'floor', true));
  floor.receiveShadow = true; arenaGroup.add(floor);
  // tops & ramps grouped by style
  const tops = {}, walls = {}, sides = [], hedge = [];
  const PX = Paint.PX, W = Paint.W, H = Paint.H;
  // one wall quad (corners as [along, height]) with its slot in the paint atlas
  const wallQuad = (style, f, corners) => {
    const st = WALL_STYLE[style], su = st.su || f.h, pts = [], uv = [], puv = [], nuv = [];
    for (const [a, y] of corners) {
      pts.push(f.ax ? [f.plane, y, a] : [a, y, f.plane]);
      uv.push([(a - f.a0) / su, st.vFull ? y / f.h : y / 3]);
      puv.push([(f.rx + 1 + (a - f.a0) * PX) / W, (f.ry + 1 + y * PX) / H]);
      nuv.push([a * 1.0 + f.plane * 0.37, y]);
    }
    (walls[style] = walls[style] || []).push(quadGeo(pts, uv, puv, nuv, [f.nx, 0, f.nz]));
  };
  for (const s of SOLIDS) {
    if (s.bound) { /* inner faces + top cap */ }
    if (s.t === 'box') {
      const ts = TOP_STYLE[s.top] || TOP_STYLE.concrete, sc = ts.s;
      if (!s.bound) (tops[s.top] = tops[s.top] || []).push(quadGeo([[s.x0, s.h, s.z0], [s.x1, s.h, s.z0], [s.x1, s.h, s.z1], [s.x0, s.h, s.z1]], [[s.x0 / sc, s.z0 / sc], [s.x1 / sc, s.z0 / sc], [s.x1 / sc, s.z1 / sc], [s.x0 / sc, s.z1 / sc]], null, null, [0, 1, 0]));
      else {
        // paintable top strip
        { const f = s.cap, cp = [], uv = [], puv = [], nuv = [];
          for (const [a, c] of [[f.a0, 0], [f.a1, 0], [f.a1, f.h], [f.a0, f.h]]) {
            const q = f.inner + c * f.sgn; cp.push(f.ax ? [q, s.h, a] : [a, s.h, q]);
            uv.push([a / 3, c / 3]); puv.push([(f.rx + 1 + (a - f.a0) * PX) / W, (f.ry + 1 + c * PX) / H]); nuv.push([a + s.h * 0.37, c]);
          }
          (walls.stone = walls.stone || []).push(quadGeo(cp, uv, puv, nuv, [0, 1, 0])); }
        const ob = { '-x': ['+x', s.x1], '+x': ['-x', s.x0], '-z': ['+z', s.z1], '+z': ['-z', s.z0] }[s.bound];
        const L = s.bound[1] === 'x' ? [s.z0, s.z1] : [s.x0, s.x1], pl = ob[1], nn = ob[0];
        const pts = [[L[0], 0], [L[1], 0], [L[1], s.h], [L[0], s.h]].map(([a, y]) => s.bound[1] === 'x' ? [pl, y - 2.2, a] : [a, y - 2.2, pl]);
        pts[2][1] = pts[3][1] = s.h;
        sides.push(quadGeo(pts, [[0, 0], [L[1] - L[0], 0], [L[1] - L[0], 1], [0, 1]], null, null, nn[1] === 'x' ? [nn[0] === '+' ? 1 : -1, 0, 0] : [0, 0, nn[0] === '+' ? 1 : -1]));
      }
      for (const d in s.faces) { const f = s.faces[d]; wallQuad(s.style, f, [[f.a0, 0], [f.a1, 0], [f.a1, f.h], [f.a0, f.h]]); }
      if (s.oob) {                                         // hedge sides above the street, not in the paint atlas
        const y0 = MAP_ID === 'skate' ? SL : 0;
        [['+x', s.x1, 1, 0], ['-x', s.x0, -1, 0], ['+z', s.z1, 0, 1], ['-z', s.z0, 0, -1]].forEach(([d, pl, nx, nz]) => {
          if ((d === '+x' && s.x1 >= XH - 0.01) || (d === '-x' && s.x0 <= -XH + 0.01) || (d === '+z' && s.z1 >= ZH - 0.01) || (d === '-z' && s.z0 <= -ZH + 0.01)) return;
          const L = nx ? [s.z0, s.z1] : [s.x0, s.x1], pts = [[L[0], y0], [L[1], y0], [L[1], s.h], [L[0], s.h]].map(([a, y]) => nx ? [pl, y, a] : [a, y, pl]);
          hedge.push(quadGeo(pts, [[L[0] / 2, y0 / 2], [L[1] / 2, y0 / 2], [L[1] / 2, s.h / 2], [L[0] / 2, s.h / 2]], null, null, [nx, 0, nz]));
        });
      }
    } else {
      const sc = 2; const c = [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]];
      const p = c.map(([x, z]) => [x, topAt(s, x, z), z]);
      const n = new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0])).cross(new THREE.Vector3(...p[3]).sub(new THREE.Vector3(...p[0]))).normalize();
      if (n.y < 0) n.negate();
      const tk = TOP_STYLE[s.top] ? s.top : 'grate'; (tops[tk] = tops[tk] || []).push(quadGeo(p, c.map(([x, z]) => [x / sc, z / sc]), null, null, [n.x, n.y, n.z]));
      // sides (triangles as degenerate quads) and the tall end: paintable walls
      const hi = Math.max(s.h0, s.h1), lowAt = s.axis === 'z' ? (s.h0 < s.h1 ? s.z0 : s.z1) : (s.h0 < s.h1 ? s.x0 : s.x1), highAt = s.axis === 'z' ? (s.h0 < s.h1 ? s.z1 : s.z0) : (s.h0 < s.h1 ? s.x1 : s.x0);
      for (const d in s.faces) {
        const f = s.faces[d];
        if (f.side) wallQuad('stone', f, [[lowAt, 0], [highAt, 0], [highAt, hi], [lowAt, 0.001]]);
        else wallQuad('stone', f, [[f.a0, 0], [f.a1, 0], [f.a1, hi], [f.a0, hi]]);
      }
    }
  }
  for (const k in tops) {
    const ts = TOP_STYLE[k]; const m = new THREE.Mesh(mergeGeos(tops[k]), paintMat({ map: TEX[ts.tex], roughness: ts.rough, metalness: ts.metal || 0 }, 'floor', false));
    m.castShadow = m.receiveShadow = true; arenaGroup.add(m);
  }
  for (const k in walls) {
    const st = WALL_STYLE[k]; const m = new THREE.Mesh(mergeGeos(walls[k]), paintMat({ map: TEX[st.tex], color: st.color, roughness: st.rough, metalness: st.metal || 0 }, 'wall', false));
    m.castShadow = m.receiveShadow = true; arenaGroup.add(m);
  }
  const sm = new THREE.Mesh(mergeGeos(sides), new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.85, side: THREE.DoubleSide }));
  sm.castShadow = sm.receiveShadow = true; arenaGroup.add(sm);
  if (hedge.length) { const hm = new THREE.Mesh(mergeGeos(hedge), new THREE.MeshStandardMaterial({ map: TEX.hedge, roughness: 0.95 })); hm.castShadow = hm.receiveShadow = true; arenaGroup.add(hm); }
  // see-through grate bridges and fences (yellow frames, like the park's rails)
  if (BRIDGES.length || FENCES.length) {
    const gm = new THREE.MeshStandardMaterial({ map: TEX.grateA, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.5 });
    const fm = new THREE.MeshStandardMaterial({ color: 0xffc629, roughness: 0.45, metalness: 0.3 });
    const add = (w, h, d, x, y, z, m, ru, rv) => { const g = new THREE.BoxGeometry(w, h, d); if (ru) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); } const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; arenaGroup.add(o); return o; };
    for (const b of BRIDGES) {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      add(w, 0.06, d, cx, b.h - 0.03, cz, gm, Math.max(w, d) / 1.2, Math.min(w, d) / 1.2);
      const along = d > w; [-1, 1].forEach(sg => add(along ? 0.1 : w, 0.14, along ? d : 0.1, along ? cx + sg * (w / 2 - 0.05) : cx, b.h - 0.07, along ? cz : cz + sg * (d / 2 - 0.05), fm));
    }
    for (const f of FENCES) {
      const w = f.x1 - f.x0, d = f.z1 - f.z0, cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, hh = f.h - f.y0;
      add(w, hh, d, cx, f.y0 + hh / 2, cz, gm, Math.max(w, d) / 1.2, hh / 1.2);
      add(w + 0.06, 0.08, d + 0.06, cx, f.h, cz, fm);
    }
  }
  // spawn pads (glowing rings)
  SPAWN.forEach((sp, t) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(sp.x, sp.y + 0.03, sp.z); ring.userData.team = t; arenaGroup.add(ring);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
    disk.rotation.x = -Math.PI / 2; disk.position.set(sp.x, sp.y + 0.025, sp.z); disk.userData.team = t; arenaGroup.add(disk);
    WORLD.spawnFx.push(ring, disk);
  });
}
const WORLD = { spawnFx: [], buoys: [], sea: null, sky: null, flags: null };
function setTeamColors(c0, c1) {
  PU.teamCol0.value.set(c0); PU.teamCol1.value.set(c1);
  WORLD.spawnFx.forEach(m => m.material.color.set(m.userData.team ? c1 : c0));
  document.documentElement.style.setProperty('--c0', c0); document.documentElement.style.setProperty('--c1', c1);
}
