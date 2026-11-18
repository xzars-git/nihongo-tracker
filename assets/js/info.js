// "Tentang aku" (about.html) and "Metode" (metode.html). Page picked by <body data-page>. Content in id/en/ja.
(async () => {
  const L = o => typeof o === "string" ? o : (o[LANG] ?? o.id);
  const D = await fetch("data/data.json", { cache: "no-cache" }).then(r => r.json()).catch(() => null);
  const M = await fetch("data/metode.json").then(r => r.json()).catch(() => null);  // method text lives in data/metode.json
  const A = D?.anki || {}, today = new Date().toISOString().slice(0, 10);
  const days = d => Math.max(0, Math.round((new Date(d) - new Date(today)) / 864e5));
  const loc = t("locale"), fmt = d => new Date(d + "T00:00:00Z").toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const tbl = (head, rows) => `<table class="wt"><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
  const facts = rows => `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;

  const about = () => `<h1>${L({ id: "Tentang aku", en: "About me", ja: "自己紹介" })}</h1>` + L({
    id: `<p class="lead">Halo, aku <b>Arsenius</b>, Flutter developer dari Bandung. Sudah lebih dari 3 tahun menulis Flutter di tempat kerja.</p>
      <p>Sekarang aku belajar bahasa Jepang dari <i>Minna no Nihongo</i>, targetnya <b>JLPT N3 Juli 2027</b>, lalu kerja di bidang IT di Jepang mulai 2028. Aku belajar di sela dan sesudah kerja, ditemani tutor AI. Halaman ini mencatat progresnya dan ter-update otomatis.</p>`,
    en: `<p class="lead">Hi, I'm <b>Arsenius</b>, a Flutter developer from Bandung. I've been writing Flutter at work for over 3 years.</p>
      <p>I'm now learning Japanese with <i>Minna no Nihongo</i>, aiming for <b>JLPT N3 in July 2027</b> and an IT job in Japan from 2028. I study around and after work with an AI tutor. This site tracks the progress and updates itself.</p>`,
    ja: `<p class="lead">こんにちは、バンドンのFlutter開発者<b>アルセニウス</b>です。仕事でFlutterを3年以上書いています。</p>
      <p>今は『みんなの日本語』で日本語を勉強中。目標は<b>2027年7月のJLPT N3</b>、そして2028年から日本でIT関係の仕事をすることです。仕事の合間と後にAIチューターと勉強しています。このサイトは進捗を記録し、自動で更新されます。</p>`,
  }) + facts([
    [L({ id: "Pekerjaan", en: "Job", ja: "仕事" }), L({ id: "Flutter mobile developer", en: "Flutter mobile developer", ja: "Flutterモバイル開発者" })],
    [L({ id: "Tempat kerja", en: "Workplace", ja: "勤務先" }), L({ id: "Bapenda Jabar, sejak Feb 2023", en: "Bapenda Jabar, since Feb 2023", ja: "西ジャワ州歳入庁（2023年2月〜）" })],
    [L({ id: "Kota", en: "City", ja: "都市" }), L({ id: "Bandung, Indonesia", en: "Bandung, Indonesia", ja: "インドネシア・バンドン" })],
    [L({ id: "Sedang belajar", en: "Studying", ja: "学習中" }), D ? `Minna no Nihongo · ${t("fx.bab", { b: D.bab })}` : "–"],
    [L({ id: "Kata Kaishi", en: "Kaishi words", ja: "Kaishi 単語" }), D ? `${A.kaishiOpened} / 1500` : "–"],
    [L({ id: "Kanji sudah ketemu", en: "Kanji seen", ja: "出会った漢字" }), A.kanjiSeen ?? "–"],
    [L({ id: "Target", en: "Goal", ja: "目標" }), `JLPT N3 · ${days("2027-07-04")} ${t("d")}`],
  ]) + `<p><a class="cta" href="https://arsenius-portfolio.vercel.app" target="_blank" rel="noopener">${L({ id: "Lihat portofolio →", en: "See my portfolio →", ja: "ポートフォリオを見る →" })}</a></p>`;

  const step = (n, h, q, tm, d) => `<div class="step"><span class="no">${n}</span><div><h3>${h}</h3><p class="mono small">${q} · ${tm}</p><p>${d}</p></div></div>`;
  const metode = () => !M ? "<p>…</p>" :
    `<h1>${L(M.title)}</h1><p class="lead">${L(M.lead)}</p>
    <div class="steps">${M.steps.map((x, n) => step(n + 1, L(x.title), L(x.quota), x.time, L(x.text))).join("")}</div>` +
    M.sections.map(x => `<h2>${L(x.h)}</h2><p>${L(x.p)}</p>`).join("") +
    `<h2>${L(M.goalsH)}</h2>` +
    tbl(M.goalCols.map(L), (D?.plan.goals || []).map(g => [`${t("goal." + g.id)}<br><small class="muted">${t("goalnote." + g.id)}</small>`, (g.approx ? "±" : "") + fmt(g.date), `${days(g.date)} ${t("d")}`])) +
    `<h2>${L(M.phasesH)}</h2>` + tbl(M.phaseCols.map(L), M.phases.map(x => [L(x.when), L(x.what)]));

  const page = document.body.dataset.page;
  document.getElementById("page").innerHTML = page === "metode" ? metode() : about();
  document.title = `${document.querySelector("#page h1").textContent} · Arsenius`;
  document.querySelector(`[data-nav="${page}"]`)?.setAttribute("aria-current", "page");
})();
