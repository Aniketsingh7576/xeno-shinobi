<#
.SYNOPSIS
    Offline RTSP camera diagnostics for Dahua / CP Plus / Hikvision cameras.

.DESCRIPTION
    Answers one question: "ONVIF found the camera, so why is there no picture?"

    Needs nothing but Windows PowerShell and a copy of ffprobe.exe sitting next
    to this script. No internet, no npm, no Python, no install.

    For each camera it:
      1. pings, and checks whether TCP 554 / 80 / 8000 are open
      2. tries the usual Dahua/CP Plus, Hikvision and ONVIF RTSP paths,
         main stream and substream, over TCP and then UDP
      3. runs ffprobe on everything that answers and reports codec, resolution,
         frame rate, bitrate and whether there is audio
      4. says in plain words what is wrong and what to change

    Passwords are never printed, never written to the report and never logged.

.EXAMPLE
    .\Diagnose-Camera.ps1 -Ip 192.168.1.108 -User admin -Password 'Abc@1234'

.EXAMPLE
    .\Diagnose-Camera.ps1 -ListFile cameras.txt -Out site-report.txt

.EXAMPLE
    .\Diagnose-Camera.ps1 -SelfTest
    Runs the built-in checks. Proves the script itself works before you rely
    on it at a client site. Needs no camera and no network.
#>
[CmdletBinding()]
param(
    # Single camera to test.
    [string] $Ip,
    [string] $User = '',
    [string] $Password = '',

    # Text file of cameras, one per line: "ip" or "ip,user,password".
    # Blank lines and lines starting with # are ignored.
    [string] $ListFile,

    # Path to ffprobe.exe. Found automatically if it sits next to this script,
    # in .\ffmpeg\, or in ..\ffmpeg\ (the Shinobi bundle layout).
    [string] $Ffprobe,

    # Where to write the report. Defaults to camera-report_<timestamp>.txt here.
    [string] $Out,

    # Per-attempt hard timeout. Raise it on a slow or busy network.
    [int] $TimeoutSec = 8,

    # RTSP port, if the site has moved it off 554.
    [int] $RtspPort = 554,

    # Extra RTSP paths to try, e.g. -ExtraPath '/live/ch0','/11'
    [string[]] $ExtraPath = @(),

    # Run the built-in checks and exit.
    [switch] $SelfTest
)

$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------
# Redaction. Every password we ever see goes in here, and nothing is printed
# or written to file without going through Hide-Secret first.
# --------------------------------------------------------------------------
$script:Secrets = New-Object System.Collections.ArrayList

function Register-Secret([string]$value) {
    if ($value -and $value.Length -gt 0 -and -not $script:Secrets.Contains($value)) {
        [void]$script:Secrets.Add($value)
        # The URL-encoded form leaks just as badly as the plain one.
        $encoded = [uri]::EscapeDataString($value)
        if ($encoded -ne $value -and -not $script:Secrets.Contains($encoded)) {
            [void]$script:Secrets.Add($encoded)
        }
    }
}

function Hide-Secret([string]$text) {
    if ($null -eq $text) { return '' }
    $safe = $text
    # Longest first, so a short password that is a substring of a longer one
    # cannot leave a fragment of the longer one behind.
    foreach ($secret in ($script:Secrets | Sort-Object -Property Length -Descending)) {
        $safe = $safe.Replace($secret, '****')
    }
    # Belt and braces: kill anything that still looks like user:pass@host.
    $safe = [regex]::Replace($safe, '(?<=://)([^/:@\s]+):([^/@\s]+)@', '$1:****@')
    return $safe
}

function Write-Both([string]$text, [string]$color) {
    $safe = Hide-Secret $text
    if ($color) { Write-Host $safe -ForegroundColor $color } else { Write-Host $safe }
    [void]$script:ReportLines.Add($safe)
}

# --------------------------------------------------------------------------
# Locating ffprobe
# --------------------------------------------------------------------------
function Resolve-Ffprobe([string]$hint) {
    $here = $PSScriptRoot
    if (-not $here) { $here = (Get-Location).Path }
    $candidates = @()
    if ($hint) { $candidates += $hint }
    $candidates += @(
        (Join-Path $here 'ffprobe.exe'),
        (Join-Path $here 'ffmpeg\ffprobe.exe'),
        (Join-Path $here 'bin\ffprobe.exe'),
        (Join-Path (Split-Path -Parent $here) 'ffmpeg\ffprobe.exe')
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { return (Resolve-Path -LiteralPath $c).Path }
    }
    $onPath = Get-Command ffprobe.exe -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    return $null
}

# --------------------------------------------------------------------------
# Network probes
# --------------------------------------------------------------------------
function Test-Icmp([string]$ip, [int]$timeoutMs = 1500) {
    try {
        $ping = New-Object System.Net.NetworkInformation.Ping
        for ($i = 0; $i -lt 2; $i++) {
            $reply = $ping.Send($ip, $timeoutMs)
            if ($reply.Status -eq 'Success') { return @{ Ok = $true; Ms = $reply.RoundtripTime } }
        }
    } catch { }
    return @{ Ok = $false; Ms = $null }
}

function Test-TcpPort([string]$ip, [int]$port, [int]$timeoutMs = 2000) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($ip, $port, $null, $null)
        if ($async.AsyncWaitHandle.WaitOne($timeoutMs, $false)) {
            $client.EndConnect($async)
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

# --------------------------------------------------------------------------
# RTSP URLs
# --------------------------------------------------------------------------
# The paths that actually turn up on Indian-market CP Plus / Dahua OEM units
# and on Hikvision. Substream first is deliberate: the substream is the one you
# want for live view, and it is usually the one already set to H.264.
function Get-UrlPatterns([string[]]$extra) {
    $patterns = @(
        @{ Vendor = 'Dahua / CP Plus'; Stream = 'substream'; Path = '/cam/realmonitor?channel=1&subtype=1' },
        @{ Vendor = 'Dahua / CP Plus'; Stream = 'main';      Path = '/cam/realmonitor?channel=1&subtype=0' },
        @{ Vendor = 'Hikvision';       Stream = 'substream'; Path = '/Streaming/Channels/102' },
        @{ Vendor = 'Hikvision';       Stream = 'main';      Path = '/Streaming/Channels/101' },
        @{ Vendor = 'Hikvision (old)'; Stream = 'substream'; Path = '/h264/ch1/sub/av_stream' },
        @{ Vendor = 'Hikvision (old)'; Stream = 'main';      Path = '/h264/ch1/main/av_stream' },
        @{ Vendor = 'ONVIF generic';   Stream = 'substream'; Path = '/onvif2' },
        @{ Vendor = 'ONVIF generic';   Stream = 'main';      Path = '/onvif1' }
    )
    foreach ($p in $extra) {
        if ($p) { $patterns += @{ Vendor = 'custom'; Stream = 'unknown'; Path = $p } }
    }
    return $patterns
}

function New-RtspUrl([string]$ip, [int]$port, [string]$user, [string]$pass, [string]$path) {
    # Percent-encode the credentials. A password containing @ : / ? # produces a
    # URL that parses into a completely different host if you do not do this,
    # and that is one of the two commonest causes of "wrong password" that is
    # not actually a wrong password.
    $auth = ''
    if ($user) {
        $auth = [uri]::EscapeDataString($user)
        if ($pass) { $auth += ':' + [uri]::EscapeDataString($pass) }
        $auth += '@'
    }
    if (-not $path.StartsWith('/')) { $path = '/' + $path }
    return "rtsp://$auth$ip" + ':' + "$port$path"
}

# --------------------------------------------------------------------------
# ffprobe
# --------------------------------------------------------------------------
function Invoke-Ffprobe([string]$exe, [string]$url, [string]$transport, [int]$timeoutSec) {
    $micro = $timeoutSec * 1000000
    $ffargs = @(
        '-hide_banner', '-v', 'error',
        '-rtsp_transport', $transport,
        '-rw_timeout', "$micro",
        '-analyzeduration', '3000000',
        '-probesize', '2000000',
        '-print_format', 'json',
        '-show_streams', '-show_format',
        '-i', $url
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = ($ffargs | ForEach-Object {
        if ($_ -match '[\s"]') { '"' + $_.Replace('"', '\"') + '"' } else { $_ }
    }) -join ' '
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    # Async readers: a synchronous ReadToEnd on both pipes deadlocks the moment
    # one of them fills its buffer.
    $sbOut = New-Object System.Text.StringBuilder
    $sbErr = New-Object System.Text.StringBuilder
    $onOut = Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -MessageData $sbOut -Action {
        if ($EventArgs.Data) { [void]$Event.MessageData.Append($EventArgs.Data).Append("`n") }
    }
    $onErr = Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -MessageData $sbErr -Action {
        if ($EventArgs.Data) { [void]$Event.MessageData.Append($EventArgs.Data).Append("`n") }
    }
    try {
        [void]$proc.Start()
        $proc.BeginOutputReadLine()
        $proc.BeginErrorReadLine()
        # ffprobe's own timeouts are not always honoured by the RTSP demuxer,
        # so the hard kill below is what actually bounds the run.
        $exited = $proc.WaitForExit(($timeoutSec + 2) * 1000)
        if (-not $exited) {
            try { $proc.Kill() } catch { }
            [void]$proc.WaitForExit(3000)
            return @{ ExitCode = -1; Stdout = ''; Stderr = 'ffprobe timed out and was killed'; TimedOut = $true }
        }
        Start-Sleep -Milliseconds 150   # let the async readers drain
        return @{ ExitCode = $proc.ExitCode; Stdout = $sbOut.ToString(); Stderr = $sbErr.ToString(); TimedOut = $false }
    } finally {
        Unregister-Event -SourceIdentifier $onOut.Name -ErrorAction SilentlyContinue
        Unregister-Event -SourceIdentifier $onErr.Name -ErrorAction SilentlyContinue
        $proc.Dispose()
    }
}

# --------------------------------------------------------------------------
# Reading ffprobe output
# --------------------------------------------------------------------------
function Get-StreamSummary([string]$json) {
    $info = @{
        Codec = 'unknown'; CodecLong = ''; Width = 0; Height = 0
        Fps = 0; BitrateKbps = 0; HasAudio = $false; AudioCodec = ''
    }
    if (-not $json -or $json.Trim().Length -eq 0) { return $info }
    try { $parsed = $json | ConvertFrom-Json } catch { return $info }
    if (-not $parsed) { return $info }

    foreach ($stream in @($parsed.streams)) {
        if ($null -eq $stream) { continue }
        if ($stream.codec_type -eq 'video' -and $info.Codec -eq 'unknown') {
            $info.Codec = "$($stream.codec_name)".ToLower()
            $info.CodecLong = "$($stream.codec_long_name)"
            if ($stream.width) { $info.Width = [int]$stream.width }
            if ($stream.height) { $info.Height = [int]$stream.height }
            $rate = "$($stream.avg_frame_rate)"
            if (-not $rate -or $rate -eq '0/0') { $rate = "$($stream.r_frame_rate)" }
            if ($rate -match '^(\d+)/(\d+)$' -and [int]$Matches[2] -ne 0) {
                $info.Fps = [math]::Round([int]$Matches[1] / [int]$Matches[2], 1)
            }
            if ("$($stream.bit_rate)" -match '^\d+$') {
                $info.BitrateKbps = [int]([int64]$stream.bit_rate / 1000)
            }
        }
        if ($stream.codec_type -eq 'audio') {
            $info.HasAudio = $true
            if (-not $info.AudioCodec) { $info.AudioCodec = "$($stream.codec_name)".ToLower() }
        }
    }
    if ($info.BitrateKbps -eq 0 -and $parsed.format -and "$($parsed.format.bit_rate)" -match '^\d+$') {
        $info.BitrateKbps = [int]([int64]$parsed.format.bit_rate / 1000)
    }
    return $info
}

# Turn ffprobe's stderr into a short machine code plus a sentence a tired
# person can act on at 11pm.
function Get-FailureReason([string]$stderr, [int]$exitCode, [bool]$timedOut) {
    $e = "$stderr"
    switch -Regex ($e) {
        '401|[Uu]nauthorized' {
            return @{ Code = 'AUTH'; Message = 'RTSP authentication failed. On CP Plus and Dahua the RTSP password is often NOT the ONVIF password - check Setup > System > Account in the camera web interface, and confirm the account is allowed to view live video. Also check the password for characters that need URL-encoding: @ : / ? # and spaces.' }
        }
        '404|[Nn]ot [Ff]ound|Method DESCRIBE failed' {
            return @{ Code = 'PATH'; Message = 'The camera answered but this RTSP path does not exist on it. Not a fault - another pattern in this report is probably the right one.' }
        }
        '[Cc]onnection refused' {
            return @{ Code = 'REFUSED'; Message = 'Connection refused on the RTSP port. RTSP is switched off, or it is listening on a different port. Check Network > Port in the camera web interface.' }
        }
        '[Nn]o route to host|[Nn]etwork is unreachable' {
            return @{ Code = 'ROUTE'; Message = 'No route to the camera. The server is on a different subnet or VLAN from the camera network.' }
        }
        '[Ii]mmediate exit requested|[Tt]imed out|[Tt]imeout|Operation not permitted' {
            return @{ Code = 'TIMEOUT'; Message = 'The camera accepted the connection but never delivered video before the timeout. Usually that channel has its stream disabled, or the camera has run out of simultaneous connections - reboot it, or raise -TimeoutSec.' }
        }
        '[Ii]nvalid data found' {
            return @{ Code = 'BADDATA'; Message = 'Something answered on this port but it is not a video stream.' }
        }
        '[Pp]rotocol not found' {
            return @{ Code = 'FFBUILD'; Message = 'This ffprobe build has no RTSP support. Use the ffprobe.exe from the Shinobi bundle.' }
        }
        '5\d\d ' {
            return @{ Code = 'SERVER'; Message = 'The camera returned a server error. Reboot the camera and retry.' }
        }
    }
    if ($timedOut) {
        return @{ Code = 'TIMEOUT'; Message = 'No response within the timeout. Raise -TimeoutSec if the network is slow.' }
    }
    return @{ Code = 'FAIL'; Message = "ffprobe exited $exitCode. The raw error is in the detail section at the end of this report." }
}

# --------------------------------------------------------------------------
# One camera
# --------------------------------------------------------------------------
function Test-Camera([string]$ip, [string]$user, [string]$pass, [string]$exe, [int]$timeoutSec, [string[]]$extra, [int]$rtspPort) {
    Register-Secret $pass

    $result = @{
        Ip = $ip; PingOk = $false; PingMs = $null
        Port554 = $false; Port80 = $false; Port8000 = $false
        Attempts = New-Object System.Collections.ArrayList
        Working = New-Object System.Collections.ArrayList
        Verdicts = New-Object System.Collections.ArrayList
        Best = $null
    }

    Write-Both ''
    Write-Both ('=' * 78)
    Write-Both "CAMERA $ip"
    Write-Both ('=' * 78)

    # --- 1. reachability -------------------------------------------------
    $ping = Test-Icmp $ip
    $result.PingOk = $ping.Ok
    $result.PingMs = $ping.Ms
    if ($ping.Ok) {
        Write-Both ("  ping ............. OK ({0} ms)" -f $ping.Ms)
    } else {
        Write-Both '  ping ............. NO REPLY  (some cameras block ping - the port checks below are what matter)'
    }

    $result.Port554 = Test-TcpPort $ip $rtspPort
    $result.Port80 = Test-TcpPort $ip 80
    $result.Port8000 = Test-TcpPort $ip 8000
    Write-Both ("  TCP {0,-4} (RTSP)  {1}" -f $rtspPort, $(if ($result.Port554) { 'OPEN' } else { 'CLOSED' }))
    Write-Both ("  TCP 80   (web)   {0}" -f $(if ($result.Port80) { 'OPEN' } else { 'CLOSED' }))
    Write-Both ("  TCP 8000 (ONVIF) {0}" -f $(if ($result.Port8000) { 'OPEN' } else { 'CLOSED' }))

    if (-not $result.PingOk -and -not $result.Port554 -and -not $result.Port80 -and -not $result.Port8000) {
        [void]$result.Verdicts.Add('Camera is not reachable at all. Check the cable, the PoE switch port, the IP address, and whether this server is on the same subnet as the camera network.')
        Write-Both ''
        Write-Both '  >> NOT REACHABLE - skipping stream tests.'
        return $result
    }

    if (-not $result.Port554) {
        # Do NOT hand a closed port to ffprobe. Against a dead RTSP port ffprobe
        # retries the connect forever instead of returning "connection refused",
        # so every attempt burns the full timeout and reports the wrong cause.
        [void]$result.Verdicts.Add("Port $rtspPort closed - RTSP may be disabled or on a non-standard port. Open http://$ip in a browser and check Network > Port. Set RTSP back to 554, or re-run this script with -RtspPort <the real port>.")
        if ($result.Port80 -or $result.Port8000) {
            [void]$result.Verdicts.Add('The camera itself is alive - its web and/or ONVIF port answered - so this is a camera setting, not a cabling or IP fault.')
        }
        Write-Both ''
        Write-Both "  >> RTSP PORT $rtspPort IS CLOSED - no point testing stream URLs until that is fixed."
        Write-Both '     (skipping the RTSP tests; ffprobe would just hang against a dead port)'
        return $result
    }

    # --- 2 & 3. stream attempts -----------------------------------------
    Write-Both ''
    Write-Both '  RTSP attempts:'
    $patterns = Get-UrlPatterns $extra
    $authFailed = $false

    foreach ($pattern in $patterns) {
        if ($authFailed) { break }   # wrong password: every other path fails identically
        $url = New-RtspUrl $ip $rtspPort $user $pass $pattern.Path
        $safe = Hide-Secret $url
        $tcpConnected = $false
        $tcpReason = $null

        foreach ($transport in @('tcp', 'udp')) {
            # Only re-test over UDP when TCP told us the path exists. A 404, a
            # refusal or a routing error is about the path or the port, never
            # about the transport, so retrying costs time and proves nothing.
            if ($transport -eq 'udp' -and $tcpReason -and $tcpReason.Code -eq 'PATH') { continue }
            if ($transport -eq 'udp' -and $tcpReason -and @('REFUSED', 'ROUTE', 'FFBUILD') -contains $tcpReason.Code) { continue }

            $probe = Invoke-Ffprobe $exe $url $transport $timeoutSec
            $ok = ($probe.ExitCode -eq 0 -and $probe.Stdout -match '"streams"')

            $attempt = @{
                Vendor = $pattern.Vendor; Stream = $pattern.Stream; Path = $pattern.Path
                Transport = $transport; SafeUrl = $safe; Ok = $ok
                Reason = $null; Info = $null; Stderr = (Hide-Secret $probe.Stderr).Trim()
                ExitCode = $probe.ExitCode
            }

            if ($ok) {
                $info = Get-StreamSummary $probe.Stdout
                $attempt.Info = $info
                if ($transport -eq 'tcp') { $tcpConnected = $true }
                [void]$result.Working.Add($attempt)
                $audio = if ($info.HasAudio) { "audio: $($info.AudioCodec)" } else { 'no audio' }
                $bitrate = if ($info.BitrateKbps -gt 0) { "$($info.BitrateKbps) kbps" } else { 'bitrate not reported' }
                Write-Both ("    [OK]   {0,-16} {1,-10} {2,-3}  {3} {4}x{5} @ {6} fps, {7}, {8}" -f `
                        $pattern.Vendor, $pattern.Stream, $transport.ToUpper(),
                    $info.Codec.ToUpper(), $info.Width, $info.Height, $info.Fps, $bitrate, $audio)
            } else {
                $reason = Get-FailureReason $probe.Stderr $probe.ExitCode $probe.TimedOut
                $attempt.Reason = $reason
                if ($transport -eq 'tcp') { $tcpReason = $reason }
                if ($reason.Code -eq 'AUTH') { $authFailed = $true }
                Write-Both ("    [--]   {0,-16} {1,-10} {2,-3}  {3}" -f `
                        $pattern.Vendor, $pattern.Stream, $transport.ToUpper(), $reason.Code)
            }
            [void]$result.Attempts.Add($attempt)
            if ($authFailed) { break }
        }

        # A transport mismatch is only meaningful for a path that actually exists.
        if (-not $authFailed) {
            $udpAttempt = $result.Attempts | Where-Object { $_.Path -eq $pattern.Path -and $_.Transport -eq 'udp' } | Select-Object -First 1
            $udpConnected = ($udpAttempt -and $udpAttempt.Ok)
            if ($tcpConnected -and $udpAttempt -and -not $udpConnected) {
                [void]$result.Verdicts.Add("Connected over TCP but not UDP on $($pattern.Vendor) $($pattern.Stream). Set RTSP Transport to TCP for this camera in Shinobi (Monitor Settings > Input > RTSP Transport). TCP is the right default anyway - it does not shed packets on a busy link.")
            }
            if ($udpConnected -and -not $tcpConnected) {
                [void]$result.Verdicts.Add("Connected over UDP but not TCP on $($pattern.Vendor) $($pattern.Stream). Set RTSP Transport to UDP in Shinobi, OR fix the camera: web interface > Network > RTSP, enable TCP. A firewall between server and camera can also drop the TCP interleaved data channel.")
            }
        }
    }

    # --- 4. verdicts -----------------------------------------------------
    if ($authFailed) {
        [void]$result.Verdicts.Add((Get-FailureReason '401 Unauthorized' 1 $false).Message)
    }

    if ($result.Working.Count -eq 0) {
        if (-not $authFailed -and $result.Port554) {
            [void]$result.Verdicts.Add("Port $rtspPort is open but no RTSP path answered. The path for this model is not in the built-in list. Log into the camera web interface, find the RTSP path under Network > RTSP (or in the model's manual), and re-run with -ExtraPath '/your/path'.")
        }
    } else {
        # Best = prefer H.264 over H.265, substream over main, TCP over UDP.
        $ranked = $result.Working | Sort-Object `
        @{ Expression = { if ($_.Info.Codec -eq 'h264') { 0 } else { 1 } } }, `
        @{ Expression = { if ($_.Stream -eq 'substream') { 0 } else { 1 } } }, `
        @{ Expression = { if ($_.Transport -eq 'tcp') { 0 } else { 1 } } }
        $result.Best = $ranked | Select-Object -First 1

        $h265 = $result.Working | Where-Object { @('hevc', 'h265') -contains $_.Info.Codec }
        $h264 = $result.Working | Where-Object { $_.Info.Codec -eq 'h264' }
        if ($h265 -and -not $h264) {
            [void]$result.Verdicts.Add('This camera is H.265. Browsers cannot play H.265. Open the camera web interface > Setup > Camera > Video, set the SUBSTREAM encoding to H.264, and point live view at the substream. You can leave the main stream on H.265 for the storage saving - Shinobi records that to a file either way; it is only live view in the browser that cannot decode it.')
        } elseif ($h265 -and $h264) {
            [void]$result.Verdicts.Add('Main stream and substream use different codecs. Use the H.264 one for live view - the H.265 one shows a black player in the browser.')
        }

        if (($result.Working | Where-Object { $_.Info.HasAudio }).Count -eq 0) {
            [void]$result.Verdicts.Add('No audio track on any working stream. Normal for most fixed-lens cameras. If audio is wanted, enable it in the camera web interface > Audio, then re-run.')
        }

        if ($result.Working | Where-Object { $_.Stream -eq 'substream' -and $_.Info.Width -gt 1280 }) {
            [void]$result.Verdicts.Add('The substream is wider than 1280. Drop it to 704x576 or 640x480 in the camera web interface - the point of a substream is a cheap live view, and a large one burns server CPU on every tile of the wall.')
        }
    }

    Write-Both ''
    if ($result.Best) {
        $b = $result.Best
        Write-Both ("  >> USE THIS: {0} {1} over {2}" -f $b.Vendor, $b.Stream, $b.Transport.ToUpper())
        Write-Both ("     {0}" -f $b.SafeUrl)
        Write-Both ("     {0} {1}x{2} @ {3} fps" -f $b.Info.Codec.ToUpper(), $b.Info.Width, $b.Info.Height, $b.Info.Fps)
    } else {
        Write-Both '  >> NO WORKING STREAM FOUND'
    }
    if ($result.Verdicts.Count -gt 0) {
        Write-Both ''
        Write-Both '  What to do:'
        $n = 0
        foreach ($v in $result.Verdicts) {
            $n++
            # Wrap so the report stays readable in Notepad on a 100-column window.
            $line = "    $n. "
            $indent = '       '
            foreach ($w in ($v -split '\s+')) {
                if (($line.Length + $w.Length + 1) -gt 96) { Write-Both $line; $line = $indent + $w + ' ' }
                else { $line = $line + $w + ' ' }
            }
            if ($line.Trim()) { Write-Both $line }
        }
    }
    return $result
}

# --------------------------------------------------------------------------
# Self-test: needs no camera, no network and no ffprobe.
# --------------------------------------------------------------------------
function Invoke-SelfTest {
    $script:selfTestFailures = 0
    function Check([string]$name, [bool]$ok) {
        if ($ok) { Write-Host "  PASS  $name" -ForegroundColor Green }
        else { Write-Host "  FAIL  $name" -ForegroundColor Red; $script:selfTestFailures++ }
    }
    Write-Host 'Self-test' -ForegroundColor Cyan

    # Redaction
    $script:Secrets.Clear()
    Register-Secret 'Abc@1234'
    Check 'password is redacted in plain text' ((Hide-Secret 'pass is Abc@1234 ok') -eq 'pass is **** ok')
    Check 'url-encoded password is redacted' ((Hide-Secret 'rtsp://admin:Abc%401234@1.2.3.4/x') -notmatch '1234')
    Check 'unknown creds in a url are redacted' ((Hide-Secret 'rtsp://bob:hunter2@1.2.3.4/x') -eq 'rtsp://bob:****@1.2.3.4/x')

    # URL building
    $u = New-RtspUrl '192.168.1.9' 554 'admin' 'Abc@1234' '/cam/realmonitor?channel=1&subtype=1'
    Check 'password with @ is percent-encoded' ($u -eq 'rtsp://admin:Abc%401234@192.168.1.9:554/cam/realmonitor?channel=1&subtype=1')
    Check 'url parses to the camera as host' (([uri]$u).Host -eq '192.168.1.9')
    $u2 = New-RtspUrl '10.0.0.5' 554 '' '' 'Streaming/Channels/102'
    Check 'no credentials, path gets a slash' ($u2 -eq 'rtsp://10.0.0.5:554/Streaming/Channels/102')

    # Failure classification
    Check 'classifies 401 as AUTH' ((Get-FailureReason 'Server returned 401 Unauthorized' 1 $false).Code -eq 'AUTH')
    Check 'classifies 404 as PATH' ((Get-FailureReason 'Method DESCRIBE failed: 404 Not Found' 1 $false).Code -eq 'PATH')
    Check 'classifies refusal' ((Get-FailureReason 'Connection refused' 1 $false).Code -eq 'REFUSED')
    Check 'classifies timeout' ((Get-FailureReason '' -1 $true).Code -eq 'TIMEOUT')

    # ffprobe output parsing
    $json = '{"streams":[{"codec_type":"video","codec_name":"hevc","width":2592,"height":1944,"avg_frame_rate":"15/1","bit_rate":"4096000"},{"codec_type":"audio","codec_name":"aac"}],"format":{"bit_rate":"4200000"}}'
    $info = Get-StreamSummary $json
    Check 'reads codec' ($info.Codec -eq 'hevc')
    Check 'reads resolution' ($info.Width -eq 2592 -and $info.Height -eq 1944)
    Check 'reads fps' ($info.Fps -eq 15)
    Check 'reads bitrate' ($info.BitrateKbps -eq 4096)
    Check 'detects audio' ($info.HasAudio -eq $true)
    Check 'survives garbage' ((Get-StreamSummary 'not json').Codec -eq 'unknown')

    Write-Host ''
    if ($script:selfTestFailures -eq 0) {
        Write-Host 'All self-tests passed.' -ForegroundColor Green
        return 0
    }
    Write-Host "$($script:selfTestFailures) self-test(s) FAILED." -ForegroundColor Red
    return 1
}

# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
if ($SelfTest) { exit (Invoke-SelfTest) }

$script:ReportLines = New-Object System.Collections.ArrayList

$exe = Resolve-Ffprobe $Ffprobe
if (-not $exe) {
    Write-Host ''
    Write-Host 'ffprobe.exe not found.' -ForegroundColor Red
    Write-Host 'Copy ffprobe.exe next to this script, or pass -Ffprobe C:\path\to\ffprobe.exe'
    Write-Host 'In the Shinobi offline bundle it is at ffmpeg\ffprobe.exe'
    exit 2
}

# Build the camera list.
$cameras = @()
if ($ListFile) {
    if (-not (Test-Path -LiteralPath $ListFile)) {
        Write-Host "List file not found: $ListFile" -ForegroundColor Red
        exit 2
    }
    foreach ($line in (Get-Content -LiteralPath $ListFile)) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith('#')) { continue }
        $parts = $t -split ','
        $cameras += @{
            Ip   = $parts[0].Trim()
            User = $(if ($parts.Count -gt 1) { $parts[1].Trim() } else { $User })
            # Join the tail back together so a password containing a comma survives.
            Pass = $(if ($parts.Count -gt 2) { ($parts[2..($parts.Count - 1)] -join ',').Trim() } else { $Password })
        }
    }
} elseif ($Ip) {
    $cameras += @{ Ip = $Ip; User = $User; Pass = $Password }
} else {
    Write-Host 'Give me something to test:' -ForegroundColor Yellow
    Write-Host '  .\Diagnose-Camera.ps1 -Ip 192.168.1.108 -User admin -Password secret'
    Write-Host '  .\Diagnose-Camera.ps1 -ListFile cameras.txt'
    Write-Host '  .\Diagnose-Camera.ps1 -SelfTest'
    exit 2
}

if (-not $Out) {
    $Out = Join-Path (Get-Location).Path ("camera-report_{0}.txt" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

Write-Both ("Shinobi camera diagnostics - {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Both ("ffprobe: {0}" -f $exe)
Write-Both ("cameras: {0}   per-attempt timeout: {1}s" -f $cameras.Count, $TimeoutSec)

$results = @()
foreach ($cam in $cameras) {
    try {
        $results += Test-Camera $cam.Ip $cam.User $cam.Pass $exe $TimeoutSec $ExtraPath $RtspPort
    } catch {
        Write-Both ("CAMERA {0}: diagnostic script error: {1}" -f $cam.Ip, (Hide-Secret $_.Exception.Message))
    }
}

# --- summary table --------------------------------------------------------
Write-Both ''
Write-Both ('=' * 112)
Write-Both 'SUMMARY'
Write-Both ('=' * 112)
Write-Both ("{0,-16} {1,-5} {2,-5} {3,-16} {4,-6} {5,-11} {6,-5} {7,-6} {8}" -f `
        'IP', 'PING', 'RTSP', 'WORKING STREAM', 'CODEC', 'RESOLUTION', 'FPS', 'AUDIO', 'VERDICT')
Write-Both ('-' * 112)
foreach ($r in $results) {
    $b = $r.Best
    if ($b) {
        $verdict = if (@('hevc', 'h265') -contains $b.Info.Codec) { 'H.265 - set substream to H.264' } else { 'OK' }
        Write-Both ("{0,-16} {1,-5} {2,-5} {3,-16} {4,-6} {5,-11} {6,-5} {7,-6} {8}" -f `
                $r.Ip,
            $(if ($r.PingOk) { 'yes' } else { 'no' }),
            $(if ($r.Port554) { 'open' } else { 'shut' }),
            "$($b.Stream)/$($b.Transport)",
            $b.Info.Codec.ToUpper(),
            "$($b.Info.Width)x$($b.Info.Height)",
            $b.Info.Fps,
            $(if ($b.Info.HasAudio) { 'yes' } else { 'no' }),
            $verdict)
    } else {
        $short = 'NO STREAM'
        if ($r.Verdicts.Count -gt 0) {
            $first = "$($r.Verdicts[0])"
            $short = $first.Substring(0, [Math]::Min(62, $first.Length))
        }
        Write-Both ("{0,-16} {1,-5} {2,-5} {3,-16} {4,-6} {5,-11} {6,-5} {7,-6} {8}" -f `
                $r.Ip,
            $(if ($r.PingOk) { 'yes' } else { 'no' }),
            $(if ($r.Port554) { 'open' } else { 'shut' }),
            '-', '-', '-', '-', '-', $short)
    }
}
Write-Both ('-' * 112)
$okCount = ($results | Where-Object { $_.Best }).Count
Write-Both ("{0} of {1} cameras have a working stream." -f $okCount, $results.Count)

# --- raw ffprobe errors, for the cases the classifier could not name ------
Write-Both ''
Write-Both ('=' * 112)
Write-Both 'DETAIL - raw ffprobe errors (passwords removed)'
Write-Both ('=' * 112)
foreach ($r in $results) {
    $failed = $r.Attempts | Where-Object { -not $_.Ok -and $_.Stderr }
    if (-not $failed) { continue }
    Write-Both ''
    Write-Both "$($r.Ip):"
    foreach ($a in $failed) {
        Write-Both ("  {0} {1} {2} -> exit {3}" -f $a.Vendor, $a.Stream, $a.Transport.ToUpper(), $a.ExitCode)
        foreach ($ln in ($a.Stderr -split "`n")) {
            if ($ln.Trim()) { Write-Both "      $($ln.Trim())" }
        }
    }
}

# UTF8 without BOM, so Notepad and the client's mail client both cope.
[IO.File]::WriteAllLines($Out, $script:ReportLines, (New-Object Text.UTF8Encoding $false))
Write-Host ''
Write-Host "Report written to: $Out" -ForegroundColor Cyan

if ($okCount -eq $results.Count) { exit 0 } else { exit 1 }
