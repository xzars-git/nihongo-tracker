// Story image gacha (1080×1920). Rarity → template; palette, headline stat and tagline are shuffled each pull.
(() => {
  const W = 1080, H = 1920;
  const PAL = [
    { bg: "#17181c", ink: "#ECEAE3", mut: "#A9A69D", dot: "#2a2b31", a: "#F2C200", af: "#111", b: "#B6FF00", bf: "#111", r: "#FF5A5F" },
    { bg: "#F4EBD6", ink: "#111", mut: "#5d5a52", dot: "#e3d7bc", a: "#111", af: "#F4EBD6", b: "#F2C200", bf: "#111", r: "#C8102E" },
    { bg: "#0E2A47", ink: "#F4F1E8", mut: "#a7bccf", dot: "#16365a", a: "#7cc4ff", af: "#0b1a2b", b: "#FF5A5F", bf: "#111", r: "#FF5A5F" },
    { bg: "#2A2216", ink: "#F4EBD6", mut: "#c4b391", dot: "#352c1e", a: "#B6FF00", af: "#111", b: "#F2C200", bf: "#111", r: "#FF6B5A" },
    { bg: "#C8102E", ink: "#fff", mut: "#ffd6d6", dot: "#b50e29", a: "#fff", af: "#C8102E", b: "#111", bf: "#fff", r: "#111" },
  ];
  const GOLD = { bg: "#14100a", ink: "#FFE7A3", mut: "#c9a75a", dot: "#241c0e", a: "#E8B931", af: "#14100a", b: "#FFE7A3", bf: "#14100a", r: "#E8B931" };
  const JP = ["継続は力なり", "今日も一歩前進", "毎日コツコツ", "千里の道も一歩から", "今日も頑張った", "塵も積もれば山となる"];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const F = {
    num: s => `800 ${s}px 'Barlow Condensed'`, head: s => `${s}px 'Archivo Black'`,
    mono: (s, w = 400) => `${w} ${s}px 'JetBrains Mono'`, jp: (s, w = 700) => `${w} ${s}px 'Noto Sans JP'`,
  };
  // Latin labels use Archivo; Japanese UI labels need the JP font
  const lab = s => (LANG === "ja" ? F.jp(Math.round(s * 0.95)) : F.head(s));

  function txt(c, t, x, y, font, color, align = "left", max) {
    c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
    max ? c.fillText(t, x, y, max) : c.fillText(t, x, y);
  }
  // Tilted block with text, (x,y) = top-left (or top-center). Returns its height.
  function plate(c, t, x, y, font, bg, fg, rot = 0, pad = 26, align = "left") {
    c.font = font;
    const m = c.measureText(t), asc = m.actualBoundingBoxAscent, w = m.width + pad * 2, h = asc + m.actualBoundingBoxDescent + pad * 1.4;
    const x0 = align === "center" ? x - w / 2 : x;
    c.save(); c.translate(x0 + w / 2, y + h / 2); c.rotate(rot * Math.PI / 180);
    c.fillStyle = bg; c.fillRect(-w / 2, -h / 2, w, h);
    c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(t, 0, -h / 2 + pad * 0.7 + asc);
    c.restore();
    return h;
  }
  function stamp(c, x, y, r, t, color, rot, lw = r / 12) {
    c.save(); c.translate(x, y); c.rotate(rot * Math.PI / 180);
    c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
    c.fillStyle = color; c.font = F.jp(r * (t.length > 1 ? 0.62 : 1.05)); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, 0, r * 0.05);
    c.restore();
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
    txt(c, `N3 まで あと ${s.daysN3} 日`, 1000, 1630, F.jp(34), p.ink, "right");
  }
  const pool = s => [
    s.min >= 30 && [Math.round(s.min / 6) / 10, t("fx.hoursToday"), "勉強時間"],
    s.streak > 1 && [s.streak, t("streak.full"), "連続達成"],
    s.active > 1 && [s.active, t("streak.active"), "連続学習"],
    s.rounds && [s.rounds, t("fx.roundsToday") + (s.avg != null ? t("fx.avg", { v: s.avg }) : ""), "漢字クイズ"],
    s.reviews && [s.reviews, t("fx.reviews"), "今日の復習"],
    s.kaishiOpened && [s.kaishiOpened, t("fx.kaishi"), "単語"],
    s.kanjiSeen && [s.kanjiSeen, t("fx.kanjiSeen"), "漢字"],
    s.totalRounds && [s.totalRounds, t("streak.rounds"), "累計"],
    [s.daysN3, t("fx.daysN3"), "N3まで"],
  ].filter(Boolean);

  const T = [
    { name: "Big number", draw(c, p, s) {
      const [v, l, j] = pick(pool(s));
      plate(c, j, 80, 400, F.jp(64), p.a, p.af, -2);
      plate(c, String(v), W / 2, 620, F.num(420), p.b, p.bf, 2, 40, "center");
      txt(c, l, W / 2, 1240, lab(52), p.ink, "center", 920);
      txt(c, pick(JP), W / 2, 1420, F.jp(88), p.ink, "center", 920);
    } },
    { name: "Checklist", draw(c, p, s) {
      plate(c, "今日のノルマ", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, `${s.done}/4`, 1000, 500, F.num(150), p.ink, "right");
      const rows = [
        [t("w.anki"), t("anki.n", { a: s.kaishiNew, b: 15 }) + " · " + t("anki.p", { r: s.reviews, ag: "", h: "" }).split(" · ")[0], s.st.anki],
        [t("w.kanji"), t("kanji.n", { a: s.rounds, b: 8 }) + (s.avg != null ? " · " + s.avg + "%" : ""), s.st.kanji],
        [t("w.minna"), s.minna.join(" · ") || t("fx.none"), s.st.minna],
        [t("w.kaiwa"), s.kaiwa ? t("minna.n", { n: s.kaiwa }) : t("fx.none"), s.st.kaiwa],
      ];
      rows.forEach(([tt, d, ok], i) => {
        const y = 600 + i * 250;
        c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(80, y, 920, 210);
        txt(c, tt, 120, y + 95, lab(60), p.ink, "left", 640);
        txt(c, d, 120, y + 160, F.mono(32), p.mut, "left", 640);
        stamp(c, 880, y + 105, 72, ok ? "済" : "未", ok ? p.r : p.mut, ok ? -12 : 0);
      });
    } },
    { name: "Receipt", draw(c, p, s) {
      const x0 = 150, x1 = 930, k = "#111", m = "#555", lf = n => LANG === "ja" ? F.jp(n, 400) : F.mono(n);
      c.fillStyle = "#FBF8F0"; c.beginPath(); c.moveTo(x0, 380); c.lineTo(x1, 380); c.lineTo(x1, 1580);
      for (let x = x1; x > x0; x -= 30) { c.lineTo(x - 15, 1610); c.lineTo(x - 30, 1580); }
      c.closePath(); c.fill();
      let y = 470;
      const line = () => { txt(c, "- ".repeat(30), 540, y, F.mono(30), m, "center", x1 - x0 - 60); y += 56; };
      txt(c, "日本語 STORE", 540, y, F.head(56), k, "center"); y += 56;
      txt(c, `${s.dateLabel} · ${t("fx.bab", { b: s.bab })}`, 540, y, lf(30), m, "center"); y += 50;
      line();
      for (const [l, v] of [["fx.r.kaishiNew", s.kaishiNew], ["fx.r.reviews", s.reviews], ["fx.r.rounds", s.rounds], ["fx.r.score", s.avg != null ? s.avg + "%" : "–"],
        ["fx.time", s.hm], ["fx.r.minna", s.minna.length], ["fx.r.kaiwa", s.kaiwa], ["fx.r.bank", s.mistakes]]) {
        txt(c, t(l), x0 + 40, y, lf(36), k); txt(c, String(v), x1 - 40, y, F.mono(36, 700), k, "right"); y += 62;
      }
      line();
      txt(c, t("fx.must"), x0 + 40, y + 20, lab(60), k); txt(c, `${s.done}/4`, x1 - 40, y + 30, F.num(120), k, "right"); y += 110;
      txt(c, t("fx.r.streak", { n: s.active }), x0 + 40, y, lf(32), m); y += 80;
      txt(c, "ありがとうございました", 540, y, F.jp(40), k, "center"); y += 40;
      c.fillStyle = k;
      for (let x = 300; x < 780;) { const w = 3 + Math.floor(Math.random() * 4) * 3; c.fillRect(x, y, w, 90); x += w + 4 + Math.floor(Math.random() * 3) * 4; }
    } },
    { name: "Countdown", draw(c, p, s) {
      const h = plate(c, "JLPT N3", 80, 400, F.num(170), p.a, p.af, -2);
      plate(c, s.n3Month, 130, 400 + h + 20, LANG === "ja" ? F.jp(90) : F.num(110), p.b, p.bf, 3);
      txt(c, String(s.daysN3), W / 2, 1200, F.num(520), p.ink, "center");
      txt(c, `${t("fx.daysLeft")} · あと`, W / 2, 1290, F.jp(56), p.mut, "center");
      const pct = Math.max(0, Math.min(1, 1 - s.daysN3 / s.n3Total));
      c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(80, 1380, 920, 70);
      c.fillStyle = p.a; c.fillRect(86, 1386, 908 * pct, 58);
      txt(c, t("fx.progress", { p: Math.round(pct * 100), d: s.startLabel }), 80, 1520, LANG === "ja" ? F.jp(34, 400) : F.mono(34), p.ink);
      txt(c, pick(JP), 80, 1620, F.jp(64), p.ink, "left", 920);
    } },
    { name: "Heatmap", draw(c, p, s) {
      plate(c, "毎日の記録", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, t("fx.heatSub"), 80, 560, LANG === "ja" ? F.jp(28, 400) : F.mono(28), p.mut, "left", 920);
      s.heat.forEach((n, i) => {
        const x = 107 + Math.floor(i / 7) * 110, y = 610 + (i % 7) * 110;
        if (n < 0) { c.strokeStyle = p.dot; c.lineWidth = 4; c.strokeRect(x + 2, y + 2, 92, 92); return; }
        c.fillStyle = n ? p.b : p.dot; c.globalAlpha = n ? 0.3 + 0.7 * n / 4 : 1; c.fillRect(x, y, 96, 96); c.globalAlpha = 1;
        if (i === s.heat.length - 1) { c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(x - 6, y - 6, 108, 108); }
      });
      txt(c, t("fx.heatLine", { a: s.active, s: s.streak }), 80, 1470, lab(48), p.ink, "left", 920);
      txt(c, pick(JP), 80, 1590, F.jp(72), p.ink, "left", 920);
    } },
    { name: "Weekly target", draw(c, p, s) {
      plate(c, "今週の目標", 80, 390, F.jp(76), p.a, p.af, -2);
      s.week.forEach(([l, have, want], i) => {
        const y = 640 + i * 280, ok = have >= want;
        txt(c, l, 80, y, lab(52), p.ink, "left", 560);
        txt(c, `${have} / ${want}`, 1000, y + 8, F.num(110), p.ink, "right");
        c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(80, y + 50, 920, 80);
        c.fillStyle = ok ? p.b : p.a; c.fillRect(86, y + 56, 908 * Math.min(1, have / want), 68);
      });
      txt(c, pick(JP), W / 2, 1560, F.jp(80), p.ink, "center", 920);
    } },
    { name: "Terminal", draw(c, p, s) {
      plate(c, "今日のログ", 80, 370, F.jp(64), p.a, p.af, -2);
      c.fillStyle = "#0d0d0f"; c.fillRect(70, 520, 940, 1080);
      c.fillStyle = "#26262b"; c.fillRect(70, 520, 940, 70);
      ["#FF5A5F", "#F2C200", "#B6FF00"].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(115 + i * 45, 555, 14, 0, 7); c.fill(); });
      const g = "#B6FF00", w = "#ECEAE3", m = "#8a8a8a", x = 110, max = 860;
      const rows = [
        [`$ nihongo status --today`, g], [`date    ${s.date}`, w],
        [`anki    ${s.kaishiNew} new · ${s.reviews} reviews`, w], [`kanji   ${s.rounds} rounds${s.avg != null ? " · avg " + s.avg + "%" : ""}`, w],
        [`minna   ${s.minna.length} sessions`, w], [`kaiwa   ${s.kaiwa} sessions`, w],
        [`time    ${s.hm}`, w], [`must    ${"█".repeat(s.done)}${"░".repeat(4 - s.done)} ${s.done}/4`, g], [`streak  ${s.active} days`, w],
        [`learned ${s.learned.slice(0, 2).join(" · ") || "-"}`, m], [`$ echo`, g],
      ];
      rows.forEach(([tt, col], i) => txt(c, tt, x, 670 + i * 66, F.mono(36, i ? 400 : 700), col, "left", max));
      txt(c, pick(JP), x, 670 + rows.length * 66, F.jp(56), w, "left", max);
      c.fillStyle = g; c.fillRect(x, 670 + rows.length * 66 + 40, 24, 44);
    } },
    { name: "Hanko", draw(c, p, s) {
      stamp(c, W / 2, 820, 330, s.done === 4 ? "完了" : "継続", p.r, -10, 34);
      txt(c, `${s.active}日連続`, W / 2, 1360, F.jp(120), p.ink, "center");
      txt(c, t("fx.hanko", { d: s.done, r: s.rounds, v: s.reviews }) + " · ⏱ " + s.hm, W / 2, 1460, LANG === "ja" ? F.jp(34, 400) : F.mono(34), p.mut, "center", 920);
      txt(c, pick(JP), W / 2, 1590, F.jp(64), p.ink, "center", 920);
    } },
    { name: "Scoreboard", draw(c, p, s) {
      plate(c, "成績表", 80, 390, F.jp(76), p.a, p.af, -2);
      const tiles = [
        [s.reviews, "fx.t1"], [`${s.rounds}/8`, "fx.t2"], [s.avg != null ? s.avg + "%" : "–", "fx.t3"],
        [s.kaishiOpened, "fx.t4"], [s.hm, "fx.time"], [s.active, "fx.t6"],
      ], hi = Math.floor(Math.random() * tiles.length);
      tiles.forEach(([v, l], i) => {
        const x = 80 + (i % 2) * 480, y = 560 + Math.floor(i / 2) * 340, on = i === hi;
        if (on) { c.fillStyle = p.a; c.fillRect(x, y, 440, 300); } else { c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(x, y, 440, 300); }
        txt(c, String(v), x + 36, y + 190, F.num(170), on ? p.af : p.ink, "left", 370);
        txt(c, t(l), x + 36, y + 255, LANG === "ja" ? F.jp(32, 400) : F.mono(32), on ? p.af : p.mut, "left", 370);
      });
      txt(c, pick(JP), W / 2, 1640, F.jp(64), p.ink, "center", 920);
    } },
    { name: "Kanji wall", draw(c, p, s) {
      const h = plate(c, String(s.kanjiSeen), 80, 380, F.num(200), p.a, p.af, -2);
      txt(c, t("fx.kanjiSeen"), 110, 380 + h + 70, lab(48), p.ink);
      const ks = [...s.kanjiList].sort(() => Math.random() - 0.5).slice(0, 36);
      ks.forEach((k, i) => {
        const x = 120 + (i % 6) * 140, y = 760 + Math.floor(i / 6) * 140, on = Math.random() < 0.15;
        if (on) { c.fillStyle = p.b; c.fillRect(x + 6, y + 6, 128, 128); }
        txt(c, k, x + 70, y + 108, F.jp(96), on ? p.bf : p.ink, "center");
      });
    } },
    { name: "Study log", draw(c, p, s) {
      plate(c, "今日の勉強", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, s.hm, 80, 720, LANG === "ja" ? F.jp(150) : F.num(230), p.ink, "left", 920);
      txt(c, t("fx.studyToday") + (s.minEst ? " · " + t("fx.estNote") : ""), 80, 790, LANG === "ja" ? F.jp(32, 400) : F.mono(32), p.mut, "left", 920);
      txt(c, t("fx.learned"), 80, 900, lab(44), p.ink);
      const items = s.learned.length ? s.learned.slice(0, 5) : [t("fx.none")];
      items.forEach((l, i) => { c.fillStyle = p.b; c.fillRect(80, 945 + i * 68, 18, 18); txt(c, l, 120, 965 + i * 68, LANG === "ja" ? F.jp(36, 400) : F.mono(34), p.ink, "left", 880); });
      const y0 = 1330, hMax = 190, mx = Math.max(60, ...s.week7.map(x => x[1]));
      txt(c, `${t("fx.week7")} · ${t("fx.total", { t: s.totalHm })}`, 80, y0 - 70, LANG === "ja" ? F.jp(30, 400) : F.mono(30), p.mut, "left", 920);
      s.week7.forEach(([d, m], i) => {
        const x = 80 + i * 134, h = Math.max(6, hMax * m / mx);
        c.fillStyle = i === 6 ? p.a : p.b; c.globalAlpha = m ? 1 : 0.25; c.fillRect(x, y0 + hMax - h, 110, h); c.globalAlpha = 1;
        txt(c, m ? String(Math.round(m / 6) / 10) : "0", x + 55, y0 + hMax - h - 14, F.mono(28, 700), p.ink, "center");
        txt(c, String(+d.slice(8)), x + 55, y0 + hMax + 44, F.mono(28), p.mut, "center");
      });
    } },
    { name: "Gold", gold: true, draw(c, p, s) {
      c.save(); c.translate(W / 2, 900); c.strokeStyle = p.a; c.globalAlpha = 0.18; c.lineWidth = 14;
      for (let i = 0; i < 36; i++) { c.rotate(Math.PI / 18); c.beginPath(); c.moveTo(0, 380); c.lineTo(0, 900); c.stroke(); }
      c.restore();
      c.strokeStyle = p.a; c.lineWidth = 10; c.strokeRect(60, 380, 960, 1260); c.lineWidth = 3; c.strokeRect(84, 404, 912, 1212);
      stamp(c, W / 2, 860, 330, s.done === 4 ? "完了" : "継続", p.a, -8, 40);
      txt(c, `${s.active}日連続`, W / 2, 1360, F.jp(130), p.ink, "center");
      txt(c, t(s.done === 4 ? "fx.perfect" : "fx.keep"), W / 2, 1460, lab(52), p.a, "center", 860);
      txt(c, "LEGENDARY", W / 2, 1560, F.mono(40, 700), p.mut, "center");
    } },
  ];
  const RAR = { common: [2, 6, 8, 9, 10], rare: [1, 5, 4, 3], epic: [7, 0], legendary: [11] };
  const COMEBACK = { common: [9], rare: [3, 5], epic: [0], legendary: [] };  // cumulative numbers only, never 0/4
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };

  window.initFlex = async s => {
    const cv = document.getElementById("flexCanvas"), c = cv.getContext("2d");
    const $ = id => document.getElementById(id), cover = $("flexCover"), rar = $("flexRar"), info = $("flexInfo"), share = $("flexShare"), save = $("flexSave");
    const sample = "0123456789ABCabc█░" + JP.join("") + s.kanjiList + "今日のノルマ済未毎日の記録今週の目標ログ成績表完了継続連続達成学習漢字クイズ復習単語累計まであとありがとうございました日本語" + ["fx.r.kaishiNew", "fx.r.reviews", "fx.r.rounds", "fx.r.score", "fx.r.minna", "fx.r.kaiwa", "fx.r.bank", "fx.r.streak", "fx.must", "fx.daysLeft", "fx.progress",
        "fx.heatSub", "fx.heatLine", "fx.wMinna", "fx.wKaishi", "fx.wKanji", "fx.hanko", "fx.t1", "fx.t2", "fx.t3", "fx.t4", "fx.t5", "fx.t6", "fx.perfect", "fx.keep",
        "fx.kanjiSeen", "fx.time", "fx.studyToday", "fx.learned", "fx.week7", "fx.estNote", "fx.kaishi", "fx.reviews", "fx.roundsToday", "fx.daysN3", "streak.full", "streak.active", "streak.rounds", "w.anki", "w.kanji", "w.minna", "w.kaiwa", "fx.none", "fx.bab"].map(k => t(k)).join("") + s.n3Month + s.dateLabel + s.learned.join("");
    await Promise.all([F.num(80), F.head(40), F.mono(30), F.mono(30, 700), F.jp(40), F.jp(40, 400)].map(f => document.fonts.load(f, sample))).catch(() => {});
    const hm = m => t("fx.hm", { h: Math.floor(m / 60), m: m % 60 });
    s.hm = (s.minEst && s.min ? "±" : "") + hm(s.min); s.totalHm = hm(s.totalMin);
    const fontOk = document.fonts.check(F.jp(40), "漢字");
    const comeback = s.done <= 1;
    let file = null, url = null, busy = false;
    const col = new Set(store("fxCol") || []);
    const showInfo = () => info.textContent = t("fx.info", { c: col.size, t: T.length, p: store("fxPity") || 0 }) + (comeback ? " · " + t("fx.comeback") : "") + (fontOk ? "" : " · " + t("fx.fontFail"));

    const roll = () => {
      const forced = new URLSearchParams(location.search).get("t");  // hidden debug: ?t=3
      if (forced !== null && T[+forced]) return [+forced, Object.keys(RAR).find(r => RAR[r].includes(+forced))];
      const kolam = comeback ? COMEBACK : RAR;
      const w = s.done === 4 ? { common: 40, rare: 35, epic: 18, legendary: 7 } : { common: 60, rare: 25, epic: 12, legendary: 3 };
      if (s.streak >= 7) w.legendary *= 2;
      const pity = store("fxPity") || 0;
      if (pity >= 10) w.common = 0;  // 11th pull without Rare+ is guaranteed Rare+
      const keys = Object.keys(w).filter(r => kolam[r].length && w[r]), sum = keys.reduce((x, r) => x + w[r], 0);
      let n = Math.random() * sum, r = keys[0];
      for (const k of keys) { if ((n -= w[k]) < 0) { r = k; break; } }
      store("fxPity", r === "common" ? pity + 1 : 0);
      return [pick(kolam[r]), r];
    };
    const draw = i => {
      const p = T[i].gold ? GOLD : pick(PAL);
      background(c, p);
      c.save(); c.translate(W / 2, 400); c.scale(0.906, 0.906); c.translate(-W / 2, -370);  // squeeze content into the IG safe area
      T[i].draw(c, p, s);
      c.restore();
      frame(c, p, s);
      file = null; share.disabled = save.disabled = true; share.textContent = t("fx.preparing");
      cv.toBlob(b => { file = new File([b], `nihongo-${s.date}.png`, { type: "image/png" }); share.textContent = t("fx.share"); share.disabled = save.disabled = busy; });
    };
    // CS-style console unboxing: the result is printed in the console first, the image is revealed after
    const RCOL = { common: "#cfcfcf", rare: "#4b9dff", epic: "#c77dff", legendary: "#FFD54A" };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = cover.querySelector(".cl");
    const line = (text, cls) => { const p = document.createElement("p"); p.className = cls; p.textContent = text; out.append(p); out.scrollTop = out.scrollHeight; return p; };
    $("flexPull").onclick = async () => {
      if (busy) return;
      busy = true; rar.textContent = ""; cover.hidden = false; out.innerHTML = "";
      share.disabled = save.disabled = true;
      const [i, r] = roll();
      draw(i); col.add(i); store("fxCol", [...col]);
      line(`> gacha_pull ${s.date}`, "cmd"); await sleep(250);
      line(`must ${s.done}/4 · streak ${s.active}${comeback ? " · comeback_pool 1" : ""}`, "dim"); await sleep(250);
      const spin = line("", "spin"), names = T.map(x => x.name);
      for (let d = 35; d < 230; d *= 1.17) { spin.textContent = `unboxing… ${pick(names)}`; await sleep(d); }
      spin.textContent = "unboxing… done";
      const res = line(`[${r.toUpperCase()}] ${T[i].name}`, "res"); res.style.color = RCOL[r];
      await sleep(r === "legendary" ? 1100 : r === "epic" ? 750 : 500);
      busy = false; cover.hidden = true;
      rar.dataset.r = r; rar.textContent = `${r.toUpperCase()} · ${T[i].name}`;
      share.disabled = save.disabled = !file; showInfo();
    };
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
    cover.hidden = false; showInfo();
  };
})();
