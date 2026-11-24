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

  const T = {
    stats(c, p, s) {
      plate(c, "今日の勉強", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, s.hm, 80, 740, LANG === "ja" ? F.jp(170) : F.num(300), p.ink, "left", 920);
      txt(c, t("fx.studyToday") + (s.minEst ? " · " + t("fx.estNote") : ""), 80, 805, sub(32), p.mut, "left", 920);
      txt(c, s.hoursSub, 80, 850, sub(28), p.mut, "left", 920);
      [[s.reviews, "fx.t1"], [s.kaishiNew, "fx.r.kaishiNew"], [s.rounds + (s.avg != null ? ` · ${s.avg}%` : ""), "fx.r.rounds"], [s.active, "fx.t6"]]
        .forEach(([v, l], i) => tile(c, p, 80 + (i % 2) * 480, 910 + Math.floor(i / 2) * 215, v, t(l), i === 0));
      // last 7 days, hours per day: consistency, not just today
      const y0 = 1480, hMax = 110, mx = Math.max(60, ...s.week7.map(x => x[1]));
      txt(c, `${t("fx.week7")} · ${t("fx.total", { t: s.totalHm })}`, 80, 1425, sub(28), p.mut, "left", 920);
      s.week7.forEach(([d, m], i) => {
        const x = 80 + i * 134, h = Math.max(6, hMax * m / mx);
        c.fillStyle = i === 6 ? p.a : p.b; c.globalAlpha = m ? 1 : 0.25; c.fillRect(x, y0 + hMax - h, 110, h); c.globalAlpha = 1;
        txt(c, String(+d.slice(8)), x + 55, y0 + hMax + 38, F.mono(26), p.mut, "center");
      });
    },
    week(c, p, s) {
      const r = s.recap;
      plate(c, "今週のまとめ", 80, 390, F.jp(76), p.a, p.af, -2);
      txt(c, t("fx.rc.sub"), 80, 560, sub(30), p.mut, "left", 920);
      txt(c, s.recapHm, 80, 790, LANG === "ja" ? F.jp(150) : F.num(260), p.ink, "left", 920);
      txt(c, t("fx.rc.hours") + (r.est ? " · " + t("fx.estNote") : ""), 80, 860, sub(32), p.mut, "left", 920);
      [[t("fx.rc.days"), `${r.days}/${r.of}`], [t("fx.rc.kaishi"), r.kaishi], [t("fx.rc.reviews"), r.reviews], [t("fx.rc.rounds"), r.rounds + (r.avg != null ? " · " + r.avg + "%" : "")]].forEach(([l, v], i) => {
        const y = 960 + i * 125; c.strokeStyle = p.ink; c.lineWidth = 5; c.strokeRect(80, y, 920, 100);
        txt(c, l, 110, y + 64, lab(38), p.ink, "left", 500); txt(c, String(v), 970, y + 70, F.num(64), p.ink, "right", 380);
      });
    },
  };
  // progress status: same levels as the dashboard alert cards (lv -1 = on pace)
  const LVC = [["#F2C200", "#111"], ["#FF5A5F", "#111"], ["#D1202F", "#fff"], ["#111", "#F2C200"]];
  const LVT = ["WARNING", "BEHIND", "CRITICAL ALERT", "CRITICAL ALERT"];
  T.status = (c, p, s) => {
    const worst = s.prog.reduce((a, b) => b.lv > a.lv ? b : a), lv = worst.lv, ok = lv < 0;
    plate(c, "進捗ステータス", 80, 390, F.jp(76), p.a, p.af, -2);
    const [bg, fg] = ok ? [p.b, p.bf] : LVC[lv];
    plate(c, ok ? "ON TRACK" : LVT[lv], 80, 560, F.head(110), bg, fg, -2, 34);
    txt(c, t(ok ? "fx.st.ok" : "fx.st.late"), 80, 800, sub(30), p.mut, "left", 920);
    s.prog.forEach((g, i) => {
      const y = 850 + i * 370;
      c.strokeStyle = p.ink; c.lineWidth = 6; c.strokeRect(80, y, 920, 335);
      txt(c, g.name, 112, y + 66, lab(44), p.ink, "left", 560);
      txt(c, `${g.have} / ${g.goal}`, 112, y + 112, sub(30), p.mut, "left", 560);
      txt(c, g.integ + "%", 968, y + 100, F.num(110), p.ink, "right", 330);
      c.strokeRect(112, y + 140, 856, 40);
      c.fillStyle = g.lv < 0 ? p.b : LVC[g.lv][0]; c.fillRect(112, y + 140, 856 * Math.min(100, g.integ) / 100, 40);
      txt(c, "THREAT LEVEL", 112, y + 232, F.mono(24, 700), p.mut);
      for (let k = 0; k < 10; k++) {
        const x = 112 + k * 86;
        if (k < g.thr) { c.fillStyle = LVC[Math.max(g.lv, 0)][0]; c.fillRect(x, y + 246, 76, 34); } else { c.lineWidth = 4; c.strokeRect(x, y + 246, 76, 34); }
      }
      txt(c, g.lv < 0 ? t("fx.st.fine") : t("fx.st.need", { n: Math.ceil(g.r), u: t(g.unit), norm: Math.round(g.norm) }), 112, y + 316, sub(26), p.mut, "left", 840);
    });
  };
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };

  window.initFlex = async s => {
    const cv = document.getElementById("flexCanvas"), c = cv.getContext("2d");
    const $ = id => document.getElementById(id), share = $("flexShare"), save = $("flexSave");
    const sample = "0123456789ABCabc今日の勉強今週のまとめ進捗ステータス日連続N2まであと" + ["fx.t1", "fx.r.kaishiNew", "fx.r.rounds", "fx.t6", "fx.studyToday", "fx.estNote", "fx.week7", "fx.total",
        "fx.st.ok", "fx.st.late", "fx.st.fine", "fx.st.need", "fx.st.words", "fx.st.chapters", "fx.rc.hours", "fx.rc.days", "fx.rc.kaishi", "fx.rc.rounds", "fx.rc.reviews", "fx.rc.sub"].map(k => t(k)).join("") + s.dateLabel + s.hoursSub + s.quotes.map(x => x.q + x.by + (x.tr ? x.tr.id + x.tr.en : "")).join("");
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
    const draw = () => {
      const p = PAL[st.pal], q = showQuote && st.q ? st.q : null, k = q ? 0.75 : 0.906;
      background(c, p);
      c.save(); c.translate(W / 2, 400); c.scale(k, k); c.translate(-W / 2, -370);  // squeeze content into the IG safe area
      T[st.mode](c, p, s);
      c.restore();
      frame(c, p, s);
      if (st.pal === 5) { c.strokeStyle = p.a; c.lineWidth = 10; c.strokeRect(30, 30, 1020, 1860); c.lineWidth = 3; c.strokeRect(54, 54, 972, 1812); }
      if (q) quoteBlock(c, p, q);
      document.querySelectorAll("#flexStats, #flexWeek, #flexStatus").forEach(b => b.setAttribute("aria-pressed", b.id === "flex" + st.mode[0].toUpperCase() + st.mode.slice(1)));
      file = null; share.disabled = save.disabled = true; share.textContent = t("fx.preparing");
      cv.toBlob(b => { file = new File([b], `nihongo-${s.date}${st.mode === "stats" ? "" : "-" + st.mode}.png`, { type: "image/png" }); share.textContent = t("fx.share"); share.disabled = save.disabled = false; });
    };
    $("flexStats").onclick = () => { st.mode = "stats"; draw(); };
    $("flexWeek").onclick = () => { st.mode = "week"; draw(); };
    $("flexStatus").onclick = () => { st.mode = "status"; draw(); };
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
      const w = s.done === 4 ? { common: 40, rare: 35, epic: 18, legendary: 7 } : { common: 60, rare: 25, epic: 12, legendary: 3 };
      if (s.streak >= 7) w.legendary *= 2;
      const pity = store("fxPity") || 0;
      if (pity >= 10) w.common = 0;
      const keys = Object.keys(w).filter(r => w[r]), sum = keys.reduce((x, r) => x + w[r], 0);
      let n = Math.random() * sum, r = keys[0];
      for (const k of keys) { if ((n -= w[k]) < 0) { r = k; break; } }
      store("fxPity", r === "common" ? pity + 1 : 0);
      st.pal = pick(RAR[r]); store("fxPal", st.pal); col.add(st.pal); store("fxCol", [...col]); draw();
      line(`> gacha_pull ${s.date}`, "cmd"); await sleep(250);
      line(`must ${s.done}/4 · streak ${s.active}`, "dim"); await sleep(250);
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
