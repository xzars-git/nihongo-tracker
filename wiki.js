// Ganbapedia: game-wiki style pages about Arsenius and the study method. Content in id/en/ja; live numbers from data.json.
(async () => {
  const NAME = "Ganbapedia", NAME_JA = "頑張ペディア";
  const L = o => o[LANG] ?? o.id;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const D = await fetch("data.json", { cache: "no-cache" }).then(r => r.json()).catch(() => null);
  const A = D?.anki || {}, today = new Date().toISOString().slice(0, 10);
  const days = d => Math.round((new Date(d) - new Date(today)) / 864e5);
  const loc = t("locale"), fmt = d => new Date(d + "T00:00:00Z").toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const ui = {
    tagline: { id: "Wiki resmi perjalanan Arsenius menuju JLPT N3", en: "The official wiki of Arsenius's road to JLPT N3", ja: "アルセニウスのJLPT N3への道・公式wiki" },
    back: { id: "← Tracker", en: "← Tracker", ja: "← トラッカー" },
    pages: { id: "Halaman", en: "Pages", ja: "ページ" },
    edited: { id: "Data halaman ini terakhir diperbarui", en: "Live data on this page last updated", ja: "このページのデータ最終更新" },
    contents: { id: "Daftar isi", en: "Contents", ja: "目次" },
  };
  const box = (title, rows, emblem) => `<aside class="ibox"><h3>${title}</h3>${emblem ? `<div class="emb">${emblem}</div>` : ""}<table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table></aside>`;
  const tbl = (head, rows) => `<table class="wt"><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
  const card = (cls, title, meta, body) => `<div class="wcard ${cls}"><h3>${title}</h3><dl>${meta.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>${body}</div>`;

  const PAGES = {
    metode: {
      icon: "📘", title: { id: "Metode belajar", en: "Study method", ja: "学習方法" },
      body: () => L({
        id: `<p class="lead">Intinya: <b>tiap hari ada 4 misi</b>. Ukurannya kuota, bukan jam, karena belajarnya di sela dan sesudah kerja.</p>`,
        en: `<p class="lead">In short: <b>4 missions every day</b>. Measured in quotas, not hours, because studying happens around and after work.</p>`,
        ja: `<p class="lead">要するに：<b>毎日4つのミッション</b>。仕事の合間と後に勉強するので、時間ではなくノルマで測る。</p>`,
      }) + `<div class="steps">` + [
        ["1", "Anki", L({ id: "15 kata baru + semua review", en: "15 new words + every review", ja: "新しい単語15個 + 復習すべて" }), "±1 h",
          L({ id: "Semua hafalan di sini (kosakata Kaishi, kosakata tiap bab Minna, bentuk kata kerja). Jadi sesi lain tinggal latihan.", en: "All memorizing happens here (Kaishi vocab, each Minna chapter's vocab, verb forms), so the other sessions are just practice.", ja: "暗記はすべてここで（Kaishiの語彙、みんなの各課の語彙、動詞の活用）。他のセッションは練習だけ。" })],
        ["2", L({ id: "Tebak kanji", en: "Kanji quiz", ja: "漢字クイズ" }), L({ id: "8 ronde × 10 kata", en: "8 rounds × 10 words", ja: "8ラウンド × 10語" }), "1.5–2 h",
          L({ id: "Lihat kanjinya saja, lalu jawab cara baca + arti + 1 kalimat sendiri. Katanya cuma dari yang sudah dipelajari di Anki.", en: "See only the kanji, then answer the reading + meaning + 1 own sentence. Words only come from what's already learned in Anki.", ja: "漢字だけを見て、読み・意味・自作の文1つを答える。出題はAnkiで学んだ語だけ。" })],
        ["3", "Minna no Nihongo", L({ id: "1 sesi", en: "1 session", ja: "1セッション" }), "45–60 min",
          L({ id: "Tata bahasa: ringkasan pola singkat → latihan banyak → bikin kalimat sendiri. Salah langsung dikoreksi.", en: "Grammar: short pattern summary → lots of practice → write own sentences. Mistakes are corrected on the spot.", ja: "文法：文型の短いまとめ → たくさん練習 → 自分で文を作る。間違いはその場で直す。" })],
        ["4", L({ id: "Kaiwa", en: "Conversation", ja: "会話" }), L({ id: "5–8 giliran", en: "5–8 turns", ja: "5〜8ターン" }), "15–20 min",
          L({ id: "Ngobrol pura-pura (role-play) pakai pola hari itu, atau shadowing skrip dialog. Ini yang paling penting buat kerja di Jepang.", en: "Role-play using the day's patterns, or shadowing a dialogue script. The most important part for working in Japan.", ja: "その日の文型でロールプレイ、または会話スクリプトのシャドーイング。日本で働くために一番大事。" })],
      ].map(([n, h, q, tm, d]) => `<div class="step"><span class="no">${n}</span><div><h3>${h}</h3><p class="mono small">${q} · ${tm}</p><p>${d}</p></div></div>`).join("") + `</div>` +
      L({
        id: `<h2>Kalau lagi sibuk</h2><p>Urutan prioritas: <b>Anki → review Minna → tebak kanji → kaiwa ringan</b>.</p>
          <h2>Seminggu</h2><p>2 bab Minna per minggu (mulai Januari 3 bab). Sabtu buat ngejar yang ketinggalan, Minggu cukup Anki.</p>
          <h2>Kalau salah</h2><p>Kesalahan masuk <b>Bank kesalahan</b> dan ditanya lagi setelah 1 → 3 → 7 → 14 hari. Benar = jaraknya makin jauh, salah = mulai lagi dari 1 hari.</p>
          <h2>Tujuannya</h2><p>JLPT N3 Juli 2027 → kerja IT di Jepang 2028. Detailnya di <a href="#quest">Quest</a>.</p>`,
        en: `<h2>On busy days</h2><p>Priority: <b>Anki → Minna review → kanji quiz → light conversation</b>.</p>
          <h2>Each week</h2><p>2 Minna chapters a week (3 from January). Saturday is for catching up, Sunday is Anki only.</p>
          <h2>When I get it wrong</h2><p>Mistakes go into the <b>Mistake bank</b> and come back after 1 → 3 → 7 → 14 days. Right = longer gap, wrong = back to 1 day.</p>
          <h2>The goal</h2><p>JLPT N3 in July 2027 → IT job in Japan in 2028. Details in <a href="#quest">Quests</a>.</p>`,
        ja: `<h2>忙しい日は</h2><p>優先順位：<b>Anki → みんなの復習 → 漢字クイズ → 軽い会話</b>。</p>
          <h2>1週間</h2><p>みんなの日本語は週2課（1月からは週3課）。土曜日は遅れを取り戻す日、日曜日はAnkiだけ。</p>
          <h2>間違えたら</h2><p>ミスは<b>ミス帳</b>に入り、1 → 3 → 7 → 14日後にもう一度出る。正解なら間隔が伸び、間違えたら1日に戻る。</p>
          <h2>目標</h2><p>2027年7月にJLPT N3 → 2028年に日本でIT就職。詳しくは<a href="#quest">クエスト</a>へ。</p>`,
      }),
    },
    karakter: {
      icon: "👤", title: { id: "Karakter: Arsenius", en: "Character: Arsenius", ja: "キャラクター：アルセニウス" },
      body: () => box("Arsenius", [
        [L({ id: "Kelas", en: "Class", ja: "クラス" }), L({ id: "Flutter mobile developer", en: "Flutter mobile developer", ja: "Flutterモバイル開発者" })],
        [L({ id: "Guild", en: "Guild", ja: "ギルド" }), L({ id: "Bapenda Jabar (sejak Feb 2023)", en: "Bapenda Jabar (since Feb 2023)", ja: "西ジャワ州歳入庁（2023年2月〜）" })],
        [L({ id: "Markas", en: "Base", ja: "拠点" }), L({ id: "Bandung, Indonesia", en: "Bandung, Indonesia", ja: "インドネシア・バンドン" })],
        [L({ id: "Level", en: "Level", ja: "レベル" }), D ? t("fx.bab", { b: D.bab }) + " · Minna no Nihongo" : "–"],
        [L({ id: "Quest utama", en: "Main quest", ja: "メインクエスト" }), `JLPT N3 · ${days("2027-07-04")} ${t("d")}`],
        ["Kaishi", D ? `${A.kaishiOpened} / 1500` : "–"],
        [L({ id: "Kanji ketemu", en: "Kanji seen", ja: "出会った漢字" }), A.kanjiSeen ?? "–"],
        [L({ id: "Sesi tercatat", en: "Sessions logged", ja: "記録済みセッション" }), D?.sessions.length ?? "–"],
        [L({ id: "Bahasa", en: "Languages", ja: "言語" }), L({ id: "Indonesia · Jepang (sedang dipelajari)", en: "Indonesian · Japanese (learning)", ja: "インドネシア語 · 日本語（学習中）" })],
      ], "ア") + L({
        id: `<p><b>Arsenius</b> adalah Flutter developer dari Bandung yang sudah lebih dari 3 tahun menulis Flutter di tempat kerja. Petualangannya sekarang: menaklukkan bahasa Jepang dari <i>Minna no Nihongo</i> sampai <b>JLPT N3</b>, lalu bekerja di bidang IT di Jepang mulai 2028.</p>
          <p>Gaya bertarungnya: <b>kuota harian, bukan jam</b>. Dia belajar di sela dan sesudah kerja, jadi setiap hari punya 4 misi WAJIB yang harus beres (lihat <a href="#skill">Skill</a>).</p>
          <p>Semua latihan dilakukan bersama tutor AI di sesi terpisah. Hasilnya dicatat, lalu tracker dan wiki ini diperbarui otomatis tiap jam.</p>`,
        en: `<p><b>Arsenius</b> is a Flutter developer from Bandung who has been writing Flutter at work for over 3 years. His current adventure: conquering Japanese from <i>Minna no Nihongo</i> up to <b>JLPT N3</b>, then working in IT in Japan from 2028.</p>
          <p>His fighting style: <b>daily quotas, not hours</b>. He studies around and after work, so every day has 4 MUST missions to clear (see <a href="#skill">Skills</a>).</p>
          <p>All practice happens with an AI tutor in separate sessions. Results are logged, and this tracker and wiki update automatically every hour.</p>`,
        ja: `<p><b>アルセニウス</b>はバンドン出身のFlutter開発者で、仕事でFlutterを3年以上書いている。今の冒険は『みんなの日本語』から<b>JLPT N3</b>まで日本語を攻略し、2028年から日本のIT業界で働くこと。</p>
          <p>戦い方は<b>時間ではなく1日のノルマ</b>。仕事の合間と仕事の後に勉強するので、毎日4つの必須ミッションをこなす（<a href="#skill">スキル</a>参照）。</p>
          <p>練習はすべて別セッションのAIチューターと行う。結果は記録され、このトラッカーとwikiは1時間ごとに自動更新される。</p>`,
      }) + `<p><a class="cta" href="https://arsenius-portfolio.vercel.app" target="_blank" rel="noopener">${L({ id: "Lihat portofolio →", en: "See the portfolio →", ja: "ポートフォリオを見る →" })}</a></p>`,
    },
    skill: {
      icon: "⚔️", title: { id: "Skill (4 pilar)", en: "Skills (4 pillars)", ja: "スキル（4本柱）" },
      body: () => {
        const k = { type: L({ id: "Tipe", en: "Type", ja: "タイプ" }), q: L({ id: "Kuota/hari", en: "Daily quota", ja: "1日のノルマ" }), time: L({ id: "Waktu", en: "Time", ja: "時間" }) };
        return L({ id: "<p>Empat skill WAJIB dipakai tiap hari. Total ±3,5–4,5 jam.</p>", en: "<p>Four MUST skills, used every day. About 3.5–4.5 hours in total.</p>", ja: "<p>毎日使う4つの必須スキル。合計 約3.5〜4.5時間。</p>" }) +
        `<div class="cards">` +
        card("s-anki", "Anki · 暗記", [[k.type, L({ id: "Hafalan (pasif)", en: "Memorization (passive)", ja: "暗記（パッシブ）" })], [k.q, L({ id: "15 kartu baru Kaishi + semua review", en: "15 new Kaishi cards + every review", ja: "Kaishi新規15枚 + 復習すべて" })], [k.time, "±60 min"]],
          L({ id: "<p>Semua hafalan ada di Anki, jadi sesi lain fokus latihan. Deck: Kaishi 1.5k, deck Minna per bab, deck kata kerja て/た/ない.</p><p><b>Scaling:</b> naik ke 20/hari kalau Hard &lt; 30/hari, turun ke 10 kalau Hard/Again melonjak.</p>",
             en: "<p>All memorization lives in Anki, so the other sessions are pure practice. Decks: Kaishi 1.5k, one Minna deck per chapter, the て/た/ない verb deck.</p><p><b>Scaling:</b> up to 20/day when Hard &lt; 30/day, down to 10 when Hard/Again spikes.</p>",
             ja: "<p>暗記はすべてAnkiで行い、他のセッションは練習に集中する。デッキ：Kaishi 1.5k、課ごとのみんなデッキ、て/た/ない動詞デッキ。</p><p><b>成長：</b>Hardが1日30未満なら1日20枚に、Hard/Againが急増したら10枚に。</p>" })) +
        card("s-minna", "Minna no Nihongo · 文法", [[k.type, L({ id: "Tata bahasa", en: "Grammar", ja: "文法" })], [k.q, L({ id: "1 sesi", en: "1 session", ja: "1セッション" })], [k.time, "45–60 min"]],
          L({ id: "<p>Per bab: recap pola singkat (≤10 baris) → latihan sebanyak-banyaknya → buat kalimat sendiri. Review pakai set A (konversi), B (kalimat), C (buat kalimat: 2 dengan hint, 1 dari nol). Kuis tanpa hint; salah langsung dikoreksi dengan alasannya.</p>",
             en: "<p>Per chapter: a short pattern recap (≤10 lines) → as much practice as possible → own sentences. Reviews use set A (conversion), B (sentences), C (writing: 2 with hints, 1 from scratch). Quizzes have no hints; mistakes are corrected on the spot with the reason.</p>",
             ja: "<p>課ごとに：文型の短いまとめ（10行以内）→ できるだけ多く練習 → 自分で文を作る。復習はA（変換）、B（文）、C（作文：ヒントあり2問、ゼロから1問）。クイズはヒントなし、間違いはその場で理由と一緒に訂正。</p>" })) +
        card("s-kanji", "Tebak kanji · 漢字", [[k.type, L({ id: "Recall", en: "Recall", ja: "想起" })], [k.q, L({ id: "≥8 ronde × 10 kata", en: "≥8 rounds × 10 words", ja: "8ラウンド以上 × 10語" })], [k.time, "1.5–2 h"]],
          L({ id: "<p>Hanya kanji, tanpa furigana atau arti. Kata HANYA dari yang sudah dipelajari di Anki. Jawab: bacaan + arti + 1 kalimat buatan sendiri. Pakai tombol Buka → cukup kalimat. Pakai clue → tercatat.</p>",
             en: "<p>Kanji only, no furigana or meaning. Words come ONLY from what is already learned in Anki. Answer: reading + meaning + 1 original sentence. Used the Reveal button → the sentence is enough. Used a clue → it gets logged.</p>",
             ja: "<p>漢字だけ（ふりがな・意味なし）。出題はAnkiで学習済みの語のみ。答え：読み + 意味 + 自作の文1つ。「開く」を使ったら文だけでOK。ヒントを使ったら記録される。</p>" })) +
        card("s-kaiwa", "Kaiwa · 会話", [[k.type, L({ id: "Bicara (ultimate)", en: "Speaking (ultimate)", ja: "会話（必殺技）" })], [k.q, L({ id: "5–8 giliran atau 1 skrip shadowing", en: "5–8 turns or 1 shadowing script", ja: "5〜8ターン、またはシャドーイング1本" })], [k.time, "15–20 min"]],
          L({ id: "<p>Role-play pakai pola dan kata hari itu, atau shadowing skrip dialog. Dilatih tiap hari karena tujuan akhirnya kerja di Jepang.</p>",
             en: "<p>Role-play with the day's patterns and words, or shadowing a dialogue script. Trained daily because the end goal is working in Japan.</p>",
             ja: "<p>その日の文型と単語でロールプレイ、または会話スクリプトのシャドーイング。最終目標が日本での仕事なので毎日練習する。</p>" })) +
        `</div>` +
        L({ id: "<h2>Bonus</h2><p>Jikoshoukai (自己紹介), bab Minna ekstra, tambahan kaiwa.</p><h2>Prioritas kalau sibuk</h2><p class='combo'>Anki → review Minna → tebak kanji → kaiwa ringan</p>",
           en: "<h2>Bonus</h2><p>Jikoshoukai (自己紹介), an extra Minna chapter, extra conversation.</p><h2>Priority on busy days</h2><p class='combo'>Anki → Minna review → kanji quiz → light conversation</p>",
           ja: "<h2>ボーナス</h2><p>自己紹介、みんなの日本語の追加の課、追加の会話。</p><h2>忙しい日の優先順位</h2><p class='combo'>Anki → みんな復習 → 漢字クイズ → 軽い会話</p>" });
      },
    },
    quest: {
      icon: "🗺️", title: { id: "Quest & target", en: "Quests & goals", ja: "クエストと目標" },
      body: () => {
        const g = D?.plan.goals || [];
        return L({ id: "<p>Syarat N3: ±3.700 kosakata dan ±650 kanji.</p>", en: "<p>N3 requires roughly 3,700 words and 650 kanji.</p>", ja: "<p>N3の目安：語彙 約3,700語、漢字 約650字。</p>" }) +
          `<h2>${L({ id: "Quest utama", en: "Main quests", ja: "メインクエスト" })}</h2>` +
          tbl([L({ id: "Quest", en: "Quest", ja: "クエスト" }), L({ id: "Tanggal", en: "Date", ja: "日付" }), L({ id: "Sisa", en: "Left", ja: "残り" }), L({ id: "Catatan", en: "Notes", ja: "メモ" })],
            g.map(x => [t("goal." + x.id), (x.approx ? "±" : "") + fmt(x.date), `${Math.max(0, days(x.date))} ${t("d")}`, esc(t("goalnote." + x.id))])) +
          `<h2>${L({ id: "Babak", en: "Acts", ja: "章" })}</h2>` +
          tbl([L({ id: "Babak", en: "Act", ja: "章" }), L({ id: "Periode", en: "Period", ja: "期間" }), L({ id: "Isi", en: "Content", ja: "内容" })], [
            ["I", L({ id: "16 Nov 2026 – 28 Feb 2027", en: "16 Nov 2026 – 28 Feb 2027", ja: "2026年11月16日〜2027年2月28日" }), L({ id: "Minna bab 15 → 50, Kaishi selesai, ±300 kanji", en: "Minna ch. 15 → 50, Kaishi finished, ~300 kanji", ja: "みんな第15課→第50課、Kaishi完了、漢字約300字" })],
            ["⚑", L({ id: "28 Feb 2027", en: "28 Feb 2027", ja: "2027年2月28日" }), L({ id: "Titik cek: bab 50 + Kaishi selesai? Ya → N3 Juli. Tidak → N3 Desember", en: "Checkpoint: ch. 50 + Kaishi done? Yes → N3 in July. No → N3 in December", ja: "チェックポイント：第50課 + Kaishi完了？はい→7月のN3、いいえ→12月" })],
            ["II", L({ id: "Mar – Mei 2027", en: "Mar – May 2027", ja: "2027年3〜5月" }), L({ id: "Tata bahasa N3 (Shin Kanzen Master / Try! N3), deck kosakata N3 15/hari (±1.900 kata), kanji → ±650", en: "N3 grammar (Shin Kanzen Master / Try! N3), N3 vocab deck 15/day (~1,900 words), kanji → ~650", ja: "N3文法（新完全マスター / Try! N3）、N3単語デッキ1日15語（約1,900語）、漢字→約650字" })],
            ["III", L({ id: "Jun 2027", en: "Jun 2027", ja: "2027年6月" }), L({ id: "Soal latihan JLPT + listening, review kesalahan", en: "JLPT practice tests + listening, mistake review", ja: "JLPT模擬問題 + 聴解、ミスの復習" })],
          ]) +
          `<h2>${L({ id: "Side quest", en: "Side quests", ja: "サブクエスト" })}</h2><ul><li>${L({ id: "Minna I (bab 25) selesai ±akhir Des 2026", en: "Finish Minna I (ch. 25) by ~end of Dec 2026", ja: "みんなの日本語 I（第25課）を2026年12月末ごろまでに完了" })}</li><li>${L({ id: "Sebelum Q3 2027 punya bukti kemampuan apa pun di CV (JFT-Basic / hasil N3 / \"menunggu hasil\")", en: "Have some proof of ability on the CV before Q3 2027 (JFT-Basic / N3 result / \"awaiting result\")", ja: "2027年第3四半期までに履歴書に書ける証明を用意（JFT-Basic / N3結果 / 結果待ち）" })}</li></ul>`;
      },
    },
    rotasi: {
      icon: "📅", title: { id: "Rotasi mingguan", en: "Weekly rotation", ja: "週のローテーション" },
      body: () => L({ id: "<p>Ukuran belajar = kuota, bukan jam (part-time learner). Target mingguan wajib tercapai tapi fleksibel: lebih cepat → majukan bab; tertinggal → Sabtu jadi hari kejar.</p>",
                      en: "<p>Progress is measured in quotas, not hours (part-time learner). Weekly targets are a must but flexible: ahead → pull the next chapter forward; behind → Saturday becomes catch-up day.</p>",
                      ja: "<p>学習量は時間ではなくノルマで測る（社会人学習者）。週の目標は必須だが柔軟に：早く終われば次の課を前倒し、遅れたら土曜日に追いつく。</p>" }) +
        tbl([L({ id: "Hari", en: "Day", ja: "曜日" }), L({ id: "Nov–Des (2 bab/minggu)", en: "Nov–Dec (2 ch./week)", ja: "11〜12月（週2課）" }), L({ id: "Jan dst (3 bab/minggu)", en: "Jan onward (3 ch./week)", ja: "1月以降（週3課）" })],
          [["mon", "materi", "materi"], ["tue", "review A/B/C", "review"], ["wed", "materi", "materi"], ["thu", "review", "review"], ["fri", "review gabungan + kaiwa", "materi"], ["sat", "ringan / kejar", "review"], ["sun", "Anki saja", "Anki saja"]]
            .map(([d, a, b]) => [new Date(Date.UTC(2026, 10, 16 + ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(d))).toLocaleDateString(loc, { weekday: "long", timeZone: "UTC" }), tr(a), tr(b)])),
    },
    bestiary: {
      icon: "👾", title: { id: "Bestiary (kesalahan)", en: "Bestiary (mistakes)", ja: "モンスター図鑑（ミス）" },
      body: () => L({ id: `<p>Monster = jenis kesalahan yang paling sering muncul. Tiap kesalahan yang tertangkap masuk <b>Bank kesalahan</b> (sekarang ${D?.mistakes.length ?? "–"} item) dan muncul lagi dengan interval 1 → 3 → 7 → 14 hari. Benar tanpa hint = interval naik; salah = kembali ke 1.</p>`,
                      en: `<p>Monsters = the mistake types that show up most. Every caught mistake goes into the <b>Mistake bank</b> (${D?.mistakes.length ?? "–"} items now) and respawns after 1 → 3 → 7 → 14 days. Right without a hint = longer interval; wrong = back to 1.</p>`,
                      ja: `<p>モンスター＝よく出るミスの種類。捕まえたミスは<b>ミス帳</b>（現在${D?.mistakes.length ?? "–"}件）に入り、1 → 3 → 7 → 14日後に再出現。ヒントなしで正解＝間隔アップ、間違い＝1日に戻る。</p>` }) +
        `<div class="cards">` +
        card("m1", L({ id: "Hydra Partikel · 助詞", en: "Particle Hydra · 助詞", ja: "助詞ヒドラ" }), [[L({ id: "Bahaya", en: "Threat", ja: "危険度" }), "★★★"]],
          "<p>好き/嫌い → が · ある/います → が + に · 住む → に · 働く → で · 会う → に · 話す (" + L({ id: "dengan", en: "with", ja: "相手" }) + ") → と</p>") +
        card("m2", L({ id: "Mimik Kembar · 似た言葉", en: "Twin Mimics · 似た言葉", ja: "そっくりミミック" }), [[L({ id: "Bahaya", en: "Threat", ja: "危険度" }), "★★"]],
          "<p>教える/帰る · 使う/作る · 見る/する · 出来る/あげる · 押して/教えて</p>") +
        card("m3", L({ id: "Golem Bentuk て", en: "て-form Golem", ja: "て形ゴーレム" }), [[L({ id: "Bahaya", en: "Threat", ja: "危険度" }), "★★"]],
          L({ id: "<p>Golongan 1 berakhiran -う/-つ/-る → って. Pengecualian: 言う → 言って, 行く → 行って.</p>", en: "<p>Group 1 verbs ending in -う/-つ/-る → って. Watch out: 言う → 言って, 行く → 行って.</p>", ja: "<p>1グループで-う/-つ/-るで終わる動詞 → って。注意：言う → 言って、行く → 行って。</p>" })) +
        card("m4", L({ id: "Kalimat Hampa · 空っぽの文", en: "Hollow Sentence · 空っぽの文", ja: "空っぽの文" }), [[L({ id: "Bahaya", en: "Threat", ja: "危険度" }), "★"]],
          L({ id: "<p>Kalimat kosong atau terpotong. Penangkal: tulis kalimat pendek lengkap, misalnya <code>X が V ます</code>.</p>", en: "<p>Empty or cut-off sentences. Counter: write a short complete sentence, e.g. <code>X が V ます</code>.</p>", ja: "<p>中身がない・途中で切れた文。対策：<code>X が V ます</code>のような短く完全な文を書く。</p>" })) +
        `</div>`,
    },
    item: {
      icon: "🎒", title: { id: "Item & perlengkapan", en: "Items & gear", ja: "アイテムと装備" },
      body: () => tbl([L({ id: "Item", en: "Item", ja: "アイテム" }), L({ id: "Slot", en: "Slot", ja: "スロット" }), L({ id: "Efek", en: "Effect", ja: "効果" })], [
        ["Minna no Nihongo Shokyu I · II", L({ id: "Senjata utama", en: "Main weapon", ja: "メイン武器" }), L({ id: "Tata bahasa bab 1–50", en: "Grammar, chapters 1–50", ja: "文法 第1〜50課" })],
        ["Kaishi 1.5k (Anki)", L({ id: "Aksesori", en: "Accessory", ja: "アクセサリー" }), L({ id: "1.500 kosakata inti, 15 baru/hari", en: "1,500 core words, 15 new/day", ja: "基本語彙1,500語、1日15語" })],
        [L({ id: "Deck Minna per bab (Anki)", en: "Minna deck per chapter (Anki)", ja: "課ごとのみんなデッキ（Anki）" }), L({ id: "Konsumabel", en: "Consumable", ja: "消耗品" }), L({ id: "Semua kosakata bab + kartu pola, dibuat sehari sebelum sesi materi", en: "All chapter vocab + pattern cards, made the day before the lesson", ja: "その課の全語彙 + 文型カード、授業の前日に作成" })],
        [L({ id: "Deck kata kerja て/た/ない", en: "て/た/ない verb deck", ja: "て/た/ない 動詞デッキ" }), L({ id: "Aksesori", en: "Accessory", ja: "アクセサリー" }), L({ id: "Bentuk kata kerja, dibiarkan dijarangkan Anki", en: "Verb forms, left for Anki to space out", ja: "動詞の活用、間隔はAnki任せ" })],
        [L({ id: "Tutor AI", en: "AI tutor", ja: "AIチューター" }), L({ id: "Pendamping", en: "Companion", ja: "仲間" }), L({ id: "Kuis, koreksi, role-play, mencatat progres", en: "Quizzes, corrections, role-play, progress logging", ja: "クイズ、訂正、ロールプレイ、進捗の記録" })],
        ["Shin Kanzen Master / Try! N3", L({ id: "Terkunci (Babak II)", en: "Locked (Act II)", ja: "未解放（第II章）" }), L({ id: "Tata bahasa N3", en: "N3 grammar", ja: "N3文法" })],
      ]) + L({ id: "<p>Deck lama tidak pernah dihapus.</p>", en: "<p>Old decks are never deleted.</p>", ja: "<p>古いデッキは削除しない。</p>" }),
    },
    aturan: {
      icon: "📜", title: { id: "Aturan main", en: "Game rules", ja: "ゲームのルール" },
      body: () => "<ol class='rules'>" + L({
        id: ["Fokus hari demi hari; minggu cukup garis besar + target.", "Tebak kanji hanya dari kata yang sudah masuk Anki.", "Kanji Minna baru dipelajari dulu lewat deck bab sebelum dipakai di tebak kanji.", "Furigana di setiap kanji, arti Indonesia di setiap kata, kecuali soal tebak kanji.", "Akhir sesi: progres dan Anki diperbarui, lalu tracker sync (otomatis tiap jam).", "Urusan karier/hidup dibahas di sesi terpisah, bukan di sesi belajar."],
        en: ["Focus day by day; the week only needs an outline + targets.", "The kanji quiz only uses words already in Anki.", "New Minna kanji are learned through the chapter deck before they appear in the kanji quiz.", "Furigana on every kanji and an Indonesian meaning on every word, except kanji quiz items.", "End of session: progress and Anki are updated, then the tracker syncs (automatically every hour).", "Career and life topics go to a separate session, not the study session."],
        ja: ["1日ずつ集中。週は大まかな流れと目標だけ。", "漢字クイズはAnkiに入っている語だけ。", "みんなの新しい漢字は、漢字クイズに出す前に課のデッキで学ぶ。", "すべての漢字にふりがな、すべての語にインドネシア語の意味（漢字クイズの問題は除く）。", "セッション終了時：進捗とAnkiを更新し、トラッカーを同期（1時間ごとに自動）。", "キャリアや生活の話は勉強とは別のセッションで。"],
      }).map(x => `<li>${x}</li>`).join("") + "</ol>",
    },
    patch: {
      icon: "🛠️", title: { id: "Patch notes", en: "Patch notes", ja: "パッチノート" },
      body: () => [
        ["v1.2", "2026-11-18", L({ id: ["Wiki ini lahir", "3 bahasa: Indonesia, English, 日本語", "Flex jadi gacha: rarity, pity, koleksi, kolam comeback", "Perbaikan dari review v1: kanji RTK dihitung per kanji, sesi Kaishi dipisah dari Minna, kaiwa butuh 5 giliran atau shadowing, Minggu = hari Anki saja", "Prediksi pace ke titik cek, banner kalau data basi, kontras mode terang"],
          en: ["This wiki is born", "3 languages: Indonesian, English, 日本語", "Flex becomes a gacha: rarity, pity, collection, comeback pool", "Fixes from review v1: RTK kanji counted per kanji, Kaishi sessions split from Minna, conversation needs 5 turns or shadowing, Sunday = Anki-only day", "Pace forecast to the checkpoint, stale-data banner, light-mode contrast"],
          ja: ["このwikiが誕生", "3言語対応：インドネシア語・英語・日本語", "フレックスがガチャに：レアリティ、天井、コレクション、カムバック枠", "レビューv1の修正：RTK漢字を1字ずつ数える、Kaishiセッションをみんなと分ける、会話は5ターンかシャドーイング、日曜はAnkiのみ", "チェックポイントまでのペース予測、データが古い時の警告、ライトモードのコントラスト"] })],
        ["v1.1", "2026-11-18", L({ id: ["Flex: 10 template gambar story", "Sync otomatis tiap jam"], en: ["Flex: 10 story image templates", "Hourly auto-sync"], ja: ["フレックス：ストーリー画像テンプレート10種", "1時間ごとの自動同期"] })],
        ["v1.0", "2026-11-18", L({ id: ["Tracker rilis"], en: ["Tracker released"], ja: ["トラッカー公開"] })],
      ].map(([v, d, xs]) => `<div class="patch"><h3>${v} <small>${fmt(d)}</small></h3><ul>${xs.map(x => `<li>${x}</li>`).join("")}</ul></div>`).join(""),
    },
  };
  // rotation table words
  const TR = { materi: { en: "new lesson", ja: "新しい課" }, review: { en: "review", ja: "復習" }, "review A/B/C": { en: "review A/B/C", ja: "復習 A/B/C" },
    "review gabungan + kaiwa": { en: "combined review + conversation", ja: "まとめ復習 + 会話" }, "ringan / kejar": { en: "light / catch-up", ja: "軽め / 追いつき" }, "Anki saja": { en: "Anki only", ja: "Ankiのみ" } };
  function tr(w) { return LANG === "id" ? w : TR[w][LANG]; }

  document.title = `${NAME} · ${L(ui.tagline)}`;
  document.getElementById("wkName").innerHTML = `${NAME} <span>${NAME_JA}</span>`;
  document.getElementById("wkTag").textContent = L(ui.tagline);
  document.getElementById("wkBack").textContent = L(ui.back);
  document.getElementById("wkPagesH").textContent = L(ui.pages);
  const nav = document.getElementById("wkNav"), page = document.getElementById("page");
  nav.innerHTML = Object.entries(PAGES).map(([id, p]) => `<a href="#${id}" data-p="${id}"><span>${p.icon}</span>${L(p.title)}</a>`).join("");
  const show = () => {
    const id = PAGES[location.hash.slice(1)] ? location.hash.slice(1) : "karakter", p = PAGES[id];
    nav.querySelectorAll("a").forEach(a => a.toggleAttribute("aria-current", a.dataset.p === id));
    page.innerHTML = `<p class="crumb mono">${NAME} › ${L(p.title)}</p><h1>${p.icon} ${L(p.title)}</h1>${p.body()}
      <p class="edited mono">${L(ui.edited)}: ${D ? new Date(D.generated).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" }) : "–"}</p>`;
    const cur = nav.querySelector("[aria-current]"); nav.scrollLeft = cur.offsetLeft - 16;  // mobile: horizontal tab strip
    scrollTo(0, 0);
  };
  addEventListener("hashchange", show); show();
})();
