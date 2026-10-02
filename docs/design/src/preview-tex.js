/* procedural textures for the Canton Arcade preview (all drawn in code, like the game) */
const GZT = (() => {
  let seed = 7;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
  function ctex(w, h, fn, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); fn(g, w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.canvas = c; return t;
  }
  const speckle = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rr(0.02, a)})`; g.fillRect(rnd() * w, rnd() * h, rr(1, 3), rr(1, 3)); } };
  const T = {};
  // 麻石: long granite street slabs laid in running courses (one texture = 4 m)
  T.granite = ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#b7b0a3'; g.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rr(0, 120);
      while (x < w) { const L = rr(110, 220); g.fillStyle = shade('#b9b2a5', rr(-0.05, 0.04)); g.fillRect(x + 2, r * rh + 2, L - 4, rh - 4); x += L; }
    }
    speckle(g, w, h, 9000, 0.12);
    g.strokeStyle = 'rgba(70,64,56,.55)'; g.lineWidth = 2.5;
    for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * rh); g.lineTo(w, r * rh); g.stroke(); }
  });
  // lighter dressed granite for bridges, the paifang, plinths
  T.stone = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#d7d1c4'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { g.fillStyle = shade('#d6d0c3', rr(-0.04, 0.03)); g.fillRect(c * 128 + (r % 2) * 64 - 64 + 2, r * 64 + 2, 124, 60); g.fillRect(c * 128 + (r % 2) * 64 + 192 + 2 - 256, r * 64 + 2, 124, 60); }
    speckle(g, w, h, 4000, 0.1);
    g.strokeStyle = 'rgba(90,84,76,.4)'; g.lineWidth = 2; for (let r = 0; r <= 4; r++) { g.beginPath(); g.moveTo(0, r * 64); g.lineTo(w, r * 64); g.stroke(); }
  });
  // canal wall: big rough granite blocks, damp and mossy toward the water
  T.canal = ctex(512, 256, (g, w, h) => {
    g.fillStyle = '#8a857a'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) { let x = -rr(0, 80); while (x < w) { const L = rr(70, 150); g.fillStyle = shade('#8b867b', rr(-0.06, 0.05)); g.fillRect(x + 3, r * 64 + 3, L - 6, 58); x += L; } }
    speckle(g, w, h, 5000, 0.15);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(40,60,40,.15)'); gr.addColorStop(1, 'rgba(40,70,45,.55)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  // 青砖: grey-blue water-polished bricks with thin light mortar (texture = 2 m)
  T.brick = ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#9b9d97'; g.fillRect(0, 0, w, h);
    const bw = 64, bh = 20;
    for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) {
      const x = c * bw + (r % 2) * bw / 2; g.fillStyle = shade('#69737a', rr(-0.05, 0.05)); g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
    speckle(g, w, h, 6000, 0.08);
  });
  // 阶砖: red quarry tiles on roof terraces (texture = 2.4 m, 30 cm tiles)
  T.terrace = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9b9a4'; g.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = shade('#b4553c', rr(-0.06, 0.05)); g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3); }
    speckle(g, w, h, 3000, 0.1);
  });
  // 瓦: grey pan-and-roll roof tiles
  T.tiles = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#5d6266'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#4b5054'); gr.addColorStop(0.5, '#8a9095'); gr.addColorStop(1, '#4b5054'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); }
    for (let y = 0; y < h; y += 22) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, w, 3); }
  });
  T.greenTiles = ctex(128, 128, (g, w, h) => {
    for (let x = 0; x < w; x += 12) { const gr = g.createLinearGradient(x, 0, x + 12, 0); gr.addColorStop(0, '#1f6a4a'); gr.addColorStop(0.5, '#4fae7c'); gr.addColorStop(1, '#1f6a4a'); g.fillStyle = gr; g.fillRect(x, 0, 12, h); }
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, y, w, 2); }
  });
  T.wood = ctex(128, 256, (g, w, h) => {
    g.fillStyle = '#6e3220'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${rnd() < 0.5 ? '30,10,5' : '150,80,50'},${rr(0.05, 0.25)})`; g.lineWidth = rr(1, 3); g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.bezierCurveTo(x + rr(-8, 8), h / 3, x + rr(-8, 8), h * 2 / 3, x + rr(-6, 6), h); g.stroke(); }
  });
  T.bamboo = ctex(128, 64, (g, w, h) => { g.fillStyle = '#c9a463'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 6) { g.fillStyle = `rgba(90,60,20,${rr(0.1, 0.3)})`; g.fillRect(x, 0, 1.5, h); } g.fillStyle = '#8e6a32'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); });
  // 满洲窗: coloured glass in a white lattice
  const MANCHU = ['#d8432f', '#2f6fc0', '#f0c419', '#3f9b55', '#e9e4d8'];
  const manchu = (g, x0, y0, w, h, n = 4, m = 4) => {
    g.fillStyle = '#5a2f1c'; g.fillRect(x0, y0, w, h);
    const fr = Math.max(2, Math.min(w, h) * 0.03), cw = (w - fr) / n, ch = (h - fr) / m;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const ex = i === 0 || i === n - 1, ey = j === 0 || j === m - 1;
      g.fillStyle = ex && ey ? '#c53a2b' : ex ? '#2f66b0' : ey ? '#3a8f55' : (i + j) % 2 ? '#dfe9e6' : '#e9c64a';
      if (!ex && !ey && (i + j) % 2 === 0) g.globalAlpha = 0.85;
      g.fillRect(x0 + fr + i * cw, y0 + fr + j * ch, cw - fr, ch - fr); g.globalAlpha = 1;
      if (!ex && !ey) { g.strokeStyle = 'rgba(90,47,28,.55)'; g.lineWidth = 1; g.beginPath(); const cx = x0 + fr + i * cw + (cw - fr) / 2, cy = y0 + fr + j * ch + (ch - fr) / 2; g.moveTo(cx, cy - (ch - fr) / 2); g.lineTo(cx + (cw - fr) / 2, cy); g.lineTo(cx, cy + (ch - fr) / 2); g.lineTo(cx - (cw - fr) / 2, cy); g.closePath(); g.stroke(); }
    }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x0, y0, w, h * 0.3);
  };
  T.manchu = ctex(256, 256, (g, w, h) => { manchu(g, 0, 0, w, h, 6, 6); });
  // a qilou bay facade: 4 m wide, 12.8 m tall (shopfront, two upper floors with tall windows, decorated parapet)
  const FAC = [
    { base: '#ead7a6', trim: '#fbf4e1', shut: '#3d7f5a' },
    { base: '#e9b9ac', trim: '#fff3ec', shut: '#2f6b85' },
    { base: '#b9d9c2', trim: '#f4fbf5', shut: '#7a4a2a' },
    { base: '#efe7d6', trim: '#ffffff', shut: '#386e9a' },
    { base: '#bccfe1', trim: '#f6fafd', shut: '#3b6f4f' },
    { base: '#e4a670', trim: '#fff1e2', shut: '#2c5c74' },
    { base: '#a8573f', trim: '#e9dcc8', shut: '#2f5a43', brick: true },
    { base: '#d9d3c6', trim: '#fbfaf6', shut: '#8a3b2b' },
  ];
  const SHOPS = ['藥材', '金舖', '打銅', '綢緞', '茶莊', '當舖', '鐘錶', '香燭', '玉器', '海味', '鞋莊', '書局'];
  T.facade = FAC.map((f, k) => ctex(256, 820, (g, w, h) => {
    const px = w / 4; // pixels per metre
    const Y = m => h - m * px;
    g.fillStyle = f.base; g.fillRect(0, 0, w, h);
    if (f.brick) { for (let r = 0; r < h / 6; r++) for (let c = -1; c < w / 16 + 1; c++) { g.fillStyle = shade(f.base, rr(-0.06, 0.05)); g.fillRect(c * 16 + (r % 2) * 8 + 0.5, r * 6 + 0.5, 15, 5); } }
    speckle(g, w, h, 2500, 0.07);
    // pilasters
    g.fillStyle = f.trim; g.fillRect(0, Y(12.2), 14, 12.2 * px - 4.4 * px); g.fillRect(w - 14, Y(12.2), 14, 12.2 * px - 4.4 * px);
    // floor bands / cornices
    [[4.4, 0.35], [7.8, 0.25], [11.2, 0.4]].forEach(([y, t]) => { g.fillStyle = f.trim; g.fillRect(0, Y(y + t), w, t * px); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, Y(y), w, 3); });
    // parapet: baroque pediment or balustrade
    if (k % 2 === 0) { g.fillStyle = f.trim; g.beginPath(); g.moveTo(10, Y(11.6)); g.quadraticCurveTo(w / 2, Y(13.6), w - 10, Y(11.6)); g.lineTo(w - 10, Y(11.2)); g.lineTo(10, Y(11.2)); g.fill(); g.fillStyle = f.base; g.beginPath(); g.arc(w / 2, Y(11.75), 0.35 * px, 0, Math.PI * 2); g.fill(); }
    else { for (let x = 18; x < w - 18; x += 14) { g.fillStyle = f.trim; g.fillRect(x, Y(12.3), 8, 0.9 * px); } g.fillRect(10, Y(12.5), w - 20, 6); }
    // upper windows with manchu fanlights and louvred shutters
    [4.9, 8.3].forEach(y0 => {
      [0.55, 2.35].forEach(x0 => {
        const X = x0 * px, W = 1.1 * px, H = 2.5 * px, top = Y(y0 + 2.5);
        g.fillStyle = f.trim; g.fillRect(X - 5, top - 5, W + 10, H + 10);
        g.fillStyle = '#26303a'; g.fillRect(X, top + 0.8 * px, W, H - 0.8 * px);
        manchu(g, X, top, W, 0.8 * px, 3, 2);
        g.fillStyle = f.shut; for (let s = 0; s < 2; s++) { const sx = s ? X + W * 0.62 : X; g.fillRect(sx, top + 0.85 * px, W * 0.38, H - 0.85 * px); g.fillStyle = 'rgba(0,0,0,.25)'; for (let l = 0; l < 14; l++) g.fillRect(sx, top + 0.95 * px + l * 6, W * 0.38, 1.5); g.fillStyle = f.shut; }
      });
      g.fillStyle = 'rgba(30,30,30,.85)'; for (let x = 0.4 * px; x < w - 0.4 * px; x += 7) g.fillRect(x, Y(y0 + 0.9), 2, 0.9 * px); g.fillRect(0.4 * px, Y(y0 + 0.95), w - 0.8 * px, 3);
    });
    // shopfront
    g.fillStyle = '#2a2622'; g.fillRect(16, Y(3.4), w - 32, 3.4 * px);
    g.fillStyle = 'rgba(255,214,140,.45)'; g.fillRect(24, Y(3.0), w - 48, 2.2 * px);
    g.fillStyle = '#3a312a'; for (let x = 24; x < w - 24; x += 18) g.fillRect(x, Y(3.0), 3, 2.2 * px);
    g.fillStyle = '#1d2a22'; g.fillRect(16, Y(4.25), w - 32, 0.75 * px);
    g.fillStyle = '#f2d27a'; g.font = `900 ${0.5 * px}px "Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","Songti SC","STSong",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#c9b06a'; g.fillRect(w / 2 - 34, Y(3.9), 68, 3);
  }));
  // inner arcade wall: shopfronts under the colonnade (texture = 8 m wide, 2.6 m tall)
  T.shopfront = ctex(1024, 340, (g, w, h) => {
    g.fillStyle = '#e8dcc2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) {
      const x = i * w / 2 + 30, W = w / 2 - 60;
      g.fillStyle = '#2a2420'; g.fillRect(x, 70, W, h - 70);
      g.fillStyle = 'rgba(255,205,120,.5)'; g.fillRect(x + 14, 90, W - 28, h - 110);
      g.fillStyle = '#5b2d1e'; for (let b = 0; b < 9; b++) g.fillRect(x + 6, 100 + b * 26, W - 12, 7);
      g.fillStyle = '#1e3326'; g.fillRect(x, 12, W, 52);
      g.fillStyle = '#f4d27d'; g.font = '900 38px "Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","Songti SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['泼泼凉茶', '飞溅糖水', '墨记云吞', '浪记烧腊'][i + (rnd() < 0.5 ? 0 : 2)], x + W / 2, 40);
    }
  });
  // vertical shop sign
  T.sign = (text, bg = '#1e3326', fg = '#f4d27d') => ctex(96, 96 * Math.max(3, text.length) * 0.9, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = `900 ${w * 0.62}px "Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","Songti SC","STSong",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = text.length; [...text].forEach((ch, i) => g.fillText(ch, w / 2, (i + 0.5) * h / n));
  });
  T.plaque = (text, bg = '#1b1b1f', fg = '#e6bf5a') => ctex(512, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    let px = 96; g.font = `900 ${px}px "Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","Songti SC","STSong",serif`; while (g.measureText(text).width > w - 70 && px > 20) { px -= 4; g.font = `900 ${px}px "Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","Songti SC","STSong",serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
  // big tea-house facade at the spawn ends
  T.teahouse = ctex(1024, 640, (g, w, h) => {
    g.fillStyle = '#e9d9b4'; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, 0.06);
    for (let fl = 0; fl < 3; fl++) for (let c = 0; c < 8; c++) {
      const x = 40 + c * 120, y = 70 + fl * 150; g.fillStyle = '#f8f0dc'; g.fillRect(x - 6, y - 6, 92, 122);
      manchu(g, x, y, 80, 110, 4, 5);
    }
    g.fillStyle = '#f8f0dc'; for (let y of [55, 205, 355, 505]) g.fillRect(0, y, w, 8);
    g.fillStyle = '#8a1f1a'; g.fillRect(260, 0, 500, 52); g.fillStyle = '#f6d36b'; g.font = '900 42px "Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","Songti SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('浪 花 茶 楼', w / 2, 28);
    g.fillStyle = '#2a2420'; g.fillRect(0, 520, w, 120); g.fillStyle = 'rgba(255,200,120,.5)'; for (let c = 0; c < 6; c++) g.fillRect(40 + c * 165, 545, 120, 80);
  });
  // ripple for the canal water
  T.water = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#4c8c84'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${rnd() < 0.5 ? '210,240,230' : '20,60,60'},${rr(0.05, 0.22)})`; g.lineWidth = rr(1, 2.5); const x = rnd() * w, y = rnd() * h, L = rr(8, 40); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y - rr(1, 4), x + L, y); g.stroke(); }
  });
  // ink splats for the paint-readability test (orange team 0 at +z, blue team 1 at -z), on a 52 x 104 canvas
  T.ink = (XH, ZH, mask) => ctex(512, 1024, (g, w, h) => {
    const toPx = (x, z) => [(x + XH) / (2 * XH) * w, (z + ZH) / (2 * ZH) * h];
    const blob = (x, z, r, col) => {
      const [px, pz] = toPx(x, z), pr = r / (2 * XH) * w; g.fillStyle = col; g.beginPath();
      const n = 14; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr2 = pr * (0.7 + rnd() * 0.5); g[i ? 'lineTo' : 'moveTo'](px + Math.cos(a) * rr2, pz + Math.sin(a) * rr2); } g.fill();
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(px + (rnd() - 0.5) * pr * 3, pz + (rnd() - 0.5) * pr * 3, pr * rr(0.1, 0.25), 0, Math.PI * 2); g.fill(); }
    };
    for (let i = 0; i < 520; i++) {
      const x = rr(-XH, XH), z = rr(-ZH, ZH); if (!mask(x, z)) continue;
      const t0 = z > 0 ? 0.72 : 0.3; blob(x, z, rr(0.6, 1.8), rnd() < t0 ? '#ff7a00' : '#3346ff');
    }
  });

  // ---------------- v2: real shops, each with its own frontage (texture = the whole shop, 2.6 m tall, 96 px per metre)
  const SERIF = '"Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","Songti SC","STSong",serif';
  const SANS = '"Noto Sans CJK TC","Noto Sans CJK SC","PingFang TC","PingFang SC","Heiti TC",sans-serif';
  const txt = (g, t, x, y, px, col, font = SERIF, align = 'center', w = 900, maxW = 0) => { g.fillStyle = col; g.font = `${w} ${px}px ${font}`; if (maxW) { let k = 0; while (g.measureText(t).width > maxW && k++ < 60) { px *= 0.95; g.font = `${w} ${px}px ${font}`; } } g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y); };
  const vtxt = (g, t, x, y0, px, col, font = SERIF) => { [...t].forEach((c, i) => txt(g, c, x, y0 + (i + 0.5) * px * 1.08, px, col, font)); };
  const tiles = (g, x, y, w, h, s, c1, c2) => { for (let i = 0; i * s < w; i++) for (let j = 0; j * s < h; j++) { g.fillStyle = (i + j) % 2 ? c1 : c2; g.fillRect(x + i * s, y + j * s, Math.min(s, w - i * s) - 1, Math.min(s, h - j * s) - 1); } };
  const PXM = 96;
  const SHOPFACE = {
    // 黃振龍涼茶: open counter, a row of brass gourd urns, covered bowls, the price board of herbal teas
    hzl(g, w, h) {
      g.fillStyle = '#efe6c8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0f5a3a'; g.fillRect(0, 0, w, 62); g.fillStyle = '#f2c230'; g.fillRect(0, 62, w, 5);
      txt(g, '黃振龍涼茶', w / 2, 33, 44, '#f6d443'); txt(g, '始創於一九四〇年代', w - 96, 36, 14, '#f6d443', SANS, 'center', 700);
      g.fillStyle = '#3a2a1c'; g.fillRect(20, 78, w - 40, 96);                          // shelf wall of herb drawers
      for (let i = 0; i < Math.floor((w - 60) / 30); i++) for (let j = 0; j < 3; j++) { g.fillStyle = '#6b4a2c'; g.fillRect(28 + i * 30, 84 + j * 30, 26, 26); g.fillStyle = '#d9b36a'; g.fillRect(38 + i * 30, 95 + j * 30, 6, 4); }
      g.fillStyle = '#0f5a3a'; g.fillRect(0, 174, w, 82); g.fillStyle = '#f2c230'; g.fillRect(0, 174, w, 6);   // counter
      for (let i = 0; i < 3; i++) { const x = 90 + i * (w - 180) / 2;                       // brass gourds
        const gr = g.createRadialGradient(x - 8, 135, 2, x, 140, 30); gr.addColorStop(0, '#ffe9a0'); gr.addColorStop(1, '#a8741c'); g.fillStyle = gr;
        g.beginPath(); g.arc(x, 150, 24, 0, 7); g.fill(); g.beginPath(); g.arc(x, 118, 15, 0, 7); g.fill(); g.fillRect(x - 4, 96, 8, 10); g.fillStyle = '#7a1d18'; g.fillRect(x - 12, 128, 24, 5); }
      for (let i = 0; i < Math.floor((w - 60) / 46); i++) { const x = 40 + i * 46; if (Math.abs((x - 90) % ((w - 180) / 2)) < 34) continue; g.fillStyle = '#fbfaf2'; g.beginPath(); g.ellipse(x, 168, 16, 7, 0, 0, 7); g.fill(); g.fillStyle = '#3b2412'; g.beginPath(); g.ellipse(x, 166, 12, 4, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(200,230,240,.7)'; g.fillRect(x - 15, 158, 30, 3); }
      ['斑痧涼茶', '廿四味', '五花茶', '龜苓膏', '酸梅湯', '羅漢果'].forEach((t, i) => { const x = 46 + i * (w - 92) / 5; g.fillStyle = '#f6efd2'; g.fillRect(x - 17, 190, 34, 62); vtxt(g, t, x, 192, 13.5, '#7a1d18'); });
    },
    // 源記腸粉 (華貴路): white-tiled street shop, the pull-drawer steam cabinet in an open kitchen window, red menu strips
    yuanji(g, w, h) {
      tiles(g, 0, 0, w, h, 16, '#f4f4ee', '#e9ebe4');
      g.fillStyle = '#fffdf4'; g.fillRect(0, 0, w, 62); g.strokeStyle = '#c0261c'; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, 54);
      txt(g, '源記腸粉', w / 2 - 60, 33, 44, '#c0261c'); txt(g, '華貴路老舖', w / 2 + 120, 26, 16, '#c0261c', SANS, 'center', 700); txt(g, '腸粉泰斗', w / 2 + 120, 46, 15, '#1f1f1f', SERIF);
      g.fillStyle = '#20262b'; g.fillRect(24, 78, w * 0.46, 120); g.fillStyle = '#c9d2d6'; g.fillRect(40, 96, w * 0.46 - 32, 96);          // steam cabinet
      for (let j = 0; j < 4; j++) { g.fillStyle = '#9aa7ad'; g.fillRect(46, 102 + j * 23, w * 0.46 - 44, 19); g.fillStyle = '#5c676d'; g.fillRect(40 + (w * 0.46 - 32) / 2 - 16, 109 + j * 23, 32, 4); }
      for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(255,255,255,${0.12 + (i % 3) * 0.08})`; g.beginPath(); g.arc(60 + i * (w * 0.46 - 60) / 8, 84 - (i % 2) * 6, 13, 0, 7); g.fill(); }
      g.fillStyle = '#b8c0c4'; g.fillRect(24, 198, w * 0.46, 58);
      const mx = w * 0.56; ['鮮蝦腸', '牛肉腸', '豬肝腸', '叉燒腸', '艇仔粥', '牛肉粥'].forEach((t, i) => { const x = mx + i * (w - mx - 24) / 5; g.fillStyle = '#c0261c'; g.fillRect(x - 14, 82, 28, 84); vtxt(g, t, x, 86, 16, '#fff8e0'); });
      g.fillStyle = '#5a3a22'; for (let i = 0; i < 3; i++) { const x = mx + 20 + i * (w - mx - 60) / 2; g.fillRect(x - 22, 196, 44, 6); g.fillRect(x - 3, 202, 6, 54); g.fillRect(x - 16, 224, 12, 32); g.fillRect(x + 6, 224, 12, 32); }
    },
    // 明記腸粉 (龍津西路, since 1981): yellow light-box sign, tables and stools seen through the open front, the boat-congee board
    mingji(g, w, h) {
      g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5c518'; g.fillRect(0, 0, w, 62); g.fillStyle = '#b3201a'; g.fillRect(0, 58, w, 6);
      txt(g, '西關明記腸粉', w / 2, 32, 42, '#b3201a'); txt(g, '1981', 46, 34, 18, '#b3201a', SANS); txt(g, '荔枝灣', w - 56, 34, 17, '#b3201a', SERIF);
      g.fillStyle = '#3a2c22'; g.fillRect(18, 76, w - 36, 180); g.fillStyle = 'rgba(255,214,150,.35)'; g.fillRect(18, 76, w - 36, 180);
      for (let i = 0; i < Math.floor((w - 60) / 120); i++) { const x = 80 + i * 120; g.fillStyle = '#f3ead6'; g.beginPath(); g.ellipse(x, 196, 42, 12, 0, 0, 7); g.fill(); g.fillStyle = '#8a5a34'; g.fillRect(x - 4, 200, 8, 50); g.fillStyle = '#c0392b'; [-34, 34].forEach(d => { g.beginPath(); g.ellipse(x + d, 226, 12, 5, 0, 0, 7); g.fill(); g.fillRect(x + d - 2, 228, 4, 26); }); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, 192, 20, 5, 0, 0, 7); g.fill(); }
      g.fillStyle = '#1e3326'; g.fillRect(30, 84, w - 60, 46); ['牛腩腸粉', '艇仔粥', '乾炒牛河', '鹹蛋黃蝦仁腸', '雙皮奶'].forEach((t, i) => txt(g, t, 30 + (i + 0.5) * (w - 60) / 5, 108, 19, '#f6e7a8'));
      for (let i = 0; i < 5; i++) { g.strokeStyle = '#d8c79a'; g.lineWidth = 2; g.beginPath(); g.moveTo(60 + i * (w - 120) / 4, 76); g.lineTo(60 + i * (w - 120) / 4, 84); g.stroke(); }
    },
    // 南信牛奶甜品專家 (第十甫路): red board with gold characters, white tiles, bowls of double-skin milk in a glass case
    nanxin(g, w, h) {
      tiles(g, 0, 0, w, h, 20, '#fbfbf6', '#eef3f1');
      g.fillStyle = '#a3171a'; g.fillRect(0, 0, w, 62); g.strokeStyle = '#e8c15a'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, 50);
      txt(g, '南信牛奶甜品專家', w / 2, 32, 38, '#f1cf6b');
      g.fillStyle = 'rgba(190,225,235,.55)'; g.fillRect(24, 132, w * 0.5, 70); g.strokeStyle = '#8fa3aa'; g.lineWidth = 3; g.strokeRect(24, 132, w * 0.5, 70);
      for (let i = 0; i < 7; i++) { const x = 52 + i * (w * 0.5 - 56) / 6; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, 184, 17, 9, 0, 0, 7); g.fill(); g.fillStyle = '#fff6d8'; g.beginPath(); g.ellipse(x, 181, 13, 5, 0, 0, 7); g.fill(); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(x, 180, 2.5, 0, 7); g.fill(); }
      g.fillStyle = '#a3171a'; g.fillRect(24, 202, w * 0.5, 54);
      ['雙皮奶', '薑撞奶', '鳳凰奶糊', '牛三星'].forEach((t, i) => { const x = w * 0.6 + i * (w * 0.4 - 30) / 3; g.fillStyle = '#fff'; g.strokeStyle = '#a3171a'; g.lineWidth = 3; g.fillRect(x - 17, 80, 34, 96); g.strokeRect(x - 17, 80, 34, 96); vtxt(g, t, x, 84, 19, '#a3171a'); });
      g.fillStyle = '#2b2b2b'; g.fillRect(w * 0.56, 190, w * 0.44 - 20, 66); g.fillStyle = 'rgba(255,220,160,.4)'; g.fillRect(w * 0.56, 190, w * 0.44 - 20, 66);
    },
    // 陳添記 (十五甫三巷): a back-lane shop — hand-painted red board, green timber shutters, plates of fish skin on a steel counter
    chentianji(g, w, h) {
      g.fillStyle = '#cfc9b8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(90,80,60,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
      g.fillStyle = '#f7f1dc'; g.fillRect(14, 4, w - 28, 56); txt(g, '陳添記', w / 2 - 110, 33, 46, '#b3201a'); txt(g, '祖傳爽魚皮', w / 2 + 90, 24, 22, '#b3201a'); txt(g, '西關老字號', w / 2 + 90, 48, 15, '#1f1f1f', SANS, 'center', 700);
      g.fillStyle = '#2f6b4f'; [[18, 70], [w - 18 - 70, 70]].forEach(([x, ww]) => { g.fillRect(x, 74, ww, 182); g.fillStyle = '#245640'; for (let j = 0; j < 12; j++) g.fillRect(x + 6, 82 + j * 14, ww - 12, 4); g.fillStyle = '#2f6b4f'; });
      g.fillStyle = '#26221e'; g.fillRect(96, 74, w - 192, 182);
      g.fillStyle = '#c4ccd0'; g.fillRect(96, 168, w - 192, 88); g.fillStyle = '#e6ebee'; g.fillRect(96, 168, w - 192, 8);
      for (let i = 0; i < Math.floor((w - 230) / 58); i++) { const x = 130 + i * 58; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, 164, 24, 8, 0, 0, 7); g.fill(); g.fillStyle = '#d8d2bd'; for (let k = 0; k < 6; k++) g.fillRect(x - 16 + k * 5, 154 + (k % 2) * 3, 4, 8); g.fillStyle = '#4c9a4a'; g.fillRect(x - 6, 152, 12, 3); }
      ['魚皮', '艇仔粥', '豬腸粉'].forEach((t, i) => { g.fillStyle = '#f7f1dc'; g.fillRect(110 + i * 46, 84, 34, 70); vtxt(g, t, 127 + i * 46, 88, 18, '#b3201a'); });
    },
    // 皇上皇臘味 (下九路, 1940): red-and-gold board, rows of cured sausages hanging over glass counters
    hsh(g, w, h) {
      g.fillStyle = '#f3e7c6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c11a1f'; g.fillRect(0, 0, w, 66); g.fillStyle = '#f3c63c'; g.fillRect(0, 62, w, 5);
      const cx = w / 2 - 150; g.fillStyle = '#f3c63c'; g.beginPath(); g.moveTo(cx - 22, 46); g.lineTo(cx - 22, 22); g.lineTo(cx - 10, 34); g.lineTo(cx, 16); g.lineTo(cx + 10, 34); g.lineTo(cx + 22, 22); g.lineTo(cx + 22, 46); g.fill();
      txt(g, '皇上皇', w / 2 - 40, 34, 48, '#f6d24a'); txt(g, '臘味', w / 2 + 90, 34, 36, '#fff3c4'); txt(g, '始創一九四〇', w - 80, 36, 14, '#fff3c4', SANS, 'center', 700);
      g.fillStyle = '#5a3a22'; g.fillRect(16, 82, w - 32, 6);
      for (let i = 0; i < Math.floor((w - 40) / 13); i++) { const x = 22 + i * 13, L = 70 + (i % 5) * 7; g.strokeStyle = '#d9c9a0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 88); g.lineTo(x, 96); g.stroke(); g.fillStyle = i % 4 === 0 ? '#5a1f1a' : i % 3 === 0 ? '#8e2a22' : '#a8382a'; g.fillRect(x - 3.5, 96, 7, L); g.fillStyle = 'rgba(255,230,200,.25)'; g.fillRect(x - 3.5, 96, 2, L); }
      g.fillStyle = 'rgba(190,225,235,.5)'; g.fillRect(16, 188, w - 32, 34); g.fillStyle = '#c11a1f'; g.fillRect(16, 222, w - 32, 34); txt(g, '臘腸　臘肉　臘鴨　秋風起　食臘味', w / 2, 240, 18, '#f6d24a');
    },
    // 吳系茶餐廳: Hong Kong style café — the red-white-blue of the woven carrier bag, a folding iron gate, booth seats, the menu wall
    wuxi(g, w, h) {
      const cols = ['#c8202a', '#ffffff', '#1f4fa3', '#ffffff']; for (let i = 0; i * 14 < w; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * 14, 0, 14, h); }
      g.fillStyle = '#c8202a'; g.fillRect(0, 0, w, 62); g.fillStyle = '#1f4fa3'; g.fillRect(0, 58, w, 6); txt(g, '吳系茶餐廳', w / 2, 32, 40, '#ffffff', SERIF, 'center', 900, w - 60);
      g.fillStyle = '#20262b'; g.fillRect(w * 0.08, 74, w * 0.84, h - 74); g.fillStyle = 'rgba(255,214,150,.38)'; g.fillRect(w * 0.08, 74, w * 0.84, h - 74);
      for (let i = 0; i < 3; i++) { const x = w * 0.16 + i * w * 0.17; g.fillStyle = '#2f6b4f'; g.fillRect(x - 30, 150, 60, 62); g.fillStyle = '#245640'; g.fillRect(x - 30, 150, 60, 8); g.fillStyle = '#e9e2cf'; g.fillRect(x - 22, 176, 44, 6); g.fillStyle = '#7a5a34'; g.fillRect(x - 3, 182, 6, 30); }
      ['菠蘿油', '絲襪奶茶', '燒鵝飯', '雲吞麵', '八寶飯'].forEach((t2, i) => { const x = w * 0.6 + i * w * 0.062; g.fillStyle = i % 2 ? '#ffffff' : '#fff3d0'; g.fillRect(x - 12, 82, 24, 92); vtxt(g, t2, x, 86, 15, i % 2 ? '#1f4fa3' : '#c8202a'); });
      g.strokeStyle = '#8f979c'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { const x = w * 0.84 + i * 9; g.beginPath(); g.moveTo(x, 74); g.lineTo(x, h); g.stroke(); for (let y = 84; y < h; y += 18) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 9, y + 9); g.lineTo(x, y + 18); g.stroke(); } }
      g.fillStyle = '#c8202a'; g.fillRect(w * 0.08, h - 30, w * 0.74, 30); txt(g, '港式燒味　即叫即做', w * 0.45, h - 14, 16, '#fff', SANS, 'center', 700, w * 0.7);
    },
    // 廣州酒家 (文昌南路, 1935): dark-red board with gold characters, "食在廣州第一家", a round moon-gate entrance, manchu windows
    gzjj(g, w, h) {
      g.fillStyle = '#efe4c6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a1512'; g.fillRect(0, 0, w, 66); g.strokeStyle = '#f3d98a'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, 54); txt(g, '廣州酒家', w / 2, 34, 46, '#f3d98a', SERIF, 'center', 900, w - 80);
      const cx = w / 2; g.fillStyle = '#7a1512'; g.fillRect(cx - 86, 84, 172, h - 84); g.fillStyle = '#231c16'; g.beginPath(); g.arc(cx, 176, 70, 0, 7); g.fill(); g.fillRect(cx - 44, 176, 88, h - 176);
      g.strokeStyle = '#f3d98a'; g.lineWidth = 5; g.beginPath(); g.arc(cx, 176, 72, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,205,130,.4)'; g.beginPath(); g.arc(cx, 176, 62, 0, 7); g.fill();
      [w * 0.14, w * 0.86].forEach(x => { g.fillStyle = '#f8f2e3'; g.fillRect(x - 54, 88, 108, 122); manchu(g, x - 48, 94, 96, 110, 4, 5); });
      [[cx - 112, '食在廣州'], [cx + 112, '第一家']].forEach(([x, t2]) => { g.fillStyle = '#141210'; g.fillRect(x - 15, 84, 30, t2.length * 24 + 10); vtxt(g, t2, x, 88, 21, '#f3d98a'); });
      g.fillStyle = '#7a1512'; g.fillRect(0, h - 26, w, 26); txt(g, '文昌雞　蝦餃　月餅　始創一九三五', w / 2, h - 12, 15, '#f3d98a', SANS, 'center', 700, w - 30);
    },
  };
  T.shopFace = (key, wm, hm = 2.6) => { const t = ctex(Math.round(wm * PXM), Math.round(hm * PXM), (g, w, h) => { g.save(); g.scale(1, h / 256); SHOPFACE[key](g, w, 256); g.restore(); }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  // the two tea houses behind the spawns: 陶陶居 (black-lacquer board, gold characters) and 蓮香樓
  T.teaFace = (name, wm, hm, o) => { const t = ctex(Math.round(wm * 28), Math.round(hm * 28), (g, w, h) => {
    const P = 28, Y = m => h - m * P; g.fillStyle = o.wall; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, 0.05);
    const bays = Math.round(wm / 4.5), bw = w / bays;
    for (let b = 0; b < bays; b++) {
      g.fillStyle = o.trim; g.fillRect(b * bw, Y(hm), 9, h); g.fillRect((b + 1) * bw - 9, Y(hm), 9, h);
      for (let fl = 1; fl < Math.floor(hm / 3.6); fl++) { const y0 = fl * 3.6 + 0.9; g.fillStyle = o.trim; g.fillRect(b * bw + 14, Y(y0 + 2.2) - 4, bw - 28, 2.2 * P + 8); manchu(g, b * bw + 18, Y(y0 + 2.2), bw - 36, 2.2 * P, 6, 4); g.fillStyle = o.rail; g.fillRect(b * bw + 9, Y(y0 - 0.1), bw - 18, 0.75 * P); for (let k = 0; k < 9; k++) { g.fillStyle = o.trim; g.fillRect(b * bw + 16 + k * (bw - 32) / 8, Y(y0 - 0.15), 3, 0.6 * P); } }
      g.fillStyle = '#241c16'; g.fillRect(b * bw + 14, Y(3.2), bw - 28, 3.2 * P); g.fillStyle = 'rgba(255,205,130,.42)'; g.fillRect(b * bw + 20, Y(3.0), bw - 40, 2.6 * P);
      g.fillStyle = o.col; g.fillRect(b * bw + 9, Y(3.5), 7, 3.5 * P); g.fillRect((b + 1) * bw - 16, Y(3.5), 7, 3.5 * P);
    }
    for (let fl = 1; fl <= Math.floor(hm / 3.6); fl++) { g.fillStyle = o.trim; g.fillRect(0, Y(fl * 3.6 + 0.1), w, 7); }
    const bwid = Math.min(w * 0.72, name.length * 96 + 70); g.fillStyle = o.board; g.fillRect(w / 2 - bwid / 2, Y(4.7), bwid, 1.3 * P + 22); g.strokeStyle = o.gold; g.lineWidth = 4; g.strokeRect(w / 2 - bwid / 2 + 5, Y(4.7) + 5, bwid - 10, 1.3 * P + 12);
    txt(g, name.split('').join(' '), w / 2, Y(4.7) + 31, 46, o.gold, SERIF, 'center', 900, bwid - 34);
    if (o.side) { [0.08, 0.92].forEach((u, i) => { g.fillStyle = o.board; g.fillRect(w * u - 16, Y(hm - 0.6), 32, o.side[i].length * 30 + 12); vtxt(g, o.side[i], w * u, Y(hm - 0.6) + 6, 25, o.gold); }); }
  }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  // weathered granite boulders for the Five Rams mound
  T.rock = ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#aaa59a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) { const x = rnd() * w, y = rnd() * h, r = rr(40, 110); const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 4, x, y, r); gr.addColorStop(0, shade('#c9c3b7', rr(-0.03, 0.04))); gr.addColorStop(1, shade('#a39d92', rr(-0.04, 0.03))); g.fillStyle = gr; g.beginPath(); const n = 9; for (let k = 0; k <= n; k++) { const a = k / n * 6.283, q = r * rr(0.75, 1.05); g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); } g.fill(); g.strokeStyle = 'rgba(70,64,56,.28)'; g.lineWidth = 2; g.stroke(); }
    speckle(g, w, h, 7000, 0.1);
  });
  return { T, rnd, rr, shade, MANCHU, SHOPS };
})();
