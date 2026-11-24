// Nihongo Sync: tray app that runs scripts/publish.py at fixed times (00:00, 12:00, 18:00, 21:00).
// Shadowing menu: opens the page from a small web server that listens on 127.0.0.1 only, and collects YouTube scripts with scripts/shadow.py.
// Closing the window hides it to the tray; only Quit stops it. Between slots it waits on one timer.
// Built by scripts/build-app.ps1 with the C# 5 compiler that ships with Windows (.NET Framework 4).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Windows.Forms;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        bool tray = args.Contains("--tray"), first;
        var mutex = new Mutex(true, @"Local\NihongoSync", out first);
        var show = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\NihongoSyncShow");
        if (!first) { if (!tray) show.Set(); return; }  // already running: ask it to show its window
        Application.EnableVisualStyles();
        var app = new SyncApp(show);
        if (!tray) app.ShowWindow();
        Application.Run();
        GC.KeepAlive(mutex);
    }
}

class SyncApp
{
    static readonly TimeSpan[] Slots = { new TimeSpan(0, 0, 0), new TimeSpan(12, 0, 0), new TimeSpan(18, 0, 0), new TimeSpan(21, 0, 0) };
    static readonly TimeSpan Reminder = new TimeSpan(20, 0, 0);  // "have you studied today?" balloon, if fewer than 4 sessions are logged
    const int MaxRetries = 2, RetryMinutes = 5;
    const string Site = "https://arsenius-nihongo.vercel.app";
    const int ShadowPort = 8765;  // local only: the server below binds 127.0.0.1
    static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NihongoSync");
    static readonly string Log = Path.Combine(Dir, "sync.log");
    static readonly string State = Path.Combine(Dir, "last.txt");  // time of the last successful sync

    static readonly Color Bg = Color.FromArgb(23, 24, 28), Ink = Color.FromArgb(236, 234, 227), Yellow = Color.FromArgb(242, 194, 0),
        Muted = Color.FromArgb(150, 147, 139), Line = Color.FromArgb(52, 54, 61), Lime = Color.FromArgb(182, 255, 0), Coral = Color.FromArgb(255, 90, 95);
    readonly Form form = new Form();
    readonly Label keys = new Label(), vals = new Label(), pill = new Label();  // keys/vals: two aligned columns of "name  value" rows
    readonly Button syncBtn, dbBtn;
    readonly NotifyIcon tray = new NotifyIcon();
    readonly System.Windows.Forms.Timer slotTimer = new System.Windows.Forms.Timer();
    readonly System.Windows.Forms.Timer reminderTimer = new System.Windows.Forms.Timer(), retryTimer = new System.Windows.Forms.Timer();
    Process proc, server;  // server = the local web server for the Shadowing page
    bool shadowBusy;
    string result = "-";
    bool quitting;
    int retries;

    public SyncApp(EventWaitHandle show)
    {
        Directory.CreateDirectory(Dir);
        var icon = MakeIcon(Yellow);

        form.Text = "Nihongo Sync"; form.Icon = icon; form.ClientSize = new Size(460, 520);
        form.FormBorderStyle = FormBorderStyle.FixedSingle; form.MaximizeBox = false; form.StartPosition = FormStartPosition.CenterScreen;
        form.BackColor = Bg; form.ForeColor = Ink; form.Font = new Font("Segoe UI", 9.5f);
        form.Controls.Add(new Label { Text = "Nihongo Sync", ForeColor = Yellow, Font = new Font("Segoe UI", 16, FontStyle.Bold), Bounds = new Rectangle(22, 16, 260, 34) });
        pill.AutoSize = true; pill.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold); pill.ForeColor = Color.Black; pill.Padding = new Padding(8, 3, 8, 3); pill.Top = 24;
        form.Controls.Add(pill);
        Rule(62);
        keys.Bounds = new Rectangle(24, 74, 110, 232); keys.ForeColor = Muted;
        vals.Bounds = new Rectangle(140, 74, 300, 232);
        form.Controls.Add(keys); form.Controls.Add(vals);
        Rule(312);
        Caption("SYNC", 324);
        syncBtn = AddButton("Sync sekarang", 0, delegate { StartSync(); }, 344);
        syncBtn.BackColor = Yellow; syncBtn.ForeColor = Color.Black; syncBtn.FlatAppearance.BorderColor = Yellow; syncBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(255, 214, 50);
        syncBtn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
        AddButton("Buka web", 1, delegate { Open(Site); }, 344);
        AddButton("Lihat log", 2, delegate { OpenLog(); }, 344);
        Caption("SHADOWING", 390);
        AddButton("Buka Shadowing", 0, delegate { OpenShadowing(); }, 410);
        AddButton("Tambah video", 1, delegate { AddVideo(); }, 410);
        AddButton("Tempel progres", 2, delegate { PasteShadow(); }, 410);
        Caption("LAINNYA", 456);
        dbBtn = AddButton("Start database", 0, delegate { StartDb(); }, 476);
        AddButton("Salin kunci web", 1, delegate { CopyKey(); }, 476);
        form.FormClosing += (s, e) => { if (!quitting) { e.Cancel = true; form.Hide(); } };  // X = hide to tray
        var handle = form.Handle;  // create the handle now so BeginInvoke works before the window is first shown

        var menu = new ContextMenuStrip();
        menu.Items.Add("Buka", null, delegate { ShowWindow(); });
        menu.Items.Add("Sync sekarang", null, delegate { StartSync(); });
        menu.Items.Add("Buka web", null, delegate { Open(Site); });
        menu.Items.Add("Start database", null, delegate { StartDb(); });
        menu.Items.Add("Buka Shadowing", null, delegate { OpenShadowing(); });
        menu.Items.Add("Tambah video Shadowing...", null, delegate { AddVideo(); });
        menu.Items.Add("Salin kunci Shadowing (web)", null, delegate { CopyKey(); });
        menu.Items.Add("Tempel progres shadowing", null, delegate { PasteShadow(); });
        menu.Items.Add("Tes pengingat", null, delegate { Remind(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, delegate { quitting = true; StopServer(); tray.Visible = false; form.Close(); Application.Exit(); });
        tray.Icon = icon; tray.ContextMenuStrip = menu; tray.Visible = true;
        tray.MouseDoubleClick += delegate { ShowWindow(); };

        // a second launch (Start menu) signals this; the wait costs nothing until then
        ThreadPool.RegisterWaitForSingleObject(show, delegate { form.BeginInvoke((Action)ShowWindow); }, null, -1, false);

        slotTimer.Tick += delegate { slotTimer.Stop(); retries = 0; StartSync(); ArmTimer(); };
        ArmTimer();

        reminderTimer.Tick += delegate { reminderTimer.Stop(); Remind(); ArmReminder(); };
        ArmReminder();

        retryTimer.Interval = RetryMinutes * 60000;
        retryTimer.Tick += delegate { retryTimer.Stop(); StartSync(); };

        // PC was off at a slot: catch up once, a minute after start (the network needs time after boot)
        var catchUp = new System.Windows.Forms.Timer { Interval = 60000 };
        catchUp.Tick += delegate { catchUp.Stop(); if (LastSync() < PrevSlot()) StartSync(); };
        catchUp.Start();
        CheckDb();
    }

    // three equal columns: col 0, 1, 2
    Button AddButton(string text, int col, EventHandler click, int y)
    {
        var b = new Button { Text = text, Bounds = new Rectangle(24 + col * 140, y, 132, 34), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(36, 37, 43), Cursor = Cursors.Hand };
        b.FlatAppearance.BorderColor = Color.FromArgb(78, 80, 88); b.FlatAppearance.MouseOverBackColor = Color.FromArgb(52, 54, 61);
        b.Click += click; form.Controls.Add(b); return b;
    }

    void Caption(string text, int y) { form.Controls.Add(new Label { Text = text, ForeColor = Muted, Font = new Font("Segoe UI", 8, FontStyle.Bold), Bounds = new Rectangle(24, y, 200, 16) }); }
    void Rule(int y) { form.Controls.Add(new Panel { BackColor = Line, Bounds = new Rectangle(24, y, 412, 1) }); }

    // drawn at runtime: the tray needs a plain bitmap icon, and the colour shows the status
    static Icon MakeIcon(Color bg)
    {
        using (var b = new Bitmap(32, 32))
        {
            using (var g = Graphics.FromImage(b))
            using (var f = new Font("Yu Gothic UI", 21, FontStyle.Bold, GraphicsUnit.Pixel))
            using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
            {
                g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
                g.Clear(bg);
                g.DrawString("日", f, Brushes.Black, new RectangleF(0, 1, 32, 32), sf);
            }
            return Icon.FromHandle(b.GetHicon());
        }
    }
    static readonly Icon IconOk = MakeIcon(Yellow), IconBusy = MakeIcon(Color.FromArgb(150, 150, 150)), IconFail = MakeIcon(Color.FromArgb(255, 90, 95));
    bool failed, dbOk = true;
    string dbInfo = "";  // lines from "db.py status": server version, row counts, backup and web-data times

    // newest Anki profile folder and when its collection last changed (Anki writes it while you review)
    static string AnkiLine()
    {
        try
        {
            var files = Directory.GetDirectories(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Anki2"))
                .Select(d => new FileInfo(Path.Combine(d, "collection.anki2"))).Where(f => f.Exists).OrderByDescending(f => f.LastWriteTime).ToArray();
            return files.Length == 0 ? "Anki: koleksi tidak ditemukan" : "Anki: " + files[0].Directory.Name + ", terakhir " + files[0].LastWriteTime.ToString("dd MMM HH:mm");
        }
        catch { return "Anki: tidak bisa dibaca"; }
    }

    public void ShowWindow() { form.Show(); form.WindowState = FormWindowState.Normal; form.Activate(); }

    static void Open(string target) { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }

    // ---- Shadowing: nothing here is reachable from the internet. The server listens on 127.0.0.1 only and stops when the tray quits.
    static bool PortOpen(int port)
    {
        try
        {
            using (var c = new System.Net.Sockets.TcpClient())
            {
                var r = c.BeginConnect("127.0.0.1", port, null, null);
                return r.AsyncWaitHandle.WaitOne(300) && c.Connected;
            }
        }
        catch { return false; }
    }

    void OpenShadowing()
    {
        if (!PortOpen(ShadowPort))
        {
            try
            {
                server = Process.Start(new ProcessStartInfo(Config.Python, "-I -m http.server " + ShadowPort + " --bind 127.0.0.1 --directory \"" + Config.Root + "\"")
                    { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Config.Root });
            }
            catch (Exception e) { tray.ShowBalloonTip(5000, "Nihongo Sync", "Server Shadowing tidak bisa dimulai: " + e.Message, ToolTipIcon.Warning); return; }
            for (int i = 0; i < 25 && !PortOpen(ShadowPort); i++) Thread.Sleep(150);
        }
        Open("http://localhost:" + ShadowPort + "/shadow.html");
    }

    // the passphrase that opens the encrypted scripts on the web: type or paste it once per browser (it is never in the repo)
    void CopyKey()
    {
        var key = Path.Combine(Dir, "shadow.key");
        if (!File.Exists(key)) { tray.ShowBalloonTip(5000, "Nihongo Sync", "Kunci belum dibuat. Tambah satu video dulu.", ToolTipIcon.Info); return; }
        try { Clipboard.SetText(File.ReadAllText(key).Trim()); tray.ShowBalloonTip(6000, "Nihongo Sync", "Kunci disalin. Tempel di halaman Shadowing di web (sekali per perangkat).", ToolTipIcon.Info); }
        catch (Exception e) { tray.ShowBalloonTip(5000, "Nihongo Sync", "Tidak bisa menyalin: " + e.Message, ToolTipIcon.Warning); }
    }

    // "nihongo-shadow <id> <menit> <baris>/<total>", copied on the Shadowing page (web or local). Only the matched parts reach the command line.
    static readonly Regex ShadowLogRe = new Regex(@"^nihongo-shadow ([\w-]{11}) ([1-9]\d{0,2}) (\d{1,4}/\d{1,4})$");

    void PasteShadow()
    {
        if (!dbOk) { tray.ShowBalloonTip(5000, "Nihongo Sync", "Database mati. Tekan Start database dulu.", ToolTipIcon.Warning); return; }
        string text = "";
        try { text = Clipboard.GetText().Trim(); } catch { }
        var m = ShadowLogRe.Match(text);
        if (!m.Success) { tray.ShowBalloonTip(6000, "Nihongo Sync", "Belum ada progres shadowing di clipboard. Di halaman Shadowing tekan \"Salin progres untuk Nihongo Sync\" dulu.", ToolTipIcon.Info); return; }
        string id = m.Groups[1].Value, min = m.Groups[2].Value, lines = m.Groups[3].Value;
        if (MessageBox.Show("Catat shadowing hari ini?\n\nVideo: " + id + "\nWaktu aktif: " + min + " menit\nSampai baris: " + lines, "Nihongo Sync",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        var psi = new ProcessStartInfo(Config.Python, "-X utf8 -I \"" + Path.Combine(Config.Root, "scripts", "catat.py") + "\" shadow " + id + " " + min + " " + lines)
        {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Config.Root,
            RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
        };
        string output; int code;
        try
        {
            using (var p = Process.Start(psi))
            {
                var err = p.StandardError.ReadToEndAsync();
                output = (p.StandardOutput.ReadToEnd() + err.Result).Trim();
                p.WaitForExit(); code = p.ExitCode;
            }
        }
        catch (Exception e) { output = e.Message; code = 1; }
        var first = output.Split('\n').Select(l => l.Trim()).FirstOrDefault(l => l.Length > 0) ?? "";
        tray.ShowBalloonTip(7000, "Nihongo Sync", code == 0 ? first + "\nMuncul di web setelah sync berikutnya." : "Gagal mencatat: " + first,
            code == 0 ? ToolTipIcon.Info : ToolTipIcon.Warning);
    }

    void StopServer()
    {
        try { if (server != null && !server.HasExited) server.Kill(); } catch { }
    }

    // only an 11-character video id ever reaches the command line, never the raw text that was typed
    static readonly Regex VideoRe = new Regex(@"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})|^([\w-]{11})$");

    bool AskVideo(out string id, out string lang)
    {
        string vid = null, lg = null;
        using (var f = new Form
        {
            Text = "Tambah video Shadowing", ClientSize = new Size(440, 130), FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, MinimizeBox = false,
            StartPosition = FormStartPosition.CenterScreen, BackColor = Bg, ForeColor = Ink, Icon = form.Icon, Font = form.Font, TopMost = true,
        })
        {
            var label = new Label { Text = "Link YouTube", Bounds = new Rectangle(15, 12, 400, 22) };
            var box = new TextBox { Bounds = new Rectangle(15, 38, 410, 26) };
            var pick = new ComboBox { Bounds = new Rectangle(15, 82, 150, 26), DropDownStyle = ComboBoxStyle.DropDownList };
            pick.Items.AddRange(new object[] { "ja (Jepang)", "en (Inggris)" }); pick.SelectedIndex = 0;
            var ok = new Button { Text = "Ambil naskah", Bounds = new Rectangle(255, 78, 170, 34), DialogResult = DialogResult.OK, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(42, 43, 49) };
            ok.Click += delegate
            {
                var m = VideoRe.Match(box.Text.Trim());
                if (!m.Success) { MessageBox.Show(f, "Link YouTube tidak dikenali.", "Nihongo Sync", MessageBoxButtons.OK, MessageBoxIcon.Warning); f.DialogResult = DialogResult.None; return; }
                vid = m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value;
                lg = pick.SelectedIndex == 0 ? "ja" : "en";
            };
            f.Controls.AddRange(new Control[] { label, box, pick, ok }); f.AcceptButton = ok;
            if (f.ShowDialog() != DialogResult.OK) { id = lang = null; return false; }
        }
        id = vid; lang = lg; return true;
    }

    void AddVideo()
    {
        if (shadowBusy) { tray.ShowBalloonTip(4000, "Nihongo Sync", "Masih ada proses Shadowing yang jalan.", ToolTipIcon.Info); return; }
        if (!dbOk) { tray.ShowBalloonTip(5000, "Nihongo Sync", "Database mati. Tekan Start database dulu.", ToolTipIcon.Warning); return; }
        string id, lang;
        if (AskVideo(out id, out lang)) RunShadow(id, lang, false);
    }

    // exit code 3 = no captions: Whisper (GPU) runs only after you answer Ya
    void RunShadow(string id, string lang, bool whisper)
    {
        shadowBusy = true;
        tray.ShowBalloonTip(3000, "Nihongo Sync", whisper ? "Whisper jalan di GPU, bisa beberapa menit..." : "Mengambil naskah...", ToolTipIcon.Info);
        var psi = new ProcessStartInfo(Config.Python, "-X utf8 -I \"" + Config.Shadow + "\" " + id + " --lang " + lang + (whisper ? " --whisper" : ""))
        {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Config.Root,
            RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
        };
        ThreadPool.QueueUserWorkItem(delegate
        {
            string output; int code;
            try
            {
                using (var p = Process.Start(psi))
                {
                    var err = p.StandardError.ReadToEndAsync();
                    output = (p.StandardOutput.ReadToEnd() + err.Result).Trim();
                    p.WaitForExit(); code = p.ExitCode;
                }
            }
            catch (Exception e) { output = e.Message; code = 1; }
            form.BeginInvoke((Action)(() => ShadowDone(id, lang, whisper, code, output)));
        });
    }

    void ShadowDone(string id, string lang, bool whisper, int code, string output)
    {
        shadowBusy = false;
        var first = output.Split('\n').Select(l => l.Trim()).FirstOrDefault(l => l.Length > 0) ?? "";
        if (code == 0)
        {
            tray.ShowBalloonTip(6000, "Nihongo Sync", (first.Length > 80 ? first.Substring(0, 80) + "…" : first) + "\nMengirim ke web...", ToolTipIcon.Info);
            StartSync();  // publish.py also pushes the encrypted scripts, so the web gets the new video right away
            return;
        }
        if (code == 3 && !whisper)
        {
            var ask = MessageBox.Show(new Form { TopMost = true }, "Video ini tidak punya caption (" + lang + ").\n\nPakai Whisper di GPU? Butuh beberapa menit dan memakai GPU-mu.",
                "Nihongo Sync", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (ask == DialogResult.Yes) RunShadow(id, lang, true);
            return;
        }
        tray.ShowBalloonTip(7000, "Nihongo Sync", "Shadowing gagal: " + Reason(output), ToolTipIcon.Warning);
    }

    // shown inside the app: relying on an external editor (the Store Notepad restores its own session and can fail on launch) was fragile
    void OpenLog()
    {
        string text;
        try { text = File.Exists(Log) ? ReadTail(Log, 40000) : "(belum ada log: sync pertama belum jalan)"; }
        catch (Exception e) { text = "Log tidak bisa dibaca: " + e.Message; }
        var box = new TextBox
        {
            Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, BorderStyle = BorderStyle.None,
            BackColor = Color.FromArgb(14, 14, 16), ForeColor = Ink, Font = new Font("Consolas", 10), Text = text.Replace("\r\n", "\n").Replace("\n", "\r\n"),
        };
        var f = new Form { Text = "Nihongo Sync · log", Icon = form.Icon, ClientSize = new Size(640, 420), StartPosition = FormStartPosition.CenterScreen, BackColor = Bg, KeyPreview = true };
        f.KeyDown += (s, e) => { if (e.KeyCode == Keys.Escape) f.Close(); };
        f.Controls.Add(box);
        f.Shown += delegate { box.SelectionStart = box.TextLength; box.ScrollToCaret(); };  // newest entries are at the end
        f.Show();
    }

    static string ReadTail(string path, int maxBytes)
    {
        using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
        {
            var cut = fs.Length > maxBytes;
            fs.Seek(Math.Max(0, fs.Length - maxBytes), SeekOrigin.Begin);
            var s = new StreamReader(fs, Encoding.UTF8).ReadToEnd();
            return cut ? s.Substring(s.IndexOf('\n') + 1) : s;  // drop the half line at the cut
        }
    }

    // keep the log from growing forever
    static void TrimLog()
    {
        try { if (File.Exists(Log) && new FileInfo(Log).Length > 200000) File.WriteAllText(Log, ReadTail(Log, 100000), Encoding.UTF8); } catch { }
    }

    static DateTime[] AllSlots()
    {
        return new[] { -1, 0, 1 }.SelectMany(d => Slots.Select(s => DateTime.Today.AddDays(d) + s)).ToArray();
    }
    static DateTime NextSlot() { return AllSlots().First(t => t > DateTime.Now); }
    static DateTime PrevSlot() { return AllSlots().Last(t => t <= DateTime.Now); }
    static DateTime LastSync()
    {
        DateTime t;
        return File.Exists(State) && DateTime.TryParse(File.ReadAllText(State).Trim(), out t) ? t : DateTime.MinValue;
    }

    void ArmTimer()
    {
        slotTimer.Interval = (int)Math.Max(1000, (NextSlot() - DateTime.Now).TotalMilliseconds);
        slotTimer.Start();
        Refresh();
    }

    void ArmReminder()
    {
        var next = DateTime.Today + Reminder;
        if (next <= DateTime.Now) next = next.AddDays(1);
        reminderTimer.Interval = (int)Math.Max(1000, (next - DateTime.Now).TotalMilliseconds);
        reminderTimer.Start();
    }

    // runs scripts/db.py <command>; returns the exit code and what it printed (stdout + stderr)
    static int RunDb(string command, out string output)
    {
        var psi = new ProcessStartInfo(Config.Python, "-I \"" + Config.Db + "\" " + command)
        {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Config.Root,
            RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
        };
        using (var p = Process.Start(psi))
        {
            var err = p.StandardError.ReadToEndAsync();
            output = (p.StandardOutput.ReadToEnd() + err.Result).Trim();
            p.WaitForExit();
            return p.ExitCode;
        }
    }

    // is PostgreSQL answering? checked at start and after every sync; the answer decides the status line and the Start database button
    void CheckDb()
    {
        ThreadPool.QueueUserWorkItem(delegate
        {
            string o, st = ""; bool ok;
            try { ok = RunDb("ping", out o) == 0; if (ok && RunDb("status", out o) == 0) st = o.Replace("\r\n", "\n"); } catch { ok = false; }
            form.BeginInvoke((Action)(() => { dbOk = ok; dbInfo = st; dbBtn.Enabled = !ok; Refresh(); }));
        });
    }

    // the service needs admin rights: Windows asks (UAC) only when this button is pressed
    void StartDb()
    {
        var svc = ServiceController.GetServices().FirstOrDefault(s => s.ServiceName.StartsWith("postgresql", StringComparison.OrdinalIgnoreCase));
        if (svc == null) { tray.ShowBalloonTip(5000, "Nihongo Sync", "Service PostgreSQL tidak ditemukan.", ToolTipIcon.Warning); return; }
        try { Process.Start(new ProcessStartInfo("net", "start \"" + svc.ServiceName + "\"") { Verb = "runas", UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden }).WaitForExit(); }
        catch (Exception) { return; }  // UAC declined
        CheckDb();
    }

    // counts today's sessions in the database (day starts at 4am, like Anki) so it also sees sessions logged after the last sync
    void Remind()
    {
        int n;
        try
        {
            string o;
            if (RunDb("today", out o) != 0 || !int.TryParse(o, out n)) return;
        }
        catch { return; }  // database not readable: stay quiet rather than nag with wrong numbers
        if (n >= 4) return;
        tray.ShowBalloonTip(10000, "Nihongo Sync", n == 0 ? "Belum ada sesi belajar tercatat hari ini." : "Baru " + n + " sesi tercatat hari ini. Lanjut yuk!", ToolTipIcon.Info);
    }

    // publish.py exits 0 even when the push or backup failed, so look for the word in its output too
    static bool Failed(int exitCode, string output) { return exitCode != 0 || output.IndexOf("gagal", StringComparison.OrdinalIgnoreCase) >= 0; }

    static string Reason(string output)
    {
        var line = output.Split('\n').Select(l => l.Trim()).LastOrDefault(l => l.Length > 0) ?? "tidak ada keterangan";
        return line.Length > 70 ? line.Substring(0, 70) + "…" : line;
    }

    void Refresh()
    {
        var last = LastSync();
        var rows = new List<string[]> {
            new[] { "Sync terakhir", last == DateTime.MinValue ? "belum pernah" : last.ToString("ddd dd MMM, HH:mm") },
            new[] { "Hasil", proc != null ? "sedang sync..." : result },
            new[] { "Berikutnya", NextSlot().ToString("ddd HH:mm") },
            new[] { "Jadwal", string.Join(" · ", Slots.Select(s => s.ToString(@"hh\:mm"))) + " · ingat " + Reminder.ToString(@"hh\:mm") },
            new[] { "", "" },
            new[] { "Database", dbOk ? "aktif" : "MATI — tekan Start database" },
        };
        foreach (var l in (dbInfo + "\n" + AnkiLine()).Split('\n'))  // "Server: PostgreSQL 19.0" → two columns
        {
            var i = l.IndexOf(": "); if (i > 0) rows.Add(new[] { l.Substring(0, i), l.Substring(i + 2) });
        }
        keys.Text = string.Join("\n", rows.Select(r => r[0]));
        vals.Text = string.Join("\n", rows.Select(r => r[1].Length > 44 ? r[1].Substring(0, 43) + "…" : r[1]));  // one line each, so the columns stay aligned
        pill.Text = proc != null ? "● SYNC..." : !dbOk ? "● DB MATI" : failed ? "● GAGAL" : "● AKTIF";
        pill.BackColor = proc != null ? Muted : failed || !dbOk ? Coral : Lime;
        pill.Left = form.ClientSize.Width - 24 - pill.PreferredSize.Width;
        // hover text (max 63 chars): status, last update, next run
        var status = proc != null ? "sedang sync" : !dbOk ? "DB MATI" : failed ? "GAGAL" : "aktif";
        var lastShort = last == DateTime.MinValue ? "-" : last.Date == DateTime.Today ? last.ToString("HH:mm") : last.ToString("dd MMM HH:mm");
        var tip = string.Format("Nihongo Sync: {0}\nUpdate: {1}\nBerikutnya: {2:HH:mm}", status, lastShort, NextSlot());
        tray.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;
        tray.Icon = proc != null ? IconBusy : failed || !dbOk ? IconFail : IconOk;
    }

    void StartSync()
    {
        if (proc != null) return;
        var psi = new ProcessStartInfo(Config.Python, "-I \"" + Config.Publish + "\"")
        {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Config.Root,
            RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
        };
        try { proc = Process.Start(psi); }
        catch (Exception e) { Finish(false, "Python tidak bisa dijalankan: " + e.Message); return; }
        syncBtn.Enabled = false; Refresh();
        var p = proc;
        ThreadPool.QueueUserWorkItem(delegate
        {
            var err = p.StandardError.ReadToEndAsync();
            var output = (p.StandardOutput.ReadToEnd() + err.Result).Trim();
            p.WaitForExit();
            form.BeginInvoke((Action)(() => Finish(!Failed(p.ExitCode, output), output)));
        });
    }

    void Finish(bool ok, string output)
    {
        TrimLog();
        File.AppendAllText(Log, "--- " + DateTime.Now.ToString("yyyy-MM-dd HH:mm") + "\r\n" + output + "\r\n", Encoding.UTF8);
        failed = !ok;
        if (ok) { File.WriteAllText(State, DateTime.Now.ToString("o")); result = Reason(output); retries = 0; }
        else
        {
            var retry = retries < MaxRetries;
            result = "GAGAL: " + Reason(output) + (retry ? " (coba lagi " + RetryMinutes + " mnt)" : "");
            tray.ShowBalloonTip(5000, "Nihongo Sync", "Sync gagal: " + Reason(output), ToolTipIcon.Warning);
            if (retry) { retries++; retryTimer.Start(); }
        }
        proc = null; syncBtn.Enabled = true; Refresh();
        CheckDb();
    }
}
