// Nihongo Sync: tray app that runs scripts/publish.py at fixed times (00:00, 12:00, 18:00, 21:00).
// Closing the window hides it to the tray; only Quit stops it. Between slots it waits on one timer.
// Built by scripts/build-app.ps1 with the C# 5 compiler that ships with Windows (.NET Framework 4).
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
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
    static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NihongoSync");
    static readonly string Log = Path.Combine(Dir, "sync.log");
    static readonly string State = Path.Combine(Dir, "last.txt");  // time of the last successful sync

    static readonly Color Bg = Color.FromArgb(23, 24, 28), Ink = Color.FromArgb(236, 234, 227), Yellow = Color.FromArgb(242, 194, 0);
    readonly Form form = new Form();
    readonly Label info = new Label();
    readonly Button syncBtn, dbBtn;
    readonly NotifyIcon tray = new NotifyIcon();
    readonly System.Windows.Forms.Timer slotTimer = new System.Windows.Forms.Timer();
    readonly System.Windows.Forms.Timer reminderTimer = new System.Windows.Forms.Timer(), retryTimer = new System.Windows.Forms.Timer();
    Process proc;
    string result = "-";
    bool quitting;
    int retries;

    public SyncApp(EventWaitHandle show)
    {
        Directory.CreateDirectory(Dir);
        var icon = MakeIcon(Yellow);

        form.Text = "Nihongo Sync"; form.Icon = icon; form.ClientSize = new Size(420, 395);
        form.FormBorderStyle = FormBorderStyle.FixedSingle; form.MaximizeBox = false; form.StartPosition = FormStartPosition.CenterScreen;
        form.BackColor = Bg; form.ForeColor = Ink; form.Font = new Font("Segoe UI", 10);
        var title = new Label { Text = "Nihongo Sync", ForeColor = Yellow, Font = new Font("Segoe UI", 16, FontStyle.Bold), Bounds = new Rectangle(20, 15, 380, 36) };
        info.Bounds = new Rectangle(20, 58, 380, 220);
        form.Controls.Add(title); form.Controls.Add(info);
        syncBtn = AddButton("Sync sekarang", 20, delegate { StartSync(); });
        AddButton("Buka web", 150, delegate { Open(Site); });
        AddButton("Lihat log", 280, delegate { OpenLog(); });
        dbBtn = AddButton("Start database", 20, delegate { StartDb(); }, 340);
        form.FormClosing += (s, e) => { if (!quitting) { e.Cancel = true; form.Hide(); } };  // X = hide to tray
        var handle = form.Handle;  // create the handle now so BeginInvoke works before the window is first shown

        var menu = new ContextMenuStrip();
        menu.Items.Add("Buka", null, delegate { ShowWindow(); });
        menu.Items.Add("Sync sekarang", null, delegate { StartSync(); });
        menu.Items.Add("Buka web", null, delegate { Open(Site); });
        menu.Items.Add("Start database", null, delegate { StartDb(); });
        menu.Items.Add("Tes pengingat", null, delegate { Remind(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, delegate { quitting = true; tray.Visible = false; form.Close(); Application.Exit(); });
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

    Button AddButton(string text, int x, EventHandler click, int y = 295)
    {
        var b = new Button { Text = text, Bounds = new Rectangle(x, y, 120, 34), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(42, 43, 49) };
        b.Click += click; form.Controls.Add(b); return b;
    }

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
        info.Text = string.Format("Jadwal: {0} · pengingat {4:hh\\:mm}\n\nSync terakhir: {1}\nHasil: {2}\nBerikutnya: {3:ddd HH:mm}\nDatabase: {5}{6}\n{7}",
            string.Join(" · ", Slots.Select(s => s.ToString(@"hh\:mm"))),
            last == DateTime.MinValue ? "belum pernah" : last.ToString("ddd dd MMM, HH:mm"),
            proc != null ? "sedang sync..." : result, NextSlot(), Reminder, dbOk ? "aktif" : "MATI (tekan Start database)", dbInfo.Length > 0 ? "\n" + dbInfo : "", AnkiLine());
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
