// Story image (1080×1920): today's study stats, or the last 7 days. Optional quote band and 5 colour themes.
(() => {
  const W = 1080, H = 1920;
  const PAL = [
    { bg: "#17181c", ink: "#ECEAE3", mut: "#A9A69D", dot: "#2a2b31", a: "#F2C200", af: "#111", b: "#B6FF00", bf: "#111" },
    { bg: "#F4EBD6", ink: "#111", mut: "#5d5a52", dot: "#e3d7bc", a: "#111", af: "#F4EBD6", b: "#F2C200", bf: "#111" },
    { bg: "#0E2A47", ink: "#F4F1E8", mut: "#a7bccf", dot: "#16365a", a: "#7cc4ff", af: "#0b1a2b", b: "#FF5A5F", bf: "#111" },
    { bg: "#2A2216", ink: "#F4EBD6", mut: "#c4b391", dot: "#352c1e", a: "#B6FF00", af: "#111", b: "#F2C200", bf: "#111" },
    { bg: "#C8102E", ink: "#fff", mut: "#ffd6d6", dot: "#b50e29", a: "#fff", af: "#C8102E", b: "#111", bf: "#fff" },
    { bg: "#14100a", ink: "#FFE7A3", mut: "#c9a75a", dot: "#241c0e", a: "#E8B931", af: "#14100a", b: "#FFE7A3", bf: "#14100a" },  // gold: legendary
  ];
  const THEME = ["Dark", "Cream", "Navy", "Mocha", "Red", "Gold"];
  const RAR = { common: [0, 1], rare: [2, 3], epic: [4], legendary: [5] };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const F = {
    num: s => `800 ${s}px 'Barlow Condensed'`, head: s => `${s}px 'Archivo Black'`,
    mono: (s, w = 400) => `${w} ${s}px 'JetBrains Mono'`, jp: (s, w = 700) => `${w} ${s}px 'Noto Sans JP'`,
  };
  // Latin labels use Archivo; Japanese UI labels need the JP font
  const lab = s => (LANG === "ja" ? F.jp(Math.round(s * 0.95)) : F.head(s));
  const sub = n => LANG === "ja" ? F.jp(n, 400) : F.mono(n);

  function txt(c, t, x, y, font, color, align = "left", max) {
    c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
    max ? c.fillText(t, x, y, max) : c.fillText(t, x, y);
  }
  // Tilted block with text, (x,y) = top-left. Returns its height.
  function plate(c, t, x, y, font, bg, fg, rot = 0, pad = 26) {
    c.font = font;
    const m = c.measureText(t), asc = m.actualBoundingBoxAscent, w = m.width + pad * 2, h = asc + m.actualBoundingBoxDescent + pad * 1.4;
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot * Math.PI / 180);
    c.fillStyle = bg; c.fillRect(-w / 2, -h / 2, w, h);
    c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(t, 0, -h / 2 + pad * 0.7 + asc);
    c.restore();
    return h;
  }
  function wrap(c, text, maxW) {
    const sep = text.includes(" ") ? " " : "", words = sep ? text.split(" ") : [...text], lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + sep + w : w;
      if (cur && c.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test;
    }
    return cur ? [...lines, cur] : lines;
  }
  // quote band under the (shrunken) card, above the footer: y 1375-1580
  function quoteBlock(c, p, q) {
    const x = 80, top = 1375, area = q.sub ? 118 : 150;
    let size = 46, lines;
    for (; size > 26; size -= 2) { c.font = F.jp(size, 700); lines = wrap(c, q.q, 880); if (lines.length * size * 1.25 <= area) break; }
    c.fillStyle = p.a; c.fillRect(x, top, 10, 205);
    lines.forEach((l, i) => txt(c, l, x + 36, top + size + i * size * 1.25, F.jp(size, 700), p.ink, "left", 880));
    if (q.sub) txt(c, q.sub, x + 36, top + area + 26, F.jp(26, 400), p.mut, "left", 880);
    txt(c, "— " + q.by, x + 36, top + 196, F.mono(26, 700), p.mut, "left", 880);
  }
  function background(c, p) {
    c.fillStyle = p.bg; c.fillRect(0, 0, W, H);
    c.fillStyle = p.dot;
    for (let y = 20; y < H; y += 40) for (let x = 20; x < W; x += 40) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
  }
  // IG story UI covers roughly the top 250px and bottom 250px: keep everything inside y 270–1650
  function frame(c, p, s) {
    plate(c, "日本語 · ARSENIUS", 80, 280, F.mono(34, 700), p.b, p.bf, -2, 20);
    txt(c, s.dateLabel, 1000, 330, F.mono(34, 700), p.ink, "right");
    txt(c, `⏱ ${s.hm} · 🔥 ${s.active}`, 1000, 380, F.mono(30, 700), p.mut, "right");
    txt(c, "arsenius-nihongo.vercel.app", 80, 1630, F.mono(28), p.mut);
    txt(c, `N2 まで あと ${s.daysN3} 日`, 1000, 1630, F.jp(34), p.ink, "right");
  }
  // one box of the stat grid
  function tile(c, p, x, y, v, l, on) {
    if (on) { c.fillStyle = p.a; c.fillRect(x, y, 440, 195); } else { c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(x, y, 440, 195); }
    txt(c, String(v), x + 32, y + 125, F.num(String(v).length > 6 ? 100 : 130), on ? p.af : p.ink, "left", 380);
    txt(c, l, x + 32, y + 172, sub(32), on ? p.af : p.mut, "left", 380);
  }

  // last 7 days, hours per day: consistency, not just today (y = caption baseline)
  function bars(c, p, s, y) {
    const y0 = y + 55, hMax = 110, mx = Math.max(60, ...s.week7.map(x => x[1]));
    txt(c, `${t("fx.week7")} · ${t("fx.total", { t: s.totalHm })}`, 80, y, sub(28), p.mut, "left", 920);
    s.week7.forEach(([d, m], i) => {
      const x = 80 + i * 134, h = Math.max(6, hMax * m / mx);
      c.fillStyle = i === 6 ? p.a : p.b; c.globalAlpha = m ? 1 : 0.25; c.fillRect(x, y0 + hMax - h, 110, h); c.globalAlpha = 1;
      txt(c, String(+d.slice(8)), x + 55, y0 + hMax + 38, F.mono(26), p.mut, "center");
    });
  }
  const LVC = [["#F2C200", "#111"], ["#FF5A5F", "#111"], ["#D1202F", "#fff"], ["#111", "#F2C200"]];
  const LVT = ["WARNING", "BEHIND", "CRITICAL ALERT", "CRITICAL ALERT"];
  const worstOf = s => s.prog.reduce((a, b) => b.lv > a.lv ? b : a);
  const T = {
    stats(c, p, s) {
      plate(c, "今日の勉強", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, s.hm, 80, 740, LANG === "ja" ? F.jp(170) : F.num(300), p.ink, "left", 920);
      txt(c, t("fx.studyToday") + (s.minEst ? " · " + t("fx.estNote") : ""), 80, 805, sub(32), p.mut, "left", 920);
      txt(c, s.hoursSub, 80, 850, sub(28), p.mut, "left", 920);
      // daily floor first (highlighted when met), then Anki, speaking (Talk · Duet · shadowing) and kanji met in Anki
      const sp = s.speak, floorOk = s.done === s.doneOf;
      [[`${s.done}/${s.doneOf}`, t(s.light ? "fx.t.light" : "fx.t.floor"), floorOk], [s.reviews, t("fx.t1")],
        [sp.min ? `${sp.min}m` : sp.n, t("fx.t.speak") + (sp.plays ? ` · ${sp.plays}×` : "")], [s.kanjiNew, t("fx.t.kanji")]]
        .forEach(([v, l, on], i) => tile(c, p, 80 + (i % 2) * 480, 910 + Math.floor(i / 2) * 215, v, l, !!on));
      // pace status strip (same level as the dashboard alert)
      const g = worstOf(s), ok = g.lv < 0, [bg, fg] = ok ? [p.b, p.bf] : LVC[g.lv];
      const ph = plate(c, ok ? "ON TRACK" : LVT[g.lv], 80, 1342, F.head(32), bg, fg, 0, 18);
      c.font = F.head(32);
      txt(c, `${g.name} ${g.integ}% · ${ok ? t("fx.st.on") : t("fx.st.short", { n: Math.ceil(g.r), u: t(g.unit) })}`, 80 + c.measureText(ok ? "ON TRACK" : LVT[g.lv]).width + 36 + 28, 1342 + ph * 0.7, sub(28), p.ink, "left", 600);
      // last 7 days, hours per day: consistency, not just today
      bars(c, p, s, 1450);
    },
    week(c, p, s) {
      const r = s.recap;
      plate(c, "今週のまとめ", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, t("fx.rc.sub"), 80, 560, sub(30), p.mut, "left", 920);
      txt(c, s.recapHm, 80, 790, LANG === "ja" ? F.jp(150) : F.num(260), p.ink, "left", 920);
      // quiz rounds are optional now: a small note under the hours instead of a row
      txt(c, t("fx.rc.hours") + (r.est ? " · " + t("fx.estNote") : "") + (r.rounds ? ` · ${t("fx.rc.rounds")} ${r.rounds}` + (r.avg != null ? ` (${r.avg}%)` : "") : ""), 80, 860, sub(32), p.mut, "left", 920);
      const sp = r.speak;
      [[t("fx.rc.floor", { z: r.zero }), `${r.floor}/${r.of}`], [t("fx.rc.kaishi"), r.kaishi], [t("fx.rc.reviews"), r.reviews], [t("fx.rc.kanji"), `${r.kanji}/${r.kanjiGoal}`],
        [t("fx.rc.speak") + (sp.plays ? ` · ${sp.plays}×` : ""), sp.min ? `${sp.n} · ${sp.min}m` : sp.n]].forEach(([l, v], i) => {
        const y = 960 + i * 125; c.strokeStyle = p.ink; c.lineWidth = 5; c.strokeRect(80, y, 920, 100);
        txt(c, l, 110, y + 64, lab(36), p.ink, "left", 560); txt(c, String(v), 970, y + 70, F.num(64), p.ink, "right", 320);
      });
    },
  };
  // progress status: same levels as the dashboard alert cards (lv -1 = on pace)
  T.status = (c, p, s) => {
    const lv = worstOf(s).lv, ok = lv < 0;
    plate(c, "進捗ステータス", 80, 390, F.jp(76), p.a, p.af, -2);
    const [bg, fg] = ok ? [p.b, p.bf] : LVC[lv];
    plate(c, ok ? "ON TRACK" : LVT[lv], 80, 560, F.head(110), bg, fg, -2, 34);
    txt(c, t(ok ? "fx.st.ok" : "fx.st.late"), 80, 800, sub(30), p.mut, "left", 920);
    // three gauges (Kaishi, Minna, kanji in Anki), compact so all fit in the safe area
    s.prog.forEach((g, i) => {
      const y = 850 + i * 285;
      c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(80, y, 920, 262);
      txt(c, g.name, 112, y + 56, lab(40), p.ink, "left", 560);
      txt(c, `${g.have} / ${g.goal}`, 112, y + 96, sub(28), p.mut, "left", 560);
      txt(c, g.integ + "%", 968, y + 92, F.num(96), p.ink, "right", 330);
      c.strokeRect(112, y + 114, 856, 32);
      c.fillStyle = g.lv < 0 ? p.b : LVC[g.lv][0]; c.fillRect(112, y + 114, 856 * Math.min(100, g.integ) / 100, 32);
      txt(c, "THREAT LEVEL", 112, y + 180, F.mono(22, 700), p.mut);
      for (let k = 0; k < 10; k++) {
        const x = 112 + k * 86;
        if (k < g.thr) { c.fillStyle = LVC[Math.max(g.lv, 0)][0]; c.fillRect(x, y + 192, 76, 26); } else { c.lineWidth = 4; c.strokeRect(x, y + 192, 76, 26); }
      }
      txt(c, g.lv < 0 ? t("fx.st.fine") : t("fx.st.need", { n: Math.ceil(g.r), u: t(g.unit), norm: Math.round(g.norm) }), 112, y + 246, sub(24), p.mut, "left", 840);
    });
  };
  // "dashboard" mode: the site's desktop layout drawn on a 1600×1200 screen, then shown flat or as a phone photo of a monitor
  const SW = 1600, SH = 1200;
  function dash(s) {
    const cv = document.createElement("canvas"); cv.width = SW; cv.height = SH;
    const c = cv.getContext("2d"), Y = "#F2C200", G = "#B6FF00", K = "#111", ink = "#ECEAE3", mut = "#A9A69D";
    c.fillStyle = "#17181c"; c.fillRect(0, 0, SW, SH);
    c.fillStyle = "#26272d"; c.fillRect(0, 0, SW, 60);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(30 + i * 24, 30, 8, 0, 7); c.fill(); });
    c.fillStyle = "#34353c"; c.fillRect(120, 13, 640, 34);
    txt(c, "arsenius-nihongo.vercel.app/home", 140, 38, F.mono(20), mut);
    plate(c, "日本語 TRACKER · ARSENIUS", 60, 92, F.mono(18, 700), Y, K, 0, 12);
    c.font = F.head(80); const w1 = c.measureText("JLPT N2").width + 48;
    plate(c, "JLPT N2", 60, 142, F.head(80), ink, K, 0, 24);
    plate(c, "JOURNEY", 60 + w1 + 24, 150, F.head(80), Y, K, 1.5, 24);
    txt(c, `N2 まで あと ${s.daysN3} 日`, 60, 312, F.jp(36), Y);
    txt(c, s.dateLabel, 1540, 312, F.mono(22), mut, "right");
    // summary cards
    const w7 = s.week7.reduce((n, x) => n + x[1], 0), on7 = s.week7.filter(x => x[1] > 0).length;
    [[t("sum.today"), s.hm, s.hoursSub], [t("sum.missions"), `${s.done}/${s.doneOf}`, s.done === s.doneOf ? t("sum.alldone") : ""],
      [t("sum.streak"), `${s.active}🔥`, ""], [t("sum.week"), t("fx.hm", { h: Math.floor(w7 / 60), m: w7 % 60 }), t("sum.week.sub", { d: on7, n: 7 })]]
      .forEach(([l, v, sb], i) => {
        const x = 60 + i * 385, y = 345, fill = i === 0;
        if (fill) { c.fillStyle = Y; c.fillRect(x, y, 365, 165); } else { c.strokeStyle = ink; c.lineWidth = 4; c.strokeRect(x, y, 365, 165); }
        txt(c, l.toUpperCase(), x + 24, y + 38, F.mono(17, 700), fill ? K : mut, "left", 320);
        txt(c, v, x + 22, y + 112, F.num(78), fill ? K : ink, "left", 320);
        txt(c, sb, x + 24, y + 146, sub(17), fill ? K : mut, "left", 320);
      });
    // pace banner, same levels as the dashboard alert
    const g = worstOf(s), ok = g.lv < 0, [bg, fg] = ok ? [G, K] : LVC[g.lv];
    c.fillStyle = bg; c.fillRect(60, 540, 1520, 150);
    plate(c, ok ? "ON TRACK" : "⚠ " + LVT[g.lv], 84, 560, F.head(30), fg, bg, 0, 16);
    txt(c, `${g.name} · ${ok ? t("fx.st.on") : t("fx.st.short", { n: Math.ceil(g.r), u: t(g.unit) })}`, 84, 650, sub(24), fg, "left", 900);
    txt(c, g.integ + "%", 1040, 640, F.num(72), fg, "right");
    for (let k = 0; k < 10; k++) {
      const x = 1080 + k * 48;
      c.strokeStyle = c.fillStyle = fg; c.lineWidth = 3;
      k < g.thr ? c.fillRect(x, 598, 40, 30) : c.strokeRect(x, 598, 40, 30);
    }
    txt(c, "THREAT LEVEL", 1080, 585, F.mono(16, 700), fg);
    // today's list: green when done
    txt(c, t("h.today"), 60, 760, lab(34), ink);
    const sp = s.speak;
    [[t("w.anki"), `${s.reviews} · +${s.kaishiNew}`, s.reviews > 0], [t("w.kaiwa"), sp.min ? `${sp.min} min` : `${sp.n}`, sp.n > 0],
      [t("fx.t.kanji"), `${s.kanjiNew}`, s.kanjiNew > 0], [t("w.minna"), `${s.minna.length}`, s.minna.length > 0]]
      .forEach(([l, v, done], i) => {
        const y = 790 + i * 96;
        if (done) { const gr = c.createLinearGradient(60, 0, 960, 0); gr.addColorStop(0, G); gr.addColorStop(1, "#8BE000"); c.fillStyle = gr; c.fillRect(60, y, 900, 82); }
        else { c.strokeStyle = ink; c.lineWidth = 3; c.strokeRect(60, y, 900, 82); }
        txt(c, (done ? "● " : "○ ") + l, 88, y + 52, lab(28), done ? K : ink, "left", 520);
        txt(c, v, 932, y + 56, F.num(48), done ? K : ink, "right", 330);
      });
    // consistency: last 8 weeks, one box per day
    txt(c, t("h.consistency"), 1030, 760, lab(34), ink);
    s.heat.forEach((lv, i) => {
      if (lv === -1) return;
      const x = 1030 + Math.floor(i / 7) * 66, y = 790 + (i % 7) * 54;
      c.fillStyle = lv === 0 ? "#2a2b31" : lv === "light" ? "#4d6b12" : `rgba(182,255,0,${0.3 + 0.17 * lv})`;
      c.fillRect(x, y, 58, 46);
    });
    return cv;
  }
  // affine-map one triangle of the image (s = source points, d = destination points)
  function tri(c, img, s, d) {
    const [[x0, y0], [x1, y1], [x2, y2]] = s, [[u0, v0], [u1, v1], [u2, v2]] = d;
    const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den, b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den;
    const e = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den, f = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den;
    const mx = (u0 + u1 + u2) / 3, my = (v0 + v1 + v2) / 3, grow = ([u, v]) => [u + Math.sign(u - mx) * 0.8, v + Math.sign(v - my) * 0.8];  // hide seams
    c.save(); c.beginPath(); d.map(grow).forEach(([u, v], i) => i ? c.lineTo(u, v) : c.moveTo(u, v)); c.closePath(); c.clip();
    c.transform(a, b, e, f, u0 - a * x0 - e * y0, v0 - b * x0 - f * y0); c.drawImage(img, 0, 0); c.restore();
  }
  // ponytail: bilinear grid, not true perspective; fine for a slight tilt
  function warp(c, img, q, n = 14) {
    const [A, B, C, D] = q, P = (u, v) => [0, 1].map(k => (A[k] * (1 - u) + B[k] * u) * (1 - v) + (D[k] * (1 - u) + C[k] * u) * v);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const [u0, u1, v0, v1] = [i / n, (i + 1) / n, j / n, (j + 1) / n], S = (u, v) => [u * img.width, v * img.height];
      tri(c, img, [S(u0, v0), S(u1, v0), S(u0, v1)], [P(u0, v0), P(u1, v0), P(u0, v1)]);
      tri(c, img, [S(u1, v0), S(u1, v1), S(u0, v1)], [P(u1, v0), P(u1, v1), P(u0, v1)]);
    }
  }
  const quad = (c, q) => { c.beginPath(); q.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
  // phone photo of the monitor in a dark room: tilt, bezel, glow, vignette, grain
  function photo(c, scr) {
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1d1e22"); bg.addColorStop(0.6, "#0c0c0e"); bg.addColorStop(1, "#050505");
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    [[380, 90, 26], [40, 260, 20]].forEach(([x, y, r]) => {
      const l = c.createRadialGradient(x, y, 0, x, y, r * 3); l.addColorStop(0, "#fff"); l.addColorStop(0.3, "rgba(255,255,255,.9)"); l.addColorStop(0.45, "rgba(255,255,255,.15)"); l.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = l; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    });
    const q = [[-30, 330], [1200, 420], [1170, 1430], [-50, 1270]];
    // stand and desk
    c.fillStyle = "#0a0a0b"; quad(c, [[420, 1400], [700, 1420], [760, 1700], [360, 1690]]); c.fill();
    c.fillStyle = "#111214"; quad(c, [[600, 1600], [1080, 1560], [1080, 1920], [700, 1920]]); c.fill();
    // bezel, then the screen with a light blur
    c.lineJoin = "round"; c.strokeStyle = "#050505"; c.lineWidth = 44; quad(c, q); c.stroke();
    c.filter = "blur(0.7px)"; warp(c, scr, q); c.filter = "none";
    c.save(); quad(c, q); c.clip();
    c.fillStyle = "rgba(0,0,0,.07)"; for (let y = 300; y < 1450; y += 6) c.fillRect(0, y, W, 2);  // faint scan lines
    const gl = c.createLinearGradient(0, 330, 1200, 1400); gl.addColorStop(0, "rgba(255,255,255,.07)"); gl.addColorStop(0.5, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(0,0,0,.25)");
    c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
    const v = c.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.45, H * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.7)");
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    const im = c.getImageData(0, 0, W, H), px = im.data;
    for (let i = 0; i < px.length; i += 4) { const n = (Math.random() - 0.5) * 18; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
    c.putImageData(im, 0, 0);
  }
  // flat: the screen as a clean screenshot card on the story background
  function flat(c, p, scr, s, q) {
    const x = 80, y = 480, w = 920, h = w * SH / SW;
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(x + 16, y + 16, w, h);
    c.drawImage(scr, x, y, w, h);
    c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(x, y, w, h);
    plate(c, "今日の勉強", 80, 400, F.jp(52), p.a, p.af, -2, 20);
    if (!q) bars(c, p, s, 1330);
  }
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };

  // the Flex dialog (was an inline script; inline scripts are blocked by the site's CSP)
  const dlg = document.getElementById("flexDlg");
  if (dlg) {
    document.getElementById("flexOpen").onclick = () => dlg.showModal();
    document.getElementById("flexClose").onclick = () => dlg.close();
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });  // tap backdrop to close
  }

  window.initFlex = async s => {
    const cv = document.getElementById("flexCanvas"), c = cv.getContext("2d");
    const $ = id => document.getElementById(id), share = $("flexShare"), save = $("flexSave");
    const sample = "0123456789ABCabc今日の勉強今週のまとめ進捗ステータス日連続N2まであと" + ["fx.t1", "fx.t.floor", "fx.t.light", "fx.t.speak", "fx.t.kanji", "fx.rc.floor", "fx.rc.kanji", "fx.rc.speak", "fx.wKanji", "fx.st.kanji", "fx.studyToday", "fx.estNote", "fx.week7", "fx.total",
        "fx.st.on", "fx.st.short", "fx.st.ok", "fx.st.late", "fx.st.fine", "fx.st.need", "fx.st.words", "fx.st.chapters", "fx.rc.hours", "fx.rc.kaishi", "fx.rc.rounds", "fx.rc.reviews", "fx.rc.sub"].map(k => t(k)).join("") + s.dateLabel + s.hoursSub + s.quotes.map(x => x.q + x.by + (x.tr ? x.tr.id + x.tr.en : "")).join("");
    await Promise.all([F.num(80), F.head(40), F.mono(30), F.mono(30, 700), F.jp(40), F.jp(40, 400)].map(f => document.fonts.load(f, sample))).catch(() => {});
    const hm = m => t("fx.hm", { h: Math.floor(m / 60), m: m % 60 });
    s.hm = (s.minEst && s.min ? "±" : "") + hm(s.min); s.totalHm = hm(s.totalMin); s.recapHm = (s.recap.est ? "±" : "") + hm(s.recap.min);
    let file = null, url = null;

    // quotes: optional band at the bottom; the card shrinks to make room
    const usable = s.quotes.filter(x => x.q.length <= 125);
    let qTag = store("fxQTag") || "all";
    const tagSel = $("flexQTag"), tags = ["all", ...new Set(usable.map(x => x.tag))];
    tagSel.innerHTML = tags.map(k => `<option value="${k}">${t("qt." + k)}</option>`).join("");
    tagSel.value = tags.includes(qTag) ? qTag : (qTag = "all");
    const pickQuote = prev => {
      const pool = usable.filter(y => y !== prev && (qTag === "all" || y.tag === qTag));
      const x = pick(pool.length ? pool : usable);
      return { ...x, sub: LANG !== "ja" ? x.tr?.[LANG] : null };
    };
    let showQuote = store("fxQuote") === true;
    const st = { mode: "stats", pal: Math.min(store("fxPal") || 0, PAL.length - 1), q: usable.length ? pickQuote() : null };
    const qBox = $("flexQ"), qNew = $("flexQNew");
    qBox.checked = showQuote; qBox.closest(".fx-q").hidden = !usable.length;
    const photoBox = $("flexPhoto"); let photoOn = photoBox.checked = store("fxPhoto") === true;
    const draw = () => {
      const p = PAL[st.pal], q = showQuote && st.q ? st.q : null, k = q ? 0.75 : 0.906, isDash = st.mode === "dash";
      photoBox.closest("label").hidden = !isDash;
      if (isDash && photoOn) photo(c, dash(s));
      else {
        background(c, p);
        if (isDash) flat(c, p, dash(s), s, q);
        else {
          c.save(); c.translate(W / 2, 400); c.scale(k, k); c.translate(-W / 2, -370);  // squeeze content into the IG safe area
          T[st.mode](c, p, s);
          c.restore();
        }
        frame(c, p, s);
        if (st.pal === 5) { c.strokeStyle = p.a; c.lineWidth = 10; c.strokeRect(30, 30, 1020, 1860); c.lineWidth = 3; c.strokeRect(54, 54, 972, 1812); }
        if (q) quoteBlock(c, p, q);
      }
      document.querySelectorAll("#flexStats, #flexWeek, #flexStatus, #flexDash").forEach(b => b.setAttribute("aria-pressed", b.id === "flex" + st.mode[0].toUpperCase() + st.mode.slice(1)));
      file = null; share.disabled = save.disabled = true; share.textContent = t("fx.preparing");
      cv.toBlob(b => { file = new File([b], `nihongo-${s.date}${st.mode === "stats" ? "" : "-" + st.mode}.png`, { type: "image/png" }); share.textContent = t("fx.share"); share.disabled = save.disabled = false; });
    };
    $("flexStats").onclick = () => { st.mode = "stats"; draw(); };
    $("flexWeek").onclick = () => { st.mode = "week"; draw(); };
    $("flexStatus").onclick = () => { st.mode = "status"; draw(); };
    $("flexDash").onclick = () => { st.mode = "dash"; draw(); };
    photoBox.onchange = () => { photoOn = photoBox.checked; store("fxPhoto", photoOn); draw(); };
    $("flexTheme").onclick = () => { st.pal = (st.pal + 1) % PAL.length; store("fxPal", st.pal); draw(); };
    qBox.onchange = () => { showQuote = qBox.checked; store("fxQuote", showQuote); draw(); };
    tagSel.onchange = () => { qTag = tagSel.value; store("fxQTag", qTag); st.q = pickQuote(st.q); showQuote = qBox.checked = true; store("fxQuote", true); draw(); };
    qNew.onclick = () => { st.q = pickQuote(st.q); showQuote = qBox.checked = true; store("fxQuote", true); draw(); };
    const download = () => {
      if (!file) return;
      if (url) URL.revokeObjectURL(url);
      const a = document.createElement("a"); a.href = url = URL.createObjectURL(file); a.download = file.name; a.click();
    };
    save.onclick = download;
    share.onclick = () => {
      if (file && navigator.canShare?.({ files: [file] })) navigator.share({ files: [file] }).catch(() => {});
      else download();
    };
    // gacha for the look (theme), not the content: rarity by weight, 11th pull without Rare+ is guaranteed Rare+
    const $c = $("flexCover"), rar = $("flexRar"), info = $("flexInfo"), out = $c.querySelector(".cl");
    const col = new Set(store("fxCol") || []);
    const showInfo = () => info.textContent = t("fx.info", { c: col.size, t: PAL.length, p: store("fxPity") || 0 });
    const RCOL = { common: "#cfcfcf", rare: "#4b9dff", epic: "#c77dff", legendary: "#FFD54A" };
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sleep = ms => new Promise(r => setTimeout(r, calm ? 0 : ms));
    const line = (text, cls) => { const p = document.createElement("p"); p.className = cls; p.textContent = text; out.append(p); out.scrollTop = out.scrollHeight; return p; };
    let busy = false;
    $("flexPull").onclick = async () => {
      if (busy) return;
      busy = true; rar.textContent = ""; $c.hidden = false; out.innerHTML = ""; share.disabled = save.disabled = true;
      const w = s.done === s.doneOf ? { common: 40, rare: 35, epic: 18, legendary: 7 } : { common: 60, rare: 25, epic: 12, legendary: 3 };
      if (s.streak >= 7) w.legendary *= 2;
      const pity = store("fxPity") || 0;
      if (pity >= 10) w.common = 0;
      const keys = Object.keys(w).filter(r => w[r]), sum = keys.reduce((x, r) => x + w[r], 0);
      let n = Math.random() * sum, r = keys[0];
      for (const k of keys) { if ((n -= w[k]) < 0) { r = k; break; } }
      store("fxPity", r === "common" ? pity + 1 : 0);
      st.pal = pick(RAR[r]); store("fxPal", st.pal); col.add(st.pal); store("fxCol", [...col]); draw();
      line(`> gacha_pull ${s.date}`, "cmd"); await sleep(250);
      line(`must ${s.done}/${s.doneOf} · streak ${s.active}`, "dim"); await sleep(250);
      const spin = line("", "spin");
      for (let d = 35; d < 230; d *= 1.17) { spin.textContent = `unboxing… ${pick(THEME)}`; await sleep(d); }
      spin.textContent = "unboxing… done";
      const res = line(`[${r.toUpperCase()}] ${THEME[st.pal]}`, "res"); res.style.color = RCOL[r];
      await sleep(r === "legendary" ? 1100 : r === "epic" ? 750 : 500);
      busy = false; $c.hidden = true; rar.dataset.r = r; rar.textContent = `${r.toUpperCase()} · ${THEME[st.pal]}`;
      share.disabled = save.disabled = !file; showInfo();
    };
    $c.hidden = true; showInfo();
    draw();
  };
})();
