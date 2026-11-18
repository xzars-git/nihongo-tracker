# Nihongo Sync: tray app that runs publish.py at fixed times (default 12:00, 18:00, 21:00).
# Closing the window hides it to the tray; only "Quit" stops it. Between slots it sleeps on a single timer.
#   powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File nihongo-sync.ps1 [-Tray]
param([switch]$Tray)

$SLOTS = @("12:00", "18:00", "21:00")
$PY = "C:\Users\xzars\AppData\Local\Programs\Python\Python310\python.exe"
$PUBLISH = Join-Path $PSScriptRoot "publish.py"
$SITE = "https://arsenius-nihongo.vercel.app"
$DIR = Join-Path $env:LOCALAPPDATA "NihongoSync"
$LOG = Join-Path $DIR "sync.log"
$STATE = Join-Path $DIR "last.txt"   # time of the last finished sync
New-Item -ItemType Directory -Force $DIR | Out-Null

$mutex = New-Object System.Threading.Mutex($false, "Local\NihongoSync")
if (-not $mutex.WaitOne(0)) { exit }  # already running

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

function Make-Icon {
    $b = New-Object System.Drawing.Bitmap 32, 32
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.TextRenderingHint = "AntiAlias"
    $g.Clear([System.Drawing.Color]::FromArgb(242, 194, 0))
    $f = New-Object System.Drawing.Font("Yu Gothic UI", 17, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = "Center"; $sf.LineAlignment = "Center"
    $g.DrawString([string][char]0x65E5, $f, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF(0, 1, 32, 32)), $sf)
    $g.Dispose()
    [System.Drawing.Icon]::FromHandle($b.GetHicon())
}
$icon = Make-Icon

function Slots { foreach ($d in -1, 0, 1) { foreach ($s in $SLOTS) { [datetime]::Today.AddDays($d) + [timespan]::Parse($s) } } }
function Next-Slot { Slots | Where-Object { $_ -gt (Get-Date) } | Select-Object -First 1 }
function Prev-Slot { Slots | Where-Object { $_ -le (Get-Date) } | Select-Object -Last 1 }
function Last-Sync { if (Test-Path $STATE) { [datetime]::Parse((Get-Content $STATE -Raw).Trim()) } else { [datetime]::MinValue } }

# ---------- window ----------
$form = New-Object System.Windows.Forms.Form
$form.Text = "Nihongo Sync"; $form.Icon = $icon; $form.Size = New-Object System.Drawing.Size(420, 300)
$form.FormBorderStyle = "FixedSingle"; $form.MaximizeBox = $false; $form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::FromArgb(23, 24, 28); $form.ForeColor = [System.Drawing.Color]::FromArgb(236, 234, 227)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$title = New-Object System.Windows.Forms.Label
$title.Text = "Nihongo Sync"; $title.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(242, 194, 0); $title.SetBounds(20, 15, 360, 34)
$info = New-Object System.Windows.Forms.Label
$info.SetBounds(20, 55, 380, 120)

function Button($text, $x, $action) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text; $b.SetBounds($x, 195, 120, 34); $b.FlatStyle = "Flat"
    $b.BackColor = [System.Drawing.Color]::FromArgb(42, 43, 49); $b.add_Click($action); $form.Controls.Add($b); $b
}
$btnSync = Button "Sync sekarang" 20 { Start-Sync }
Button "Buka web" 145 { Start-Process $SITE } | Out-Null
Button "Lihat log" 270 { if (Test-Path $LOG) { Start-Process notepad $LOG } } | Out-Null
$form.Controls.AddRange(@($title, $info))

$script:quitting = $false
$form.add_FormClosing({ param($s, $e) if (-not $script:quitting) { $e.Cancel = $true; $form.Hide() } })  # X = hide to tray

# ---------- tray ----------
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menu.Items.Add("Buka", $null, { Show-Window }) | Out-Null
$menu.Items.Add("Sync sekarang", $null, { Start-Sync }) | Out-Null
$menu.Items.Add("Buka web", $null, { Start-Process $SITE }) | Out-Null
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$menu.Items.Add("Quit", $null, { $script:quitting = $true; $tray.Visible = $false; $form.Close(); [System.Windows.Forms.Application]::Exit() }) | Out-Null
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icon; $tray.Text = "Nihongo Sync"; $tray.ContextMenuStrip = $menu; $tray.Visible = $true
$tray.add_MouseDoubleClick({ Show-Window })
function Show-Window { $form.Show(); $form.WindowState = "Normal"; $form.Activate() }

# ---------- sync ----------
$script:proc = $null; $script:result = "-"
$slotTimer = New-Object System.Windows.Forms.Timer
$watch = New-Object System.Windows.Forms.Timer; $watch.Interval = 1000   # only ticks while a sync is running

function Refresh-Info {
    $last = Last-Sync
    $lastTxt = if ($last -eq [datetime]::MinValue) { "belum pernah" } else { $last.ToString("ddd dd MMM, HH:mm") }
    $state = if ($script:proc) { "sedang sync..." } else { $script:result }
    $info.Text = "Jadwal: $($SLOTS -join ' · ')`n`nSync terakhir: $lastTxt`nHasil: $state`nBerikutnya: $((Next-Slot).ToString('ddd HH:mm'))"
    $tray.Text = "Nihongo Sync · berikutnya $((Next-Slot).ToString('HH:mm'))"
}
function Arm-Timer {
    $ms = [int][math]::Max(1000, ((Next-Slot) - (Get-Date)).TotalMilliseconds)
    $slotTimer.Stop(); $slotTimer.Interval = $ms; $slotTimer.Start(); Refresh-Info
}
function Start-Sync {
    if ($script:proc) { return }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $PY; $psi.Arguments = "-I `"$PUBLISH`""; $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8; $psi.WorkingDirectory = Split-Path $PSScriptRoot
    $script:proc = [System.Diagnostics.Process]::Start($psi)
    $btnSync.Enabled = $false; $watch.Start(); Refresh-Info
}
$watch.add_Tick({
    if (-not $script:proc.HasExited) { return }
    $watch.Stop()
    $out = ($script:proc.StandardOutput.ReadToEnd() + $script:proc.StandardError.ReadToEnd()).Trim()
    $ok = $script:proc.ExitCode -eq 0
    Add-Content $LOG "--- $(Get-Date -Format 'yyyy-MM-dd HH:mm')`n$out" -Encoding UTF8
    $script:result = if ($ok) { ($out -split "`n")[-1] } else { "GAGAL (lihat log)" }
    if ($ok) { Set-Content $STATE (Get-Date -Format "o") }
    else { $tray.ShowBalloonTip(5000, "Nihongo Sync", "Sync gagal, buka log untuk detail.", "Warning") }
    $script:proc = $null; $btnSync.Enabled = $true; Refresh-Info
})
$slotTimer.add_Tick({ $slotTimer.Stop(); Start-Sync; Arm-Timer })

# PC was off at a slot: catch up once, a minute after start (network needs time after boot)
$catchUp = New-Object System.Windows.Forms.Timer; $catchUp.Interval = 60000
$catchUp.add_Tick({ $catchUp.Stop(); if ((Last-Sync) -lt (Prev-Slot)) { Start-Sync } })
$catchUp.Start()

Arm-Timer
if (-not $Tray) { Show-Window }
[System.Windows.Forms.Application]::Run()
$tray.Dispose(); $mutex.ReleaseMutex()
