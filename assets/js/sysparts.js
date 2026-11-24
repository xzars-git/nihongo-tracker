// System page, top section: one architecture diagram per part (tracker, Talk, Duet, Shadowing).
// Zones show where each piece runs; a walkthrough lights up one step at a time; hover/tap a box for why it exists.
// Concept level only: no file paths, ports, account names or secrets.
(() => {
  const L = o => o == null ? "" : typeof o === "string" ? o : (o[LANG] ?? o.id);
  const tx = (id, en, ja) => ({ id, en, ja });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const IC = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cards: '<rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
    git: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-7 4-11 8"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cloud: '<path d="M7 19h10a4.5 4.5 0 0 0 .6-9A6 6 0 0 0 6 9.5 4.8 4.8 0 0 0 7 19z"/>',
    browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
    text: '<path d="M4 7V4h16v3M12 4v16M9 20h6"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    play: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  };
  const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

  const UI = {
    h: tx("Arsitektur per bagian", "Architecture by part", "パート別アーキテクチャ"),
    lead: tx("Pilih satu bagian. Kotak putus-putus menunjukkan di mana komponen berjalan. Jalankan langkah demi langkah, atau arahkan kursor/ketuk kotak untuk tahu kenapa ia ada.",
      "Pick a part. Dashed boxes show where each component runs. Walk through it step by step, or hover/tap a box to see why it exists.",
      "パートを選んでください。点線の枠は各コンポーネントが動く場所です。ステップごとに進めるか、箱にカーソルを合わせる／タップすると、それがある理由を表示します。"),
    all: tx("Gambaran umum", "Overview", "全体像"), prev: tx("← Sebelumnya", "← Prev", "← 前へ"), next: tx("Berikut →", "Next →", "次へ →"),
    stepOf: tx("Langkah {n} dari {m}", "Step {n} of {m}", "ステップ {n}/{m}"),
    mob: tx("Di layar kecil, panah hanya muncul per langkah. Tekan ▶ Putar alur.", "On small screens, arrows appear one step at a time. Press ▶ Play the flow.", "小さい画面では、矢印はステップごとに表示されます。「▶ 流れを再生」を押してください。"),
    play: tx("▶ Putar alur", "▶ Play the flow", "▶ 流れを再生"), pause: tx("⏸ Jeda", "⏸ Pause", "⏸ 一時停止"),
    flow: tx("Alur langkah demi langkah: klik satu langkah, atau putar otomatis.", "The flow step by step: click a step, or play it automatically.", "流れをステップごとに：ステップをクリックするか、自動再生。"),
    why: tx("Kenapa ada?", "Why is it here?", "なぜあるのか"),
    pick: tx("Arahkan kursor atau ketuk satu kotak di diagram.", "Hover or tap a box in the diagram.", "図の箱にカーソルを合わせるか、タップしてください。"),
  };

  const PC = tx("PC-ku (Windows)", "My PC (Windows)", "自分のPC（Windows）");
  const DEV = tx("Perangkatmu", "Your device", "あなたの端末");
  const OFF = tx("Semua di PC-ku · offline", "All on my PC · offline", "すべて自分のPC・オフライン");
  const C = { pc: "#7cc4ff", gh: "#d9b8ff", vc: "#F2C200", dev: "#ffb37c", gpu: "#ff8f94", voice: "#B6FF00" };

  // shared nodes
  const catat = { n: "catat.py", ic: "term", sub: tx("setelah Kirim", "after Send", "送信後"),
    w: tx("Alat yang sama dengan latihan lain, jadi menit Talk/Duet masuk target mingguan tanpa format baru.", "The same tool as every other drill, so Talk/Duet minutes count toward the weekly target with no new format.", "ほかの練習と同じツールなので、Talk/Duetの時間も新しい形式なしで週目標に入る。") };
  const pg = { n: "PostgreSQL", ic: "db", sub: tx("database lokal", "local database", "ローカルDB"),
    w: tx("Satu sumber data untuk semua latihan. Bisa di-query dan tidak membengkak seperti file markdown dulu.", "One source of truth for every drill. It can be queried and does not bloat like the old markdown files.", "すべての練習の唯一のデータ源。クエリでき、昔のMarkdownのように肥大化しない。") };
  const qwenW = tx("Model lokal di GPU lewat Ollama: gratis, offline, dan percakapan tidak dikirim ke mana pun. Mode berpikir dimatikan supaya balasan cepat.", "A local model on the GPU through Ollama: free, offline, and the chat is sent nowhere. Thinking mode is off so replies come fast.", "Ollama経由でGPU上のローカルモデル：無料・オフラインで、会話はどこにも送られない。思考モードはオフで返答が速い。");
  const ttsW = tx("Suara Jepang lokal yang natural. Kalau tidak berjalan, VOICEVOX otomatis menggantikan.", "A natural local Japanese voice. If it is not running, VOICEVOX takes over automatically.", "自然なローカル日本語音声。起動していなければ自動でVOICEVOXに切り替える。");
  const kwW = tx("Whisper yang dilatih khusus bahasa Jepang, jadi kanji-nya lebih tepat daripada model umum.", "A Whisper model trained for Japanese, so it gets the kanji right more often than a general model.", "日本語向けに学習したWhisperなので、汎用モデルより漢字が正確。");
  const siteW = tx("Hosting statis: gratis, cepat, deploy otomatis, dan tidak ada server yang bisa diretas.", "Static hosting: free, fast, auto deploy, and there is no server to hack.", "静的ホスティング：無料・高速・自動デプロイで、攻撃できるサーバーがない。");
  const srvW = tx("Python standar saja, hanya mendengarkan di PC ini, dan menolak permintaan dari situs lain (cek Host/Origin).", "Plain Python, listens on this PC only, and refuses calls from other websites (Host/Origin check).", "標準のPythonだけで、このPCでのみ待ち受け、ほかのサイトからの呼び出しは拒否（Host/Origin確認）。");

  const P = [
    { id: "tracker", tab: tx("Tracker", "Tracker", "トラッカー"),
      s: tx("Gambaran umum: dari satu perintah di PC-ku sampai dashboard di perangkatmu. Hanya JSON turunan yang keluar ke publik.", "The big picture: from one command on my PC to the dashboard on your device. Only derived JSON goes public.", "全体像：自分のPCでの1コマンドから、あなたの端末のダッシュボードまで。公開されるのは派生JSONだけ。"),
      cols: "minmax(0,1.7fr) minmax(0,1fr)", areas: '"pc gh" "pc vc" "pc dev"',
      zones: [
        { id: "pc", n: PC, c: C.pc, cols: 2, nodes: {
          you: { n: tx("Kamu + tutor AI", "You + AI tutor", "あなた＋AIチューター"), ic: "user", sub: tx("latihan di chat", "drills in chat", "チャットで練習"), w: tx("Belajar terjadi di chat. Kalau mencatat butuh lebih dari satu perintah, pasti aku lewatkan.", "Learning happens in the chat. If logging took more than one command, I would skip it.", "学習はチャットで行う。記録に1コマンド以上かかると、きっとサボる。") },
          catat: { n: "catat.py", ic: "term", sub: tx("CLI pencatat", "logging CLI", "記録CLI"), w: tx("Satu alat untuk semua jenis catatan (sesi, kesalahan, kata Inggris), jadi formatnya selalu sama. Query berparameter, jadi teks catatan tidak bisa menyisipkan SQL.", "One tool for every kind of log (sessions, mistakes, English words), so the format never drifts. Queries are parameterized, so note text cannot inject SQL.", "セッション・間違い・英単語を1つのツールで記録するので形式がぶれない。クエリはパラメータ化され、メモからSQLを注入できない。") },
          tray: { n: "Nihongo Sync", ic: "clock", sub: tx("aplikasi tray", "tray app", "トレイアプリ"), w: tx("Menjalankan sync 4× sehari dan mengingatkan jam 20:00, jadi aku tidak perlu ingat apa pun.", "Runs the sync 4× a day and reminds me at 20:00, so I never have to remember anything.", "1日4回同期し、20:00にリマインドするので、何も覚えておかなくていい。") },
          pg: { n: "PostgreSQL", ic: "db", sub: tx("11 tabel · lokal", "11 tables · local", "11テーブル・ローカル"), w: pg.w },
          anki: { n: "Anki", ic: "cards", sub: tx("salinan baca-saja", "read-only copy", "読み取り専用コピー"), w: tx("Statistik review dibaca dari salinan, jadi data Anki asli tidak pernah disentuh.", "Review stats are read from a copy, so the real Anki data is never touched.", "復習統計はコピーから読むので、本物のAnkiデータには触れない。") },
          publish: { n: "publish.py", ic: "code", sub: tx("membangun JSON", "builds the JSON", "JSONを生成"), w: tx("Mengubah baris database jadi dua file JSON dalam satu transaksi. Situs tidak pernah menyentuh database.", "Turns database rows into two JSON files in one transaction. The site never touches the database.", "1トランザクションでDBの行をJSON 2ファイルに変換。サイトはDBに触れない。") },
        } },
        { id: "gh", n: "GitHub", c: C.gh, nodes: {
          priv: { n: tx("Repo privat", "Private repo", "非公開リポジトリ"), ic: "lock", sub: tx("cadangan SQL", "SQL backup", "SQLバックアップ"), w: tx("Salinan penuh database, supaya PC rusak tidak berarti data hilang. Hanya dikirim kalau isinya berubah. Akun memakai 2FA.", "A full copy of the database, so a broken PC does not mean lost data. Sent only when it changed. The account uses 2FA.", "DB全体のコピーで、PCが壊れてもデータは失われない。変更時だけ送る。アカウントは2FA。") },
          repo: { n: tx("Repo publik", "Public repo", "公開リポジトリ"), ic: "git", sub: tx("kode + 2 JSON", "code + 2 JSON", "コード＋JSON 2つ"), w: tx("Setiap perubahan data punya riwayat, dan push memicu deploy. Tidak ada password, dump, atau catatan mentah di sini.", "Every data change has a history, and a push triggers the deploy. No passwords, dumps or raw notes live here.", "データ変更の履歴が残り、pushでデプロイ。パスワード・ダンプ・生ノートは置かない。") },
        } },
        { id: "vc", n: "Vercel", c: C.vc, nodes: {
          site: { n: tx("Situs statis", "Static site", "静的サイト"), ic: "cloud", sub: "HTML · CSS · JS · JSON", w: siteW },
        } },
        { id: "dev", n: DEV, c: C.dev, nodes: {
          br: { n: "Browser", ic: "browser", sub: tx("dashboard + Flex", "dashboard + Flex", "ダッシュボード＋Flex"), w: tx("Grafik dan kartu alert dihitung di perangkatmu dari JSON. Gambar Flex dibuat di canvas lokal dan tidak pernah diunggah.", "Charts and alert cards are computed on your device from the JSON. The Flex image is drawn on a local canvas and never uploaded.", "グラフとアラートはJSONから端末で計算。Flex画像はローカルのcanvasで描き、アップロードしない。") },
        } },
      ],
      edges: [["you", "catat", tx("1 baris", "1 command", "1コマンド")], ["catat", "pg", "INSERT"], ["tray", "pg", tx("hidup?", "alive?", "稼働？")],
        ["tray", "publish", tx("4×/hari", "4×/day", "1日4回")], ["pg", "publish", "SELECT"], ["anki", "publish", tx("baca", "read", "読む")],
        ["pg", "priv", tx("dump SQL", "SQL dump", "SQLダンプ")], ["publish", "repo", "git push"], ["repo", "site", "auto deploy"], ["site", "br", "HTTPS"]],
      steps: [
        { n: ["you", "catat"], e: ["you>catat"], t: tx("Kamu mencatat", "You log a result", "結果を記録"), d: tx("Setelah latihan di chat, satu perintah mencatat hasilnya. Belum ada yang keluar dari PC.", "After a drill in the chat, one command logs the result. Nothing has left the PC yet.", "チャットで練習した後、1コマンドで結果を記録。まだPCから何も出ていない。") },
        { n: ["catat", "pg"], e: ["catat>pg"], t: tx("Masuk database", "Into the database", "DBへ"), d: tx("Baris baru ditulis ke PostgreSQL dengan query berparameter.", "A new row is written to PostgreSQL with a parameterized query.", "パラメータ化クエリでPostgreSQLに新しい行を書く。") },
        { n: ["tray", "pg", "publish"], e: ["tray>pg", "tray>publish"], t: tx("Jadwal + cek", "Schedule + check", "スケジュール＋確認"), d: tx("Tray menjalankan sync 4× sehari. Pertama ia mengecek database: kalau mati, sync berhenti dan tidak ada data basi yang terkirim.", "The tray runs the sync 4× a day. First it checks the database: if it is down, the sync stops and no stale data goes out.", "トレイが1日4回同期。まずDBを確認し、止まっていれば中断して古いデータを送らない。") },
        { n: ["pg", "anki", "publish"], e: ["pg>publish", "anki>publish"], t: tx("Membangun JSON", "Build the JSON", "JSONを作る"), d: tx("publish.py membaca SQL dalam satu transaksi dan menambah angka Anki dari salinan.", "publish.py reads SQL in one transaction and adds the Anki numbers from the copy.", "publish.pyが1トランザクションでSQLを読み、コピーからAnkiの数字を加える。") },
        { n: ["pg", "priv"], e: ["pg>priv"], t: tx("Cadangan privat", "Private backup", "非公開バックアップ"), d: tx("Dump SQL dikirim hanya ke repo privat, dan hanya kalau berubah. Repo publik tidak pernah menerimanya.", "An SQL dump goes only to the private repo, and only if it changed. The public repo never gets it.", "SQLダンプは変更時だけ非公開リポジトリへ。公開リポジトリには届かない。") },
        { n: ["publish", "repo"], e: ["publish>repo"], t: tx("Push 2 file", "Push 2 files", "2ファイルをpush"), d: tx("Hanya dua file JSON di daftar putih yang di-commit, dan hanya kalau ada perubahan.", "Only the two allow-listed JSON files are committed, and only if something changed.", "許可リストのJSON 2ファイルだけを、変更があるときだけコミット。") },
        { n: ["repo", "site"], e: ["repo>site"], t: tx("Deploy", "Deploy", "デプロイ"), d: tx("Vercel melihat push baru dan men-deploy situs statis secara otomatis.", "Vercel sees the new push and deploys the static site automatically.", "Vercelが新しいpushを検知し、静的サイトを自動デプロイ。") },
        { n: ["site", "br"], e: ["site>br"], t: tx("Tampil di perangkatmu", "Shown on your device", "端末に表示"), d: tx("Browser membaca JSON, menghitung tempo vs target, lalu menggambar grafik dan kartu alert.", "The browser reads the JSON, computes pace against the target and draws the charts and alert cards.", "ブラウザがJSONを読み、目標に対するペースを計算し、グラフとアラートを描く。") },
      ] },

    { id: "talk", tab: tx("Talk · AI lokal", "Talk · local AI", "Talk・ローカルAI"), frame: OFF,
      s: tx("Tutor percakapan suara dengan Yuki. Semua model berjalan di GPU PC ini: suaramu tidak pernah keluar ke internet.", "A voice conversation tutor with Yuki. Every model runs on this PC's GPU: your voice never goes to the internet.", "ゆきとの音声会話チューター。すべてのモデルがこのPCのGPUで動き、声はインターネットに出ない。"),
      cols: "repeat(3,minmax(0,1fr))", areas: '"br sv gpu" "br sv voice" "br tr dict"',
      zones: [
        { id: "br", n: tx("Browser (halaman lokal)", "Browser (local page)", "ブラウザ（ローカル）"), c: C.dev, nodes: {
          mic: { n: tx("Tombol mic", "Mic button", "マイクボタン"), ic: "mic", sub: tx("pilih bahasa · klik · klik", "pick language · click · click", "言語選択・クリック×2"), w: tx("Klik untuk mulai, klik untuk kirim. Tidak deteksi otomatis, jadi jeda saat berpikir tidak memotong kalimatmu. Bahasa dipilih dulu (日本語/Indonesia/English).", "Click to start, click to send. No auto-detect, so a pause while you think never cuts you off. You pick the language first (日本語/Indonesia/English).", "クリックで開始、もう一度で送信。自動検出なしなので考える間に途切れない。言語は先に選ぶ（日本語/Indonesia/English）。") },
          ui: { n: tx("Chat + furigana", "Chat + furigana", "チャット＋ふりがな"), ic: "browser", sub: tx("teks mengalir", "streaming text", "ストリーミング"), w: tx("Balasan muncul kata demi kata, jadi kamu tidak menunggu. Arti, furigana, romaji, dan contoh jawaban bisa dinyalakan/dimatikan.", "The reply appears word by word, so you are not left waiting. Meanings, furigana, romaji and example answers can be switched on or off.", "返答は単語ごとに表示されるので待たされない。意味・ふりがな・ローマ字・回答例はオン/オフできる。") },
          spk: { n: tx("Speaker", "Speaker", "スピーカー"), ic: "speaker", sub: tx("satu klip sekaligus", "one clip at a time", "同時に1クリップ"), w: tx("Satu pemutar bersama menghentikan klip lama dulu, jadi klik ganda tidak pernah membuat dua suara bertumpuk.", "One shared player stops the old clip first, so a double click never plays two voices at once.", "共通プレーヤーが前のクリップを止めるので、ダブルクリックでも声が重ならない。") },
        } },
        { id: "sv", n: tx("Server Talk (Python)", "Talk server (Python)", "Talkサーバー（Python）"), c: C.pc, nodes: {
          ctx: { n: tx("Konteks", "Context", "文脈"), ic: "file", sub: tx("persona · topik · pertanyaan lama", "persona · topic · past questions", "人物・話題・過去の質問"), w: tx("Persona Yuki, daftar pertanyaan yang sudah ia tanyakan, dan petunjuk topik ditambahkan ke setiap permintaan, jadi ia tidak mengulang dan bisa membawa topik baru.", "Yuki's persona, the questions she already asked and a topic hint are added to every request, so she does not repeat herself and can bring up new topics.", "ゆきの人物設定・聞いた質問の一覧・話題のヒントを毎回加えるので、繰り返さず新しい話題も出せる。") },
          srv: { n: tx("Server lokal", "Local server", "ローカルサーバー"), ic: "code", sub: tx("hanya untuk PC ini", "this PC only", "このPC専用"), w: srvW },
        } },
        { id: "gpu", n: tx("Model AI di GPU", "AI models on the GPU", "GPU上のAIモデル"), c: C.gpu, nodes: {
          kw: { n: "kotoba-whisper", ic: "chip", sub: tx("suara → teks (JA)", "speech → text (JA)", "音声→文字（日本語）"), w: kwW },
          ws: { n: "whisper-small", ic: "chip", sub: tx("suara → teks (ID/EN)", "speech → text (ID/EN)", "音声→文字（ID/EN）"), w: tx("Model kecil multibahasa untuk Indonesia/Inggris. Karena bahasa dipilih dulu, bahasa Jepang tidak salah ditulis sebagai Inggris.", "A small multilingual model for Indonesian/English. Because you pick the language first, Japanese is never written down as English.", "インドネシア語・英語用の小さな多言語モデル。先に言語を選ぶので、日本語が英語として書かれない。") },
          qw: { n: "Qwen3.5 9B", ic: "chip", sub: tx("balasan · koreksi · contoh", "reply · correction · examples", "返答・添削・回答例"), w: qwenW },
        } },
        { id: "voice", n: tx("Mesin suara", "Voice engine", "音声エンジン"), c: C.voice, nodes: {
          tts: { n: "AivisSpeech", ic: "speaker", sub: tx("cadangan: VOICEVOX", "fallback: VOICEVOX", "予備：VOICEVOX"), w: ttsW },
        } },
        { id: "tr", n: tx("Tracker (PC ini)", "Tracker (this PC)", "トラッカー（このPC）"), c: C.vc, nodes: { catat, pg } },
        { id: "dict", n: tx("Kamus", "Dictionary", "辞書"), c: C.gh, nodes: {
          fu: { n: "fugashi + UniDic", ic: "text", sub: tx("furigana · romaji", "furigana · romaji", "ふりがな・ローマ字"), w: tx("Bacaan kanji diambil dari kamus, bukan dari AI, jadi tidak pernah dikarang.", "Kanji readings come from a dictionary, not from the AI, so they are never made up.", "漢字の読みはAIではなく辞書から取るので、でたらめにならない。") },
        } },
      ],
      edges: [["mic", "srv", "WAV"], ["ctx", "srv", tx("ditambahkan", "added", "追加")], ["srv", "kw", "ja"], ["srv", "ws", "id / en"], ["srv", "qw", tx("chat · stream", "chat · stream", "チャット")],
        ["srv", "tts", tx("teks → suara", "text → voice", "文字→音声")], ["srv", "fu", tx("teks", "text", "文字")], ["srv", "ui", tx("teks", "text", "文字")], ["srv", "spk", "WAV"],
        ["srv", "catat", tx("report", "report", "レポート")], ["catat", "pg", "INSERT"]],
      steps: [
        { n: ["mic", "srv"], e: ["mic>srv"], t: tx("Kamu bicara", "You speak", "話す"), d: tx("Pilih bahasa, klik untuk mulai, klik lagi untuk kirim. Rekaman hanya dikirim ke server di PC ini.", "Pick the language, click to start, click again to send. The recording only goes to the server on this PC.", "言語を選び、クリックで開始、もう一度で送信。録音はこのPCのサーバーにだけ送られる。") },
        { n: ["srv", "kw", "ws"], e: ["srv>kw", "srv>ws"], t: tx("Suara jadi teks", "Speech to text", "音声を文字に"), d: tx("Bahasa Jepang ke kotoba-whisper, Indonesia/Inggris ke whisper-small. Kalau hasilnya berulang-ulang seperti halusinasi, server mencoba lagi sebagai bahasa Jepang.", "Japanese goes to kotoba-whisper, Indonesian/English to whisper-small. If the result repeats itself like a hallucination, the server retries it as Japanese.", "日本語はkotoba-whisper、インドネシア語・英語はwhisper-smallへ。結果が幻覚のように繰り返すと、日本語として再試行。") },
        { n: ["ctx", "srv", "qw", "ui"], e: ["ctx>srv", "srv>qw", "srv>ui"], t: tx("Yuki menjawab", "Yuki answers", "ゆきが答える"), d: tx("Konteks ditambahkan, lalu Qwen mengalirkan balasan ke chat kata demi kata.", "The context is added, then Qwen streams the reply into the chat word by word.", "文脈を加え、Qwenが返答を単語ごとにチャットへ流す。") },
        { n: ["srv", "qw"], e: ["srv>qw"], t: tx("Koreksi + contoh jawaban", "Correction + example answers", "添削＋回答例"), d: tx("Permintaan terpisah dengan suhu rendah: cek tata bahasa (salah dengar kanji dari STT diabaikan), terjemahkan jawaban Indonesia/Inggris ke Jepang, dan beri 2 contoh jawaban.", "Separate low-temperature requests: check the grammar (kanji mishearings from speech-to-text are ignored), translate Indonesian/English answers into Japanese, and give 2 example answers.", "別の低温度リクエストで、文法確認（音声認識の漢字違いは無視）、インドネシア語・英語の回答を日本語に翻訳、回答例を2つ。") },
        { n: ["srv", "fu", "ui"], e: ["srv>fu", "srv>ui"], t: tx("Furigana + romaji", "Furigana + romaji", "ふりがな＋ローマ字"), d: tx("Setiap kalimat Jepang dipecah dengan kamus, lalu diberi furigana dan romaji satu kalimat penuh.", "Every Japanese sentence is split with the dictionary, then gets furigana and full-sentence romaji.", "日本語の文を辞書で分割し、ふりがなと文全体のローマ字を付ける。") },
        { n: ["srv", "tts", "spk"], e: ["srv>tts", "srv>spk"], t: tx("Yuki bicara", "Yuki speaks", "ゆきが話す"), d: tx("Balasan diubah jadi suara per kalimat, jadi suara mulai sebelum seluruh balasan selesai. Klik mic untuk menyela.", "The reply becomes voice sentence by sentence, so audio starts before the whole reply is done. Click the mic to interrupt.", "返答を文ごとに音声化するので、全体が終わる前に話し始める。マイクをクリックで割り込める。") },
        { n: ["srv", "catat", "pg"], e: ["srv>catat", "catat>pg"], t: tx("Report → tracker", "Report → tracker", "レポート → トラッカー"), d: tx("Selesai → pilih kesalahan yang mau disimpan → Kirim. Hanya menit dan kesalahan pilihanmu yang dicatat. Audio tidak pernah disimpan.", "Finish → pick the mistakes to keep → Send. Only the minutes and your chosen mistakes are logged. Audio is never saved.", "終了→残す間違いを選ぶ→送信。記録するのは時間と選んだ間違いだけ。音声は保存しない。") },
      ] },

    { id: "duet", tab: tx("Duet", "Duet", "Duet"), frame: OFF,
      s: tx("Shadowing dialog gaya duet TikTok: AI menulis naskah, Yuki membaca barisnya, kamu membalas, lalu dinilai per kata.", "Dialogue shadowing in TikTok duet style: the AI writes a script, Yuki reads her line, you answer, and each word is scored.", "TikTokデュエット風の対話シャドーイング：AIが台本を書き、ゆきが読み、あなたが答え、単語ごとに採点。"),
      cols: "repeat(3,minmax(0,1fr))", areas: '"br sv gpu" "br sv voice" "br tr disk"',
      zones: [
        { id: "br", n: tx("Browser (halaman lokal)", "Browser (local page)", "ブラウザ（ローカル）"), c: C.dev, nodes: {
          scene: { n: tx("Pilih adegan", "Scene picker", "場面選択"), ic: "browser", sub: tx("peran · bantuan teks", "role · text help", "役・文字補助"), w: tx("Adegan nyata (kafe, kerja, akhir pekan) supaya kalimatnya langsung terpakai. Kamu pilih jadi A atau B.", "Real scenes (café, work, weekend) so the sentences are useful right away. You choose to be A or B.", "カフェ・仕事・週末など実際の場面なので、すぐ使える。AかBを選ぶ。") },
          lines: { n: tx("Baris naskah", "Script lines", "台本の行"), ic: "text", sub: tx("penuh · huruf awal · kosong", "full · first letters · none", "全文・頭文字・なし"), w: tx("Bantuan teks tiga tingkat, supaya naskah bisa dilepas pelan-pelan sampai kamu hafal.", "Three levels of text help, so you can let go of the script step by step until you know it.", "文字の補助は3段階で、覚えるまで少しずつ台本から離れられる。") },
          mic: { n: tx("Tombol mic", "Mic button", "マイクボタン"), ic: "mic", sub: tx("ucapkan barismu", "say your line", "自分の行を言う"), w: tx("Klik-klik seperti di Talk. Klik saat masih memuat diabaikan, jadi tidak ada dua rekaman sekaligus.", "Click to start and stop, like in Talk. Clicks while loading are ignored, so two takes can never run at once.", "Talkと同じくクリックで開始・停止。読み込み中のクリックは無視され、録音が重ならない。") },
        } },
        { id: "sv", n: tx("Server Talk (Python)", "Talk server (Python)", "Talkサーバー（Python）"), c: C.pc, nodes: {
          score: { n: tx("Penilai", "Scorer", "採点"), ic: "check", sub: tx("cocok per kana", "kana match per word", "単語ごとのかな一致"), w: tx("Dibandingkan dalam hiragana, bukan kanji, jadi kanji berbeda dari pengenal suara tidak dihitung salah. Kata lulus kalau ≥60% kana-nya cocok.", "Compared in hiragana, not kanji, so a different kanji from speech recognition is not a mistake. A word passes when ≥60% of its kana match.", "漢字ではなくひらがなで比べるので、音声認識の漢字違いは間違いにならない。かなが60%以上一致で合格。") },
          api: { n: "Duet API", ic: "code", sub: tx("buat · muat · nilai", "new · load · score", "作成・読込・採点"), w: tx("Satu server kecil untuk semua langkah. Hasil dari putaran lama dibuang, jadi klik cepat tidak mencampur baris.", "One small server for every step. Results from an old run are dropped, so fast clicks never mix up lines.", "すべての手順を1つの小さなサーバーで。古い実行の結果は捨てるので、速いクリックでも行が混ざらない。") },
        } },
        { id: "gpu", n: tx("Model AI di GPU", "AI models on the GPU", "GPU上のAIモデル"), c: C.gpu, nodes: {
          qw: { n: "Qwen3.5 9B", ic: "chip", sub: tx("penulis naskah", "script writer", "台本作成"), w: tx("Menulis pasangan baris (Yuki, kamu) sebagai JSON, jadi peran tidak pernah tertukar. Baris tanpa kana dibuang.", "Writes line pairs (Yuki, you) as JSON, so the roles never swap. Lines without kana are dropped.", "（ゆき、あなた）の行ペアをJSONで書くので役が入れ替わらない。かなのない行は捨てる。") },
          kw: { n: "kotoba-whisper", ic: "chip", sub: tx("mendengar barismu", "hears your line", "あなたの行を聞く"), w: kwW },
        } },
        { id: "voice", n: tx("Mesin suara", "Voice engine", "音声エンジン"), c: C.voice, nodes: {
          tts: { n: "AivisSpeech", ic: "speaker", sub: tx("suara Yuki", "Yuki's voice", "ゆきの声"), w: tx("Mendengar dulu adalah inti shadowing: tiru ritmenya sebelum membaca.", "Listening first is the core of shadowing: copy the rhythm before you read.", "先に聞くのがシャドーイングの基本：読む前にリズムをまねる。") },
        } },
        { id: "tr", n: tx("Tracker (PC ini)", "Tracker (this PC)", "トラッカー（このPC）"), c: C.vc, nodes: { catat, pg } },
        { id: "disk", n: tx("Disk lokal", "Local disk", "ローカルディスク"), c: C.gh, nodes: {
          saved: { n: tx("Naskah tersimpan", "Saved scripts", "保存した台本"), ic: "file", sub: "JSON", w: tx("Naskah bagus bisa diulang besok atau dipakai dengan peran tertukar, tanpa meminta AI lagi.", "A good script can be repeated tomorrow or played with roles swapped, without asking the AI again.", "良い台本は翌日も、役を入れ替えても、AIに頼まず繰り返せる。") },
        } },
      ],
      edges: [["scene", "api", tx("adegan", "scene", "場面"), .2], ["api", "qw", "prompt"], ["api", "saved", tx("simpan", "save", "保存")], ["api", "lines", tx("naskah", "script", "台本")],
        ["api", "tts", tx("baris Yuki", "Yuki's line", "ゆきの行")], ["mic", "api", "WAV"], ["api", "kw", "ja"], ["kw", "score", tx("teks", "text", "文字")],
        ["score", "lines", tx("skor", "score", "スコア"), .2], ["api", "catat", tx("kirim sesi", "send session", "送信")], ["catat", "pg", "INSERT"]],
      steps: [
        { n: ["scene", "api", "qw"], e: ["scene>api", "api>qw"], t: tx("Naskah dibuat", "The script is written", "台本を作る"), d: tx("Adegan dan peranmu dikirim ke Qwen, yang menulis dialog pendek dalam JSON.", "The scene and your role go to Qwen, which writes a short dialogue in JSON.", "場面と役をQwenに送り、短い対話をJSONで書かせる。") },
        { n: ["api", "saved", "lines"], e: ["api>saved", "api>lines"], t: tx("Simpan + tampilkan", "Save + show", "保存＋表示"), d: tx("Naskah disimpan di disk lalu ditampilkan sesuai tingkat bantuan teks yang kamu pilih.", "The script is saved to disk, then shown with the text-help level you picked.", "台本をディスクに保存し、選んだ文字補助のレベルで表示。") },
        { n: ["api", "tts", "lines"], e: ["api>tts"], t: tx("Yuki membaca", "Yuki reads", "ゆきが読む"), d: tx("Baris Yuki diubah jadi suara dan diputar di browser. Tombol Dengar memutar contoh barismu.", "Yuki's line becomes voice and plays in the browser. The Listen button plays an example of your line.", "ゆきの行を音声にしてブラウザで再生。「聞く」ボタンで自分の行の見本も聞ける。") },
        { n: ["mic", "api", "kw"], e: ["mic>api", "api>kw"], t: tx("Kamu mengulang", "You repeat", "あなたが繰り返す"), d: tx("Rekaman barismu ditranskripsi sebagai bahasa Jepang saja.", "Your take is transcribed as Japanese only.", "あなたの録音は日本語のみとして書き起こす。") },
        { n: ["kw", "score", "lines"], e: ["kw>score", "score>lines"], t: tx("Dinilai per kata", "Scored per word", "単語ごとに採点"), d: tx("Kata yang cocok diberi hijau, yang terlewat diberi garis merah, plus apa yang terdengar. Skor ≥90 mendapat \"Bagus\".", "Matched words turn green, missed ones get a red underline, plus what was heard. A score of 90 or more gets \"Bagus\".", "一致した単語は緑、抜けた単語は赤線、聞き取った文も表示。90点以上で「Bagus」。") },
        { n: ["api", "catat", "pg"], e: ["api>catat", "catat>pg"], t: tx("Kirim ke tracker", "Send to the tracker", "トラッカーへ送信"), d: tx("Rata-rata skor dan menit dikirim lewat catat.py, jadi Duet ikut terhitung di target mingguan.", "The average score and minutes are sent through catat.py, so Duet counts toward the weekly target.", "平均スコアと時間をcatat.pyで送り、Duetも週目標に数える。") },
      ] },

    { id: "shadow", tab: tx("Shadowing", "Shadowing", "シャドーイング"),
      s: tx("Naskah video YouTube dikumpulkan di PC-ku. Hanya salinan terenkripsi yang masuk ke situs publik, dan dibuka di browser-mu.", "Scripts from YouTube videos are collected on my PC. Only an encrypted copy goes to the public site, and it is unlocked in your browser.", "YouTube動画の台本は自分のPCで集める。公開サイトには暗号化したコピーだけを置き、あなたのブラウザで解錠する。"),
      cols: "minmax(0,1.7fr) minmax(0,1fr)", areas: '"pc yt" "pc gh" "pc vc" "pc dev"',
      zones: [
        { id: "pc", n: PC, c: C.pc, cols: 2, nodes: {
          you: { n: tx("Link video", "Video link", "動画リンク"), ic: "user", sub: tx("Tambah video di tray", "Add video in the tray", "トレイで動画追加"), w: tx("Materi asli dari video yang memang aku suka, jadi aku mau mengulangnya.", "Real material from videos I actually like, so I want to repeat them.", "本当に好きな動画の素材なので、繰り返したくなる。") },
          sh: { n: "shadow.py", ic: "term", sub: tx("pengumpul naskah", "script collector", "台本コレクター"), w: tx("Satu skrip untuk ambil, simpan, terjemahkan, dan ekspor, jadi setiap video lewat langkah yang sama.", "One script to fetch, save, translate and export, so every video goes through the same steps.", "取得・保存・翻訳・書き出しを1つのスクリプトで行い、どの動画も同じ手順を通る。") },
          wh: { n: "Whisper (GPU)", ic: "chip", sub: tx("hanya jika tanpa subtitle", "only without captions", "字幕がない時だけ"), w: tx("Berat dan lambat, jadi hanya jalan untuk video tanpa subtitle, dan hanya setelah kamu menjawab Ya.", "Heavy and slow, so it only runs for videos without captions, and only after you answer Yes.", "重くて遅いので、字幕のない動画だけ、「はい」と答えた後にだけ動く。") },
          pg: { n: "PostgreSQL", ic: "db", sub: tx("video + baris", "videos + lines", "動画＋行"), w: tx("Baris beserta waktunya disimpan di database. Ekspor JSON biasa tetap lokal dan tidak masuk git, karena itu teks milik orang lain.", "Lines and their timestamps live in the database. The plain JSON export stays local and out of git, because it is other people's text.", "行とタイムスタンプはDBに保存。平文のJSONは他人の文章なのでローカルに置き、gitに入れない。") },
          ro: { n: tx("Arti + romaji", "Meanings + romaji", "意味＋ローマ字"), ic: "text", sub: "cutlet + UniDic", w: tx("Dibuat sekali di PC, jadi halaman web tetap ringan dan tidak perlu AI.", "Made once on the PC, so the web page stays light and needs no AI.", "PCで一度だけ作るので、Webページは軽くAIも不要。") },
          enc: { n: "AES-256-GCM", ic: "lock", sub: tx("kunci dari passphrase", "key from a passphrase", "パスフレーズ由来の鍵"), w: tx("Kunci dibuat dari passphrase (PBKDF2). Passphrase hanya ada di file lokal di luar repo, tidak pernah di-commit.", "The key is derived from a passphrase (PBKDF2). The passphrase lives only in a local file outside the repo and is never committed.", "鍵はパスフレーズから生成（PBKDF2）。パスフレーズはリポジトリ外のローカルファイルだけにあり、コミットしない。") },
          catat: { n: "catat.py", ic: "term", sub: tx("menit latihan", "practice minutes", "練習時間"), w: tx("Setelah latihan, halaman menampilkan perintah persisnya, jadi menit shadowing tercatat seperti latihan lain.", "After practice the page shows the exact command, so shadowing minutes are logged like any other drill.", "練習後にページが正確なコマンドを表示するので、シャドーイングの時間もほかと同じく記録できる。") },
          tray: { n: "Nihongo Sync", ic: "clock", sub: tx("push setelah tambah video", "pushes after adding", "追加後にpush"), w: tx("Sync berjalan tepat setelah video ditambahkan, jadi web langsung mendapatkannya tanpa langkah manual.", "A sync runs right after a video is added, so the web gets it with no manual step.", "動画を追加するとすぐ同期し、手作業なしでWebに届く。") },
        } },
        { id: "yt", n: "YouTube", c: C.gpu, nodes: {
          ytc: { n: tx("Subtitle", "Captions", "字幕"), ic: "play", sub: tx("dicoba lebih dulu", "tried first", "まず取得"), w: tx("Subtitle yang sudah ada dipakai dulu karena cepat dan gratis.", "Existing captions are used first because they are fast and free.", "既存の字幕を優先。速くて無料だから。") },
        } },
        { id: "gh", n: "GitHub", c: C.gh, nodes: {
          repo: { n: tx("Repo publik", "Public repo", "公開リポジトリ"), ic: "git", sub: tx("hanya file terenkripsi", "encrypted files only", "暗号化ファイルのみ"), w: tx("Teks milik orang lain tidak pernah ada dalam bentuk biasa di repo publik.", "Other people's text never sits in plain form in a public repo.", "他人の文章を平文で公開リポジトリに置かない。") },
        } },
        { id: "vc", n: "Vercel", c: C.vc, nodes: { site: { n: tx("Situs statis", "Static site", "静的サイト"), ic: "cloud", sub: "HTML · JS · .enc", w: siteW } } },
        { id: "dev", n: DEV, c: C.dev, nodes: {
          unlock: { n: tx("Buka kunci", "Unlock", "解錠"), ic: "lock", sub: "WebCrypto", w: tx("Passphrase dimasukkan sekali per perangkat, dan dekripsi terjadi di browser. Kunci tidak pernah dikirim ke mana pun.", "The passphrase is entered once per device and decryption happens in the browser. The key is never sent anywhere.", "パスフレーズは端末ごとに1回入力し、復号はブラウザ内。鍵はどこにも送られない。") },
          player: { n: tx("Pemutar + naskah", "Player + script", "プレーヤー＋台本"), ic: "play", sub: tx("loop · lambat · giliranmu", "loop · slow · your turn", "ループ・スロー・あなたの番"), w: tx("Video asli diputar dari YouTube dengan naskah yang sinkron: ulang per baris, kecepatan lambat, mode otomatis, dan jeda untuk giliranmu.", "The real video plays from YouTube with a synced script: repeat each line, slow speed, auto mode, and a pause for your turn.", "本物の動画をYouTubeから再生し、台本を同期：行ごとの繰り返し・スロー・自動モード・あなたの番で一時停止。") },
        } },
      ],
      edges: [["you", "sh", tx("link", "link", "リンク")], ["sh", "ytc", tx("ambil subtitle", "fetch captions", "字幕取得")], ["sh", "wh", tx("tanpa subtitle?", "no captions?", "字幕なし？")],
        ["sh", "pg", tx("simpan baris", "save lines", "行を保存")], ["wh", "pg", tx("teks", "text", "文字")], ["pg", "ro", tx("tambah arti", "add meanings", "意味を追加")],
        ["pg", "enc", tx("ekspor", "export", "書き出し")], ["enc", "tray", ".enc"], ["tray", "repo", "git push"], ["repo", "site", "auto deploy"],
        ["site", "unlock", "HTTPS"], ["unlock", "player", tx("teks asli", "plain text", "平文")]],
      steps: [
        { n: ["you", "sh"], e: ["you>sh"], t: tx("Tambah video", "Add a video", "動画を追加"), d: tx("Tempel link di menu tray Tambah video.", "Paste a link into the tray's Add video menu.", "トレイの「動画を追加」にリンクを貼る。") },
        { n: ["sh", "ytc", "wh", "pg"], e: ["sh>ytc", "sh>wh", "wh>pg", "sh>pg"], t: tx("Ambil naskah", "Get the script", "台本を取得"), d: tx("Subtitle YouTube dicoba lebih dulu. Hanya kalau tidak ada, Whisper di GPU menulis naskahnya setelah kamu setuju. Baris disimpan dengan waktunya.", "YouTube captions are tried first. Only if there are none does Whisper on the GPU write the script, after you agree. Lines are saved with their timestamps.", "まずYouTubeの字幕を試す。ない場合だけ、同意後にGPUのWhisperが台本を作る。行はタイムスタンプ付きで保存。") },
        { n: ["pg", "ro"], e: ["pg>ro"], t: tx("Arti + romaji", "Meanings + romaji", "意味＋ローマ字"), d: tx("Arti Indonesia dan romaji ditambahkan sekali di PC.", "Indonesian meanings and romaji are added once on the PC.", "インドネシア語の意味とローマ字をPCで一度だけ付ける。") },
        { n: ["pg", "enc", "tray"], e: ["pg>enc", "enc>tray"], t: tx("Enkripsi", "Encrypt", "暗号化"), d: tx("Naskah dienkripsi dengan AES-256-GCM sebelum meninggalkan PC.", "The script is encrypted with AES-256-GCM before it leaves the PC.", "台本はPCを出る前にAES-256-GCMで暗号化。") },
        { n: ["tray", "repo", "site"], e: ["tray>repo", "repo>site"], t: tx("Terbit", "Publish", "公開"), d: tx("Tray mem-push file terenkripsi dan Vercel men-deploy-nya. Tanpa passphrase, isinya hanya data acak.", "The tray pushes the encrypted files and Vercel deploys them. Without the passphrase, they are just random bytes.", "トレイが暗号化ファイルをpushし、Vercelがデプロイ。パスフレーズがなければただのランダムなデータ。") },
        { n: ["site", "unlock", "player"], e: ["site>unlock", "unlock>player"], t: tx("Buka + latihan", "Unlock + practice", "解錠＋練習"), d: tx("Browser membuka kunci naskah dengan passphrase, lalu kamu berlatih bersama video. Menitnya dicatat dengan catat.py.", "The browser unlocks the script with the passphrase, then you practice along with the video. The minutes are logged with catat.py.", "ブラウザがパスフレーズで台本を解錠し、動画と一緒に練習。時間はcatat.pyで記録。") },
      ] },
  ];

  const mount = document.getElementById("parts");
  if (!mount) return;
  const st = { p: Math.max(0, P.findIndex(p => "#" + p.id === location.hash)), s: 0, sel: null };
  const part = () => P[st.p];
  const nodeOf = id => { for (const z of part().zones) if (z.nodes[id]) return z.nodes[id]; };
  const steps = () => [{ t: UI.all, d: part().s }, ...part().steps];

  mount.innerHTML = `<h2>${L(UI.h)}</h2><p>${L(UI.lead)}</p>
    <div class="pt-tabs" role="tablist">${P.map((p, i) => `<button type="button" role="tab" data-p="${i}">${esc(L(p.tab))}</button>`).join("")}</div>
    <div id="ptBody"></div>`;
  const body = mount.querySelector("#ptBody");

  const build = () => {
    const p = part();
    mount.querySelectorAll(".pt-tabs button").forEach(b => b.setAttribute("aria-selected", String(+b.dataset.p === st.p)));
    body.innerHTML = `<div class="pt-walk">
        <div class="pt-step" aria-live="polite"></div>
        <div class="pt-why" aria-live="polite"></div>
        <div class="pt-ctl"><button type="button" data-play class="go"></button><button type="button" data-go="-1">${L(UI.prev)}</button><button type="button" data-go="1">${L(UI.next)}</button><span class="muted small">${L(UI.flow)}</span></div>
        <ol class="pt-steps">${steps().map((s, i) => `<li><button type="button" data-s="${i}"><b>${i || "◎"}</b>${esc(L(s.t))}</button></li>`).join("")}</ol>
      </div>
      <div class="pt-d${p.frame ? " framed" : ""}" style="--cols:${p.cols};--areas:${esc(p.areas)}">
        ${p.frame ? `<span class="pt-fl mono">${esc(L(p.frame))}</span>` : ""}
        <svg class="pt-svg" aria-hidden="true"><defs>
          <marker id="pta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker>
          <marker id="ptb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--hi)"/></marker></defs><g></g></svg>
        ${p.zones.map(z => `<section class="pt-z" style="grid-area:${z.id};--zc:${z.c};--zn:${z.cols || 1}"><h4 class="pt-zl mono">${esc(L(z.n))}</h4><div class="pt-zg">
          ${Object.entries(z.nodes).map(([id, x]) => `<button type="button" class="pt-n" data-id="${id}" aria-pressed="false"><span class="pt-i">${icon(x.ic)}</span><span class="pt-t"><b>${esc(L(x.n))}</b><small>${esc(L(x.sub))}</small></span></button>`).join("")}
        </div></section>`).join("")}
        <div class="pt-ls"></div>
      </div>`;
    apply(); requestAnimationFrame(draw);
  };

  const why = id => {
    const x = id && nodeOf(id);
    body.querySelector(".pt-why").innerHTML = `<p class="mono small pt-no">${L(UI.why)}</p>` + (x ? `<h3>${esc(L(x.n))}</h3><p>${L(x.w)}</p>` : `<p class="muted">${L(UI.pick)}</p>`);
  };

  const apply = () => {
    const p = part(), all = steps(), cur = all[st.s], on = st.s ? new Set(cur.n) : null;
    body.querySelectorAll(".pt-n").forEach(b => {
      b.classList.toggle("on", !!on && on.has(b.dataset.id)); b.classList.toggle("dim", !!on && !on.has(b.dataset.id));
      b.setAttribute("aria-pressed", String(b.dataset.id === st.sel));
    });
    body.querySelector(".pt-step").innerHTML = `<p class="mono small pt-no">${st.s ? L(UI.stepOf).replace("{n}", st.s).replace("{m}", p.steps.length) : L(UI.all)}</p><h3>${L(cur.t)}</h3><p>${L(cur.d)}</p>${st.s ? "" : `<p class="pt-mob muted small">${L(UI.mob)}</p>`}`;
    why(st.sel);
    body.querySelectorAll(".pt-steps button").forEach(b => b.setAttribute("aria-current", String(+b.dataset.s === st.s)));
    body.querySelector(".pt-steps").classList.toggle("run", !!st.timer);
    body.querySelector("[data-play]").textContent = L(st.timer ? UI.pause : UI.play);
    body.querySelector('[data-go="-1"]').disabled = st.s === 0;
    body.querySelector('[data-go="1"]').textContent = st.s === p.steps.length ? L(UI.all) : L(UI.next);
    draw();
  };

  // orthogonal route between two boxes: leave from the side facing the other box, bend once in the middle
  // f = where the bend sits between the two boxes (0..1), set per edge when two routes would share a line
  const route = (a, b, f = .5) => {
    const hg = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    if (hg > 16) {
      const r = b.x > a.x, x1 = r ? a.x + a.w : a.x, x2 = r ? b.x : b.x + b.w, y1 = a.y + a.h / 2, y2 = b.y + b.h / 2, m = x1 + (x2 - x1) * f;
      return { d: `M${x1} ${y1}H${m}V${y2}H${x2}`, lx: m, ly: y1 === y2 ? y1 : (y1 + y2) / 2 };
    }
    const dn = b.y > a.y, y1 = dn ? a.y + a.h : a.y, y2 = dn ? b.y : b.y + b.h, x1 = a.x + a.w / 2, x2 = b.x + b.w / 2, m = y1 + (y2 - y1) * f;
    return { d: `M${x1} ${y1}V${m}H${x2}V${y2}`, lx: (x1 + x2) / 2, ly: m };
  };

  const draw = () => {
    const d = body.querySelector(".pt-d"); if (!d || !d.offsetWidth) return;
    const c = d.getBoundingClientRect(), svg = d.querySelector(".pt-svg"), g = svg.querySelector("g");
    svg.setAttribute("width", c.width); svg.setAttribute("height", c.height); svg.setAttribute("viewBox", `0 0 ${c.width} ${c.height}`);
    const box = id => { const r = d.querySelector(`.pt-n[data-id="${id}"]`).getBoundingClientRect(); return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }; };
    const cur = st.s ? new Set(steps()[st.s].e) : null;
    // phones: boxes are stacked, so only the current step's arrows are drawn, each in its own lane on the right
    const narrow = matchMedia("(max-width:900px)").matches;
    const lane0 = narrow && Math.max(...[...d.querySelectorAll(".pt-n")].map(n => n.getBoundingClientRect().right - c.left)) + 8;
    let paths = "", labels = "", lane = 0;
    for (const [a, b, l, f] of part().edges) {
      const k = `${a}>${b}`;
      if (narrow && !(cur && cur.has(k))) continue;
      const A = box(a), B = box(b), gx = lane0 + 7 * lane++;
      const r = narrow ? { d: `M${A.x + A.w} ${A.y + A.h / 2}H${gx}V${B.y + B.h / 2}H${B.x + B.w + 2}`, lx: 0, ly: 0 } : route(A, B, f);
      const cls = cur ? (cur.has(k) ? "on" : "dim") : "";
      paths += `<path class="pt-e ${cls}" d="${r.d}" marker-end="url(#${cls === "on" ? "ptb" : "pta"})"/>`;
      labels += `<span class="pt-l mono ${cls}" style="left:${r.lx.toFixed(1)}px;top:${r.ly.toFixed(1)}px">${esc(L(l))}</span>`;
    }
    g.innerHTML = paths; d.querySelector(".pt-ls").innerHTML = labels;
  };

  // autoplay: one step every STEP ms, back to the overview after the last step
  const STEP = 4500;
  const stop = () => { clearInterval(st.timer); st.timer = null; };
  const play = () => {
    if (st.timer) { stop(); apply(); return; }
    if (st.s === 0 || st.s === part().steps.length) st.s = 1;
    st.timer = setInterval(() => { if (st.s >= part().steps.length) { stop(); st.s = 0; } else st.s++; apply(); }, STEP);
    apply();
  };

  mount.addEventListener("click", e => {
    const tab = e.target.closest(".pt-tabs button");
    if (tab) { stop(); st.p = +tab.dataset.p; st.s = 0; st.sel = null; history.replaceState(null, "", "#" + part().id); build(); return; }
    if (e.target.closest("[data-play]")) { play(); return; }
    const go = e.target.closest("[data-go]"), dot = e.target.closest("[data-s]"), n = e.target.closest(".pt-n");
    if (go || dot) stop();
    if (go) { const m = part().steps.length; st.s = st.s === m && +go.dataset.go > 0 ? 0 : Math.max(0, Math.min(m, st.s + +go.dataset.go)); apply(); }
    else if (dot) { st.s = +dot.dataset.s; apply(); }
    else if (n) { st.sel = st.sel === n.dataset.id ? null : n.dataset.id; apply(); }
  });
  // hover previews the why without pinning; leaving the box shows the pinned one again
  mount.addEventListener("mouseover", e => { const n = e.target.closest(".pt-n"); if (n) why(n.dataset.id); });
  mount.addEventListener("mouseout", e => { const n = e.target.closest(".pt-n"); if (n && !n.contains(e.relatedTarget)) why(st.sel); });
  mount.addEventListener("focusin", e => { const n = e.target.closest(".pt-n"); if (n) why(n.dataset.id); });
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(draw, 80); });
  document.fonts?.ready.then(draw);
  build();
})();
