/* ================================================================ MAP
   Several maps: the one in use is picked before the world is built (the
   lobby saves the choice and reloads the page), so every system below just
   reads XH / ZH / SOLIDS / SPAWN / DECK as before.                        */
const MAP_LIST = {
  dock: { id: 'dock', name: '潮汐码头广场', en: 'TIDE DOCK PLAZA', XH: 28, ZH: 46, size: '56 × 92 米', tags: ['集装箱', '中路开阔', '两侧高台'], desc: '码头上的集装箱广场，中路开阔、两侧有高台' },
  skate: { id: 'skate', name: '墨浪滑板场', en: 'RUSH SKATEPARK', XH: 25.5, ZH: 55.5, cull: true, spawnSlots: [[-1.7, -0.5], [-0.6, 0.7], [0.6, -0.5], [1.7, 0.7]], size: '51 × 111 米', tags: ['S 形泳池', '中央高塔', '铁网走道'], desc: '城市滑板公园：S 形下沉泳池、波浪外墙、中央高塔和铁网走道' }
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
// palm trees (added with the decor): trunk and crown stop shots and bombs but never take ink
const TREES = []; let TREE_Y0 = 1e9;
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
/* ---- 墨浪滑板场 (skatepark): after the classic skatepark stage (top-down plan traced from the
   reference, rotated 180° for the other team). Curved parts are terrain (bowls, park outline),
   straight-edged parts are blocks. Team 0 spawns at +z, its bowl is on the +x side.
   Heights: bowl floor 0, street 1.0 (SL), spawn platform / side ledge 2.0, tower top 4.0.     */
const SL = 1.0;    // street level (the bowls and pits are sunk below it)
const SKATE_LV = { plat: 2.0 };
// the plan below is traced at the reference's scale, then everything is spread out by SKATE_K (heights stay):
// at 1.0 the park was ~15% tighter than the original relative to our characters and felt cramped
const SKATE_K = 1.15;
// a path made of straight runs ('L') and smooth curves ('C'): [x, z] points
function pathOf(...parts) { const out = []; for (const [k, P] of parts) { const q = k === 'C' ? smoothPts(P, false, 3) : P; q.forEach(p => { const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.02) out.push(p); }); } return out; }
function defineSkate() {
  const oob = (x0, x1, z0, z1, h = 2.8) => Object.assign(box(x0, x1, z0, z1, h, 'hedge', 'grass'), { oob: true });
  const P = SKATE_LV.plat;
  // ---- the park outline, team 0's half (from the +x side at z=0, round the spawn, back along the -x side)
  const half = pathOf(
    ['L', [[19.2, 0], [19.2, 1.5], [18.3, 1.5], [18.3, 17.3]]],
    ['C', [[18.3, 17.3], [18.1, 19], [18.3, 22], [18.1, 24.5], [17.3, 26.3], [15.7, 27.7], [14.3, 28.8], [13.3, 30.3], [12.4, 31.7], [10.8, 32.7], [9.0, 33.3], [7.8, 34.4], [7.4, 36.5], [7.2, 38.8], [6.2, 40.3], [4.8, 40.6]]],
    ['L', [[4.8, 40.6], [-2.6, 40.6], [-3.3, 41.3], [-3.3, 43.0]]],
    ['C', Array.from({ length: 13 }, (_, k) => { const a = k / 12 * Math.PI; return [-6.8 + Math.cos(a) * 3.5, 43.0 + Math.sin(a) * 3.5]; })],
    ['L', [[-10.3, 43.0], [-10.3, 34.6]]],
    ['C', [[-10.3, 34.6], [-10.8, 33.3], [-12.2, 32.3], [-13.4, 31.3], [-13.8, 30.0]]],
    ['L', [[-13.8, 30.0], [-13.8, 28.9], [-20.3, 28.9], [-20.3, 0]]]
  );
  TERR.outline = half.concat(rotPts(half));
  // ---- team 0's bowl: a kidney-shaped pool along the outer wall, with a snake ridge and a round hump
  const bowl = {
    floor: 0, R: 2.4,
    poly: pathOf(
      ['C', [[18.6, 17.3], [18.4, 19], [18.6, 22], [18.4, 24.5], [17.6, 26.5], [15.9, 28.0], [14.5, 29.1], [13.5, 30.6], [12.6, 32.0], [10.9, 33.0], [9.1, 33.6], [7.8, 33.9]]],
      ['L', [[7.8, 33.9], [0.6, 33.7]]],
      ['C', [[0.6, 33.7], [-1.6, 33.2], [-3.6, 31.7], [-5.0, 29.7], [-5.8, 27.2], [-6.1, 24.6], [-6.2, 22.6]]],
      ['L', [[-6.2, 22.6], [-6.2, 21.8], [-3.3, 21.8], [-3.3, 16.8]]],
      ['C', [[-3.3, 16.8], [-2.9, 15.3], [-1.6, 14.2], [0.4, 13.6], [2.5, 13.7], [4.0, 14.4], [4.6, 15.8]]],
      ['L', [[4.6, 15.8], [4.6, 17.2], [12.4, 17.2], [12.4, 17.3]]]
    ),
    ridges: [
      { pts: smoothPts([[13.6, 17.6], [14.6, 20.5], [14.4, 23.5], [12.7, 26.0], [10.2, 27.2], [8.6, 29.4], [7.0, 31.4]], false, 3), w: 2.0, h: 0.55, flat: 0.45 },
      { pts: smoothPts([[8.0, 17.6], [5.6, 18.8], [3.6, 20.8], [2.6, 23.4], [3.2, 26.2]], false, 3), w: 1.9, h: 0.5, flat: 0.45 },
    ],
    mounds: [{ x: 7.8, z: 24.3, r: 3.0, h: 0.75 }],
    rims: []
  };
  // spawn platform + the narrow side ledge (raised plateau); where it meets the bowl the bowl's rim rises to it
  const plat = { h: P, mat: 3, poly: [[-3.3, 47.5], [-3.3, 33.7], [0.8, 33.7], [0.8, 30.5], [-0.4, 28.0], [-0.4, 21.8], [-14.0, 21.8], [-14.0, 17.4], [-15.5, 17.4], [-15.5, 15.3], [-21, 15.3], [-21, 47.5]] };   // the side ledge runs right up to the planter (no pocket)
  bowl.rims.push({ poly: plat.poly, h: P, blend: 2.2 });
  // the pit under the side grate bridge
  const pit = { h: 0, mat: 1, poly: [[-21, 5.2], [-11.4, 5.2], [-11.4, 10.0], [-21, 10.0]] };   // includes its way-out ramp
  TERR.plats = [plat, { h: P, mat: 3, poly: rotPts(plat.poly) }, pit, { h: 0, mat: 1, poly: rotPts(pit.poly) }];
  const rb = b => ({ floor: b.floor, R: b.R, poly: rotPts(b.poly), ridges: b.ridges.map(r => Object.assign({}, r, { pts: rotPts(r.pts) })), mounds: b.mounds.map(m => Object.assign({}, m, { x: -m.x, z: -m.z })), rims: b.rims.map(r => Object.assign({}, r, { poly: rotPts(r.poly) })) });
  TERR.bowls = [bowl, rb(bowl)];
  // thin walls along the plateau's straight edges (paintable, climbable; they also stop people walking up the edge)
  const W = 0.6;           // thick enough to cover the narrow slope where a raised plateau meets the street
  const half2 = [
    // ---- spawn side
    box(-14.0, -0.4, 21.8 - W, 21.8, P, 'panel', 'concrete'),                  // front face of the spawn platform
    box(-14.0, -14.0 + W, 17.4, 21.8, P, 'panel', 'concrete'),                   // edge of the side ledge (on the low side, so it hides the terrain's edge)
    box(-3.3, -3.3 + W, 33.7, 41.4, P, 'panel', 'concrete'),                     // spawn deck's side toward the bowl end
    box(-3.0, 2.3, 33.7, 36.6, 2.5, 'contB', 'grate'),                           // dark block behind the bowl (flush with the spawn deck: no gap)
    box(-3.0, 2.6, 36.6, 41.4, 2.5, 'contG', 'grate'),                           // dark grate box behind the bowl
    // ---- side ledge: walkway past the planter, grate bridge over the pit, out to the street
    box(-15.5, -13.6, 10.0, 17.4, P, 'stone', 'concrete'),
    oob(-21, -15.5, 10.0, 15.3, 2.8),
    ramp(-13.6, -11.4, 5.2 + W, 10.0 - W, 'x', 0, SL, 'skate'),                  // way out of the pit
    box(-21, -11.4, 5.2, 5.2 + W, SL, 'stone', 'concrete'), box(-21, -11.4, 10.0 - W, 10.0, SL, 'stone', 'concrete'),   // the pit's side walls
    oob(-18.2, -15.4, 0.6, 3.0, 1.9),                                            // parked car on the street
    // ---- middle, spawn side of the tower (x<0)
    box(-14.0, -3.3, 15.3, 21.8, 1.5, 'stone', 'concrete'),                      // raised square in front of the spawn platform
    oob(-12.8, -9.4, 18.2, 21.5, 2.2),                                           // grass strip along its back ...
    oob(-9.4, -5.0, 15.3, 21.5, 2.7),                                            // ... joined to the palm planter (no slot between them)
    box(-4.4, -3.5, 4.8, 10.3, 2.0, 'crate', 'wood'),                            // walkway off the tower balcony (grate beside it)
    box(-8.7, -6.9, 5.0, 10.3, 1.5, 'crate', 'wood'),                            // crate row (grate beside it)
    box(-12.8, -10.6, 3.4, 6.8, 1.5, 'crate', 'wood'),
    box(-4.8, -1.0, 1.0, 4.8, 2.0, 'panel', 'concrete'),                         // tower balcony
    // ---- middle, +x side
    oob(4.6, 11.2, 9.2, 16.7, 2.6),                                              // big palm planter (grate walkways on two sides)
    box(5.8, 11.2, 3.6, 9.2, 2.2, 'panel', 'concrete'),                          // raised block in front of the planter
    box(10.8, 13.6, 1.5, 3.6, 2.2, 'panel', 'concrete'),
    box(0.6, 2.6, 9.0, 12.3, 1.5, 'stone', 'concrete'),                          // low step, a 2 m lane to the planter
    ramp(12.0, 15.3, 6.1, 16.4, 'x', SL, 2.2, 'wood'),                           // wooden ramp up to the side ledge
    box(15.3, 18.3, 3.9, 16.4, 2.2, 'stone', 'concrete'),                        // side ledge along the wall (overlooks the bowl)
    box(13.6, 15.3, 3.7, 6.1, 2.2, 'stone', 'concrete'),
    box(17.6, 18.3, 9.2, 15.1, 3.2, 'panel', 'concrete'),                        // parapet against the park wall
  ];
  half2.forEach(s => { SOLIDS.push(s); SOLIDS.push(mirrorSolid(s)); });
  // the tower: three overlapping blocks make a rounded column, only climbable on its inked walls
  SOLIDS.push(box(-2.1, 2.1, -1.0, 1.0, 4.0, 'panel', 'concrete'), box(-1.0, 1.0, -2.1, 2.1, 4.0, 'panel', 'concrete'), box(-1.6, 1.6, -1.6, 1.6, 4.0, 'panel', 'concrete'));
  TERR.tower = { r: 2.35, h: 4.0 };
  // grate walkways round the palm planters (people walk on them, squids drop through), grate bridges over the side pits
  const grates = [{ x0: 11.2, x1: 12.0, z0: 9.2, z1: 17.4, h: 2.6 }, { x0: 4.6, x1: 12.0, z0: 16.7, z1: 17.4, h: 2.6 }, { x0: -20.3, x1: -13.6, z0: 5.2, z1: 10.0, h: P },
    { x0: -3.5, x1: -2.0, z0: 4.8, z1: 10.3, h: 2.0 }, { x0: -10.3, x1: -8.7, z0: 5.0, z1: 10.3, h: 1.5 }];
  grates.forEach(b => BRIDGES.push(b, Object.assign({}, b, { x0: -b.x1, x1: -b.x0, z0: -b.z1, z1: -b.z0 })));
  // grate fences beside the tower: people can't pass, squids and ink can
  const fz = [[2.2, 5.0, 6.0, 6.12], [2.2, 5.0, 8.48, 8.6], [4.88, 5.0, 6.0, 8.6]];
  fz.forEach(([x0, x1, z0, z1]) => { FENCES.push({ x0, x1, z0, z1, y0: SL, h: SL + 1.25 }, { x0: -x1, x1: -x0, z0: -z1, z1: -z0, y0: SL, h: SL + 1.25 }); });
  // spread the whole plan out (plan view only; heights stay)
  const K = SKATE_K, sp = P => P.map(([x, z]) => [x * K, z * K]), sr = r => { r.x0 *= K; r.x1 *= K; r.z0 *= K; r.z1 *= K; };
  SOLIDS.forEach(sr); BRIDGES.forEach(sr); FENCES.forEach(sr);
  TERR.outline = sp(TERR.outline); TERR.plats.forEach(p => { p.poly = sp(p.poly); if (p.h > SL) p.grow = 0.3; else if (p.h < SL) p.shrink = 0.3; });   // raised plateaus reach a little under their edge walls
  TERR.bowls.forEach(b => { b.poly = sp(b.poly); b.R *= K; b.ridges.forEach(r => { r.pts = sp(r.pts); r.w *= K; }); b.mounds.forEach(m => { m.x *= K; m.z *= K; m.r *= K; }); b.rims.forEach(r => { r.poly = sp(r.poly); r.blend *= K; }); });
  TERR.tower.r *= K;
  buildTerrain();
  SOLIDS.forEach((s, i) => { s.id = i; s.maxH = s.t === 'ramp' ? Math.max(s.h0, s.h1) : s.h; });
}
// yaw = facing the battlefield (team 0 looks toward -z, team 1 toward +z)
const SPAWN = MAP_ID === 'skate' ? [{ x: -6.8 * SKATE_K, z: 42.6 * SKATE_K, y: 2.0, yaw: Math.PI }, { x: 6.8 * SKATE_K, z: -42.6 * SKATE_K, y: 2.0, yaw: 0 }] : [{ x: 0, z: 42, y: 2.0, yaw: Math.PI }, { x: 0, z: -42, y: 2.0, yaw: 0 }];
const DECK = MAP_ID === 'skate' ? [{ x0: -10.3 * SKATE_K, x1: -3.3 * SKATE_K, z0: 36 * SKATE_K, z1: 46.5 * SKATE_K }, { x0: 3.3 * SKATE_K, x1: 10.3 * SKATE_K, z0: -46.5 * SKATE_K, z1: -36 * SKATE_K }] : [{ x0: -9, x1: 9, z0: 37, z1: 46 }, { x0: -9, x1: 9, z0: -46, z1: -37 }];
function inRect(s, x, z) { return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1; }
function topAt(s, x, z) {
  if (s.t === 'box') return s.h;
  const t = s.axis === 'x' ? (x - s.x0) / (s.x1 - s.x0) : (z - s.z0) / (s.z1 - s.z0);
  return lerp(s.h0, s.h1, clamp(t, 0, 1));
}

/* ---- curved terrain: a height field under the blocks (skatepark only).
   Sunken skate bowls with rounded transitions, snake ridges and humps, plus
   the park's curved outline (outside it = out of bounds, a solid wall).
   Everything that asks "how high is the ground here" just takes the higher
   of the terrain and the blocks, so paint, AI, bombs and the camera all work. */
const TERR = { on: false, R: 0.25, W: 0, H: 0, h: null, mat: null, oob: null, OOB_H: 2.9, outline: null, bowls: [], plats: [] };
function terrH(x, z) {
  const R = TERR.R, fx = clamp((x + XH) / R, 0, TERR.W - 1.001), fz = clamp((z + ZH) / R, 0, TERR.H - 1.001);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, W = TERR.W, h = TERR.h, k = j * W + i;
  return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + W] * (1 - u) + h[k + W + 1] * u) * v;
}
function terrOob(x, z) {
  const i = Math.floor((x + XH) / TERR.R), j = Math.floor((z + ZH) / TERR.R);
  if (i < 0 || j < 0 || i >= TERR.W - 1 || j >= TERR.H - 1) return true;
  return TERR.oob[j * (TERR.W - 1) + i] === 1;
}
// polygon helpers (points are [x, z])
function inPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function segDist(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz; let t = L ? ((x - ax) * dx + (z - az) * dz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - ax - dx * t, z - az - dz * t); }
function polyDist(x, z, P, closed = true) { let d = 1e9; const n = P.length; for (let i = 0; i < (closed ? n : n - 1); i++) { const a = P[i], b = P[(i + 1) % n]; const e = segDist(x, z, a[0], a[1], b[0], b[1]); if (e < d) d = e; } return d; }
// smooth a polyline / polygon through its control points (Catmull-Rom), ~k points per metre
function smoothPts(P, closed = true, k = 3) {
  const out = [], n = P.length, get = i => closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2), m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * k));
    for (let s = 0; s < m; s++) { const t = s / m, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  if (!closed) out.push(P[n - 1].slice());
  return out;
}
const rotPts = P => P.map(([x, z]) => [-x, -z]);
// height + surface kind of the open ground at (x,z): bowls (rounded transitions up to their rim), raised plateaus, the street
function terrainAt(x, z) {
  let h = SL, m = 0, rim = 0;
  for (const p of TERR.plats) {
    if (x < p.bb[0] || x > p.bb[1] || z < p.bb[2] || z > p.bb[3]) continue;
    if (p.shrink) { if (inPoly(x, z, p.poly) && polyDist(x, z, p.poly) >= p.shrink) { h = p.h; m = p.mat; } continue; }   // sunken pits stop a little short of their walls
    if (inPoly(x, z, p.poly) || (p.grow && polyDist(x, z, p.poly) < p.grow)) { h = p.h; m = p.mat; }
  }
  for (const b of TERR.bowls) {
    if (x < b.bb[0] || x > b.bb[1] || z < b.bb[2] || z > b.bb[3] || !inPoly(x, z, b.poly)) continue;
    // the rim rises where a plateau borders the bowl (blend over a couple of metres so the coping has no step)
    let rh = SL;
    for (const r of b.rims) { const d = inPoly(x, z, r.poly) ? 0 : polyDist(x, z, r.poly); rh = Math.max(rh, lerp(r.h, SL, smoothstep(0, r.blend, d))); }
    const t = Math.min(1, polyDist(x, z, b.poly) / (b.R * Math.max(1, (rh - b.floor) / (SL - b.floor)))), q = 1 - t;
    let y = b.floor + (rh - b.floor) * q * q;
    for (const r of b.ridges) { const d = polyDist(x, z, r.pts, false); if (d < r.w) y = Math.max(y, b.floor + r.h * smoothstep(r.w, r.w * r.flat, d)); }
    for (const c of b.mounds) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r) y = Math.max(y, b.floor + c.h * smoothstep(c.r, c.r * 0.45, d)); }
    h = Math.min(rh, y); m = 1;
  }
  return [h, m];
}
function buildTerrain() {
  const R = TERR.R, W = TERR.W = Math.round(XH * 2 / R) + 1, H = TERR.H = Math.round(ZH * 2 / R) + 1;
  const bbOf = P => { const xs = P.map(p => p[0]), zs = P.map(p => p[1]); return [Math.min(...xs) - 0.5, Math.max(...xs) + 0.5, Math.min(...zs) - 0.5, Math.max(...zs) + 0.5]; };
  TERR.plats.forEach(p => p.bb = bbOf(p.poly)); TERR.bowls.forEach(b => b.bb = bbOf(b.poly));
  TERR.h = new Float32Array(W * H); TERR.mat = new Uint8Array((W - 1) * (H - 1)); TERR.oob = new Uint8Array((W - 1) * (H - 1));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) TERR.h[j * W + i] = terrainAt(i * R - XH, j * R - ZH)[0];
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    const x = (i + 0.5) * R - XH, z = (j + 0.5) * R - ZH, k = j * (W - 1) + i;
    TERR.oob[k] = inPoly(x, z, TERR.outline) ? 0 : 1; TERR.mat[k] = terrainAt(x, z)[1];
  }
  TERR.on = true;
}

function groundAt(x, z) {
  let h = 0;
  if (TERR.on) { if (terrOob(x, z)) return TERR.OOB_H; h = terrH(x, z); }
  for (const s of solidsNear(x, z)) if (!s.bound && inRect(s, x, z)) { const t = topAt(s, x, z); if (t > h) h = t; }
  return h;
}
// highest walkable ground under (x,z) that is not above y+step
function groundBelow(x, z, y, step, noBridge) {
  let h = 0;
  if (TERR.on) h = terrOob(x, z) && TERR.OOB_H <= y + step ? TERR.OOB_H : terrH(x, z);
  for (const s of solidsNear(x, z)) if (inRect(s, x, z)) { const t = topAt(s, x, z); if (t > h && t <= y + step) h = t; }
  if (!noBridge) for (const b of BRIDGES) if (b.h > h && b.h <= y + step && inRect(b, x, z)) h = b.h;
  return h;
}
// is point inside solid geometry?  (true = the ground / terrain, else the block it is in)
function solidAt(x, y, z) {
  if (y < 0) return true;
  if (TERR.on && (y < terrH(x, z) || (y < TERR.OOB_H && terrOob(x, z)))) return true;
  if (y > TREE_Y0) for (const t of TREES) { if (y < t.y0 || y > t.y1) continue; const dx = x - t.x, dz = z - t.z, r = y > t.yc ? t.rc : t.r; if (dx * dx + dz * dz < r * r) return t; }
  for (const s of solidsNear(x, z)) if (inRect(s, x, z) && y < topAt(s, x, z)) return s;
  return null;
}
// characters: out of bounds is a wall at any height, terrain too steep to step up is a wall
function terrBlocked(x, z, y) { return terrOob(x, z) || terrH(x, z) > y; }
function segBlocked(ax, ay, az, bx, by, bz, stepLen = 0.4) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); const n = Math.max(1, Math.ceil(L / stepLen));
  for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(ax + dx * t, ay + dy * t, az + dz * t)) return t; }
  return 0;
}

/* ============================================================ PAINT */
const Paint = {
  data: null, owner: null, hgt: null, onTerr: null, tex: null, dirty: false, teamCells: [0, 0], total: NX * NZ,
  wdata: null, wtex: null, wdirty: false, W: 1024, H: 1024, PX: 8, faces: []
};
function initPaint() {
  Paint.data = new Uint8Array(NX * NZ * 4);
  Paint.owner = new Int8Array(NX * NZ).fill(-1);
  Paint.hgt = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) Paint.hgt[j * NX + i] = groundAt((i + 0.5) * CELL - XH, (j + 0.5) * CELL - ZH);
  // cells whose ground is the curved terrain itself (not a block top): splats may follow its slope
  Paint.onTerr = new Uint8Array(NX * NZ);
  if (TERR.on) for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = (i + 0.5) * CELL - XH, z = (j + 0.5) * CELL - ZH, k = j * NX + i; if (!terrOob(x, z) && Math.abs(Paint.hgt[k] - terrH(x, z)) < 0.02) Paint.onTerr[k] = 1; }
  const OOB = SOLIDS.filter(s => s.oob);
  if (OOB.length || TERR.on) {           // out of bounds: never takes ink, doesn't count toward the turf total
    let n = 0;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = (i + 0.5) * CELL - XH, z = (j + 0.5) * CELL - ZH; if (OOB.some(o => inRect(o, x, z)) || (TERR.on && terrOob(x, z))) Paint.hgt[j * NX + i] = 99; else n++; }
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
    if (!SOLIDS.some(o => o !== s && !o.bound && inRect(o, px, pz) && topAt(o, px, pz) >= s.h - 0.05) && !(TERR.on && (terrOob(px, pz) || terrH(px, pz) >= s.h - 0.05))) all = false;
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
    if (d === highD && (SOLIDS.some(o => o !== s && !o.bound && inRect(o, ox, oz) && topAt(o, ox, oz) >= hi - 0.05) || (TERR.on && (terrOob(ox, oz) || terrH(ox, oz) >= hi - 0.05)))) continue;
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
  const D = Paint.data, O = Paint.owner, Hg = Paint.hgt, TC = Paint.teamCells, OT = Paint.onTerr;
  // a splat that lands on the terrain follows its slope (a bowl wall) instead of stopping at a fixed height band
  const slopeOk = TERR.on && Math.abs(terrH(x, z) - y) < 0.15 && !terrOob(x, z);
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
      let ddx = (i + 0.5) * CELL - XH - x, ddz = dz;
      if (Math.abs(Hg[q] - y) > tol + (slopeOk && OT[q] ? Math.hypot(ddx, ddz) * 0.95 : 0)) continue;
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
// skatepark ground paint: baked slope shading in the bowls (so their curves read from above), white coping
// along the bowl rims, pale snake humps, soft contact shadows round the blocks, the team logos on the spawn platforms
function makeLayoutSkate() {
  const W = 1024, H = Math.round(1024 * PSZ / PSX);
  const t = canvasTex(W, H, (g) => {
    const s = W / PSX, m2p = (x, z) => [(x + XH) / PSX * W, (z + ZH) / PSZ * H];
    // contact shadows (fake AO) round the blocks
    g.save(); const OFF = W * 3; g.shadowOffsetX = OFF; g.shadowBlur = Math.round(s * 0.9); g.shadowColor = 'rgba(10,12,25,.55)'; g.fillStyle = '#000';
    for (const so of SOLIDS) { if (so.bound || so.t !== 'box') continue; const [a, b] = m2p(so.x0, so.z0), [c, d] = m2p(so.x1, so.z1), pad = s * 0.15; g.fillRect(a - pad - OFF, b - pad, c - a + pad * 2, d - b + pad * 2); }
    g.restore();
    // bowls: per-pixel hill shading from the terrain itself
    const img = (g.getImageData && g.getImageData(0, 0, W, H)) || g.createImageData(W, H), D = img.data, L = [-0.45, 0.8, -0.4], Ll = Math.hypot(...L);
    const step = TERR.R;
    for (let py = 0; py < H; py++) {
      const z = (py + 0.5) / H * PSZ - ZH;
      for (let px = 0; px < W; px++) {
        const x = (px + 0.5) / W * PSX - XH, ci = Math.floor((x + XH) / TERR.R), cj = Math.floor((z + ZH) / TERR.R);
        if (ci < 0 || cj < 0 || ci >= TERR.W - 1 || cj >= TERR.H - 1) continue;
        const k = cj * (TERR.W - 1) + ci; if (TERR.mat[k] !== 1 || TERR.oob[k]) continue;
        const y = terrH(x, z), gx = (terrH(x + step, z) - terrH(x - step, z)) / (2 * step), gz = (terrH(x, z + step) - terrH(x, z - step)) / (2 * step);
        const nl = Math.hypot(gx, 1, gz), sh = (-gx * L[0] + L[1] - gz * L[2]) / nl / Ll, slope = 1 - 1 / nl;
        const hump = clamp((y - 0.12) / 0.45, 0, 1) * (1 - clamp(slope * 3, 0, 1));
        let r = 200, gg = 214, b = 224;
        r = lerp(r, 196, hump); gg = lerp(gg, 226, hump); b = lerp(b, 236, hump);                      // pale blue snake tops
        const lum = 0.6 + 0.42 * sh - 0.16 * (1 - clamp(y, 0, 1));
        const o = (py * W + px) * 4, a0 = D[o + 3] / 255;
        D[o] = lerp(D[o], clamp(r * lum, 0, 255), 1 - a0 * 0.3); D[o + 1] = lerp(D[o + 1], clamp(gg * lum, 0, 255), 1 - a0 * 0.3); D[o + 2] = lerp(D[o + 2], clamp(b * lum, 0, 255), 1 - a0 * 0.3);
        D[o + 3] = Math.max(D[o + 3], 215);
      }
    }
    g.putImageData(img, 0, 0);
    // coping: a white edge with a dark lip all round each bowl rim, and round the humps
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const bw of TERR.bowls) {
      const pts = bw.poly.filter(([x, z]) => !terrOob(x * 0.995, z * 0.995));
      const runs = []; let cur = []; bw.poly.forEach(p => { if (terrOob(p[0] - Math.sign(p[0]) * 0.4, p[1])) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(p); }); if (cur.length > 1) runs.push(cur);
      for (const r of runs) {
        g.beginPath(); r.forEach(([x, z], i) => { const [a, b] = m2p(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
        g.strokeStyle = 'rgba(40,46,60,.55)'; g.lineWidth = s * 0.55; g.stroke(); g.strokeStyle = 'rgba(250,250,248,.95)'; g.lineWidth = s * 0.32; g.stroke();
      }
      for (const rd of bw.ridges) { g.beginPath(); rd.pts.forEach(([x, z], i) => { const [a, b] = m2p(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = s * 0.18; g.stroke(); }
      for (const c of bw.mounds) { const [a, b] = m2p(c.x, c.z); g.beginPath(); g.arc(a, b, c.r * 0.45 * s, 0, 7); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = s * 0.16; g.stroke(); g.fillStyle = 'rgba(60,70,85,.75)'; g.beginPath(); g.arc(a, b, s * 0.3, 0, 7); g.fill(); }
    }
    // team logos on the spawn platforms (our own ink-arrow emblem)
    [[-9.4 * SKATE_K, 25.6 * SKATE_K, Math.PI], [9.4 * SKATE_K, -25.6 * SKATE_K, 0]].forEach(([x, z, r]) => {
      const [a, b] = m2p(x, z); g.save(); g.translate(a, b); g.rotate(r); g.globalAlpha = 0.85;
      g.fillStyle = '#7ad6a0'; g.beginPath(); g.moveTo(-s * 1.6, s * 1.4); g.lineTo(0, -s * 1.7); g.lineTo(s * 0.2, s * 0.2); g.closePath(); g.fill();
      g.fillStyle = '#b77bf0'; g.beginPath(); g.moveTo(s * 1.6, s * 1.4); g.lineTo(0, -s * 0.6); g.lineTo(-s * 0.4, s * 1.5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = s * 0.12; g.strokeRect(-s * 2, -s * 2.1, s * 4, s * 4); g.restore();
    });
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
  if (TERR.on) buildTerrainMesh(); else {
  // floor
  const fg = quadGeo([[-XH, 0, -ZH], [XH, 0, -ZH], [XH, 0, ZH], [-XH, 0, ZH]], [[-XH / 8, -ZH / 8], [XH / 8, -ZH / 8], [XH / 8, ZH / 8], [-XH / 8, ZH / 8]], null, null, [0, 1, 0]);
  const floor = new THREE.Mesh(fg, paintMat({ map: TEX.concrete, roughness: 0.92, color: 0xffffff }, 'floor', true));
  floor.receiveShadow = true; arenaGroup.add(floor);
  }
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
  if (sides.length) { const sm = new THREE.Mesh(mergeGeos(sides), new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.85, side: THREE.DoubleSide })); sm.castShadow = sm.receiveShadow = true; arenaGroup.add(sm); }
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
// the terrain surface: flat stretches merged into long strips, bowls as a fine smooth mesh
const TERR_STYLE = [{ tex: 'concrete', s: 8, rough: 0.9 }, { tex: 'bowl', s: 7, rough: 0.5 }, { tex: 'deck', s: 4, rough: 0.6, metal: 0.2 }, { tex: 'concrete', s: 5, rough: 0.85, color: 0xd9d2c4 }];
function buildTerrainMesh() {
  const R = TERR.R, W = TERR.W, H = TERR.H, h = TERR.h, CW = W - 1, CH = H - 1;
  const G = TERR_STYLE.map(() => ({ p: [], n: [], u: [], i: [] }));
  const vh = (i, j) => h[j * W + i];
  const nrm = (i, j) => { const a = vh(Math.max(0, i - 1), j), b = vh(Math.min(W - 1, i + 1), j), c = vh(i, Math.max(0, j - 1)), d = vh(i, Math.min(H - 1, j + 1)); const nx = -(b - a) / (2 * R), nz = -(d - c) / (2 * R), L = Math.hypot(nx, 1, nz); return [nx / L, 1 / L, nz / L]; };
  const near = (i, j) => { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < CW && jj < CH && !TERR.oob[jj * CW + ii]) return true; } return false; };
  const quad = (g, P, N) => { const st = TERR_STYLE[g], o = G[g], b = o.p.length / 3; P.forEach((q, k) => { o.p.push(...q); o.n.push(...N[k]); o.u.push(q[0] / st.s, q[2] / st.s); }); o.i.push(b, b + 2, b + 1, b, b + 3, b + 2); };
  for (let j = 0; j < CH; j++) {
    let run = null;
    const flush = () => { if (!run) return; const z0 = j * R - ZH, z1 = z0 + R, x0 = run.i0 * R - XH, x1 = (run.i1 + 1) * R - XH; quad(run.m, [[x0, run.y, z0], [x1, run.y, z0], [x1, run.y, z1], [x0, run.y, z1]], [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]]); run = null; };
    for (let i = 0; i < CW; i++) {
      const k = j * CW + i; if (TERR.oob[k] && !near(i, j)) { flush(); continue; }
      const a = vh(i, j), b = vh(i + 1, j), c = vh(i + 1, j + 1), d = vh(i, j + 1), m = TERR.mat[k];
      if (Math.abs(a - b) < 1e-4 && Math.abs(a - c) < 1e-4 && Math.abs(a - d) < 1e-4) {
        if (run && run.m === m && Math.abs(run.y - a) < 1e-4 && run.i1 === i - 1) { run.i1 = i; continue; }
        flush(); run = { i0: i, i1: i, y: a, m }; continue;
      }
      flush();
      const x0 = i * R - XH, z0 = j * R - ZH;
      quad(m, [[x0, a, z0], [x0 + R, b, z0], [x0 + R, c, z0 + R], [x0, d, z0 + R]], [nrm(i, j), nrm(i + 1, j), nrm(i + 1, j + 1), nrm(i, j + 1)]);
    }
    flush();
  }
  G.forEach((o, g) => {
    if (!o.i.length) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2)); geo.setIndex(o.i); geo.computeBoundingSphere();
    const st = TERR_STYLE[g], m = new THREE.Mesh(geo, paintMat({ map: TEX[st.tex], roughness: st.rough, metalness: st.metal || 0, color: st.color || 0xffffff }, 'floor', true));
    m.receiveShadow = true; m.castShadow = g === 1; arenaGroup.add(m);
  });
  buildParkWall();
}
// the park's outer wall along the curved outline: inner face, a flat top, the outside face; a yellow rail on top
function buildParkWall() {
  const P = TERR.outline, n = P.length, WT = TERR.OOB_H, T = 0.5;
  const out = P.map((p, i) => {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n]; let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    let nx = tz, nz = -tx; if (inPoly(p[0] + nx * 0.3, p[1] + nz * 0.3, P)) { nx = -nx; nz = -nz; } return [nx, nz];
  });
  const pos = [], nor = [], uv = [], idx = [], cap = { p: [], n: [], u: [], i: [] };
  let acc = 0;
  const lens = P.map((p, i) => { const q = P[(i + 1) % n]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  for (let i = 0; i <= n; i++) {
    const k = i % n, p = P[k], o = out[k], u = acc / 11.6; acc += lens[k];
    // inner face (normal points into the park), outer face
    pos.push(p[0], -0.5, p[1], p[0], WT, p[1]); nor.push(-o[0], 0, -o[1], -o[0], 0, -o[1]); uv.push(u, 0.17, u, 1);
    pos.push(p[0] + o[0] * T, SL - 0.05, p[1] + o[1] * T, p[0] + o[0] * T, WT, p[1] + o[1] * T); nor.push(o[0], 0, o[1], o[0], 0, o[1]); uv.push(u, 0.4, u, 1);
    cap.p.push(p[0], WT, p[1], p[0] + o[0] * T, WT, p[1] + o[1] * T); cap.n.push(0, 1, 0, 0, 1, 0); cap.u.push(u, 0, u, 0.2);
    if (i < n) { const b = i * 4, c = i * 2; idx.push(b, b + 1, b + 5, b, b + 5, b + 4, b + 2, b + 7, b + 3, b + 2, b + 6, b + 7); cap.i.push(c, c + 3, c + 1, c, c + 2, c + 3); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
  const wm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: TEX.parkWall || TEX.panel, color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide })); wm.castShadow = wm.receiveShadow = true; arenaGroup.add(wm);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cap.p, 3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(cap.n, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(cap.u, 2)); cg.setIndex(cap.i); cg.computeBoundingSphere();
  const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: TEX.stone, color: 0x9aa0ad, roughness: 0.85, side: THREE.DoubleSide })); cm.receiveShadow = true; arenaGroup.add(cm);
  // yellow coping rail just inside the top edge, on short posts
  const railM = new THREE.MeshStandardMaterial({ color: 0xffc629, roughness: 0.35, metalness: 0.4 });
  const rp = P.map((p, i) => new THREE.Vector3(p[0] + out[i][0] * 0.22, WT + 0.42, p[1] + out[i][1] * 0.22));
  const curve = new THREE.CatmullRomCurve3(rp, true);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(1400, n * 2), 0.11, 6, true), railM); tube.castShadow = true; arenaGroup.add(tube);
  const posts = []; let d = 0; for (let i = 0; i < n; i++) { d += lens[i]; if (d > 2.2) { d = 0; posts.push(rp[i]); } }
  const pim = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6), railM, posts.length), dm = new THREE.Object3D();
  posts.forEach((q, i) => { dm.position.set(q.x, WT + 0.21, q.z); dm.updateMatrix(); pim.setMatrixAt(i, dm.matrix); }); arenaGroup.add(pim);
  // the centre tower's round lip (sits round the top edge, never over the paintable top)
  if (TERR.tower) {
    const T = TERR.tower, lip = new THREE.Mesh(new THREE.TorusGeometry(T.r - 0.08, 0.12, 8, 48), railM); lip.rotation.x = Math.PI / 2; lip.position.y = T.h + 0.02; arenaGroup.add(lip);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r, 0.35, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide })); band.position.y = T.h - 0.2; arenaGroup.add(band);
  }
}
const WORLD = { spawnFx: [], buoys: [], sea: null, sky: null, flags: null };
function setTeamColors(c0, c1) {
  PU.teamCol0.value.set(c0); PU.teamCol1.value.set(c1);
  WORLD.spawnFx.forEach(m => m.material.color.set(m.userData.team ? c1 : c0));
  document.documentElement.style.setProperty('--c0', c0); document.documentElement.style.setProperty('--c1', c1);
}
