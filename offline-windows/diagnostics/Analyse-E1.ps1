<#
.SYNOPSIS
    Turn E1_SAMPLES.csv into the answers the endurance test was run to get.

.DESCRIPTION
    Run this when the 24-hour sampler has finished (or at any point during it, for a
    partial picture). It reports the things that decide pass/fail:

      - recording gaps per camera (newest-segment age above the cutoff)
      - whether retention purged, and whether recording continued through it
      - memory and handle TREND, not peak - a rising line is a leak
      - unprompted process restarts (the node PID changing)
      - total footage and measured GB/camera/day over the full cycle
      - the files-with-no-row leak counter

.EXAMPLE
    .\Analyse-E1.ps1
    .\Analyse-E1.ps1 -Csv D:\xeno-shinobi\xeno-shinobi\E1_SAMPLES.csv
#>
param(
    [string]$Csv = 'D:\xeno-shinobi\xeno-shinobi\E1_SAMPLES.csv',
    [int]$CutoffSeconds = 420   # 5-min segments; >7 min means the camera stopped producing
)
$ErrorActionPreference = 'Stop'
$rows = @(Import-Csv $Csv)
if ($rows.Count -lt 2) { Write-Host "Not enough samples yet ($($rows.Count))."; exit 1 }

$camCols = ($rows[0].PSObject.Properties.Name | Where-Object { $_ -like 'age_*' })
$first = $rows[0]; $last = $rows[-1]
$hours = [math]::Round(([datetime]$last.timestamp - [datetime]$first.timestamp).TotalHours, 2)

Write-Host "=== E1 SUMMARY ===" -ForegroundColor Cyan
Write-Host ("samples        : {0}" -f $rows.Count)
Write-Host ("window         : {0}  ->  {1}   ({2} h)" -f $first.timestamp, $last.timestamp, $hours)
Write-Host ""

# --- recording continuity ----------------------------------------------------
Write-Host "--- Recording continuity (gap = newest segment older than $CutoffSeconds s) ---"
foreach ($c in $camCols) {
    $vals = $rows | ForEach-Object { $_.$c }
    $bad = @($rows | Where-Object { $_.$c -match '^\d+$' -and [int]$_.$c -gt $CutoffSeconds })
    $nofile = @($vals | Where-Object { $_ -notmatch '^\d+$' }).Count
    $worst = ($vals | Where-Object { $_ -match '^\d+$' } | Measure-Object -Maximum).Maximum
    $status = if ($bad.Count -eq 0 -and $nofile -eq 0) { 'CONTINUOUS' } else { 'GAPS' }
    Write-Host ("  {0,-22} {1,-11} gapSamples={2,-4} nonNumeric={3,-4} worstAge={4}s" -f `
        ($c -replace '^age_',''), $status, $bad.Count, $nofile, $worst)
    if ($bad.Count -gt 0) {
        $bad | Select-Object -First 6 | ForEach-Object { Write-Host ("      gap at {0}  age={1}s" -f $_.timestamp, $_.$c) }
        if ($bad.Count -gt 6) { Write-Host ("      ... and {0} more" -f ($bad.Count - 6)) }
    }
}
Write-Host ""

# --- retention ---------------------------------------------------------------
Write-Host "--- Retention / purging ---"
$foot = $rows | Where-Object { $_.footageGB -match '^[\d.]+$' }
$peak = ($foot | ForEach-Object { [double]$_.footageGB } | Measure-Object -Maximum).Maximum
$drops = @()
for ($i = 1; $i -lt $foot.Count; $i++) {
    $d = [double]$foot[$i-1].footageGB - [double]$foot[$i].footageGB
    if ($d -gt 0.5) { $drops += [pscustomobject]@{ at = $foot[$i].timestamp; freedGB = [math]::Round($d,2) } }
}
Write-Host ("  peak footage on share : {0} GB" -f $peak)
Write-Host ("  purge events (>0.5 GB freed between samples) : {0}" -f $drops.Count)
$drops | Select-Object -First 10 | ForEach-Object { Write-Host ("     {0}  freed {1} GB" -f $_.at, $_.freedGB) }
if ($drops.Count -eq 0) { Write-Host "     NONE - purging never triggered. If footage neared the quota, that is a FAIL." -ForegroundColor Yellow }
Write-Host ("  free space  first={0} GB  last={1} GB  min={2} GB" -f $first.freeGB, $last.freeGB,
    (($rows | Where-Object { $_.freeGB -match '^[\d.]+$' } | ForEach-Object { [double]$_.freeGB } | Measure-Object -Minimum).Minimum))
Write-Host ""

# --- leak: memory and handles ------------------------------------------------
Write-Host "--- Memory and handle trend (the leak test) ---"
function Trend($name, $col, $unit) {
    $pts = @($rows | Where-Object { $_.$col -match '^[\d.]+$' })
    if ($pts.Count -lt 3) { Write-Host ("  {0}: not enough data" -f $name); return }
    $n = $pts.Count
    # least-squares slope against elapsed minutes
    $xs = $pts | ForEach-Object { [double]$_.elapsedMin }
    $ys = $pts | ForEach-Object { [double]$_.$col }
    $mx = ($xs | Measure-Object -Average).Average; $my = ($ys | Measure-Object -Average).Average
    $num = 0.0; $den = 0.0
    for ($i = 0; $i -lt $n; $i++) { $num += ($xs[$i]-$mx)*($ys[$i]-$my); $den += ($xs[$i]-$mx)*($xs[$i]-$mx) }
    $slope = if ($den -ne 0) { $num / $den } else { 0 }
    $perHour = [math]::Round($slope * 60, 3)
    $verdict = if ([math]::Abs($perHour) -lt ([double]$my * 0.01)) { 'FLAT' } elseif ($perHour -gt 0) { 'RISING - possible leak' } else { 'falling' }
    Write-Host ("  {0,-10} first={1} last={2} min={3} max={4} {5}   slope={6} {5}/hour  -> {7}" -f `
        $name, $ys[0], $ys[-1], ($ys|Measure-Object -Minimum).Minimum, ($ys|Measure-Object -Maximum).Maximum, $unit, $perHour, $verdict)
}
Trend 'RSS'     'nodeRSS_MB'  'MB'
Trend 'Handles' 'nodeHandles' ''
Write-Host ""

# --- restarts ----------------------------------------------------------------
Write-Host "--- Unprompted restarts ---"
$pids = @($rows | Where-Object { $_.nodePID -match '^\d+$' } | ForEach-Object { $_.nodePID } | Select-Object -Unique)
Write-Host ("  distinct node PIDs seen : {0}  [{1}]" -f $pids.Count, ($pids -join ', '))
if ($pids.Count -gt 1) {
    Write-Host "  RESTART DETECTED - the process changed identity mid-run:" -ForegroundColor Yellow
    $prev = $null
    foreach ($r in $rows) { if ($r.nodePID -match '^\d+$') { if ($prev -and $r.nodePID -ne $prev) { Write-Host ("     {0}  {1} -> {2}" -f $r.timestamp, $prev, $r.nodePID) }; $prev = $r.nodePID } }
} else { Write-Host "  none - PID stable for the whole run." }
$none = @($rows | Where-Object { $_.nodePID -eq 'NONE' })
if ($none.Count) { Write-Host ("  samples with NO node process at all: {0} (first {1})" -f $none.Count, $none[0].timestamp) -ForegroundColor Red }
Write-Host ""

# --- leak counter and throughput ---------------------------------------------
Write-Host "--- Orphan files (no Videos row) ---"
$orp = @($rows | Where-Object { $_.filesWithNoRow -match '^\d+$' } | ForEach-Object { [int]$_.filesWithNoRow })
if ($orp.Count) {
    Write-Host ("  first={0} last={1} min={2} max={3}" -f $orp[0], $orp[-1], ($orp|Measure-Object -Minimum).Minimum, ($orp|Measure-Object -Maximum).Maximum)
    Write-Host "  NOTE: one open (unclosed) segment per camera is normally row-less, so a steady"
    Write-Host "        value around the camera count is expected. A rising floor is the leak."
}
Write-Host ""
Write-Host "--- Throughput ---"
$ffAvg = [math]::Round((($rows | Where-Object { $_.ffmpegCount -match '^\d+$' } | ForEach-Object { [int]$_.ffmpegCount }) | Measure-Object -Average).Average, 2)
Write-Host ("  ffmpeg count: avg={0}  min={1}  max={2}" -f $ffAvg,
    (($rows | Where-Object { $_.ffmpegCount -match '^\d+$' } | ForEach-Object { [int]$_.ffmpegCount }) | Measure-Object -Minimum).Minimum,
    (($rows | Where-Object { $_.ffmpegCount -match '^\d+$' } | ForEach-Object { [int]$_.ffmpegCount }) | Measure-Object -Maximum).Maximum)
$written = [double]$first.freeGB - [double]$last.freeGB
Write-Host ("  net free-space change : {0} GB over {1} h" -f ([math]::Round($written,2)), $hours)
Write-Host "  (net change understates footage written once purging starts; use peak footage"
Write-Host "   plus total freed by purges for the real throughput figure)"
$camCount = $camCols.Count
if ($hours -gt 0 -and $camCount -gt 0) {
    $totalFreed = ($drops | Measure-Object freedGB -Sum).Sum
    if (-not $totalFreed) { $totalFreed = 0 }
    $grossGB = $peak + $totalFreed
    Write-Host ("  gross footage written : ~{0} GB  ->  {1} GB/camera/day" -f `
        [math]::Round($grossGB,2), [math]::Round($grossGB / $camCount / $hours * 24, 2))
}
