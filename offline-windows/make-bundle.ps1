# Builds a self-contained, offline-installable Shinobi VMS bundle for Windows.
# Run this on a Windows machine WITH internet. Copy dist\ShinobiVMS-Offline to
# the offline machine and run INSTALL.bat there as administrator.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion = '20.18.1'   # backend/package.json requires node >=20 <21
$repo   = Split-Path -Parent $PSScriptRoot
$dist   = Join-Path $PSScriptRoot 'dist\ShinobiVMS-Offline'
$cache  = Join-Path $PSScriptRoot '.cache'

New-Item -ItemType Directory -Force -Path $dist, $cache | Out-Null

function Get-Cached($url, $file) {
    $path = Join-Path $cache $file
    if (Test-Path $path) { Write-Host "  cached: $file"; return $path }
    Write-Host "  downloading: $file"
    Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing
    return $path
}

# --- 1. Portable Node runtime -------------------------------------------
Write-Host "`n[1/5] Node.js $NodeVersion runtime"
$nodeZip = Get-Cached "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" "node-v$NodeVersion-win-x64.zip"
if (-not (Test-Path "$dist\node\node.exe")) {
    Expand-Archive -Path $nodeZip -DestinationPath $cache -Force
    Copy-Item "$cache\node-v$NodeVersion-win-x64" "$dist\node" -Recurse -Force
}

# --- 2. ffmpeg ----------------------------------------------------------
# The app looks for <root>/ffmpeg/ffmpeg.exe (backend/libs/ffmpeg/utils.js).
Write-Host "`n[2/5] ffmpeg"
$ffZip = Get-Cached 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' 'ffmpeg.zip'
if (-not (Test-Path "$dist\ffmpeg\ffmpeg.exe")) {
    Expand-Archive -Path $ffZip -DestinationPath "$cache\ff" -Force
    New-Item -ItemType Directory -Force -Path "$dist\ffmpeg" | Out-Null
    Get-ChildItem "$cache\ff" -Recurse -Include ffmpeg.exe,ffprobe.exe |
        ForEach-Object { Copy-Item $_.FullName "$dist\ffmpeg\" -Force }
}

# --- 3. Service wrapper (WinSW) -----------------------------------------
Write-Host "`n[3/5] service wrapper"
$winsw = Get-Cached 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' 'WinSW-x64.exe'
Copy-Item $winsw "$dist\shinobi-service.exe" -Force

# --- 4. Application + dependencies --------------------------------------
Write-Host "`n[4/5] application and npm dependencies"
$app = Join-Path $dist 'app'
New-Item -ItemType Directory -Force -Path $app | Out-Null
foreach ($item in 'backend','frontend','shared','patches') {
    if (Test-Path "$repo\$item") {
        Copy-Item "$repo\$item" $app -Recurse -Force `
            -Exclude 'node_modules','*.sqlite','conf.json','super.json','*.bak.*'
    }
}
# Build node_modules with the bundled Node so native binaries match its ABI.
$env:PATH = "$dist\node;$env:PATH"
Push-Location "$app\backend"
& "$dist\node\npm.cmd" install --omit=dev --no-audit --no-fund
# SQLite engine: knex reads the client straight from conf.json, so this is the
# only dependency the offline build adds over the Linux deployment.
& "$dist\node\npm.cmd" install sqlite3 --no-audit --no-fund
Pop-Location

# --- 5. Config + operator scripts ---------------------------------------
Write-Host "`n[5/5] configuration"

# SQLite config. Paths are filled in at install time by INSTALL.bat.
# No "passwordType" here on purpose: it defaults to md5, which is what the
# shipped super.json hash uses. Setting sha256 here makes the superuser
# password unmatchable and locks you out of /super entirely.
# requireStorageMount:false is the documented opt-out for legitimate LOCAL
# storage (libs/folders.js). This bundle records to a local disk, not a NAS.
# If this site is ever repointed at a NAS, REMOVE that line so the mount-health
# guard is active again - otherwise a dropped mount records to the OS disk.
@'
{
  "port": 8080,
  "databaseType": "sqlite3",
  "db": { "filename": "__ROOT__/shinobi.sqlite" },
  "videosDir": "__ROOT__/videos",
  "ffmpegDir": "__ROOT__/ffmpeg/ffmpeg.exe",
  "useNullAsDefault": true,
  "requireStorageMount": false,
  "cron": {},
  "pluginKeys": {}
}
'@ | ForEach-Object { [IO.File]::WriteAllText("$dist\conf.template.json", $_, (New-Object Text.UTF8Encoding $false)) }

if (Test-Path "$repo\backend\super.sample.json") {
    Copy-Item "$repo\backend\super.sample.json" "$app\backend\super.json" -Force
}

Copy-Item "$PSScriptRoot\INSTALL.bat","$PSScriptRoot\UNINSTALL.bat", `
          "$PSScriptRoot\START-CONSOLE.bat","$PSScriptRoot\README.md" $dist -Force

# Camera diagnostics tool. ffprobe.exe is copied in beside it so this one folder
# can be pulled onto its own USB stick and run on a machine with no Shinobi
# install at all - which is exactly the situation you are in when a camera shows
# no picture and you are standing at the client's site.
$diag = Join-Path $dist 'diagnostics'
New-Item -ItemType Directory -Force -Path $diag | Out-Null
Copy-Item "$PSScriptRoot\diagnostics\*" $diag -Recurse -Force
Copy-Item "$dist\ffmpeg\ffprobe.exe" $diag -Force

Write-Host "`nBundle ready: $dist"
Write-Host ("Size: {0:N0} MB" -f ((Get-ChildItem $dist -Recurse -File |
    Measure-Object Length -Sum).Sum / 1MB))
Write-Host "Copy that folder to the offline machine, then run INSTALL.bat as administrator."
