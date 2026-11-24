# Builds and installs Nihongo Sync (app/NihongoSync.cs) with the C# compiler that ships with Windows.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-app.ps1
# Installs to %LOCALAPPDATA%\Programs\NihongoSync, adds Start Menu + Startup shortcuts, then starts it in the tray.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot
$src = Join-Path $root "app\NihongoSync.cs"
$ico = Join-Path $root "app\icon.ico"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$python = (Get-Command python.exe).Source
$dest = Join-Path $env:LOCALAPPDATA "Programs\NihongoSync"
$exe = Join-Path $dest "NihongoSync.exe"
$tmp = Join-Path $env:TEMP "nihongo-sync-build"
New-Item -ItemType Directory -Force $dest, $tmp | Out-Null
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $ico)) {  # yellow square with 日, PNG-compressed .ico in 4 sizes
    $sizes = 16, 32, 48, 256; $pngs = foreach ($s in $sizes) {
        $b = New-Object System.Drawing.Bitmap $s, $s; $g = [System.Drawing.Graphics]::FromImage($b)
        $g.TextRenderingHint = "AntiAliasGridFit"; $g.Clear([System.Drawing.Color]::FromArgb(242, 194, 0))
        $f = New-Object System.Drawing.Font("Yu Gothic UI", [float]($s * 0.66), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = "Center"; $sf.LineAlignment = "Center"
        $g.DrawString([string][char]0x65E5, $f, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF(0, ($s * 0.04), $s, $s)), $sf)
        $ms = New-Object IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); , $ms.ToArray()
    }
    $out = New-Object IO.MemoryStream; $w = New-Object IO.BinaryWriter $out
    $w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $s = $sizes[$i]; $w.Write([byte]($s % 256)); $w.Write([byte]($s % 256)); $w.Write([byte]0); $w.Write([byte]0)
        $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$pngs[$i].Length); $w.Write([uint32]$offset); $offset += $pngs[$i].Length
    }
    foreach ($p in $pngs) { $w.Write($p) }
    [IO.File]::WriteAllBytes($ico, $out.ToArray())
}

# machine-specific paths are compiled in, so the exe needs no config file
$cfg = Join-Path $tmp "Config.cs"
Set-Content $cfg -Encoding UTF8 @"
static class Config {
    public const string Python = @"$python";
    public const string Publish = @"$(Join-Path $root 'scripts\publish.py')";
    public const string Root = @"$root";
    public const string Db = @"$(Join-Path $root 'scripts\db.py')";
}
"@

Get-Process NihongoSync -ErrorAction SilentlyContinue | Stop-Process -Force
& $csc /nologo /target:winexe /optimize /codepage:65001 "/win32icon:$ico" "/out:$exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Core.dll /r:System.ServiceProcess.dll $src $cfg
if ($LASTEXITCODE) { throw "build gagal" }

$shell = New-Object -ComObject WScript.Shell
foreach ($l in @(@{ dir = "Programs"; arg = "" }, @{ dir = "Startup"; arg = "--tray" })) {
    $sc = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath($l.dir)) "Nihongo Sync.lnk"))
    $sc.TargetPath = $exe; $sc.Arguments = $l.arg; $sc.WorkingDirectory = $dest; $sc.Description = "Nihongo Sync"; $sc.Save()
}
Start-Process $exe "--tray"
"terpasang: $exe"
