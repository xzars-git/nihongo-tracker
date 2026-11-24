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

  // Architecture overview tiles. f = flow top to bottom; an array inside f = nodes side by side. k = colour kind, w = why the step exists.
  const KIND = {
    you: { id: "Kamu", en: "You", ja: "あなた" }, run: { id: "Kode", en: "Code", ja: "コード" }, ai: { id: "Model AI", en: "AI model", ja: "AIモデル" },
    db: { id: "Data", en: "Data", ja: "データ" }, web: { id: "Web", en: "Web", ja: "Web" }, lock: { id: "Proteksi", en: "Protection", ja: "保護" },
  };
  const ARC = {
    h: { id: "Arsitektur sekilas", en: "Architecture at a glance", ja: "アーキテクチャ概要" },
    lead: { id: "Enam alur utama. Titik kuning menunjukkan arah data. Arahkan kursor atau ketuk kotak untuk tahu kenapa langkah itu ada, klik untuk menyematkan.", en: "The six main flows. The yellow dot shows where the data goes. Hover or tap a box to see why that step exists; click to pin it.", ja: "主な6つの流れ。黄色の点がデータの向きを示します。箱にカーソルを合わせるかタップすると、その手順がある理由を表示。クリックで固定。" },
    detail: { id: "Detail: sebelum dan sesudah PostgreSQL", en: "In detail: before and after PostgreSQL", ja: "詳細：PostgreSQL導入の前後" },
  };
  const TILES = [
    { t: { id: "Pencatatan harian", en: "Daily logging", ja: "毎日の記録" },
      s: { id: "Dari latihan di chat sampai angka di situs ini.", en: "From a drill in the chat to the numbers on this site.", ja: "チャットでの練習から、このサイトの数字まで。" },
      f: [
        { n: { id: "Kamu + tutor AI", en: "You + AI tutor", ja: "あなた＋AIチューター" }, k: "you", w: { id: "Belajar terjadi di chat. Kalau mencatat butuh lebih dari satu perintah, aku pasti melewatkannya.", en: "Learning happens in the chat. If logging took more than one command, I would skip it.", ja: "学習はチャットで行う。記録に1コマンド以上かかると、きっとサボってしまう。" } },
        { n: "catat.py", k: "run", w: { id: "Satu alat untuk semua jenis catatan (sesi, kesalahan, kata Inggris), jadi format datanya selalu sama.", en: "One tool for every kind of log (sessions, mistakes, English words), so the data format never drifts.", ja: "セッション・間違い・英単語をすべて1つのツールで記録するので、データ形式がぶれない。" } },
        { n: "PostgreSQL", k: "db", w: { id: "Tabel bisa di-query dan tidak membengkak. File markdown yang lama terus memanjang dan mudah rusak.", en: "Tables can be queried and do not bloat. The old markdown files kept growing and broke easily.", ja: "表はクエリでき、肥大化しない。以前のMarkdownファイルは長くなり続け、壊れやすかった。" } },
        { n: "publish.py", k: "run", w: { id: "Mengubah baris database jadi dua file JSON. Situs tidak pernah menyentuh database, jadi tidak ada yang bisa membobolnya dari internet.", en: "Turns database rows into two JSON files. The site never touches the database, so nobody can reach it from the internet.", ja: "DBの行を2つのJSONファイルに変換。サイトはDBに触れないので、インターネットから到達できない。" } },
        [{ n: "GitHub", k: "web", w: { id: "Riwayat setiap perubahan data tersimpan, dan push memicu deploy otomatis.", en: "Every data change has a history, and a push triggers the deploy automatically.", ja: "データ変更の履歴が残り、pushで自動デプロイが走る。" } },
         { n: "Vercel", k: "web", w: { id: "Situs statis: gratis, cepat, dan tidak ada server yang bisa diretas.", en: "A static site: free, fast, and there is no server to hack.", ja: "静的サイト：無料で速く、攻撃できるサーバーがない。" } }],
        { n: "Browser", k: "web", w: { id: "Grafik dan kartu alert dihitung di perangkatmu dari JSON yang sama, jadi tidak perlu backend.", en: "Charts and alert cards are computed on your device from the same JSON, so no backend is needed.", ja: "グラフとアラートカードは同じJSONから端末で計算するので、バックエンドが要らない。" } },
      ] },
    { t: { id: "Sync dan cadangan", en: "Sync and backup", ja: "同期とバックアップ" },
      s: { id: "Berjalan sendiri empat kali sehari dari aplikasi tray.", en: "Runs by itself four times a day from the tray app.", ja: "トレイアプリから1日4回、自動で実行。" },
      f: [
        { n: "Nihongo Sync (tray)", k: "run", w: { id: "Jadwal otomatis, jadi aku tidak perlu ingat untuk sync. Ia juga mengingatkan jam 20:00 kalau belum belajar.", en: "An automatic schedule, so I never have to remember to sync. It also reminds me at 20:00 if I have not studied.", ja: "自動スケジュールなので同期を覚えておく必要がない。20:00に未学習ならリマインドもする。" } },
        { n: { id: "Cek database", en: "Database check", ja: "DB確認" }, k: "lock", w: { id: "Kalau database mati, sync berhenti dengan pesan jelas. Lebih baik data lama daripada data kosong di situs.", en: "If the database is down, the sync stops with a clear message. Old data on the site is better than empty data.", ja: "DBが止まっていれば、明確なメッセージで同期を中断。空のデータより古いデータのほうがまし。" } },
        [{ n: { id: "JSON publik", en: "Public JSON", ja: "公開JSON" }, k: "web", w: { id: "Hanya file di daftar putih yang boleh ikut. Tidak ada password atau catatan mentah.", en: "Only allow-listed files may go along. No passwords and no raw notes.", ja: "許可リストのファイルだけを含める。パスワードや生ノートは入らない。" } },
         { n: { id: "Cadangan SQL", en: "SQL backup", ja: "SQLバックアップ" }, k: "db", w: { id: "Salinan penuh database ke repo privat, supaya PC rusak tidak berarti data hilang.", en: "A full copy of the database to a private repo, so a broken PC does not mean lost data.", ja: "DB全体を非公開リポジトリにコピー。PCが壊れてもデータは失われない。" } }],
        { n: { id: "Push jika berubah", en: "Push only if changed", ja: "変更時のみpush" }, k: "run", w: { id: "Tidak ada commit kosong dan tidak ada deploy yang sia-sia.", en: "No empty commits and no wasted deploys.", ja: "空のコミットや無駄なデプロイをしない。" } },
      ] },
    { t: { id: "Talk: tutor percakapan", en: "Talk: conversation tutor", ja: "Talk：会話チューター" },
      s: { id: "Ngobrol dengan Yuki. Semua berjalan di PC ini, suaramu tidak keluar.", en: "Chat with Yuki. Everything runs on this PC; your voice never leaves it.", ja: "ゆきと会話。すべてこのPCで動き、声は外に出ない。" },
      f: [
        { n: { id: "Mic: klik bicara", en: "Mic: click to talk", ja: "マイク：クリックで話す" }, k: "you", w: { id: "Klik untuk mulai, klik untuk kirim. Tidak deteksi otomatis, jadi jeda saat berpikir tidak memotong kalimatmu.", en: "Click to start, click to send. No auto-detect, so a pause while you think never cuts you off.", ja: "クリックで開始、もう一度で送信。自動検出しないので、考える間に途切れない。" } },
        [{ n: "kotoba-whisper (JA)", k: "ai", w: { id: "Model Whisper yang dilatih khusus untuk bahasa Jepang, jadi kanji-nya lebih tepat.", en: "A Whisper model trained for Japanese, so the kanji come out right more often.", ja: "日本語向けに学習したWhisperなので、漢字がより正確。" } },
         { n: "whisper-small (ID/EN)", k: "ai", w: { id: "Kamu memilih bahasa sebelum bicara, jadi bahasa Jepang tidak salah ditulis sebagai bahasa Inggris.", en: "You pick the language before you speak, so Japanese is never written down as English.", ja: "話す前に言語を選ぶので、日本語が英語として書き起こされない。" } }],
        { n: "Qwen3.5 9B (Ollama)", k: "ai", w: { id: "Model lokal di GPU: gratis, offline, dan percakapanmu tidak dikirim ke mana pun. Mode berpikir dimatikan supaya balasan cepat muncul.", en: "A local model on the GPU: free, offline, and your chat is sent nowhere. Thinking mode is off so replies start quickly.", ja: "GPU上のローカルモデル：無料・オフラインで、会話はどこにも送られない。思考モードはオフにして返答を速くしている。" } },
        [{ n: { id: "Koreksi", en: "Correction", ja: "添削" }, k: "run", w: { id: "Koreksi dicek terpisah dari obrolan, jadi Yuki tetap ngobrol natural seperti teman.", en: "Grammar is checked in a separate pass, so Yuki can keep chatting naturally like a friend.", ja: "文法は別の処理で確認するので、ゆきは友だちのように自然に話し続けられる。" } },
         { n: { id: "Furigana + romaji", en: "Furigana + romaji", ja: "ふりがな＋ローマ字" }, k: "run", w: { id: "Bacaan kanji diambil dari kamus (UniDic), bukan dari AI, jadi tidak mengarang.", en: "Kanji readings come from a dictionary (UniDic), not from the AI, so they are never made up.", ja: "読みはAIではなく辞書（UniDic）から取るので、でたらめにならない。" } }],
        { n: "AivisSpeech", k: "ai", w: { id: "Suara Jepang lokal yang natural. Kalau tidak jalan, otomatis pakai VOICEVOX.", en: "A natural local Japanese voice. If it is not running, VOICEVOX takes over.", ja: "自然なローカル日本語音声。起動していなければVOICEVOXに切り替える。" } },
        { n: { id: "Report → tracker", en: "Report → tracker", ja: "レポート → トラッカー" }, k: "db", w: { id: "Hanya menit dan kesalahan yang kamu pilih yang dicatat, setelah kamu menekan Kirim. Audio tidak pernah disimpan.", en: "Only the minutes and the mistakes you choose are logged, after you press Send. Audio is never saved.", ja: "送信を押した後、時間と選んだ間違いだけを記録。音声は保存しない。" } },
      ] },
    { t: { id: "Duet: shadowing dialog", en: "Duet: dialogue shadowing", ja: "Duet：対話シャドーイング" },
      s: { id: "Gaya duet TikTok: Yuki membaca satu baris, kamu menjawab.", en: "TikTok duet style: Yuki reads one line, you answer.", ja: "TikTokのデュエット風：ゆきが1行読み、あなたが答える。" },
      f: [
        { n: { id: "Pilih adegan", en: "Pick a scene", ja: "場面を選ぶ" }, k: "you", w: { id: "Adegan nyata (kafe, kerja, akhir pekan) supaya kalimatnya langsung terpakai di hidup sehari-hari.", en: "Real scenes (café, work, weekend) so the sentences are useful in daily life right away.", ja: "カフェ・仕事・週末など実際の場面なので、文がすぐ日常で使える。" } },
        { n: { id: "AI menulis naskah", en: "AI writes the script", ja: "AIが台本を書く" }, k: "ai", w: { id: "Ditulis sebagai pasangan baris (Yuki, kamu) dalam JSON, jadi peran tidak pernah tertukar. Baris tanpa kana dibuang.", en: "Written as line pairs (Yuki, you) in JSON, so the roles never swap. Lines without kana are dropped.", ja: "（ゆき、あなた）の行ペアをJSONで書かせるので、役が入れ替わらない。かなのない行は捨てる。" } },
        { n: { id: "Yuki bicara", en: "Yuki speaks", ja: "ゆきが話す" }, k: "ai", w: { id: "Mendengar dulu adalah inti shadowing: tiru ritmenya sebelum membaca.", en: "Listening first is the core of shadowing: copy the rhythm before you read.", ja: "先に聞くのがシャドーイングの基本：読む前にリズムをまねる。" } },
        { n: { id: "Kamu mengulang", en: "You repeat", ja: "あなたが繰り返す" }, k: "you", w: { id: "Bantuan teks tiga tingkat (penuh, huruf awal, tanpa teks) supaya naskah bisa dilepas pelan-pelan.", en: "Three levels of text help (full, first letters, none) so you can let go of the script step by step.", ja: "文字の補助は3段階（全文・頭文字・なし）で、少しずつ台本から離れられる。" } },
        { n: { id: "Skor per kata", en: "Score per word", ja: "単語ごとの採点" }, k: "run", w: { id: "Dibandingkan dalam hiragana, bukan kanji, jadi kanji berbeda dari pengenal suara tidak dihitung salah.", en: "Compared in hiragana, not kanji, so a different kanji from speech recognition is not counted as a mistake.", ja: "漢字ではなくひらがなで比べるので、音声認識の漢字違いは間違いにならない。" } },
        { n: { id: "Kirim → tracker", en: "Send → tracker", ja: "送信 → トラッカー" }, k: "db", w: { id: "Skor rata-rata dan menit masuk tracker, jadi latihan Duet ikut terhitung di target mingguan.", en: "The average score and minutes go to the tracker, so Duet practice counts toward the weekly target.", ja: "平均スコアと時間をトラッカーへ。Duetの練習も週目標に数える。" } },
      ] },
    { t: { id: "Shadowing video", en: "Video shadowing", ja: "動画シャドーイング" },
      s: { id: "Naskah dari video YouTube, dikunci di situs publik.", en: "Scripts from YouTube videos, locked on the public site.", ja: "YouTube動画の台本を、公開サイト上では鍵付きで。" },
      f: [
        { n: { id: "Link YouTube", en: "YouTube link", ja: "YouTubeリンク" }, k: "you", w: { id: "Materi asli dari video yang memang aku suka, jadi aku mau mengulangnya.", en: "Real material from videos I actually like, so I want to repeat them.", ja: "自分が本当に好きな動画の素材なので、繰り返したくなる。" } },
        [{ n: { id: "Subtitle", en: "Captions", ja: "字幕" }, k: "run", w: { id: "Subtitle yang sudah ada dipakai dulu karena cepat dan gratis.", en: "Existing captions are used first because they are fast and free.", ja: "既存の字幕を優先。速くて無料だから。" } },
         { n: "Whisper (GPU)", k: "ai", w: { id: "Hanya untuk video tanpa subtitle, dan hanya setelah ditanya, karena berat dan lambat.", en: "Only for videos without captions, and only after asking, because it is heavy and slow.", ja: "字幕のない動画だけ、確認してから実行。重くて遅いから。" } }],
        { n: { id: "Arti + romaji", en: "Meanings + romaji", ja: "意味＋ローマ字" }, k: "run", w: { id: "Dibuat sekali di PC, jadi halaman web tetap ringan.", en: "Made once on the PC, so the web page stays light.", ja: "PCで一度だけ作るので、Webページは軽いまま。" } },
        { n: "AES-256 encrypt", k: "lock", w: { id: "Naskah adalah teks milik orang lain, jadi hanya salinan terenkripsi yang boleh ada di situs publik.", en: "The script is other people's text, so only an encrypted copy may sit on the public site.", ja: "台本は他人の文章なので、公開サイトには暗号化したコピーだけを置く。" } },
        { n: { id: "Buka di browser", en: "Unlock in browser", ja: "ブラウザで解錠" }, k: "web", w: { id: "Passphrase dimasukkan sekali per perangkat dan dekripsi terjadi di browser. Kuncinya tidak pernah ada di repo.", en: "The passphrase is entered once per device and decryption happens in the browser. The key is never in the repo.", ja: "パスフレーズは端末ごとに1回入力し、復号はブラウザ内で行う。鍵はリポジトリにない。" } },
        { n: { id: "Menit → tracker", en: "Minutes → tracker", ja: "時間 → トラッカー" }, k: "db", w: { id: "Menit latihan dicatat dengan catat.py seperti latihan lain.", en: "Practice minutes are logged with catat.py like any other practice.", ja: "練習時間はほかの練習と同じくcatat.pyで記録。" } },
      ] },
    { t: { id: "Di mana data berhenti", en: "Where data stops", ja: "データの行き先" },
      s: { id: "Dari yang paling privat sampai yang publik. Makin ke bawah, makin sedikit yang ikut.", en: "From most private to public. The further down, the less goes along.", ja: "最も私的なものから公開まで。下に行くほど、渡るものは少ない。" },
      f: [
        { n: { id: "Suaramu", en: "Your voice", ja: "あなたの声" }, k: "lock", w: { id: "Hanya di memori PC ini sampai selesai ditranskripsi, lalu dibuang. Tidak pernah ditulis ke disk atau dikirim.", en: "Kept in this PC's memory only until it is transcribed, then dropped. Never written to disk or sent.", ja: "書き起こしが終わるまでこのPCのメモリにだけあり、その後破棄。ディスクにも外にも出ない。" } },
        { n: { id: "Database (PC ini)", en: "Database (this PC)", ja: "DB（このPC）" }, k: "db", w: { id: "Data lengkap tinggal di PC ini, dilindungi password. Kredensial ada di file lokal di luar repo.", en: "The full data lives on this PC, behind a password. Credentials sit in a local file outside the repo.", ja: "完全なデータはこのPCにあり、パスワードで保護。認証情報はリポジトリ外のローカルファイル。" } },
        { n: { id: "Cadangan (repo privat)", en: "Backup (private repo)", ja: "バックアップ（非公開）" }, k: "db", w: { id: "Hanya untuk pemulihan. Aman selama akunnya aman, jadi pakai 2FA.", en: "Only for recovery. It is as safe as the account, so 2FA is on.", ja: "復旧専用。アカウント次第の安全性なので2FAを使う。" } },
        [{ n: { id: "Angka + catatan", en: "Numbers + notes", ja: "数字＋メモ" }, k: "web", w: { id: "Publik, jadi aturan utamanya: tidak menulis hal pribadi di catatan sesi.", en: "Public, so the main rule is: never write anything private in a session note.", ja: "公開なので、セッションのメモに私的なことは書かないのが鉄則。" } },
         { n: { id: "Naskah (terkunci)", en: "Scripts (locked)", ja: "台本（鍵付き）" }, k: "lock", w: { id: "Publik tapi terenkripsi, jadi hanya pemilik passphrase yang bisa membaca.", en: "Public but encrypted, so only the passphrase owner can read them.", ja: "公開だが暗号化されており、パスフレーズを持つ人だけが読める。" } }],
      ] },
  ];
  const nodesOf = s => Array.isArray(s) ? s : [s];
  const nm = x => typeof x.n === "string" ? x.n : L(x.n);
  const tilesHTML = () => `<h2>${L(ARC.h)}</h2><p>${L(ARC.lead)}</p>
    <div class="arc-lg mono">${Object.keys(KIND).map(k => `<span><i class="k-${k}"></i>${L(KIND[k])}</span>`).join("")}</div>
    <div class="arc-grid" id="arcGrid">${TILES.map((t, ti) => `<article class="arc-t" style="--n:${t.f.length};--o:${ti}"><h3>${L(t.t)}</h3><div class="arc-f">${t.f.map((s, si) =>
      (si ? `<span class="arc-a" style="--i:${si - 1}" aria-hidden="true"><i></i></span>` : "") +
      `<div class="arc-s">${nodesOf(s).map((x, j) => `<button type="button" class="arc-n k-${x.k}" style="--i:${si}" data-k="${ti}.${si}.${j}" aria-pressed="false">${esc(nm(x))}</button>`).join("")}</div>`).join("")}</div>
      <p class="arc-why" aria-live="polite">${L(t.s)}</p></article>`).join("")}</div>
    <h2>${L(ARC.detail)}</h2>`;

  const st = { view: "after", step: -1, sel: null };
  const badge = k => `<span class="sys-bd ${k}">${L(UI.badge[k])}</span>`;
  const shown = (id) => st.view === "after" || N[id].st !== "new";
  const nodeKind = id => st.view === "before" ? "old" : N[id].st;

  const page = $("#page");
  page.innerHTML = `
    <h1>${L(UI.title)}</h1>${tilesHTML()}<p class="lead">${L(UI.lead)}</p>
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

  // tiles: hover/focus shows the why, click pins it; leaving the tile goes back to the pinned box or the summary
  const why = b => { const [ti, si, j] = b.dataset.k.split(".").map(Number); return nodesOf(TILES[ti].f[si])[j]; };
  const show = (art, b) => {
    art.querySelectorAll(".arc-n").forEach(n => n.classList.toggle("cur", n === b));
    const x = b && why(b), ti = +art.style.getPropertyValue("--o");
    art.querySelector(".arc-why").innerHTML = x ? `<b>${esc(nm(x))}</b> ${L(x.w)}` : L(TILES[ti].s);
  };
  document.querySelectorAll(".arc-t").forEach(art => {
    const pinned = () => art.querySelector('.arc-n[aria-pressed="true"]');
    art.addEventListener("mouseover", e => { const b = e.target.closest(".arc-n"); if (b) show(art, b); });
    art.addEventListener("focusin", e => { const b = e.target.closest(".arc-n"); if (b) show(art, b); });
    art.addEventListener("mouseleave", () => show(art, pinned()));
    art.addEventListener("click", e => {
      const b = e.target.closest(".arc-n"); if (!b) return;
      const on = b.getAttribute("aria-pressed") !== "true";
      art.querySelectorAll(".arc-n").forEach(n => n.setAttribute("aria-pressed", String(on && n === b)));
      show(art, on ? b : null);
    });
  });
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawEdges, 80); });
  document.fonts?.ready.then(drawEdges);
  document.title = `${L(UI.title)} · Arsenius`;
  document.querySelector('[data-nav="system"]')?.setAttribute("aria-current", "page");
  render();
})();
