#!/usr/bin/env python3
"""Generate src/js/03b_canton_design.js from the approved design draft's own source (docs/design/src),
so the props in the game are the design's props, not a re-creation.  Run:  python3 tools/gen-canton-design.py"""
import os, re, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
D = os.path.join(root, 'docs', 'design', 'src')
rd = lambda f: open(os.path.join(D, f), encoding='utf-8').read()
def sub(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

# ---- layout data: same as the draft, with the heights that changed in playtesting (canal 2.2 m deep, arcade deck at 3.4 / 3.8 m, deck 0.8 m thick)
data = rd('map-data.js')
data = sub(data, "bed: -1.8, shallow: -1.6", "bed: -2.2, shallow: -2.0")
data = sub(data, "R(20.3, 26, 36, 42, 'z', 3.0, 2.0, 'terrace'", "R(20.3, 26, 36, 42, 'z', 3.8, 2.0, 'terrace'")
data = sub(data, "F(20.3, 26, 8, 36, 2.6, 3.0, 'arcade'", "F(20.3, 26, 8, 36, 3.4, 3.8, 'arcade'")
data = sub(data, "F(20.3, 20.6, 8, 36, 3.0, 3.9, 'balustrade'", "F(20.3, 20.6, 8, 36, 3.8, 4.7, 'balustrade'")
data = sub(data, "c - 0.3, c + 0.3, 2.6, 'column'", "c - 0.3, c + 0.3, 3.4, 'column'")
data = sub(data, "B(8.5, 19, 0.2, 1.4, -1.1, 'boat', { y0: -1.8,", "B(8.5, 19, 0.2, 1.4, -1.5, 'boat', { y0: -2.2,")
data = sub(data, "F(-7, 7, -3.5, 3.5, -0.4, 0, 'deck'", "F(-7, 7, -3.5, 3.5, -0.8, 0, 'deck'")
data = sub(data, "if (typeof module !== 'undefined') module.exports = GZ;", "")
data = sub(data, "const GZ = (() => {", "const GZ = (() => {", 1)

tex = rd('preview-tex.js')
tex = tex.replace("g.measureText(t).width", "((g.measureText(t) || {}).width || 0)").replace("g.measureText(text).width", "((g.measureText(text) || {}).width || 0)")
m = re.search(r"\n  return \{[^\n]*\};\n\}\)\(\);\s*$", tex); assert m, 'GZT return'
ret = m.group(0)
tex = tex[:m.start()] + ret.replace("return {", "return { seed: v => { if (v !== undefined) seed = v; return seed; },", 1)

sc = rd('preview-scene.js').split('\n')
ix = lambda key: next(i for i, l in enumerate(sc) if l.strip().startswith(key))
A = '\n'.join(sc[ix('// ---------------- materials'):ix('// ---------------- ground, canal')])
C = '\n'.join(sc[ix('// ---------------- solids'):ix('// ---------------- sky, light')])
# materials: no reflections from the game's environment map (the draft had none)
A = sub(A, "const p = Object.assign({ roughness: 0.85 }, o);", "const p = Object.assign({ roughness: 0.85 }, o);")
A = sub(A, "  const water = new THREE.MeshStandardMaterial({ map: T.water, color: 0xa9bfb4, transparent: true, opacity: 0.8, roughness: 0.12, metalness: 0.15 });\n  water.map.repeat.set(1 / 6, 1 / 6);\n", "")
# box(): the plain block of a solid is drawn (and inked) by the game itself, so the draft's copy of it is left out
A = sub(A, "    group.add(mesh); return mesh;\n  }\n  // a prism along an axis",
 "    if (CUR && !CUR.oob && group === G.map && x0 === CUR.x0 && x1 === CUR.x1 && z0 === CUR.z0 && z1 === CUR.z1 && y1 === CUR.h && y0 === (CUR.float ? CUR.y0 : (CUR.y0 || 0))) return mesh;\n    group.add(mesh); return mesh;\n  }\n  // a prism along an axis")
C = sub(C, "    const k = s.kind;\n", "    const k = s.kind; CUR = s;\n")
C = sub(C, "  // canal landing-step side walls are plain granite", "  CUR = null;\n  // canal landing-step side walls are plain granite")
# bridge: the game's bridge is its own arch (0.9 m rise over the 7 m canal); keep the draft's balustrade on it
a = C.index("      const pts = [[5.5, 0], [0, 0.8], [-5.5, 0], [-3.5, 0], [-3.5, CANAL.bed]];"); b = C.index("      continue;\n    }\n    if (k === 'stair')")
C = C[:a] + """      const yb = z => 0.9 * Math.min(1, Math.max(0, (3.5 - Math.abs(z)) / 2.3));
      [s.x0 + 0.15, s.x1 - 0.15].forEach(x => {
        for (let z = -3.2; z <= 3.21; z += 0.8) { const y = yb(z); box(G.decor, x - 0.1, x + 0.1, y, y + 0.85, z - 0.1, z + 0.1, mats.stone); }
        [[-3.5, -1.2], [-1.2, 1.2], [1.2, 3.5]].forEach(([za, zb]) => between(G.decor, V(x, yb(za) + 0.85, za), V(x, yb(zb) + 0.85, zb), 0.09, mats.stone, 6));
      });
""" + C[b:]
C = sub(C, "    if (k === 'stair') { stairs(s, mats.stone); continue; }\n    if (s.t === 'ramp') { ramp(s, mats.plaster, mats.terrace); continue; }", "    if (k === 'stair' || s.t === 'ramp') continue;      // slopes are drawn (and inked) by the game")
# arcade at the playtested height
C = sub(C, "const pts = [[za, 2.6], [zb, 2.6], [zb, 2.2]]; for (let j = 1; j < 16; j++) { const t = j / 16; pts.push([zb + (za - zb) * t, 2.2 + 0.32 * Math.sin(t * Math.PI)]); } pts.push([za, 2.2]);",
            "const pts = [[za, y0], [zb, y0], [zb, y0 - 0.4]]; for (let j = 1; j < 16; j++) { const t = j / 16; pts.push([zb + (za - zb) * t, y0 - 0.4 + 0.32 * Math.sin(t * Math.PI)]); } pts.push([za, y0 - 0.4]);")
C = sub(C, "box(G.map, ax - 0.2, ax + 0.2, 2.95, 3.05, s.z0, s.z1, mats.plasterW);", "box(G.map, ax - 0.2, ax + 0.2, s.h - 0.05, s.h + 0.05, s.z0, s.z1, mats.plasterW);")
C = sub(C, "bx(t, G.decor, 25.6, 26, 0, 2.6, z1 - 0.12, z1 + 0.12, mats.plasterW);", "bx(t, G.decor, 25.6, 26, 0, 3.4, z1 - 0.12, z1 + 0.12, mats.plasterW); bx(t, G.decor, 25.9, 26, 2.6, 3.4, z0, z1, mats.plasterW, { cast: false });")
C = sub(C, "W2(t, 19.9, 4.3, zc), 0, true); sg.castShadow = true;", "W2(t, 19.9, 5.1, zc), 0, true); sg.castShadow = true;")
C = sub(C, "bx(t, G.decor, 20.21, 20.29, 3.0, 5.6, zc - 0.04, zc + 0.04, mats.iron);", "bx(t, G.decor, 20.21, 20.29, 3.8, 6.4, zc - 0.04, zc + 0.04, mats.iron);")
C = sub(C, "lanterns(P(20.3, 4.4, 27.8), P(-5, 3.0, 24.5), 0.6, 8);", "lanterns(P(20.3, 5.2, 27.8), P(-5, 3.0, 24.5), 0.6, 8);")
# dragon boat sits on the deeper canal bed
C = sub(C, "const tm = t ? mats.greenTiles : mats.red, z = 0.8, y = -1.1;", "const tm = t ? mats.greenTiles : mats.red, z = 0.8, y = -1.5;")
# outside paving: the game lays its own (it also forms the canal walls outside the arena)
a = C.index("  // street paving outside the park (with the canal cut through it)"); b = C.index("  // tea houses behind the spawn terraces, rows at the far ends")
C = C[:a] + C[b:]

out = """/* GENERATED by tools/gen-canton-design.py from the approved design draft (docs/design/src) — do not edit by hand.
   西關大屋: every prop, sign, shop front, tree and the town outside is built by the draft's own code, so the game shows what was approved.
   Left to the game: the blocks people stand on and ink (ground, walls, slopes) — it draws those with the draft's textures. */
""" + data + "\nlet GZT_;\nfunction cantonGZT() { return GZT_ || (GZT_ = (() => {\n" + tex.replace("const GZT = (() => {", "return (() => {", 1) + "\n})()); }\n" + """
// builds the draft's scene; returns a group whose y = 0 is street level
function cantonDesign() {
  const GZT = cantonGZT(), M = GZ, { T, rnd, rr } = GZT;
  if (cantonDesign.seed === undefined) cantonDesign.seed = GZT.seed(); else GZT.seed(cantonDesign.seed);     // same random scatter every time the map is built
  const G = { map: new THREE.Group(), decor: new THREE.Group(), env: new THREE.Group() }, rootG = new THREE.Group(); rootG.add(G.map, G.decor, G.env);
  let CUR = null;
""" + A + "\n  const { XH, ZH, CANAL } = M;\n" + C + """
  rootG.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && 'envMapIntensity' in m) m.envMapIntensity = 0; }); });
  return { root: rootG, G, mats };
}
"""
open(os.path.join(root, 'src', 'js', '03b_canton_design.js'), 'w', encoding='utf-8').write(out)
print('wrote 03b_canton_design.js', len(out), 'bytes')
