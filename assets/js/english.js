// English tracker (english.html). Built from my own reports to the AI tutor (catatan/english.md → data/english.json), so it is not live data.
(async () => {
  const L = o => o[LANG] ?? o.id;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const E = await fetch("data/english.json", { cache: "no-cache" }).then(r => r.json()).catch(() => null);
  const date = d => new Date(d + "T00:00:00Z").toLocaleDateString(t("locale"), { day: "numeric", month: "short", timeZone: "UTC" });
  const tbl = (head, rows) => `<table class="wt"><tr>${head.map(h => `<th>${L(h)}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
  const newest = rows => [...rows].reverse();  // rows are appended, so the last one is the newest

  const LADDER = ["A1", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C2"];
  const SKILLS = [
    ["overall", { id: "Keseluruhan", en: "Overall", ja: "総合" }],
    ["reading", { id: "Membaca", en: "Reading", ja: "読解" }],
    ["listening", { id: "Menyimak", en: "Listening", ja: "リスニング" }],
    ["grammar", { id: "Tata bahasa", en: "Grammar", ja: "文法" }],
    ["speaking", { id: "Berbicara", en: "Speaking", ja: "スピーキング" }],
  ];
  const bar = ([skill, name]) => {
    const x = E.levels.filter(r => r.skill === skill).pop(), i = x ? LADDER.indexOf(x.level) : -1;
    const sub = x ? `${esc(x.source)} · ${date(x.date)}` : L({ id: "belum dites", en: "not tested yet", ja: "未テスト" });
    return `<div class="bar ${i >= 5 ? "ok" : ""}"><div class="lbl"><span>${L(name)}</span><b>${x ? esc(x.level) : "–"}</b></div><div class="track"><div class="fill" style="width:${(i + 1) / LADDER.length * 100}%"></div></div><p class="mono small muted">${sub}</p></div>`;
  };

  const h1 = "English · IELTS";
  if (!E) { document.getElementById("page").innerHTML = `<h1>${h1}</h1><p>…</p>`; return; }
  const last = [...E.levels, ...E.practice, ...E.mistakes, ...E.words].map(r => r.date).sort().pop();
  const cats = {};
  for (const m of E.mistakes) cats[m.cat] = (cats[m.cat] || 0) + 1;

  document.getElementById("page").innerHTML = `<h1>${h1}</h1>
    <p class="lead">${L({
      id: "Dicatat dari laporanku ke tutor AI, jadi bukan data real-time.",
      en: "Written from my own reports to the AI tutor, so this is not live data.",
      ja: "AIチューターへの自分の報告から記録しているため、リアルタイムのデータではありません。" })}</p>
    <p class="mono small muted">${L({ id: "Laporan terakhir", en: "Last report", ja: "最新の報告" })}: ${last ? date(last) : "–"} · ${L({
      id: "“Band” adalah perkiraan tutor dari chat, bukan skor resmi.",
      en: "“Band” is the tutor's estimate from chat, not an official score.",
      ja: "「Band」はチャットからのチューターの目安で、公式スコアではありません。" })}</p>
    <h2>${L({ id: "Level (CEFR)", en: "Level (CEFR)", ja: "レベル（CEFR）" })}</h2>
    <div class="bars">${SKILLS.map(bar).join("")}</div>
    <h2>${L({ id: "Catatan latihan", en: "Practice log", ja: "練習記録" })}</h2>` +
    tbl([{ id: "Tanggal", en: "Date", ja: "日付" }, { id: "Skill", en: "Skill", ja: "スキル" }, { id: "Latihan", en: "Task", ja: "課題" }, { id: "Band", en: "Band", ja: "Band" }],
      newest(E.practice).map(r => [date(r.date), esc(r.skill), `${esc(r.task)}<br><small class="muted">${esc(r.note)}</small>`, `<b>${esc(r.band)}</b>`])) +
    `<h2>${L({ id: "Kesalahan berulang", en: "Recurring mistakes", ja: "よくある間違い" })}</h2>
    <div class="weak">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="wc">${esc(k)} <b>${n}</b></span>`).join("")}</div>` +
    tbl([{ id: "Jenis", en: "Type", ja: "種類" }, { id: "Salah → benar", en: "Wrong → right", ja: "誤 → 正" }],
      newest(E.mistakes).map(r => [esc(r.cat), `${esc(r.wrong)} → <b>${esc(r.right)}</b>`])) +
    `<h2>${L({ id: "Kosakata baru", en: "New words", ja: "新しい単語" })} <span class="mono muted small">${E.words.length}</span></h2>` +
    tbl([{ id: "Kata", en: "Word", ja: "単語" }, { id: "Arti dan contoh", en: "Meaning and example", ja: "意味と例文" }],
      newest(E.words).map(r => [`<b>${esc(r.word)}</b>`, `${esc(r.meaning)}<br><small class="muted">${esc(r.example)}</small>`]));

  document.title = `${h1} · Arsenius`;
  document.querySelector('[data-nav="english"]')?.setAttribute("aria-current", "page");
})();
