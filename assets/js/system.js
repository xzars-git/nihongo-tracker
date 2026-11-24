// System design page (system.html): before/after toggle, step walkthrough and component inspector.
// Everything here is described at concept level on purpose: no file paths, ports, account names, secrets or private repo names.
(() => {
  const L = o => o[LANG] ?? o.id;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const UI = {
    title: { id: "Desain sistem", en: "System design", ja: "システム設計" },
    lead: {
      id: "Dari satu perintah di chat sampai angka di halaman ini. Klik komponen untuk detail, atau jalankan langkah demi langkah. Tombol di atas membandingkan sistem sebelum dan sesudah database PostgreSQL ditambahkan.",
      en: "From one command in the chat to the numbers on this site. Click a component for details, or walk through it step by step. The switch compares the system before and after the PostgreSQL database was added.",
      ja: "チャットの1コマンドから、このサイトの数字まで。コンポーネントをクリックすると詳細、ステップ実行もできます。切り替えでPostgreSQL導入の前後を比べられます。",
    },
    before: { id: "Sebelum", en: "Before", ja: "導入前" }, after: { id: "Sesudah", en: "After", ja: "導入後" },
    sub: { before: { id: "catatan markdown", en: "markdown notes", ja: "Markdownノート" }, after: { id: "dengan PostgreSQL", en: "with PostgreSQL", ja: "PostgreSQLあり" } },
    lg: { id: "Legenda", en: "Legend", ja: "凡例" },
    lgOld: { id: "sudah ada", en: "existing", ja: "既存" }, lgMod: { id: "diubah", en: "modified", ja: "変更" },
    lgNew: { id: "baru", en: "new", ja: "新規" }, lgGone: { id: "diarsipkan", en: "archived", ja: "アーカイブ" },
    badge: { old: { id: "ADA", en: "EXISTING", ja: "既存" }, mod: { id: "DIUBAH", en: "MODIFIED", ja: "変更" }, new: { id: "BARU", en: "NEW", ja: "新規" }, gone: { id: "ARSIP", en: "ARCHIVED", ja: "保管" } },
    walk: { id: "Alur langkah demi langkah", en: "Step-by-step flow", ja: "ステップ別の流れ" },
    start: { id: "Mulai", en: "Start", ja: "開始" }, prev: { id: "← Sebelumnya", en: "← Prev", ja: "← 前へ" }, next: { id: "Berikut →", en: "Next →", ja: "次へ →" }, all: { id: "Lihat semua", en: "Show all", ja: "全体表示" },
    stepOf: { id: "Langkah {n} dari {m}", en: "Step {n} of {m}", ja: "ステップ {n}/{m}" },
    pick: { id: "Klik satu komponen di diagram untuk melihat perannya, apa yang berubah, dan catatan keamanannya.", en: "Click a component in the diagram to see its role, what changed and its security notes.", ja: "図のコンポーネントをクリックすると、役割・変更点・セキュリティ上の注意が表示されます。" },
    role: { id: "Peran", en: "Role", ja: "役割" }, chg: { id: "Yang berubah", en: "What changed", ja: "変更点" }, sec: { id: "Keamanan", en: "Security", ja: "セキュリティ" },
    secH: { id: "Siapa bisa melihat apa", en: "Who can see what", ja: "誰が何を見られるか" },
    secLead: { id: "Situs ini publik, jadi aku memisahkan data jadi tiga zona.", en: "This site is public, so data is split into three zones.", ja: "このサイトは公開されているため、データを3つのゾーンに分けています。" },
    zone: { id: "Zona", en: "Zone", ja: "ゾーン" }, what: { id: "Isinya", en: "What lives there", ja: "中身" }, guard: { id: "Penjagaan", en: "How it is guarded", ja: "守り方" },
    weakH: { id: "Kelemahan yang aku tahu", en: "Weak spots I know about", ja: "把握している弱点" },
    weakLead: { id: "Tidak ada sistem yang sempurna. Ini daftar jujur beserta rencana perbaikannya.", en: "No system is perfect. This is an honest list with the planned fix.", ja: "完璧なシステムはありません。正直な一覧と改善案です。" },
    hist: { id: "Riwayat: sebelum dan sesudah PostgreSQL", en: "History: before and after PostgreSQL", ja: "経緯：PostgreSQL導入の前後" },
    hint: { id: "Di layar kecil, garis panah disembunyikan. Pakai langkah demi langkah untuk melihat urutannya.", en: "On small screens the arrows are hidden. Use the step-by-step flow to see the order.", ja: "小さい画面では矢印を隠します。順番はステップ実行で確認してください。" },
  };

  // st: old = unchanged, mod = changed by the PostgreSQL work, new = added, gone = replaced (kept as a read-only archive)
  // c/r: column / row on the desktop grid
  const N = {
    you: { n: "You + AI tutor", st: "old", c: 1, r: 1,
      role: { id: "Belajar bersama tutor AI di chat. Hasil latihan dicatat dengan satu perintah.", en: "Study with the AI tutor in chat. Results are logged with one command.", ja: "チャットでAIチューターと勉強。結果は1つのコマンドで記録。" },
      chg: { id: "Tidak ada perubahan.", en: "No change.", ja: "変更なし。" },
      sec: { id: "Catatan sesi ikut terbit di data publik. Jangan menulis hal pribadi di catatan.", en: "Session notes end up in the public data. Never write anything private in a note.", ja: "セッションのメモは公開データに含まれます。私的な内容は書かないこと。" } },
    catat: { n: "catat.py (CLI)", st: "mod", c: 2, r: 1,
      role: { id: "Alat satu baris untuk mencatat sesi, kesalahan, bab, dan kosakata Inggris.", en: "One-line tool to log sessions, mistakes, chapters and English words.", ja: "セッション・間違い・章・英単語を1行で記録するツール。" },
      chg: { id: "Dulu menambah baris ke tabel markdown. Sekarang INSERT/UPDATE ke PostgreSQL, dan ada perintah baru untuk membaca daftar review yang jatuh tempo.", en: "It used to append rows to markdown tables. Now it does INSERT/UPDATE in PostgreSQL, and a new command reads the due review list.", ja: "以前はMarkdown表に行を追加。今はPostgreSQLにINSERT/UPDATEし、期限の来た復習リストを読む新コマンドもある。" },
      sec: { id: "Semua query memakai parameter, jadi isi catatan tidak bisa menyisipkan SQL.", en: "Every query uses parameters, so note text cannot inject SQL.", ja: "すべてのクエリはパラメータ化されており、メモ文からSQLを注入できない。" } },
    notes: { n: "Markdown notes", st: "gone", c: 3, r: 1,
      role: { id: "Sumber data lama: tabel di file markdown yang terus bertambah.", en: "The old source of truth: tables in markdown files that kept growing.", ja: "旧データ源：増え続けるMarkdownファイルの表。" },
      chg: { id: "Dipindah ke arsip baca-saja. Tidak ada kode yang membacanya lagi.", en: "Moved to a read-only archive. No code reads it any more.", ja: "読み取り専用のアーカイブへ移動。もうコードは読まない。" },
      sec: { id: "Hanya ada di repo catatan privat, tidak di repo publik.", en: "Lives only in the private notes repo, never in the public one.", ja: "非公開のノート用リポジトリにのみ存在し、公開リポジトリにはない。" } },
    pg: { n: "PostgreSQL (local)", st: "new", c: 3, r: 2,
      role: { id: "Sumber kebenaran tunggal: 11 tabel untuk sesi, bank kesalahan, kosakata, data Anki harian, dan menit belajar.", en: "The single source of truth: 11 tables for sessions, the mistake bank, words, daily Anki data and study minutes.", ja: "唯一のデータ源：セッション・間違い・単語・Anki日次・学習分の11テーブル。" },
      chg: { id: "Baru. Menggantikan markdown agar data tidak membengkak dan bisa di-query. Berjalan sebagai layanan di PC ini.", en: "New. Replaces markdown so the data does not bloat and can be queried. Runs as a service on this PC.", ja: "新規。データの肥大化を防ぎクエリ可能にするためMarkdownを置換。このPC上でサービスとして稼働。" },
      sec: { id: "Hanya untuk PC ini, dilindungi password. Kredensial ada di file lokal di luar repo, tidak pernah di-commit.", en: "Meant for this PC only and password protected. Credentials live in a local file outside the repo and are never committed.", ja: "このPC専用でパスワード保護。認証情報はリポジトリ外のローカルファイルにあり、コミットされない。" } },
    backup: { n: "SQL backup → private repo", st: "new", c: 3, r: 3,
      role: { id: "Salinan SQL biasa dari seluruh database, dibuat setiap sync.", en: "A plain SQL copy of the whole database, made on every sync.", ja: "毎回の同期で作る、データベース全体のプレーンSQLコピー。" },
      chg: { id: "Baru. Ditulis ulang hanya jika isinya berubah, lalu didorong ke repo privat.", en: "New. Rewritten only when the content changed, then pushed to the private repo.", ja: "新規。内容が変わったときだけ書き直し、非公開リポジトリへpush。" },
      sec: { id: "Hanya masuk repo privat. Baris yang berubah-ubah tiap dump dibuang agar riwayat git tidak ramai. Pakai 2FA di akun GitHub.", en: "Goes only to the private repo. Lines that change on every dump are stripped so the git history stays quiet. Use 2FA on the GitHub account.", ja: "非公開リポジトリのみ。毎回変わる行は除いてgit履歴を静かに保つ。GitHubアカウントには2FAを。" } },
    anki: { n: "Anki (read-only copy)", st: "old", c: 4, r: 3,
      role: { id: "Statistik review dan kata baru dibaca dari salinan database Anki.", en: "Review and new-card statistics are read from a copy of the Anki database.", ja: "復習数・新規カードの統計はAnkiデータベースのコピーから読む。" },
      chg: { id: "Tidak ada perubahan. Angka harian sekarang disimpan sebagai baris di PostgreSQL.", en: "No change. Daily numbers are now stored as rows in PostgreSQL.", ja: "変更なし。日次の数字はPostgreSQLの行として保存される。" },
      sec: { id: "Hanya dibaca dari salinan. Tidak pernah menulis ke Anki.", en: "Read from a copy only. It never writes to Anki.", ja: "コピーからの読み取りのみ。Ankiには書き込まない。" } },
    tray: { n: "Nihongo Sync (tray app)", st: "mod", c: 2, r: 2,
      role: { id: "Aplikasi tray Windows yang menjalankan sync empat kali sehari dan mengingatkan jam 20:00.", en: "A Windows tray app that runs the sync four times a day and reminds at 20:00.", ja: "1日4回の同期を実行し、20:00にリマインドするWindowsトレイアプリ。" },
      chg: { id: "Sekarang cek database sebelum sync, menampilkan status database, dan punya tombol Start database. Sync berhenti dengan pesan jelas jika database mati.", en: "It now checks the database before a sync, shows the database status and has a Start database button. A sync stops with a clear message when the database is down.", ja: "同期前にDBを確認し、DB状態を表示し、DB起動ボタンを持つ。DBが止まっていれば明確なメッセージで中断。" },
      sec: { id: "Hak admin hanya diminta saat tombol Start database ditekan. Gagal sync tidak pernah mengirim data basi.", en: "Admin rights are requested only when you press Start database. A failed sync never pushes stale data.", ja: "管理者権限はDB起動ボタンを押したときだけ要求。同期失敗時に古いデータは送らない。" } },
    publish: { n: "publish.py", st: "mod", c: 4, r: 1,
      role: { id: "Membangun file JSON dari database dan Anki, lalu mem-push jika ada perubahan.", en: "Builds the JSON files from the database and Anki, then pushes if anything changed.", ja: "DBとAnkiからJSONを作り、変更があればpushする。" },
      chg: { id: "Sekarang membaca dari SQL dalam satu transaksi, bukan mem-parse markdown. Bentuk JSON sama persis, jadi situs tidak berubah.", en: "It now reads SQL in one transaction instead of parsing markdown. The JSON shape is identical, so the site did not change.", ja: "Markdown解析の代わりに1トランザクションでSQLを読む。JSONの形は同一なのでサイトは変わらない。" },
      sec: { id: "Hanya dua file JSON yang di-add ke git (daftar putih). Database mati = berhenti, tidak ada yang ditulis atau di-push.", en: "Only two JSON files are added to git (an allow-list). Database down means it stops and writes or pushes nothing.", ja: "gitに追加するのはJSON 2ファイルのみ（許可リスト）。DBが止まっていれば何も書かずpushもしない。" } },
    json: { n: "data/*.json", st: "old", c: 5, r: 1,
      role: { id: "Data turunan yang dibaca situs: sesi, bank kesalahan, angka Anki, rencana.", en: "Derived data the site reads: sessions, mistake bank, Anki numbers, the plan.", ja: "サイトが読む派生データ：セッション・間違い・Anki数値・計画。" },
      chg: { id: "Tidak ada perubahan bentuk. Sumbernya sekarang SQL.", en: "No change in shape. The source is now SQL.", ja: "形は変更なし。元データがSQLになった。" },
      sec: { id: "Publik. Berisi catatan sesi, jadi tidak boleh ada isi rahasia di sana.", en: "Public. It contains session notes, so nothing secret may be written there.", ja: "公開。セッションのメモを含むため、秘密の内容は書かない。" } },
    github: { n: "GitHub (public repo)", st: "old", c: 6, r: 1,
      role: { id: "Menyimpan kode dan JSON turunan. Setiap push memicu deploy.", en: "Holds the code and the derived JSON. Every push triggers a deploy.", ja: "コードと派生JSONを保管。pushごとにデプロイが走る。" },
      chg: { id: "Tidak ada perubahan.", en: "No change.", ja: "変更なし。" },
      sec: { id: "Tidak ada password, dump database, atau catatan mentah di repo ini.", en: "No passwords, no database dump and no raw notes in this repo.", ja: "このリポジトリにパスワード・DBダンプ・生ノートは含まれない。" } },
    vercel: { n: "Vercel (static site)", st: "old", c: 6, r: 2,
      role: { id: "Hosting statis. Deploy otomatis setiap push ke branch utama.", en: "Static hosting. Deploys automatically on every push to the main branch.", ja: "静的ホスティング。mainブランチへのpushごとに自動デプロイ。" },
      chg: { id: "Tidak ada perubahan.", en: "No change.", ja: "変更なし。" },
      sec: { id: "Tidak ada kode server dan tidak ada database di sisi ini, jadi tidak ada yang bisa diretas di server.", en: "There is no server code and no database on this side, so there is no server to break into.", ja: "サーバーコードもDBもないため、侵入できるサーバーがない。" } },
    browser: { n: "Browser (dashboard + Flex)", st: "mod", c: 6, r: 3,
      role: { id: "Menggambar dashboard, kartu alert, dan gambar Flex di perangkatmu.", en: "Draws the dashboard, the alert cards and the Flex image on your device.", ja: "ダッシュボード・アラートカード・Flex画像をあなたの端末で描画。" },
      chg: { id: "Fitur baru: kartu alert bertingkat (tempo vs target mingguan) dan kartu Status di Flex. Dihitung di browser dari JSON yang sama.", en: "New features: tiered alert cards (pace vs the weekly target) and a Status card in Flex. Both are computed in the browser from the same JSON.", ja: "新機能：ペース対週目標の段階式アラートカードと、FlexのStatusカード。同じJSONからブラウザ内で計算。" },
      sec: { id: "Gambar Flex dibuat di canvas lokal dan tidak pernah diunggah. Halaman memakai noindex, tetapi itu bukan kontrol akses: siapa pun yang punya tautan bisa membacanya.", en: "The Flex image is drawn on a local canvas and never uploaded. The page uses noindex, but that is not access control: anyone with the link can read it.", ja: "Flex画像はローカルのcanvasで描画しアップロードしない。noindexはアクセス制御ではなく、リンクを知っていれば誰でも読める。" } },
  };

  // k: old = only before, new = only after, both = in both views
  const E = [
    { id: "e1", a: "you", b: "catat", k: "both" }, { id: "e2", a: "catat", b: "notes", k: "old" }, { id: "e3", a: "catat", b: "pg", k: "new" },
    { id: "e4", a: "notes", b: "publish", k: "old" }, { id: "e5", a: "pg", b: "publish", k: "new" }, { id: "e6", a: "anki", b: "publish", k: "both" },
    { id: "e7", a: "tray", b: "publish", k: "both" }, { id: "e8", a: "tray", b: "pg", k: "new" }, { id: "e9", a: "publish", b: "json", k: "both" },
    { id: "e10", a: "pg", b: "backup", k: "new" }, { id: "e11", a: "json", b: "github", k: "both" }, { id: "e12", a: "github", b: "vercel", k: "both" },
    { id: "e13", a: "vercel", b: "browser", k: "both" },
  ];

  const S = {
    after: [
      { e: ["e1"], n: ["you", "catat"], t: { id: "Kamu mencatat", en: "You log a result", ja: "結果を記録する" }, d: { id: "Setelah latihan di chat, satu perintah mencatat hasilnya. Tidak ada yang dikirim ke internet pada langkah ini.", en: "After a drill in the chat, one command logs the result. Nothing goes to the internet at this step.", ja: "チャットで練習した後、1コマンドで結果を記録。この段階ではインターネットに何も送られない。" } },
      { e: ["e3"], n: ["catat", "pg"], t: { id: "Masuk database", en: "It lands in the database", ja: "DBに保存される" }, d: { id: "Baris baru ditulis ke PostgreSQL dengan query berparameter. Ini bagian BARU: dulu baris ini ditambahkan ke file markdown.", en: "A new row is written to PostgreSQL with a parameterized query. This is the NEW part: this row used to be appended to a markdown file.", ja: "パラメータ化クエリでPostgreSQLに行を書き込む。ここが新規部分で、以前はMarkdownファイルへの追記だった。" } },
      { e: ["e7", "e8"], n: ["tray", "pg", "publish"], t: { id: "Jadwal dan cek database", en: "Schedule and database check", ja: "スケジュールとDB確認" }, d: { id: "Aplikasi tray menjalankan sync di 00:00, 12:00, 18:00, dan 21:00. Sebelumnya ia mengecek database. Jika mati, sync berhenti dan tidak ada data basi yang terkirim.", en: "The tray app runs the sync at 00:00, 12:00, 18:00 and 21:00. First it checks the database. If it is down, the sync stops and no stale data is sent.", ja: "トレイアプリが00:00・12:00・18:00・21:00に同期を実行。まずDBを確認し、停止中なら同期を中断して古いデータは送らない。" } },
      { e: ["e5", "e6"], n: ["pg", "anki", "publish"], t: { id: "Membangun data", en: "Build the data", ja: "データを作る" }, d: { id: "publish.py membaca SQL dalam satu transaksi dan menambahkan angka Anki dari salinan baca-saja. Hasilnya sama persis dengan versi markdown, jadi situs tidak perlu diubah.", en: "publish.py reads SQL in one transaction and adds the Anki numbers from the read-only copy. The result is identical to the markdown version, so the site needed no change.", ja: "publish.pyが1トランザクションでSQLを読み、読み取り専用コピーのAnki数値を加える。結果はMarkdown版と同一なのでサイトの変更は不要。" } },
      { e: ["e10"], n: ["pg", "backup"], t: { id: "Cadangan privat", en: "Private backup", ja: "非公開バックアップ" }, d: { id: "Dump SQL dibuat dan dikirim hanya ke repo privat, hanya jika isinya berubah. Repo publik tidak pernah menerimanya.", en: "An SQL dump is made and sent only to the private repo, and only if it changed. The public repo never receives it.", ja: "SQLダンプを作り、内容が変わったときだけ非公開リポジトリへ送る。公開リポジトリには届かない。" } },
      { e: ["e9", "e11"], n: ["publish", "json", "github"], t: { id: "Terbit ke GitHub", en: "Publish to GitHub", ja: "GitHubへ公開" }, d: { id: "Hanya dua file JSON yang di-commit dan di-push (daftar putih). Tidak ada hal lain yang ikut.", en: "Only two JSON files are committed and pushed (an allow-list). Nothing else goes along.", ja: "コミット・pushするのはJSON 2ファイルのみ（許可リスト）。他は何も含まれない。" } },
      { e: ["e12", "e13"], n: ["github", "vercel", "browser"], t: { id: "Deploy dan tampil", en: "Deploy and display", ja: "デプロイと表示" }, d: { id: "Vercel men-deploy situs statis. Browser membaca JSON, menghitung tempo vs target, dan menggambar kartu alert serta Flex Status di perangkatmu.", en: "Vercel deploys the static site. The browser reads the JSON, computes pace against the target and draws the alert cards and the Flex Status on your device.", ja: "Vercelが静的サイトをデプロイ。ブラウザがJSONを読み、ペースと目標を計算し、アラートカードとFlex Statusを端末で描画。" } },
    ],
    before: [
      { e: ["e1"], n: ["you", "catat"], t: { id: "Kamu mencatat", en: "You log a result", ja: "結果を記録する" }, d: { id: "Satu perintah mencatat hasil latihan.", en: "One command logs the result of a drill.", ja: "1コマンドで練習結果を記録。" } },
      { e: ["e2"], n: ["catat", "notes"], t: { id: "Ditambah ke markdown", en: "Appended to markdown", ja: "Markdownに追記" }, d: { id: "Baris ditambahkan ke tabel di file markdown. Setelah beberapa bulan file ini menjadi sangat panjang dan lambat dirawat.", en: "A row is appended to a table in a markdown file. After a few months that file gets very long and hard to maintain.", ja: "Markdownファイルの表に行を追記。数か月で非常に長くなり、管理しにくくなる。" } },
      { e: ["e4", "e6", "e7"], n: ["notes", "anki", "tray", "publish"], t: { id: "Parse dan gabung", en: "Parse and combine", ja: "解析して結合" }, d: { id: "Aplikasi tray menjalankan publish.py, yang mem-parse tabel markdown dengan kode buatan sendiri dan menambah angka Anki. Format tabel yang rusak bisa menggagalkan hasil.", en: "The tray app runs publish.py, which parses the markdown tables with custom code and adds the Anki numbers. A broken table format can break the result.", ja: "トレイアプリがpublish.pyを実行。自作コードでMarkdown表を解析しAnki数値を加える。表の形式が崩れると結果が壊れる。" } },
      { e: ["e9", "e11"], n: ["publish", "json", "github"], t: { id: "Terbit ke GitHub", en: "Publish to GitHub", ja: "GitHubへ公開" }, d: { id: "Hanya file JSON turunan yang di-push. Catatan mentah tetap di repo privat.", en: "Only the derived JSON is pushed. The raw notes stay in the private repo.", ja: "派生JSONだけをpush。生ノートは非公開リポジトリに残る。" } },
      { e: ["e12", "e13"], n: ["github", "vercel", "browser"], t: { id: "Deploy dan tampil", en: "Deploy and display", ja: "デプロイと表示" }, d: { id: "Vercel men-deploy situs statis dan browser menggambar dashboard.", en: "Vercel deploys the static site and the browser draws the dashboard.", ja: "Vercelが静的サイトをデプロイし、ブラウザがダッシュボードを描画。" } },
    ],
  };

  const ZONES = [
    { z: { id: "Publik", en: "Public", ja: "公開" }, w: { id: "Situs dan repo GitHub: kode, JSON turunan (sesi, bank kesalahan, angka), dokumentasi.", en: "The site and the GitHub repo: code, derived JSON (sessions, mistake bank, numbers), docs.", ja: "サイトとGitHubリポジトリ：コード・派生JSON（セッション・間違い・数値）・ドキュメント。" }, g: { id: "Hanya file di daftar putih yang di-push. Tidak ada password atau dump. Isi catatan sesi tetap terbaca publik.", en: "Only allow-listed files are pushed. No passwords or dumps. Session note text is still readable by anyone.", ja: "許可リストのファイルのみpush。パスワードやダンプはなし。セッションのメモ文は誰でも読める。" } },
    { z: { id: "Privat", en: "Private", ja: "非公開" }, w: { id: "Repo catatan: catatan lengkap, aturan belajar, dan cadangan SQL.", en: "The notes repo: full notes, study rules and the SQL backup.", ja: "ノート用リポジトリ：完全なノート・学習ルール・SQLバックアップ。" }, g: { id: "Repo privat. Keamanannya sebatas keamanan akunnya, jadi pakai password kuat dan 2FA.", en: "A private repo. It is only as safe as the account, so use a strong password and 2FA.", ja: "非公開リポジトリ。安全性はアカウント次第なので、強いパスワードと2FAを使う。" } },
    { z: { id: "Hanya di PC ini", en: "This PC only", ja: "このPCのみ" }, w: { id: "Database PostgreSQL, salinan Anki, dan kredensial koneksi.", en: "The PostgreSQL database, the Anki copy and the connection credentials.", ja: "PostgreSQLデータベース・Ankiコピー・接続用の認証情報。" }, g: { id: "Tidak ada di repo mana pun. Kredensial disimpan di file lokal di luar proyek. Firewall membatasi akses dari luar.", en: "In no repo at all. Credentials sit in a local file outside the project. The firewall limits access from outside.", ja: "どのリポジトリにもない。認証情報はプロジェクト外のローカルファイル。ファイアウォールが外部からのアクセスを制限。" } },
  ];
  const WEAK = [
    { w: { id: "Catatan sesi tampil di JSON publik.", en: "Session notes show up in the public JSON.", ja: "セッションのメモが公開JSONに表示される。" }, f: { id: "Aturan: jangan menulis hal pribadi. Rencana: pemindai rahasia sebelum commit.", en: "Rule: never write anything private. Planned: a secret scanner before commits.", ja: "ルール：私的な内容は書かない。計画：コミット前のシークレットスキャン。" } },
    { w: { id: "noindex bukan kontrol akses.", en: "noindex is not access control.", ja: "noindexはアクセス制御ではない。" }, f: { id: "Siapa pun yang punya tautan bisa membaca. Jika perlu privat, taruh di balik login.", en: "Anyone with the link can read it. If it must be private, put it behind a login.", ja: "リンクを知っていれば誰でも読める。非公開にするならログインの背後に置く。" } },
    { w: { id: "Database mendengarkan di semua antarmuka jaringan; hanya firewall yang menahan akses luar.", en: "The database listens on all network interfaces; only the firewall blocks outside access.", ja: "DBは全ネットワークインターフェースで待ち受けており、外部アクセスを止めているのはファイアウォールだけ。" }, f: { id: "Perbaikan: batasi ke localhost saja di konfigurasi database.", en: "Fix: restrict it to localhost in the database configuration.", ja: "対策：DB設定でlocalhostのみに制限する。" } },
    { w: { id: "Cadangan bergantung pada satu akun repo privat.", en: "The backup depends on one private repo account.", ja: "バックアップは1つの非公開リポジトリのアカウントに依存。" }, f: { id: "Pakai 2FA. Rencana: salinan kedua yang terenkripsi di tempat lain.", en: "Use 2FA. Planned: a second encrypted copy somewhere else.", ja: "2FAを使う。計画：別の場所に暗号化した2つ目のコピー。" } },
    { w: { id: "Satu PC adalah titik tunggal: PC mati berarti tidak ada update.", en: "One PC is a single point of failure: PC off means no updates.", ja: "1台のPCが単一障害点。PCがオフなら更新されない。" }, f: { id: "Sync gagal dengan pesan jelas dan data lama tetap aman di situs. Cadangan melindungi dari kehilangan data.", en: "A failed sync reports clearly and the old data stays on the site. The backup protects against data loss.", ja: "同期失敗は明確に通知され、サイト上の古いデータは残る。バックアップがデータ消失を防ぐ。" } },
  ];

  const st = { view: "after", step: -1, sel: null };
  const badge = k => `<span class="sys-bd ${k}">${L(UI.badge[k])}</span>`;
  const shown = (id) => st.view === "after" || N[id].st !== "new";
  const nodeKind = id => st.view === "before" ? "old" : N[id].st;

  const page = $("#page");
  page.innerHTML = `
    <h1>${L(UI.title)}</h1><div id="parts"></div><h2>${L(UI.hist)}</h2><p class="lead">${L(UI.lead)}</p>
    <div class="sys-bar">
      <div class="sys-sw" role="group" aria-label="${esc(L(UI.before))} / ${esc(L(UI.after))}">
        <button type="button" data-v="before">${L(UI.before)}<small>${L(UI.sub.before)}</small></button>
        <button type="button" data-v="after">${L(UI.after)}<small>${L(UI.sub.after)}</small></button>
      </div>
      <div class="sys-lg mono"><b>${L(UI.lg)}</b>
        <span><i class="sys-bd old">${L(UI.badge.old)}</i> ${L(UI.lgOld)}</span><span><i class="sys-bd mod">${L(UI.badge.mod)}</i> ${L(UI.lgMod)}</span>
        <span><i class="sys-bd new">${L(UI.badge.new)}</i> ${L(UI.lgNew)}</span><span><i class="sys-bd gone">${L(UI.badge.gone)}</i> ${L(UI.lgGone)}</span></div>
    </div>
    <div class="sys-map" id="sysMap"><svg id="sysSvg" aria-hidden="true"><defs>
      <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker>
      <marker id="ahn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ok)"/></marker></defs><g id="sysEdges"></g></svg>
      ${Object.entries(N).map(([id, x]) => `<button type="button" class="sys-n" data-id="${id}" style="--c:${x.c};--r:${x.r}"><b>${esc(x.n)}</b><span class="sys-b"></span></button>`).join("")}
    </div>
    <p class="muted small sys-hint">${L(UI.hint)}</p>
    <div class="sys-cols">
      <section class="sys-card" aria-live="polite"><h2>${L(UI.walk)}</h2><div id="sysStep"></div>
        <div class="sys-ctl"><button type="button" id="sysPrev">${L(UI.prev)}</button><button type="button" id="sysNext" class="go">${L(UI.start)}</button><button type="button" id="sysAll">${L(UI.all)}</button></div></section>
      <section class="sys-card" aria-live="polite"><h2>Inspector</h2><div id="sysInfo"></div></section>
    </div>
    <h2>${L(UI.secH)}</h2><p>${L(UI.secLead)}</p>
    <table class="wt sys-t"><tr><th>${L(UI.zone)}</th><th>${L(UI.what)}</th><th>${L(UI.guard)}</th></tr>${ZONES.map(z => `<tr><td><b>${L(z.z)}</b></td><td>${L(z.w)}</td><td>${L(z.g)}</td></tr>`).join("")}</table>
    <h2>${L(UI.weakH)}</h2><p>${L(UI.weakLead)}</p>
    <table class="wt sys-t">${WEAK.map(x => `<tr><td>${L(x.w)}</td><td>${L(x.f)}</td></tr>`).join("")}</table>`;

  const map = $("#sysMap"), svg = $("#sysSvg"), g = $("#sysEdges");
  const el = id => map.querySelector(`.sys-n[data-id="${id}"]`);

  // point where the line from a's centre towards b's centre leaves a's box
  const edgePt = (a, b, gap) => {
    const ca = [a.x + a.w / 2, a.y + a.h / 2], cb = [b.x + b.w / 2, b.y + b.h / 2], dx = cb[0] - ca[0], dy = cb[1] - ca[1];
    const t = Math.min(dx ? (a.w / 2 + gap) / Math.abs(dx) : Infinity, dy ? (a.h / 2 + gap) / Math.abs(dy) : Infinity);
    return [ca[0] + dx * t, ca[1] + dy * t];
  };
  const box = e => ({ x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight });

  const drawEdges = () => {
    const w = map.clientWidth, h = map.clientHeight; svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("width", w); svg.setAttribute("height", h);
    const on = st.step >= 0 ? new Set(S[st.view][st.step].e) : null;
    g.innerHTML = E.filter(e => e.k === "both" || (e.k === "old") === (st.view === "before")).map(e => {
      const a = box(el(e.a)), b = box(el(e.b)), p = edgePt(a, b, 3), q = edgePt(b, a, 7);
      const cls = ["sys-e", e.k === "new" ? "new" : "", on ? (on.has(e.id) ? "on" : "dim") : ""].join(" ");
      return `<path class="${cls}" d="M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}" marker-end="url(#${e.k === "new" ? "ahn" : "ah"})"/>`;
    }).join("");
  };

  const info = () => {
    const x = N[st.sel], box = $("#sysInfo");
    if (!x) { box.innerHTML = `<p class="muted">${L(UI.pick)}</p>`; return; }
    box.innerHTML = `<h3>${esc(x.n)} ${badge(nodeKind(st.sel))}</h3>
      <dl class="sys-dl"><dt>${L(UI.role)}</dt><dd>${L(x.role)}</dd><dt>${L(UI.chg)}</dt><dd>${L(x.chg)}</dd><dt>${L(UI.sec)}</dt><dd>${L(x.sec)}</dd></dl>`;
  };

  const render = () => {
    const steps = S[st.view], cur = st.step >= 0 ? steps[st.step] : null, on = cur ? new Set(cur.n) : null;
    map.dataset.view = st.view;
    document.querySelectorAll(".sys-sw button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === st.view)));
    for (const [id, x] of Object.entries(N)) {
      const b = el(id), k = nodeKind(id);
      b.hidden = false; b.style.visibility = shown(id) ? "" : "hidden";
      b.className = `sys-n k-${k}${on ? (on.has(id) ? " on" : " dim") : ""}${st.sel === id ? " sel" : ""}`;
      b.querySelector(".sys-b").innerHTML = st.view === "after" && k === "old" ? "" : badge(k);
      b.disabled = !shown(id);
    }
    if (st.sel && !shown(st.sel)) st.sel = null;
    $("#sysStep").innerHTML = cur
      ? `<p class="mono small sys-no">${L(UI.stepOf).replace("{n}", st.step + 1).replace("{m}", steps.length)}</p><h3>${L(cur.t)}</h3><p>${L(cur.d)}</p>`
      : `<p class="muted">${steps.length} · ${L(UI.walk)}</p>`;
    $("#sysPrev").disabled = st.step < 0;
    $("#sysNext").textContent = st.step < 0 ? L(UI.start) : st.step === steps.length - 1 ? L(UI.all) : L(UI.next);
    info(); drawEdges();
  };

  document.querySelectorAll(".sys-sw button").forEach(b => b.onclick = () => { st.view = b.dataset.v; st.step = -1; render(); });
  map.addEventListener("click", e => { const b = e.target.closest(".sys-n"); if (!b || b.disabled) return; st.sel = b.dataset.id; render(); });
  $("#sysPrev").onclick = () => { st.step--; render(); };
  $("#sysNext").onclick = () => { st.step = st.step === S[st.view].length - 1 ? -1 : st.step + 1; render(); };
  $("#sysAll").onclick = () => { st.step = -1; render(); };

  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawEdges, 80); });
  document.fonts?.ready.then(drawEdges);
  document.title = `${L(UI.title)} · Arsenius`;
  document.querySelector('[data-nav="system"]')?.setAttribute("aria-current", "page");
  render();
})();
