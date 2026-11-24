// Talk showcase page (talk.html). The app itself runs only on the owner's PC; this page explains it and shows practice totals.
// Voice and transcripts never reach the site: only the number of sessions and minutes, from data.json.
(() => {
  const L = o => o[LANG] ?? o.id;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const UI = {
    title: { id: "Talk", en: "Talk", ja: "Talk" },
    tag: { id: "prototipe · hanya di PC pemilik", en: "prototype · runs on the owner's PC only", ja: "試作 · 所有者のPCでのみ動作" },
    lead: {
      id: "Tutor percakapan bahasa Jepang yang jalan 100% di komputerku. Tahan tombol, bicara, lalu tutor membalas, mengoreksi, dan memberi arti Indonesia. Halaman ini hanya showcase.",
      en: "A Japanese conversation tutor that runs 100% on my own computer. Hold a button, speak, and the tutor replies, corrects me and gives an Indonesian meaning. This page is only a showcase.",
      ja: "自分のパソコンだけで動く日本語会話チューター。ボタンを押しながら話すと、返事と訂正、インドネシア語の意味が返ってきます。このページは紹介だけです。",
    },
    how: { id: "Cara kerja", en: "How it works", ja: "しくみ" },
    steps: {
      id: ["Mikrofon: klik tombol untuk bicara, klik lagi untuk kirim.", "Whisper (GPU) mengubah suara jadi teks dan mengenali bahasanya (Jepang, Indonesia atau Inggris).", "Model bahasa lokal (Qwen3.5 9B lewat Ollama) menjawab dalam bahasa Jepang sederhana sesuai bab yang sedang kupelajari, dan membuka topik baru sendiri.", "Suara Jepang lokal (AivisSpeech) membacakan jawabannya.", "Di akhir sesi: report berisi kesalahan, kata baru dan saran. Aku memeriksanya, lalu mengirimnya ke tracker."],
      en: ["Microphone: click the button to speak, click again to send.", "Whisper (on the GPU) turns the voice into text and detects the language (Japanese, Indonesian or English).", "A local language model (Qwen3.5 9B through Ollama) answers in simple Japanese that fits the chapter I am studying, and brings up new topics itself.", "A local Japanese voice (AivisSpeech) reads the answer aloud.", "At the end: a report with mistakes, new words and advice. I review it and send it to the tracker."],
      ja: ["マイク：ボタンを押して話し、もう一度押して送ります。", "Whisper（GPU）が音声をテキストにし、言語（日本語・インドネシア語・英語）を判別します。", "ローカルの言語モデル（Ollama経由のQwen3.5 9B）が、学習中の章に合う簡単な日本語で答え、自分から新しい話題を出します。", "ローカルの日本語音声（AivisSpeech）が返事を読み上げます。", "最後にレポート（間違い・新しい言葉・アドバイス）を作り、確認してからトラッカーに送ります。"],
    },
    privacy: { id: "Privasi", en: "Privacy", ja: "プライバシー" },
    privacyText: {
      id: "Suara dan transkrip tidak pernah keluar dari komputerku dan tidak pernah tampil di sini. Server hanya mendengarkan 127.0.0.1, dan tidak ada akun atau API berbayar.",
      en: "Voice and transcripts never leave my computer and are never shown here. The server only listens on 127.0.0.1, and there is no account or paid API.",
      ja: "音声と文字起こしは私のパソコンの外に出ず、ここにも表示されません。サーバーは127.0.0.1だけで待ち受け、アカウントも有料APIもありません。",
    },
    limits: { id: "Batasnya", en: "Limits", ja: "限界" },
    limitsText: {
      id: "Ini prototipe. Model lokal 7B lebih lemah daripada tutor berbayar: koreksinya bisa salah, jadi setiap kesalahan kuperiksa dulu sebelum masuk ke bank pengulangan. Satu giliran butuh sekitar 2 sampai 3 detik.",
      en: "This is a prototype. A local 7B model is weaker than a paid tutor: its corrections can be wrong, so I check every mistake before it enters the review bank. One turn takes about 2 to 3 seconds.",
      ja: "これは試作です。ローカルの7Bモデルは有料のチューターより弱く、訂正を間違えることがあります。そのため、復習バンクに入れる前に毎回確認します。1ターンは約2〜3秒です。",
    },
    stats: { id: "Latihan tercatat", en: "Logged practice", ja: "記録した練習" },
    none: { id: "Belum ada sesi Talk yang dicatat.", en: "No Talk sessions logged yet.", ja: "Talkの記録はまだありません。" },
    sum: { id: "{n} sesi · {m} menit", en: "{n} sessions · {m} minutes", ja: "{n}回 · {m}分" },
  };

  async function stats() {
    let ss = [];
    try { ss = (await (await fetch("data/data.json", { cache: "no-store" })).json()).sessions.filter(x => /talk/i.test(x.mode)); } catch {}
    const mins = ss.reduce((a, x) => a + (x.min || 0), 0);
    return ss.length ? `<p class="mono">${esc(L(UI.sum).replace("{n}", ss.length).replace("{m}", mins))}</p><ul>${ss.slice(-8).reverse().map(x => `<li><span class="mono">${esc(x.date)}</span> · ${x.min ? x.min + " min" : "–"}</li>`).join("")}</ul>` : `<p>${esc(L(UI.none))}</p>`;
  }

  (async () => {
    document.title = `${L(UI.title)} · Arsenius`;
    $("#page").innerHTML = `
      <h1>${esc(L(UI.title))}</h1>
      <p class="mono tk-tag">${esc(L(UI.tag))}</p>
      <p class="tk-lead">${esc(L(UI.lead))}</p>
      <h2>${esc(L(UI.how))}</h2>
      <ol class="tk-steps">${L(UI.steps).map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      <h2>${esc(L(UI.privacy))}</h2><p>${esc(L(UI.privacyText))}</p>
      <h2>${esc(L(UI.limits))}</h2><p>${esc(L(UI.limitsText))}</p>
      <h2>${esc(L(UI.stats))}</h2>${await stats()}`;
  })();
})();
