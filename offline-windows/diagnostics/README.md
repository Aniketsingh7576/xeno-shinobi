# Camera diagnostics — USB stick tool

One PowerShell script that answers *"ONVIF found the camera, so why is there no
picture?"* on a Windows machine with no internet.

Nothing to install. Windows PowerShell is already on every Windows machine; the
only thing you have to carry is `ffprobe.exe`.

---

## Bundling checklist — what to copy onto the USB stick

Copy this whole folder. It must end up looking like this:

```
D:\camera-diag\
    Diagnose-Camera.ps1      <- the script (this repo)
    README.md                <- this file (this repo)
    cameras.txt              <- your site's camera list (you edit this)
    ffprobe.exe              <- YOU MUST ADD THIS. It is not in git.
```

Tick these off before you leave:

- [ ] `Diagnose-Camera.ps1` copied
- [ ] `ffprobe.exe` copied **next to it**. Take it from the Shinobi offline
      bundle: `ShinobiVMS-Offline\ffmpeg\ffprobe.exe`. Using the same binary the
      server uses is the point — if it can't open the stream, neither can Shinobi.
      (`ffmpeg.exe` is not needed. Copy it anyway if there's room, it costs
      nothing and lets you record a 10-second sample by hand.)
- [ ] `cameras.txt` filled in with the site's IPs (see format below), **or**
      you know you'll be passing `-Ip` one camera at a time
- [ ] Self-test run once on your own machine before you travel:
      `.\Diagnose-Camera.ps1 -SelfTest` — all lines must say PASS
- [ ] Run it once against one real camera on your bench, so you know what a
      healthy result looks like before you're staring at a broken one
- [ ] USB stick is NTFS or exFAT (FAT32 chokes on the bundle if you carry the
      installer on the same stick)

Total size: about 130 MB, nearly all of it `ffprobe.exe`.

---

## Running it

Open PowerShell in the folder (Shift + right-click the folder → *Open PowerShell
window here*).

**One camera:**

```powershell
.\Diagnose-Camera.ps1 -Ip 192.168.1.108 -User admin -Password 'Abc@1234'
```

**A whole site, with a report to hand the client:**

```powershell
.\Diagnose-Camera.ps1 -ListFile cameras.txt -Out site-report.txt
```

**If PowerShell refuses to run the script** (execution policy), run it like this
instead — this does not change any machine setting:

```powershell
powershell -ExecutionPolicy Bypass -File .\Diagnose-Camera.ps1 -ListFile cameras.txt
```

Quote the password in single quotes. A password containing `$` or backticks will
be mangled by PowerShell otherwise.

### `cameras.txt` format

One camera per line. Blank lines and `#` comments are ignored.

```
# ip[,user,password]   - if user/password are left off, the -User/-Password
#                        given on the command line are used for that camera.
192.168.1.101
192.168.1.102
192.168.1.150,admin,DifferentPass1
```

### Options

| Option | Default | When you need it |
|---|---|---|
| `-Ip` | — | test a single camera |
| `-ListFile` | — | test a list of cameras |
| `-User` / `-Password` | empty | credentials used for cameras with none in the list file |
| `-Out` | `camera-report_<timestamp>.txt` | where the report goes |
| `-TimeoutSec` | `8` | raise it on a slow link; lower it to scan a big site faster |
| `-RtspPort` | `554` | the site moved RTSP off 554 |
| `-ExtraPath` | — | an RTSP path not in the built-in list, e.g. `-ExtraPath '/live/ch0','/11'` |
| `-Ffprobe` | auto | `ffprobe.exe` isn't next to the script |
| `-SelfTest` | — | prove the script itself works. No camera or network needed. |

Exit code is `0` only if **every** camera produced a working stream, so you can
use it in a batch file.

---

## What it actually does, per camera

1. **Reachability.** Ping, then TCP connect to 554 (RTSP), 80 (web) and 8000
   (ONVIF). If nothing at all answers it stops there and tells you to look at
   cabling, PoE and subnets — no point probing streams on a dead host.

2. **If the RTSP port is closed it stops before probing.** This is deliberate.
   ffprobe does not return "connection refused" against a dead RTSP port — it
   retries the connect until something kills it, so probing would burn two
   minutes per camera and then report the wrong cause.

3. **RTSP patterns.** Eight built-in paths, substream first, over TCP and then
   UDP:

   | Vendor | Substream | Main |
   |---|---|---|
   | Dahua / CP Plus | `/cam/realmonitor?channel=1&subtype=1` | `...&subtype=0` |
   | Hikvision | `/Streaming/Channels/102` | `/Streaming/Channels/101` |
   | Hikvision (older) | `/h264/ch1/sub/av_stream` | `/h264/ch1/main/av_stream` |
   | ONVIF generic | `/onvif2` | `/onvif1` |

   UDP is only retried for a path that TCP proved exists. A 404 or a refused
   connection is about the path or the port, never the transport.

   The first `401 Unauthorized` stops that camera immediately — with a wrong
   password every other path fails identically, and there is no sense spending
   two minutes proving it eight more times.

4. **ffprobe on everything that connects**, reporting codec, resolution, frame
   rate, bitrate and audio.

5. **A plain-language verdict**, e.g.

   - *This camera is H.265. Browsers cannot play H.265. Open the camera web
     interface > Setup > Camera > Video, set the SUBSTREAM encoding to H.264,
     and point live view at the substream.*
   - *RTSP authentication failed. On CP Plus and Dahua the RTSP password is
     often NOT the ONVIF password… also check the password for characters that
     need URL-encoding: `@ : / ? #` and spaces.*
   - *Connected over UDP but not TCP… set RTSP Transport to UDP in Shinobi, OR
     fix the camera: web interface > Network > RTSP, enable TCP.*
   - *Port 554 closed — RTSP may be disabled or on a non-standard port.*

---

## The report

One text file: a per-camera section, then a summary table you can hand over
as-is, then the raw ffprobe errors for anything the classifier couldn't name.

```
IP               PING  RTSP  WORKING STREAM   CODEC  RESOLUTION  FPS   AUDIO  VERDICT
------------------------------------------------------------------------------------------
192.168.1.101    yes   open  substream/tcp    H264   704x576     15    no     OK
192.168.1.102    yes   open  main/tcp         HEVC   2592x1944   15    no     H.265 - set substream to H.264
192.168.1.150    yes   shut  -                -      -           -     -      Port 554 closed - RTSP may be...
```

**Passwords never appear in it.** Every line goes through a redactor before it is
printed or written — the plain password, its URL-encoded form, and anything that
merely *looks* like `user:pass@host` are all replaced with `****`. That includes
ffprobe's own error text, which likes to echo the URL back at you.

---

## How long a scan takes

Fast cases are fast; the slow case is a camera that answers on 554 but never
delivers video.

- unreachable camera: ~4 s
- RTSP port closed: ~6 s
- wrong password: ~10 s (stops at the first 401)
- healthy camera: ~15–30 s
- worst case (port open, nothing streams): about `patterns × 2 × TimeoutSec`,
  so roughly 2½ minutes at the default 8 s

For a 30-camera site budget about 20 minutes, and drop `-TimeoutSec` to 5 if
the network is good.

---

## If the script itself misbehaves

Run `.\Diagnose-Camera.ps1 -SelfTest`. It checks redaction, URL building,
failure classification and ffprobe output parsing, and needs no camera, no
network and no ffprobe. If those pass, the script is fine and what you are
looking at is the camera.
