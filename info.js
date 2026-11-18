// "Tentang aku" (about.html) and "Metode" (metode.html). Page picked by <body data-page>. Content in id/en/ja.
(async () => {
  const L = o => o[LANG] ?? o.id;
  const D = await fetch("data.json", { cache: "no-cache" }).then(r => r.json()).catch(() => null);
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
  const metode = () => `<h1>${L({ id: "Metode belajar", en: "Study method", ja: "学習方法" })}</h1>` + L({
    id: `<p class="lead">Intinya: <b>tiap hari ada 4 misi</b>. Ukurannya kuota, bukan jam, karena belajarnya di sela dan sesudah kerja.</p>`,
    en: `<p class="lead">In short: <b>4 missions every day</b>. Measured in quotas, not hours, because studying happens around and after work.</p>`,
    ja: `<p class="lead">要するに：<b>毎日4つのミッション</b>。仕事の合間と後に勉強するので、時間ではなくノルマで測る。</p>`,
  }) + `<div class="steps">` +
    step("1", "Anki", L({ id: "15 kata baru + semua review", en: "15 new words + every review", ja: "新しい単語15個 + 復習すべて" }), "±1 h",
      L({ id: "Semua hafalan di sini (kosakata Kaishi, kosakata tiap bab Minna, bentuk kata kerja). Jadi sesi lain tinggal latihan.", en: "All memorizing happens here (Kaishi vocab, each Minna chapter's vocab, verb forms), so the other sessions are just practice.", ja: "暗記はすべてここで（Kaishiの語彙、みんなの各課の語彙、動詞の活用）。他のセッションは練習だけ。" })) +
    step("2", L({ id: "Tebak kanji", en: "Kanji quiz", ja: "漢字クイズ" }), L({ id: "8 ronde × 10 kata", en: "8 rounds × 10 words", ja: "8ラウンド × 10語" }), "1.5–2 h",
      L({ id: "Lihat kanjinya saja, lalu jawab cara baca + arti + 1 kalimat sendiri. Katanya cuma dari yang sudah dipelajari di Anki.", en: "See only the kanji, then answer the reading + meaning + 1 own sentence. Words only come from what's already learned in Anki.", ja: "漢字だけを見て、読み・意味・自作の文1つを答える。出題はAnkiで学んだ語だけ。" })) +
    step("3", "Minna no Nihongo", L({ id: "1 sesi", en: "1 session", ja: "1セッション" }), "45–60 min",
      L({ id: "Tata bahasa: ringkasan pola singkat → latihan banyak → bikin kalimat sendiri. Salah langsung dikoreksi.", en: "Grammar: short pattern summary → lots of practice → write own sentences. Mistakes are corrected on the spot.", ja: "文法：文型の短いまとめ → たくさん練習 → 自分で文を作る。間違いはその場で直す。" })) +
    step("4", L({ id: "Kaiwa", en: "Conversation", ja: "会話" }), L({ id: "5–8 giliran", en: "5–8 turns", ja: "5〜8ターン" }), "15–20 min",
      L({ id: "Ngobrol pura-pura (role-play) pakai pola hari itu, atau shadowing skrip dialog. Ini yang paling penting buat kerja di Jepang.", en: "Role-play using the day's patterns, or shadowing a dialogue script. The most important part for working in Japan.", ja: "その日の文型でロールプレイ、または会話スクリプトのシャドーイング。日本で働くために一番大事。" })) +
    `</div>` + L({
      id: `<h2>Kalau lagi sibuk</h2><p>Urutan prioritas: <b>Anki → review Minna → tebak kanji → kaiwa ringan</b>.</p>
        <h2>Seminggu</h2><p>2 bab Minna per minggu (mulai Januari 3 bab). Sabtu buat ngejar yang ketinggalan, Minggu cukup Anki.</p>
        <h2>Kalau salah</h2><p>Kesalahan masuk <b>Bank kesalahan</b> dan ditanya lagi setelah 1 → 3 → 7 → 14 hari. Benar = jaraknya makin jauh, salah = mulai lagi dari 1 hari.</p>
        <h2>Target</h2>`,
      en: `<h2>On busy days</h2><p>Priority: <b>Anki → Minna review → kanji quiz → light conversation</b>.</p>
        <h2>Each week</h2><p>2 Minna chapters a week (3 from January). Saturday is for catching up, Sunday is Anki only.</p>
        <h2>When I get it wrong</h2><p>Mistakes go into the <b>Mistake bank</b> and come back after 1 → 3 → 7 → 14 days. Right = longer gap, wrong = back to 1 day.</p>
        <h2>Goals</h2>`,
      ja: `<h2>忙しい日は</h2><p>優先順位：<b>Anki → みんなの復習 → 漢字クイズ → 軽い会話</b>。</p>
        <h2>1週間</h2><p>みんなの日本語は週2課（1月からは週3課）。土曜日は遅れを取り戻す日、日曜日はAnkiだけ。</p>
        <h2>間違えたら</h2><p>ミスは<b>ミス帳</b>に入り、1 → 3 → 7 → 14日後にもう一度出る。正解なら間隔が伸び、間違えたら1日に戻る。</p>
        <h2>目標</h2>`,
    }) +
    tbl([L({ id: "Target", en: "Goal", ja: "目標" }), L({ id: "Kapan", en: "When", ja: "時期" }), L({ id: "Sisa", en: "Left", ja: "残り" })],
      (D?.plan.goals || []).map(g => [`${t("goal." + g.id)}<br><small class="muted">${t("goalnote." + g.id)}</small>`, (g.approx ? "±" : "") + fmt(g.date), `${days(g.date)} ${t("d")}`])) +
    `<h2>${L({ id: "Tahapan", en: "Phases", ja: "段階" })}</h2>` +
    tbl([L({ id: "Kapan", en: "When", ja: "時期" }), L({ id: "Isi", en: "What", ja: "内容" })], [
      [L({ id: "Nov 2026 – Feb 2027", en: "Nov 2026 – Feb 2027", ja: "2026年11月〜2027年2月" }), L({ id: "Minna bab 15 → 50, Kaishi 1.500 kata selesai", en: "Minna ch. 15 → 50, all 1,500 Kaishi words", ja: "みんな第15課→第50課、Kaishi 1,500語 完了" })],
      [L({ id: "28 Feb 2027", en: "28 Feb 2027", ja: "2027年2月28日" }), L({ id: "Titik cek: sesuai rencana → N3 Juli, kalau belum → N3 Desember", en: "Checkpoint: on plan → N3 in July, otherwise → N3 in December", ja: "チェックポイント：計画どおりなら7月のN3、そうでなければ12月" })],
      [L({ id: "Mar – Mei 2027", en: "Mar – May 2027", ja: "2027年3〜5月" }), L({ id: "Tata bahasa N3 + kosakata N3 15/hari, JFT-Basic", en: "N3 grammar + N3 vocab 15/day, JFT-Basic", ja: "N3文法 + N3単語1日15語、JFT-Basic" })],
      [L({ id: "Jun 2027", en: "Jun 2027", ja: "2027年6月" }), L({ id: "Latihan soal + listening", en: "Practice tests + listening", ja: "模擬問題 + 聴解" })],
      [L({ id: "Jul 2027", en: "Jul 2027", ja: "2027年7月" }), L({ id: "Ujian JLPT N3", en: "JLPT N3 exam", ja: "JLPT N3 本番" })],
    ]);

  const page = document.body.dataset.page;
  document.getElementById("page").innerHTML = page === "metode" ? metode() : about();
  document.title = `${document.querySelector("#page h1").textContent} · Arsenius`;
  document.querySelector(`[data-nav="${page}"]`)?.setAttribute("aria-current", "page");
})();
