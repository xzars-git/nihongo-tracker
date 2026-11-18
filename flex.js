// Story image generator (1080×1920). Template = layout; palette, headline stat and tagline are shuffled each draw.
(() => {
  const W = 1080, H = 1920;
  const PAL = [
    { bg: "#17181c", ink: "#ECEAE3", mut: "#A9A69D", dot: "#2a2b31", a: "#F2C200", af: "#111", b: "#B6FF00", bf: "#111", r: "#FF5A5F" },
    { bg: "#F4EBD6", ink: "#111", mut: "#5d5a52", dot: "#e3d7bc", a: "#111", af: "#F4EBD6", b: "#F2C200", bf: "#111", r: "#C8102E" },
    { bg: "#0E2A47", ink: "#F4F1E8", mut: "#a7bccf", dot: "#16365a", a: "#7cc4ff", af: "#0b1a2b", b: "#FF5A5F", bf: "#111", r: "#FF5A5F" },
    { bg: "#2A2216", ink: "#F4EBD6", mut: "#c4b391", dot: "#352c1e", a: "#B6FF00", af: "#111", b: "#F2C200", bf: "#111", r: "#FF6B5A" },
    { bg: "#C8102E", ink: "#fff", mut: "#ffd6d6", dot: "#b50e29", a: "#fff", af: "#C8102E", b: "#111", bf: "#fff", r: "#111" },
  ];
  const JP = ["継続は力なり", "今日も一歩前進", "毎日コツコツ", "千里の道も一歩から", "今日も頑張った", "塵も積もれば山となる"];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const F = {
    num: s => `800 ${s}px 'Barlow Condensed'`, head: s => `${s}px 'Archivo Black'`,
    mono: (s, w = 400) => `${w} ${s}px 'JetBrains Mono'`, jp: (s, w = 700) => `${w} ${s}px 'Noto Sans JP'`,
  };

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
  function stamp(c, x, y, r, t, color, rot) {
    c.save(); c.translate(x, y); c.rotate(rot * Math.PI / 180);
    c.strokeStyle = color; c.lineWidth = r / 12; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
    c.fillStyle = color; c.font = F.jp(r * (t.length > 1 ? 0.62 : 1.05)); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, 0, r * 0.05);
    c.restore();
  }
  function background(c, p) {
    c.fillStyle = p.bg; c.fillRect(0, 0, W, H);
    c.fillStyle = p.dot;
    for (let y = 20; y < H; y += 40) for (let x = 20; x < W; x += 40) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
  }
  function frame(c, p, s) {
    plate(c, "日本語 · ARSENIUS", 80, 190, F.mono(34, 700), p.b, p.bf, -2, 20);
    txt(c, s.dateLabel, 1000, 245, F.mono(36, 700), p.ink, "right");
    txt(c, "arsenius-nihongo.vercel.app", 80, 1770, F.mono(30), p.mut);
    txt(c, `N3 まで あと ${s.daysN3} 日`, 1000, 1770, F.jp(36), p.ink, "right");
  }
  const pool = s => [
    s.streak > 1 && [s.streak, "hari WAJIB 4/4 beruntun", "連続達成"],
    s.active > 1 && [s.active, "hari belajar beruntun", "連続学習"],
    s.rounds && [s.rounds, `ronde tebak kanji hari ini${s.avg != null ? " · rata-rata " + s.avg + "%" : ""}`, "漢字クイズ"],
    s.reviews && [s.reviews, "kartu Anki direview hari ini", "今日の復習"],
    s.kaishiOpened && [s.kaishiOpened, "kata Kaishi sudah dibuka", "単語"],
    s.kanjiSeen && [s.kanjiSeen, "kanji sudah ketemu", "漢字"],
    s.totalRounds && [s.totalRounds, "ronde tebak kanji total", "累計"],
    [s.daysN3, "hari lagi menuju JLPT N3", "N3まで"],
  ].filter(Boolean);

  const T = [
    { name: "Angka besar", draw(c, p, s) {
      const [v, l, j] = pick(pool(s));
      plate(c, j, 80, 400, F.jp(64), p.a, p.af, -2);
      plate(c, String(v), W / 2, 620, F.num(420), p.b, p.bf, 2, 40, "center");
      txt(c, l, W / 2, 1240, F.head(52), p.ink, "center", 920);
      txt(c, pick(JP), W / 2, 1420, F.jp(88), p.ink, "center", 920);
    } },
    { name: "Checklist", draw(c, p, s) {
      plate(c, "今日のノルマ", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, `${s.done}/4`, 1000, 500, F.num(150), p.ink, "right");
      const rows = [
        ["Anki", `${s.kaishiNew}/15 baru · ${s.reviews} review`, s.st.anki],
        ["Tebak kanji", `${s.rounds}/8 ronde${s.avg != null ? " · " + s.avg + "%" : ""}`, s.st.kanji],
        ["Minna", s.minna.join(" · ") || "belum", s.st.minna],
        ["Kaiwa", s.kaiwa ? s.kaiwa + " sesi" : "belum", s.st.kaiwa],
      ];
      rows.forEach(([t, d, ok], i) => {
        const y = 600 + i * 250;
        c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(80, y, 920, 210);
        txt(c, t, 120, y + 95, F.head(60), p.ink);
        txt(c, d, 120, y + 160, F.mono(32), p.mut, "left", 640);
        stamp(c, 880, y + 105, 72, ok ? "済" : "未", ok ? p.r : p.mut, ok ? -12 : 0);
      });
    } },
    { name: "Struk", draw(c, p, s) {
      const x0 = 150, x1 = 930, k = "#111", m = "#555";
      c.fillStyle = "#FBF8F0"; c.beginPath(); c.moveTo(x0, 380); c.lineTo(x1, 380); c.lineTo(x1, 1580);
      for (let x = x1; x > x0; x -= 30) { c.lineTo(x - 15, 1610); c.lineTo(x - 30, 1580); }
      c.closePath(); c.fill();
      let y = 470;
      const line = () => { txt(c, "- ".repeat(30), 540, y, F.mono(30), m, "center", x1 - x0 - 60); y += 56; };
      txt(c, "日本語 STORE", 540, y, F.head(56), k, "center"); y += 56;
      txt(c, `${s.dateLabel} · bab ${s.bab}`, 540, y, F.mono(30), m, "center"); y += 50;
      line();
      for (const [l, v] of [["Kaishi baru", s.kaishiNew], ["Review Anki", s.reviews], ["Ronde kanji", s.rounds], ["Skor kanji", s.avg != null ? s.avg + "%" : "–"],
        ["Sesi Minna", s.minna.length], ["Kaiwa", s.kaiwa], ["Bank kesalahan", s.mistakes]]) {
        txt(c, l, x0 + 40, y, F.mono(36), k); txt(c, String(v), x1 - 40, y, F.mono(36, 700), k, "right"); y += 62;
      }
      line();
      txt(c, "WAJIB", x0 + 40, y + 20, F.head(60), k); txt(c, `${s.done}/4`, x1 - 40, y + 30, F.num(120), k, "right"); y += 110;
      txt(c, `streak ${s.active} hari`, x0 + 40, y, F.mono(32), m); y += 80;
      txt(c, "ありがとうございました", 540, y, F.jp(40), k, "center"); y += 40;
      c.fillStyle = k;
      for (let x = 300; x < 780;) { const w = 3 + Math.floor(Math.random() * 4) * 3; c.fillRect(x, y, w, 90); x += w + 4 + Math.floor(Math.random() * 3) * 4; }
    } },
    { name: "Countdown", draw(c, p, s) {
      const h = plate(c, "JLPT N3", 80, 400, F.num(170), p.a, p.af, -2);
      plate(c, "JULI 2027", 130, 400 + h + 20, F.num(110), p.b, p.bf, 3);
      txt(c, String(s.daysN3), W / 2, 1200, F.num(520), p.ink, "center");
      txt(c, "hari lagi · あと日", W / 2, 1290, F.jp(56), p.mut, "center");
      const pct = Math.max(0, Math.min(1, 1 - s.daysN3 / s.n3Total));
      c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(80, 1380, 920, 70);
      c.fillStyle = p.a; c.fillRect(86, 1386, 908 * pct, 58);
      txt(c, `${Math.round(pct * 100)}% perjalanan sejak ${s.startLabel}`, 80, 1520, F.mono(34), p.ink);
      txt(c, pick(JP), 80, 1620, F.jp(64), p.ink, "left", 920);
    } },
    { name: "Heatmap", draw(c, p, s) {
      plate(c, "毎日の記録", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, "8 minggu terakhir · 1 kotak = 1 hari · makin pekat = makin lengkap", 80, 560, F.mono(28), p.mut, "left", 920);
      s.heat.forEach((n, i) => {
        const x = 107 + Math.floor(i / 7) * 110, y = 610 + (i % 7) * 110;
        if (n < 0) { c.strokeStyle = p.dot; c.lineWidth = 4; c.strokeRect(x + 2, y + 2, 92, 92); return; }
        c.fillStyle = n ? p.b : p.dot; c.globalAlpha = n ? 0.3 + 0.7 * n / 4 : 1; c.fillRect(x, y, 96, 96); c.globalAlpha = 1;
        if (i === s.heat.length - 1) { c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(x - 6, y - 6, 108, 108); }
      });
      txt(c, `${s.active} hari beruntun · ${s.streak} hari 4/4`, 80, 1470, F.head(48), p.ink, "left", 920);
      txt(c, pick(JP), 80, 1590, F.jp(72), p.ink, "left", 920);
    } },
    { name: "Target minggu", draw(c, p, s) {
      plate(c, "今週の目標", 80, 390, F.jp(76), p.a, p.af, -2);
      s.week.forEach(([l, have, want], i) => {
        const y = 640 + i * 280, ok = have >= want;
        txt(c, l, 80, y, F.head(52), p.ink);
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
        [`minna   ${s.minna.join(", ") || "-"}`, w], [`kaiwa   ${s.kaiwa} sesi`, w],
        [`wajib   ${"█".repeat(s.done)}${"░".repeat(4 - s.done)} ${s.done}/4`, g], [`streak  ${s.active} days`, w],
        [`mistake ${s.mistakes} in bank`, m], ["", w], [`$ echo`, g],
      ];
      rows.forEach(([t, col], i) => txt(c, t, x, 670 + i * 66, F.mono(36, i ? 400 : 700), col, "left", max));
      txt(c, pick(JP), x, 670 + rows.length * 66, F.jp(56), w, "left", max);
      c.fillStyle = g; c.fillRect(x, 670 + rows.length * 66 + 40, 24, 44);
    } },
    { name: "Hanko", draw(c, p, s) {
      stamp(c, W / 2, 820, 330, s.done === 4 ? "完了" : "継続", p.r, -10);
      txt(c, `${s.active}日連続`, W / 2, 1360, F.jp(120), p.ink, "center");
      txt(c, `WAJIB ${s.done}/4 · ${s.rounds} ronde kanji · ${s.reviews} review`, W / 2, 1460, F.mono(34), p.mut, "center", 920);
      txt(c, pick(JP), W / 2, 1590, F.jp(64), p.ink, "center", 920);
    } },
    { name: "Papan skor", draw(c, p, s) {
      plate(c, "成績表", 80, 390, F.jp(76), p.a, p.af, -2);
      const tiles = [
        [s.reviews, "review Anki"], [`${s.rounds}/8`, "ronde kanji"], [s.avg != null ? s.avg + "%" : "–", "skor kanji"],
        [s.kaishiOpened, "kata Kaishi"], [s.kanjiSeen, "kanji ketemu"], [s.active, "hari beruntun"],
      ], hi = Math.floor(Math.random() * tiles.length);
      tiles.forEach(([v, l], i) => {
        const x = 80 + (i % 2) * 480, y = 560 + Math.floor(i / 2) * 340, on = i === hi;
        if (on) { c.fillStyle = p.a; c.fillRect(x, y, 440, 300); } else { c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(x, y, 440, 300); }
        txt(c, String(v), x + 36, y + 190, F.num(170), on ? p.af : p.ink, "left", 370);
        txt(c, l, x + 36, y + 255, F.mono(32), on ? p.af : p.mut);
      });
      txt(c, pick(JP), W / 2, 1640, F.jp(64), p.ink, "center", 920);
    } },
    { name: "Dinding kanji", draw(c, p, s) {
      const h = plate(c, String(s.kanjiSeen), 80, 380, F.num(200), p.a, p.af, -2);
      txt(c, "kanji sudah ketemu", 80 + 30, 380 + h + 70, F.head(48), p.ink);
      const ks = [...s.kanjiList].sort(() => Math.random() - 0.5).slice(0, 36);
      ks.forEach((k, i) => {
        const x = 120 + (i % 6) * 140, y = 760 + Math.floor(i / 6) * 140;
        const on = Math.random() < 0.15;
        if (on) { c.fillStyle = p.b; c.fillRect(x + 6, y + 6, 128, 128); }
        txt(c, k, x + 70, y + 108, F.jp(96), on ? p.bf : p.ink, "center");
      });
    } },
  ];

  window.initFlex = async s => {
    const cv = document.getElementById("flexCanvas"), c = cv.getContext("2d"), chips = document.getElementById("flexChips");
    const sample = "0123456789ABCabc█░" + JP.join("") + s.kanjiList + "今日のノルマ済未毎日の記録今週の目標ログ成績表完了継続連続達成学習漢字クイズ復習単語累計まであとありがとうございました日本語";
    await Promise.all([F.num(80), F.head(40), F.mono(30), F.mono(30, 700), F.jp(40), F.jp(40, 400)].map(f => document.fonts.load(f, sample))).catch(() => {});
    chips.innerHTML = T.map((t, i) => `<button type="button" data-i="${i}">${i + 1}. ${t.name}</button>`).join("");
    let file = null;
    const draw = i => {
      const p = pick(PAL);
      background(c, p); T[i].draw(c, p, s); frame(c, p, s);
      chips.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.i == i));
      file = null; cv.toBlob(b => { file = new File([b], `nihongo-${s.date}.png`, { type: "image/png" }); });
    };
    const save = () => { if (!file) return; const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); };
    chips.onclick = e => { const b = e.target.closest("button"); if (b) draw(+b.dataset.i); };
    document.getElementById("flexShuffle").onclick = () => draw(Math.floor(Math.random() * T.length));
    document.getElementById("flexSave").onclick = save;
    document.getElementById("flexShare").onclick = () => {
      if (file && navigator.canShare?.({ files: [file] })) navigator.share({ files: [file] }).catch(() => {});
      else save();
    };
    draw(Math.floor(Math.random() * T.length));
  };
})();
