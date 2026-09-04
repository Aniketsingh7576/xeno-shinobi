<#
.SYNOPSIS
    Confirm a deployed copy of the backend really contains the code in this repo.

.DESCRIPTION
    Editing backend/ fixes nothing on the pilot machine: that machine runs
    offline-windows\dist\ShinobiVMS-Offline\app\backend\, and an installed machine runs
    its own copy again. A fix that never reached the running copy looks exactly like a
    fix that did not work, and it will cost an afternoon every time.

    This hashes every .js/.json under backend/ in both trees and reports the files that
    are missing or different. It exits 1 when anything differs, so it can gate a deploy.

    Run it after every backend change, and once more on the site machine before leaving.

.EXAMPLE
    .\Compare-Bundle.ps1
    Repo vs the bundle in offline-windows\dist.

.EXAMPLE
    .\Compare-Bundle.ps1 -Target 'C:\ShinobiVMS\app'
    Repo vs an installed copy. Run this ON the pilot machine, with the repo present.
#>
param(
    [string]$Target = (Join-Path $PSScriptRoot 'dist\ShinobiVMS-Offline\app')
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent

function Get-BackendHashes([string]$root) {
    $backend = Join-Path $root 'backend'
    if (-not (Test-Path $backend)) { throw "No backend directory under $root" }
    # conf.json and super.json are per-install and SHOULD differ; node_modules is built on
    # the target and never matches byte-for-byte.
    $skip = @('conf.json', 'super.json')
    $map = @{}
    Get-ChildItem -Path $backend -Recurse -File | Where-Object {
        $_.Extension -in @('.js', '.json') -and
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.Name -notin $skip -and
        $_.Name -notlike '*.bak.*'
    } | ForEach-Object {
        $rel = $_.FullName.Substring($backend.Length).TrimStart('\')
        $map[$rel] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
    return $map
}

Write-Host "repo   : $repo"
Write-Host "target : $Target`n"

$src = Get-BackendHashes $repo
$dst = Get-BackendHashes $Target

$missing = @()
$different = @()
foreach ($rel in $src.Keys) {
    if (-not $dst.ContainsKey($rel)) { $missing += $rel }
    elseif ($dst[$rel] -ne $src[$rel]) { $different += $rel }
}
$extra = @($dst.Keys | Where-Object { -not $src.ContainsKey($_) })

if ($missing.Count) {
    Write-Host "MISSING from the target ($($missing.Count)):" -ForegroundColor Red
    $missing | Sort-Object | ForEach-Object { Write-Host "  $_" }
}
if ($different.Count) {
    Write-Host "`nDIFFERENT content ($($different.Count)):" -ForegroundColor Red
    $different | Sort-Object | ForEach-Object { Write-Host "  $_" }
}
if ($extra.Count) {
    # Informational only: an installed copy legitimately gains files over time.
    Write-Host "`nOnly in the target ($($extra.Count)), not an error:" -ForegroundColor DarkGray
    $extra | Sort-Object | ForEach-Object { Write-Host "  $_" }
}

if ($missing.Count -or $different.Count) {
    Write-Host "`nThe target is NOT running this code. Rebuild the bundle (make-bundle.ps1)" -ForegroundColor Red
    Write-Host "or copy backend\libs over, then run this again." -ForegroundColor Red
    exit 1
}

Write-Host "`nOK - $($src.Count) backend files match." -ForegroundColor Green
exit 0
