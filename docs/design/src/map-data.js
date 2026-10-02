/* 西关骑楼街 · CANTON ARCADE — layout data (design draft v1)
   Units: metres. x = across (±26), z = along (±52). Team 0 (orange) spawns at +z, team 1 at -z.
   Only team 0's half is listed (plus pieces marked self:true that already sit on the centre);
   the other half is the same list rotated 180° round the centre, like the skatepark.
   Heights: canal bed -1.8 · street 0 · low cover 0.5 / 1.0–1.2 · shop 2.4 · spawn roof 2.0 ·
   大屋 wings 2.6 · arcade roof 3.0 · ancestral hall roof 4.0
   Engine mapping: box / ramp = existing solids; float = NEW "solid with an underside" (people walk
   under it, bump their head on it); fence = existing grate fence (squids pass, people don't);
   oob = existing out-of-bounds block; canal = existing height-field terrain (sunken band).      */
const GZ = (() => {
  const XH = 26, ZH = 52;
  const CANAL = { z0: -3.5, z1: 3.5, bed: -1.8, shallow: -1.6, deep: -0.6 };
  const B = (x0, x1, z0, z1, h, kind, o = {}) => Object.assign({ t: 'box', x0, x1, z0, z1, y0: 0, h, kind }, o);
  const R = (x0, x1, z0, z1, axis, h0, h1, kind, o = {}) => Object.assign({ t: 'ramp', x0, x1, z0, z1, axis, h0, h1, y0: 0, kind }, o);
  const F = (x0, x1, z0, z1, y0, h, kind, o = {}) => Object.assign({ t: 'box', x0, x1, z0, z1, y0, h, kind, float: true }, o);

  const half = [
    // ---- spawn: the tea house's roof terrace (red quarry tiles), stairs down to the street
    B(-10, 10, 42, 52, 2.0, 'terrace', { zone: 'spawn', label: '茶楼天台（出生点）' }),
    R(-3, 3, 36, 42, 'z', 0, 2.0, 'stair', { zone: 'spawn', label: '下街石阶' }),
    B(10, 26, 42, 52, 2.0, 'terrace', { zone: 'spawn', label: '天台' }),
    B(15, 17, 46, 48, 3.6, 'tank', { zone: 'spawn', label: '水箱' }),
    B(-26, -10, 44, 52, 9.0, 'teahouse', { oob: true, zone: 'spawn', label: '茶樓（陶陶居 / 蓮香樓）' }),
    R(20.3, 26, 36, 42, 'z', 3.0, 2.0, 'terrace', { zone: 'arcade', label: '上骑楼坡道' }),

    // ---- qilou arcade along the +x wall: covered street below, walkable upper deck above
    F(20.3, 26, 8, 36, 2.6, 3.0, 'arcade', { zone: 'arcade', label: '骑楼二层走廊', isNew: true }),
    F(20.3, 20.6, 8, 36, 3.0, 3.9, 'balustrade', { zone: 'arcade' }),

    // ---- Xiguan mansion along the -x wall: two flat-roof wings, a courtyard behind a tanglong gate
    B(-26, -15, 12, 16, 2.6, 'brick', { zone: 'mansion', label: '大屋南翼（天台）' }),
    B(-26, -15, 30, 34, 2.6, 'brick', { zone: 'mansion', label: '大屋北翼（天台）' }),
    B(-26, -23, 16, 30, 4.4, 'hall', { oob: true, zone: 'mansion', label: '正厅' }),
    B(-16, -15, 16, 21, 2.6, 'brick', { zone: 'mansion' }),
    B(-16, -15, 25, 30, 2.6, 'brick', { zone: 'mansion' }),
    // (v3: the gate is open — no tanglong fence; people walk in under the lintel)
    F(-16, -15, 21, 25, 2.2, 2.6, 'lintel', { zone: 'mansion', label: '門楣（下面是敞開的大門）' }),
    R(-15, -10, 30, 34, 'x', 2.6, 0, 'stair', { zone: 'mansion', label: '外楼梯' }),
    B(-20.5, -18, 21, 25, 1.0, 'planterbox', { zone: 'mansion', label: '天井花台' }),
    R(-15, -10, 12.4, 16, 'x', 2.6, 0, 'stair', { zone: 'mansion', label: '外楼梯' }),

    // ---- the street between them
    B(-11, -5, 18, 25, 2.4, 'shop', { zone: 'street', label: '小樓（吳系茶餐廳 / 廣州酒家）' }),
    B(-5, -3.5, 18, 19.6, 1.2, 'steamer', { zone: 'street', label: '蒸笼堆' }),
    B(-1, 0.6, 14, 15.6, 0.5, 'steamer', { zone: 'street' }),
    B(5, 11, 13, 18, 0.5, 'planter', { zone: 'street', label: '榕树花基' }),
    B(2, 5, 25, 26.6, 1.1, 'stall', { zone: 'street', label: '街邊檔' }),
    B(13, 15, 24, 26.5, 1.2, 'trike', { zone: 'street', label: '三轮车' }),
    B(14, 17, 16, 17, 1.0, 'planterwall', { zone: 'street', label: '花基矮墙' }),
    B(-4.4, -3.6, 30.6, 31.4, 4.6, 'post', { zone: 'street' }),
    B(3.6, 4.4, 30.6, 31.4, 4.6, 'post', { zone: 'street' }),
    F(-5, 5, 30.5, 31.5, 3.4, 4.6, 'lintel', { zone: 'street', label: '獵德牌坊' }),

    // ---- canal-side promenade: kapok trees, stone landing steps down into the canal
    B(-7, -5, 6, 8, 0.5, 'planter', { zone: 'canal', label: '木棉' }),
    B(10, 12, 5.5, 7.5, 0.5, 'planter', { zone: 'canal', label: '木棉' }),
    B(-12, -11.2, 1.7, 3.5, -0.45, 'landing', { y0: -1.8, zone: 'canal', label: '埠头' }),
    B(-11.2, -10.4, 1.7, 3.5, -0.9, 'landing', { y0: -1.8, zone: 'canal' }),
    B(-10.4, -9.6, 1.7, 3.5, -1.35, 'landing', { y0: -1.8, zone: 'canal' }),
    B(22.2, 23, 1.7, 3.5, -0.45, 'landing', { y0: -1.8, zone: 'canal', label: '埠头' }),
    B(21.4, 22.2, 1.7, 3.5, -0.9, 'landing', { y0: -1.8, zone: 'canal' }),
    B(20.6, 21.4, 1.7, 3.5, -1.35, 'landing', { y0: -1.8, zone: 'canal' }),
    // stone arch bridge (one half of it; the rotated copy is the other side bridge)
    R(14, 18, 0, 5.5, 'z', 0.8, 0, 'bridge', { float: true, thick: 0.5, zone: 'canal', label: '石拱桥', isNew: true }),
    R(14, 18, -5.5, 0, 'z', 0, 0.8, 'bridge', { float: true, thick: 0.5, zone: 'canal' }),

    // ---- centre: the ancestral hall stands on a square deck over the canal
    B(2.5, 5, -2.5, 0, 2.0, 'citywall', { zone: 'centre', label: '城牆台（2 米）' }),
    B(2.5, 5, -4.2, -2.5, 1.0, 'citywall', { zone: 'centre' }),
    // dragon boat moored in the canal (walkable deck, a jump up from the canal bed)
    B(8.5, 19, 0.2, 1.4, -1.1, 'boat', { y0: -1.8, zone: 'canal', label: '龍舟' }),
  ];
  // arcade columns: 8 per side, ~3.3 m between them
  for (let i = 0; i < 8; i++) { const c = 8.3 + i * (35.7 - 8.3) / 7; half.push(B(20.3, 20.9, c - 0.3, c + 0.3, 2.6, 'column', { zone: 'arcade' })); }

  const centre = [
    F(-7, 7, -3.5, 3.5, -0.4, 0, 'deck', { zone: 'centre', label: '中央广场桥（桥下只能鱿鱼过）', isNew: true }),
    B(-2.5, 2.5, -2.5, 2.5, 4.0, 'zhl', { zone: 'centre', label: '鎮海樓（4 米平台）' }),
    B(-1, 1, -1, 1, 8.2, 'zhltop', { zone: 'centre', label: '鎮海樓上層' }),
  ];
  const trees = [
    { kind: 'banyan', x: 8, z: 15.5, y: 0.5, r: 0.7, k: 1.0 },
    { kind: 'kapok', x: -6, z: 7, y: 0.5, r: 0.35, k: 1.0 },
    { kind: 'kapok', x: 11, z: 6.5, y: 0.5, r: 0.35, k: 0.9 },
  ];
  const rot = s => {
    const m = Object.assign({}, s, { x0: -s.x1, x1: -s.x0, z0: -s.z1, z1: -s.z0, team: 1 });
    if (s.t === 'ramp') { m.h0 = s.h1; m.h1 = s.h0; }
    return m;
  };
  const solids = [];
  half.forEach(s => { solids.push(Object.assign({ team: 0 }, s)); solids.push(rot(s)); });
  centre.forEach(s => solids.push(Object.assign({ self: true }, s)));
  const allTrees = [];
  trees.forEach(t => { allTrees.push(t); allTrees.push(Object.assign({}, t, { x: -t.x, z: -t.z })); });
  const spawns = [{ x: 0, z: 47, y: 2, yaw: Math.PI, team: 0 }, { x: 0, z: -47, y: 2, yaw: 0, team: 1 }];
  return { XH, ZH, CANAL, solids, trees: allTrees, spawns, BODY_H: 1.7, STEP: 0.55, JUMP_V: 8.3, GRAV: 24, RUN: 6.4 };
})();
if (typeof module !== 'undefined') module.exports = GZ;
