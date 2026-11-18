// Nihongo Sync: tray app that runs scripts/publish.py at fixed times (12:00, 18:00, 21:00).
// Closing the window hides it to the tray; only Quit stops it. Between slots it waits on one timer.
// Built by scripts/build-app.ps1 with the C# 5 compiler that ships with Windows (.NET Framework 4).
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
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
    static readonly TimeSpan[] Slots = { new TimeSpan(12, 0, 0), new TimeSpan(18, 0, 0), new TimeSpan(21, 0, 0) };
    const string Site = "https://arsenius-nihongo.vercel.app";
    static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NihongoSync");
    static readonly string Log = Path.Combine(Dir, "sync.log");
    static readonly string State = Path.Combine(Dir, "last.txt");  // time of the last successful sync

    static readonly Color Bg = Color.FromArgb(23, 24, 28), Ink = Color.FromArgb(236, 234, 227), Yellow = Color.FromArgb(242, 194, 0);
    readonly Form form = new Form();
    readonly Label info = new Label();
    readonly Button syncBtn;
    readonly NotifyIcon tray = new NotifyIcon();
    readonly System.Windows.Forms.Timer slotTimer = new System.Windows.Forms.Timer();
    Process proc;
    string result = "-";
    bool quitting;

    public SyncApp(EventWaitHandle show)
    {
        Directory.CreateDirectory(Dir);
        var icon = MakeIcon(Yellow);

        form.Text = "Nihongo Sync"; form.Icon = icon; form.ClientSize = new Size(420, 250);
        form.FormBorderStyle = FormBorderStyle.FixedSingle; form.MaximizeBox = false; form.StartPosition = FormStartPosition.CenterScreen;
        form.BackColor = Bg; form.ForeColor = Ink; form.Font = new Font("Segoe UI", 10);
        var title = new Label { Text = "Nihongo Sync", ForeColor = Yellow, Font = new Font("Segoe UI", 16, FontStyle.Bold), Bounds = new Rectangle(20, 15, 380, 36) };
        info.Bounds = new Rectangle(20, 58, 380, 120);
        form.Controls.Add(title); form.Controls.Add(info);
        syncBtn = AddButton("Sync sekarang", 20, delegate { StartSync(); });
        AddButton("Buka web", 150, delegate { Open(Site); });
        AddButton("Lihat log", 280, delegate { OpenLog(); });
        form.FormClosing += (s, e) => { if (!quitting) { e.Cancel = true; form.Hide(); } };  // X = hide to tray
        var handle = form.Handle;  // create the handle now so BeginInvoke works before the window is first shown

        var menu = new ContextMenuStrip();
        menu.Items.Add("Buka", null, delegate { ShowWindow(); });
        menu.Items.Add("Sync sekarang", null, delegate { StartSync(); });
        menu.Items.Add("Buka web", null, delegate { Open(Site); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, delegate { quitting = true; tray.Visible = false; form.Close(); Application.Exit(); });
        tray.Icon = icon; tray.ContextMenuStrip = menu; tray.Visible = true;
        tray.MouseDoubleClick += delegate { ShowWindow(); };

        // a second launch (Start menu) signals this; the wait costs nothing until then
        ThreadPool.RegisterWaitForSingleObject(show, delegate { form.BeginInvoke((Action)ShowWindow); }, null, -1, false);

        slotTimer.Tick += delegate { slotTimer.Stop(); StartSync(); ArmTimer(); };
        ArmTimer();

        // PC was off at a slot: catch up once, a minute after start (the network needs time after boot)
        var catchUp = new System.Windows.Forms.Timer { Interval = 60000 };
        catchUp.Tick += delegate { catchUp.Stop(); if (LastSync() < PrevSlot()) StartSync(); };
        catchUp.Start();
    }

    Button AddButton(string text, int x, EventHandler click)
    {
        var b = new Button { Text = text, Bounds = new Rectangle(x, 195, 120, 34), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(42, 43, 49) };
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
    bool failed;

    public void ShowWindow() { form.Show(); form.WindowState = FormWindowState.Normal; form.Activate(); }

    static void Open(string target) { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }

    void OpenLog()
    {
        if (!File.Exists(Log)) File.WriteAllText(Log, "");
        Process.Start("notepad.exe", "\"" + Log + "\"");
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

    void Refresh()
    {
        var last = LastSync();
        info.Text = string.Format("Jadwal: {0}\n\nSync terakhir: {1}\nHasil: {2}\nBerikutnya: {3:ddd HH:mm}",
            string.Join(" · ", Slots.Select(s => s.ToString(@"hh\:mm"))),
            last == DateTime.MinValue ? "belum pernah" : last.ToString("ddd dd MMM, HH:mm"),
            proc != null ? "sedang sync..." : result, NextSlot());
        // hover text (max 63 chars): status, last update, next run
        var status = proc != null ? "sedang sync" : failed ? "GAGAL" : "aktif";
        var lastShort = last == DateTime.MinValue ? "-" : last.Date == DateTime.Today ? last.ToString("HH:mm") : last.ToString("dd MMM HH:mm");
        var tip = string.Format("Nihongo Sync: {0}\nUpdate: {1}\nBerikutnya: {2:HH:mm}", status, lastShort, NextSlot());
        tray.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;
        tray.Icon = proc != null ? IconBusy : failed ? IconFail : IconOk;
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
            form.BeginInvoke((Action)(() => Finish(p.ExitCode == 0, output)));
        });
    }

    void Finish(bool ok, string output)
    {
        File.AppendAllText(Log, "--- " + DateTime.Now.ToString("yyyy-MM-dd HH:mm") + "\r\n" + output + "\r\n", Encoding.UTF8);
        failed = !ok;
        if (ok) { File.WriteAllText(State, DateTime.Now.ToString("o")); result = output.Split('\n').Last().Trim(); }
        else { result = "GAGAL (lihat log)"; tray.ShowBalloonTip(5000, "Nihongo Sync", "Sync gagal, buka log untuk detail.", ToolTipIcon.Warning); }
        proc = null; syncBtn.Enabled = true; Refresh();
    }
}
