<#
.SYNOPSIS
    Morning check: is every camera actually recording? Reads the filesystem, not the app.

.DESCRIPTION
    Run this once each morning and send the output to whoever supports the system.

    It deliberately does NOT ask the VMS whether it is healthy. Every serious failure
    found during commissioning was an app reporting health while writing nothing: cameras
    green with an empty folder, a service "Running" with no recorder, a UI listing
    cameras that had been dropped. The only trustworthy answer is a recording file that
    is NEWER THAN IT WAS A FEW MINUTES AGO, so that is what this measures.

.PARAMETER VideosDir
    The recording directory. A UNC path is fine. Defaults to the Shinobi bundle layout.

.PARAMETER MaxAgeMinutes
    How old the newest recording may be before a camera counts as failed. Should be a
    little more than the segment length. Default 10 (for 5-minute segments).

.PARAMETER ExpectedCameras
    How many cameras should be recording. 0 = infer from the folders present.

.EXAMPLE
    .\Daily-Check.ps1
    .\Daily-Check.ps1 -VideosDir '\\192.168.1.54\shared-cctv\shinobi-e1' -ExpectedCameras 5
#>
param(
    [string]$VideosDir = 'D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\videos',
    [int]$MaxAgeMinutes = 10,
    [int]$ExpectedCameras = 0,
    # How much history you expect to be able to go back through. 0 skips the check.
    # This is the guard against silent deletion: after a retention over-delete every
    # camera is still recording, so every other check on this page reports green while
    # weeks of footage have gone.
    [int]$ExpectedRetentionDays = 30
)
$ErrorActionPreference = 'Continue'
$now = Get-Date

Write-Host ""
Write-Host "  CCTV RECORDING CHECK" -ForegroundColor Cyan
Write-Host ("  " + $now.ToString('dddd d MMMM yyyy, HH:mm'))
Write-Host ("  Recordings: " + $VideosDir)
Write-Host ""

if (-not (Test-Path $VideosDir)) {
    Write-Host "  PROBLEM: the recording folder cannot be reached." -ForegroundColor Red
    Write-Host "  If recordings are on a NAS, the NAS is off or off the network."
    Write-Host "  NOTHING IS BEING RECORDED. Call support." -ForegroundColor Red
    exit 2
}

# Camera folders live one level below the group folder: <videos>\<group>\<camera>\*.mp4
$camDirs = @()
foreach ($g in Get-ChildItem $VideosDir -Directory -EA SilentlyContinue) {
    foreach ($c in Get-ChildItem $g.FullName -Directory -EA SilentlyContinue) {
        if ($c.Name -notlike '*_timelapse') { $camDirs += $c }
    }
}
if ($camDirs.Count -eq 0) { $camDirs = @(Get-ChildItem $VideosDir -Directory -EA SilentlyContinue | Where-Object { $_.Name -notlike '*_timelapse' -and $_.Name -notlike '.*' }) }

if ($camDirs.Count -eq 0) {
    Write-Host "  PROBLEM: no camera folders were found in the recording location." -ForegroundColor Red
    Write-Host "  The folder is reachable but empty. Either recording has never started,"
    Write-Host "  or the system is writing somewhere else."
    Write-Host "  NOTHING IS BEING RECORDED. Call support." -ForegroundColor Red
    Write-Host ""
    exit 2
}

$ok = @(); $bad = @()
foreach ($c in $camDirs) {
    # Newest by NAME: the filename is the segment start time, and on a network share the
    # directory entry's timestamp lags while the file is still open.
    $f = Get-ChildItem $c.FullName -File -Filter *.mp4 -EA SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    $ageMin = $null
    if ($f -and $f.BaseName -match '^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})') {
        $t = Get-Date -Year $Matches[1] -Month $Matches[2] -Day $Matches[3] -Hour $Matches[4] -Minute $Matches[5] -Second $Matches[6]
        $ageMin = [math]::Round(($now - $t).TotalMinutes, 1)
    } elseif ($f) {
        $ageMin = [math]::Round(($now - $f.LastWriteTime).TotalMinutes, 1)
    }
    # Oldest recording, for the history check below. Sorted by NAME, which is the
    # segment start time, so this is the true start of retained history.
    $oldestDays = $null
    $of = Get-ChildItem $c.FullName -File -Filter *.mp4 -EA SilentlyContinue | Sort-Object Name | Select-Object -First 1
    if ($of -and $of.BaseName -match '^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})') {
        $ot = Get-Date -Year $Matches[1] -Month $Matches[2] -Day $Matches[3] -Hour $Matches[4] -Minute $Matches[5] -Second $Matches[6]
        $oldestDays = [math]::Round(($now - $ot).TotalDays, 2)
    }
    $row = [PSCustomObject]@{ Camera = $c.Name; AgeMin = $ageMin; OldestDays = $oldestDays }
    if ($null -ne $ageMin -and $ageMin -le $MaxAgeMinutes) { $ok += $row } else { $bad += $row }
}

if ($ok.Count) {
    Write-Host "  RECORDING NORMALLY:" -ForegroundColor Green
    foreach ($r in $ok) {
        $hist = if ($null -eq $r.OldestDays) { "history unknown" }
                elseif ($r.OldestDays -lt 1) { "history goes back {0} hours" -f [math]::Round($r.OldestDays * 24, 1) }
                else { "history goes back {0} days" -f $r.OldestDays }
        Write-Host ("    OK   {0,-24} newest recording {1} min old, {2}" -f $r.Camera, $r.AgeMin, $hist)
    }
    Write-Host ""
}
if ($bad.Count) {
    Write-Host "  NOT RECORDING:" -ForegroundColor Red
    foreach ($r in $bad) {
        $what = if ($null -eq $r.AgeMin) { "no recordings at all" } else { "last recording $($r.AgeMin) minutes old" }
        Write-Host ("    FAIL {0,-24} {1}" -f $r.Camera, $what)
    }
    Write-Host ""
}

# Recorder processes. Filtered by install path so another application's ffmpeg cannot
# make this look healthy.
$ff = @(Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" -EA SilentlyContinue |
        Where-Object { $_.CommandLine -like '*ShinobiVMS*' -or $_.CommandLine -like '*vms-go*' })
$expected = if ($ExpectedCameras -gt 0) { $ExpectedCameras } else { $camDirs.Count }
Write-Host ("  Recorder processes running : {0}   (expected about {1})" -f $ff.Count, $expected)

# Free space on the recording volume.
try {
    $fso = New-Object -ComObject Scripting.FileSystemObject
    $d = $fso.GetDrive($fso.GetDriveName($VideosDir))
    $freeGB = [math]::Round($d.FreeSpace / 1GB, 1)
    $totalGB = [math]::Round($d.TotalSize / 1GB, 1)
    $pct = if ($totalGB -gt 0) { [math]::Round(100 * $freeGB / $totalGB) } else { 0 }
    Write-Host ("  Free space on recordings   : {0} GB of {1} GB ({2}%)" -f $freeGB, $totalGB, $pct)
    if ($freeGB -lt 10) { Write-Host "    WARNING: very little space left." -ForegroundColor Yellow }
} catch { Write-Host "  Free space                 : could not be read" }


# --- history check -----------------------------------------------------------
# After a retention over-delete every camera is still recording, so every check above
# reports green while weeks of footage have gone. This is the only line on the page that
# would notice. Measured on a real recorder: retention was 435 MB short of its floor and
# deleted 2.7 GB, twice in one night, leaving a single segment per camera.
$historyAlarm = $false
if ($ExpectedRetentionDays -gt 0) {
    $withHistory = @($ok + $bad | Where-Object { $null -ne $_.OldestDays })
    if ($withHistory.Count) {
        $shortest = ($withHistory | Sort-Object OldestDays | Select-Object -First 1)
        $wantDays = $ExpectedRetentionDays
        Write-Host ("  Oldest recording kept       : {0} days   (you expect {1})" -f $shortest.OldestDays, $wantDays)
        if ($shortest.OldestDays -lt ($wantDays * 0.5)) {
            $historyAlarm = $true
            Write-Host ""
            Write-Host "  WARNING: THERE IS FAR LESS HISTORY THAN THERE SHOULD BE." -ForegroundColor Yellow
            $howLong = if ($shortest.OldestDays -lt 1) { "{0} hours" -f [math]::Round($shortest.OldestDays * 24, 1) } else { "{0} days" -f $shortest.OldestDays }
            Write-Host ("  You expect $wantDays days of recordings. The oldest one for $($shortest.Camera)") -ForegroundColor Yellow
            Write-Host ("  is only $howLong old, so older footage has been deleted.") -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  This can happen without any camera failing, which is why it is easy to miss."
            Write-Host "  If the system was only set up recently this is normal and expected."
            Write-Host "  Otherwise, report it - footage may have been lost."
        }
    }
}

Write-Host ""
Write-Host "  ---------------------------------------------------------------"
if ($bad.Count -eq 0 -and $ff.Count -ge $expected -and -not $historyAlarm) {
    Write-Host ("  RESULT: ALL {0} CAMERAS ARE RECORDING. Nothing to do." -f $ok.Count) -ForegroundColor Green
    Write-Host "  ---------------------------------------------------------------"
    Write-Host ""
    exit 0
}
if ($bad.Count -eq 0 -and $historyAlarm) {
    Write-Host ("  RESULT: all {0} cameras are recording, BUT older footage is missing." -f $ok.Count) -ForegroundColor Yellow
} else {
    Write-Host ("  RESULT: {0} of {1} cameras are NOT recording." -f $bad.Count, ($ok.Count + $bad.Count)) -ForegroundColor Red
}
if ($ff.Count -lt $expected) { Write-Host ("  Also: only {0} recorder processes are running, expected {1}." -f $ff.Count, $expected) -ForegroundColor Red }
Write-Host "  Send this whole screen to support. Do not restart anything first --"
Write-Host "  the current state is the evidence."
Write-Host "  ---------------------------------------------------------------"
Write-Host ""
exit 1
