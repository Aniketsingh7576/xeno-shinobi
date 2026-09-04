# DEPLOYMENT RUNBOOK — Windows server, NAS over SMB, no internet

Everything you need is in this document. Assume you cannot look anything up at the
site. Placeholders in `<ANGLE BRACKETS>` are the only things you fill in.

Companion documents (Linux install, background, hardware sizing) are listed at the
end. **This runbook is the one to follow for a Windows + NAS + air-gapped site.**

---

## 0. Read this first — the five things that actually go wrong

**1. A UNC path in `videosDir` is silently ignored.**
Shinobi validates the recording directory with a regular expression that does not
accept `\\SERVER\share`. When it rejects a path it does not warn — it falls back to
the local folder `<install>\app\backend\videos\`. You get a running system, live
video, "recording" on every camera, and **nothing on the NAS** while the C: drive
fills up.
Verified on this codebase: `backend/libs/folders.js`, `isValidPath()`.

| Path | Accepted? |
|---|---|
| `C:/ShinobiVMS/videos/` | yes |
| `D:/videos/` | yes |
| `\\NAS01\cctv\video\` | **NO — silently ignored** |
| `//NAS01/cctv/video/` | **NO — silently ignored** |

👉 The fix is a directory **symlink**, Step 2f. Do not skip it.

**2. A Windows service cannot see your mapped drives.**
Drive letters are per-logon-session. `Z:` mapped by you does not exist for the
service. Even the UNC path is not enough on its own — the service must run as an
account that the NAS will accept. Step 2.

**3. The NAS marker file.**
The VMS **refuses to start** unless a file called `.nas-online` is readable inside
the recording directory. This is deliberate: when SMB drops, the folder still looks
present and writable but is now the local disk, and without this check the system
records footage onto C: until it fills. Step 2g.

**4. 15 cameras until the licence is activated — and activation needs internet.**
Camera 16 does not error. It simply never records. Activation calls out to
`licenses.shinobi.video`. On an air-gapped server you cannot do this at the site.
Step 1f tells you how to deal with this **before you travel**.

**5. H.265 shows a black player.**
Browsers cannot decode H.265. Most CP Plus and Dahua units ship with the main
stream on H.265. Set the **substream** to H.264 and point live view at it. Step 4.

---

## 1. Pre-flight — before you touch anything

Do sections 1a–1e at the site, in this order, before installing. Do 1f–1h **in the
office, before you travel.**

### 1a. Server specification

```powershell
# CPU cores and model
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors

# RAM in GB
[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)

# Windows version
(Get-CimInstance Win32_OperatingSystem).Caption

# Local disks: free / total in GB
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID,
    @{n='FreeGB';e={[math]::Round($_.FreeSpace/1GB,1)}},
    @{n='TotalGB';e={[math]::Round($_.Size/1GB,1)}}
```

Minimum to proceed:

- [ ] 8+ physical cores for up to ~50 cameras; 16 cores for 150
- [ ] 16 GB RAM minimum, 32 GB for 50+ cameras
- [ ] **40 GB free on the system drive** — the database, the HLS stream buffer and
      the logs all live locally, never on the NAS
- [ ] Windows Server 2016+ or Windows 10/11 64-bit

If the system drive has under 40 GB free, stop and clear space. The database, the
live HLS segment buffer (`streamDir`) and the logs are all local, and the segment
buffer grows with the number of cameras.

### 1b. Is the camera network reachable from this server?

```powershell
# One camera, to prove routing works at all
Test-NetConnection -ComputerName <CAMERA_IP> -Port 554

# The whole range, quickly
1..254 | ForEach-Object {
  $ip = "192.168.1.$_"
  if (Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue) { $ip }
}
```

- [ ] `TcpTestSucceeded : True` on port 554 for at least one camera

If this fails, nothing else matters. Check that the server has an interface on the
camera VLAN, or a route to it.

### 1c. Are the cameras and the NAS on the same link?

```powershell
Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Select-Object InterfaceAlias, NextHop
Find-NetRoute -RemoteIPAddress <CAMERA_IP>  | Select-Object -First 1 InterfaceAlias, IPAddress
Find-NetRoute -RemoteIPAddress <NAS_IP>     | Select-Object -First 1 InterfaceAlias, IPAddress
Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name, LinkSpeed
```

- [ ] Write down which adapter reaches the cameras and which reaches the NAS

**If both use the same adapter, every megabit arrives on that link and leaves on it
again.** 50 cameras at 4 Mbps is 200 Mbps in and 200 Mbps out — 400 Mbps on a
1 Gbps NIC, which works but leaves no headroom. Above ~80 cameras on a shared
1 GbE link, recording will start dropping segments. Note it in the handover and
recommend a second NIC for the NAS.

### 1d. NAS write test — as **you**, first

This is the easy half. Step 2 does the hard half, as the service account.

```powershell
# What is the NAS actually sharing?
net view \\<NAS_IP>

# Can you reach it and write?
Test-NetConnection -ComputerName <NAS_IP> -Port 445
New-Item -ItemType Directory -Force -Path \\<NAS_IP>\<SHARE>\cctv | Out-Null
"write test $(Get-Date)" | Out-File \\<NAS_IP>\<SHARE>\cctv\write-test.txt -Encoding utf8
Get-Content \\<NAS_IP>\<SHARE>\cctv\write-test.txt
Remove-Item \\<NAS_IP>\<SHARE>\cctv\write-test.txt
```

- [ ] Port 445 open
- [ ] The file was written and read back

### 1e. NAS capacity and throughput

```powershell
# Free space on the share. Get-PSDrive does not work on a bare UNC path;
# the old FileSystemObject COM object does.
$fso = New-Object -ComObject Scripting.FileSystemObject
$drv = $fso.GetDrive("\\<NAS_IP>\<SHARE>")
"{0:N1} TB free of {1:N1} TB" -f ($drv.FreeSpace / 1TB), ($drv.TotalSize / 1TB)

# Sustained write speed: 2 GB file, timed
$f = "\\<NAS_IP>\<SHARE>\cctv\speed.bin"
$sw = [Diagnostics.Stopwatch]::StartNew()
$fs = [IO.File]::Create($f); $buf = New-Object byte[] (8MB)
1..256 | ForEach-Object { $fs.Write($buf,0,$buf.Length) }
$fs.Close(); $sw.Stop()
"{0:N1} MB/s" -f (2048 / $sw.Elapsed.TotalSeconds)
Remove-Item $f
```

Required sustained write speed: **cameras × bitrate ÷ 8**.
30 cameras at 4 Mbps = 15 MB/s. 150 cameras at 4 Mbps = 75 MB/s.

- [ ] Measured speed is at least **twice** the required figure. Below that, footage
      will be lost during retention purges and playback.

Storage needed, per camera, per day, at 4 Mbps: **43 GB**.
`cameras × 43 GB × retention_days` = total. 30 cameras × 30 days = 39 TB.

- [ ] Free space covers the retention the client asked for. If it does not, agree a
      shorter retention **now**, in writing, not after the disk fills.

### 1f. ⚠️ Licence — do this in the office

The server will be air-gapped. Activation needs internet.

1. On the build machine, **with internet**, install the bundle exactly as you will
   at the site (Step 3), open `http://localhost:8080/super`, and activate the
   licence key there.
2. Then **prove it survives being offline**: unplug that machine's network cable,
   restart the service, log in, and check *Storage & Retention → Maximum cameras*.
   - Still shows your licensed number → good, ship the bundle **with that
     `shinobi.sqlite` and `conf.json`**, activated.
   - Dropped back to 15 → the licence re-validates over the internet at every boot,
     and an air-gapped server cannot hold more than 15 cameras. **You need to know
     this in the office**, not at the site. Options at that point: arrange a
     temporary internet path for the server, split across two servers, or renegotiate
     scope with the client.
3. [ ] Result written down here: ______________________

### 1g. Bundle checklist — everything Shinobi needs offline

Build it on a machine **with** internet:

```powershell
powershell -ExecutionPolicy Bypass -File offline-windows\make-bundle.ps1
```

That one script gathers all of it. What it collects, and why:

| Item | Version / source | Why it must be in the bundle |
|---|---|---|
| Node.js runtime | 20.18.1 win-x64 portable zip, nodejs.org | `backend/package.json` requires `>=20 <21`. Do not substitute 22 or 24 — the native addons are compiled for Node 20's ABI (modules 115). |
| npm packages | 49 declared dependencies, ~380 packages installed | Installed with the **bundled** Node so native addons match. |
| Native addons | `pixel-change`, `sqlite3`, `cws` | Compiled `.node` binaries. These are why you cannot just copy `node_modules` from a Linux box. |
| ffmpeg + ffprobe | gyan.dev `ffmpeg-release-essentials` (9.0.1 in this bundle) | ffmpeg does all recording; ffprobe is used for stream probing and by the camera diagnostics tool. |
| WinSW | v2.12.0 x64 | Runs the app as a Windows service with restart-on-crash. |
| Database | **SQLite** — no server, no port, no root password | `conf.json` sets `databaseType: sqlite3`; knex creates the tables on first boot. No schema to import. |
| App source | `backend/`, `frontend/`, `shared/`, `patches/` | |
| Camera diagnostics | `diagnostics\Diagnose-Camera.ps1` + `ffprobe.exe` | The tool for "no picture" at the site. See `offline-windows/diagnostics/README.md`. |

**Not needed offline:** MariaDB/MySQL (SQLite replaces it), Python, Visual Studio
build tools (no compilation happens at install time), Docker, any Shinobi plugin.

**Wants internet but does not block startup:** the licence check (Step 1f), the
Shinobi Hub config backup (leave it off), the ONVIF device manager's firmware
lookups. None of these stop the system running — verified in the rehearsal below.

Copy to the USB stick:

- [ ] the whole `dist\ShinobiVMS-Offline\` folder (~600 MB)
- [ ] USB is NTFS or exFAT — FAT32 cannot hold it
- [ ] this runbook, as a file, on the same stick
- [ ] `diagnostics\` folder, with `ffprobe.exe` in it

### 1h. Rehearse the install in the office

Do the whole of Step 3 on a spare Windows machine **with its network cable
unplugged**, from the USB stick. If it only works with internet, you need to find
that out here.

---

## What was already rehearsed, and what was not

Verified on this machine, from the built bundle:

- ✅ All **49 declared dependencies load** under the bundled Node 20.18.1, native
      addons included (`pixel-change`, `sqlite3`, `cws` all OK, ABI 115).
- ✅ The app **boots from the bundle** and serves: `/` → 200, `/super` → 200,
      static assets → 200.
- ✅ SQLite schema created automatically; 17 tables present.
- ✅ **Zero outbound network connections.** With the server running, its only
      socket was the listener on its own port. The licence check fails fast and
      does not block or delay startup. Air-gapped operation is safe.
- ✅ `INSTALL.bat` performs **no** network access — all it does is write
      `conf.json`, register the WinSW service and start it.
- ✅ ffmpeg 9.0.1 and ffprobe run from the bundle and report the hardware
      acceleration methods available.

Not verified here, and therefore still on you:

- ❌ Installing **as a Windows service** and running as a **non-admin service
      account** — this session had no administrator rights. Step 3 and Step 2 are
      unrehearsed. **Do 1h.**
- ❌ Writing to a real SMB NAS as the service account.
- ❌ Behaviour with the network adapter actually disabled (the evidence above is
      "it opens no outbound sockets", which is strong but is not the same test).
- ❌ Licence activation and whether it survives going offline — Step 1f.

---

## 2. NAS configuration

The service does not run as you. Everything in this section exists to make the NAS
reachable **from the service's identity**.

### 2a. Create the service account

Elevated PowerShell (right-click → Run as administrator):

```powershell
$pw = Read-Host -AsSecureString "Password for shinobisvc"
New-LocalUser -Name shinobisvc -Password $pw -PasswordNeverExpires -AccountNeverExpires `
              -FullName "Shinobi VMS service" -Description "Runs the VMS service"
# Not an administrator. It only needs its own install folder and the NAS.
```

Write the password down somewhere the client can find it. If it is lost, the
service cannot be restarted after a password change.

### 2b. Make the NAS accept that account — pick one

**Method A (recommended): matching credentials.**
Create a user on the NAS with the **same username and password** — `shinobisvc` —
and give it read/write on the share. Windows then authenticates automatically, with
nothing stored anywhere on the server. This survives reboots, profile resets and
password syncs, and there is nothing to forget to configure.

**Method B: `cmdkey`, stored in the service account's own profile.**
Use this when the NAS username cannot be changed.

The catch that costs people an evening: **`cmdkey` stores credentials per user
profile.** Running it as yourself does nothing for the service. It has to run *as*
`shinobisvc`. Two ways:

```powershell
# B1. Interactive: opens a shell running as the service account. Type the
#     password when prompted, then run cmdkey inside that shell.
runas /user:shinobisvc /savecred cmd
#   then, inside the new window:
#     cmdkey /add:<NAS_IP> /user:<NAS_USER> /pass:<NAS_PASSWORD>
#     cmdkey /list
#     exit
```

```powershell
# B2. Non-interactive, via a one-shot scheduled task. Use this if runas is blocked.
schtasks /create /tn ShinobiCredSetup /f /sc once /st 00:00 `
  /ru shinobisvc /rp "<SERVICE_ACCOUNT_PASSWORD>" `
  /tr "cmd /c cmdkey /add:<NAS_IP> /user:<NAS_USER> /pass:<NAS_PASSWORD>"
schtasks /run /tn ShinobiCredSetup
Start-Sleep -Seconds 5
schtasks /delete /tn ShinobiCredSetup /f
```

Add an entry for **both** the IP and the hostname if you use both anywhere:

```powershell
cmdkey /add:<NAS_IP>       /user:<NAS_USER> /pass:<NAS_PASSWORD>
cmdkey /add:<NAS_HOSTNAME> /user:<NAS_USER> /pass:<NAS_PASSWORD>
```

### 2c. Give the account its install folder

```powershell
New-Item -ItemType Directory -Force -Path C:\ShinobiVMS | Out-Null
icacls C:\ShinobiVMS /grant "shinobisvc:(OI)(CI)M" /T
```

`M` is Modify. The service writes `shinobi.sqlite`, `logs\`, `streams\` and
`app\backend\conf.json` here.

### 2d. Move the stream buffer off `C:\Windows\Temp`

By default Shinobi puts its HLS buffer in `C:\Windows\Temp\streams\`. A non-admin
service account frequently cannot write there, and the failure looks like "camera
is recording but live view is black". Put it in the install folder instead — Step 3
does this via `conf.json`, and the `icacls` above already granted access.

### 2e. ⚠️ Prove the **service account** can write to the NAS

This is the test the whole section exists for. Run it **before** configuring
recording. It writes its result to a local file, so it works even if your own
session cannot see the share.

```powershell
New-Item -ItemType Directory -Force -Path C:\ShinobiVMS\logs | Out-Null

schtasks /create /tn ShinobiNasTest /f /sc once /st 00:00 `
  /ru shinobisvc /rp "<SERVICE_ACCOUNT_PASSWORD>" `
  /tr "cmd /c (whoami > C:\ShinobiVMS\logs\nas-test.txt) & (echo svc-write-ok > \\<NAS_IP>\<SHARE>\cctv\svc-write-test.txt && echo WRITE_OK >> C:\ShinobiVMS\logs\nas-test.txt || echo WRITE_FAILED >> C:\ShinobiVMS\logs\nas-test.txt)"

schtasks /run /tn ShinobiNasTest
Start-Sleep -Seconds 8
Get-Content C:\ShinobiVMS\logs\nas-test.txt
schtasks /delete /tn ShinobiNasTest /f
```

Expected output:

```
<SERVERNAME>\shinobisvc
WRITE_OK
```

- [ ] It says `shinobisvc` — the task really did run as the service account
- [ ] It says `WRITE_OK`

If it says `WRITE_FAILED`, **stop.** Go back to 2b. Do not configure recording
until this passes — a system configured past a failing NAS records to C: and
nobody notices for a week.

Clean up: `Remove-Item \\<NAS_IP>\<SHARE>\cctv\svc-write-test.txt`

### 2f. ⚠️ The symlink — because a UNC path in `videosDir` is ignored

See Section 0, item 1. The workaround is a directory **symlink**, which every
process on the machine resolves, unlike a mapped drive.

```powershell
# Elevated. /D makes a symbolic link, which CAN point at a UNC path.
# /J makes a junction, which CANNOT. Use /D.
cmd /c mklink /D C:\ShinobiVMS\nas \\<NAS_IP>\<SHARE>\cctv

# Verify it resolves
Get-Item C:\ShinobiVMS\nas | Select-Object LinkType, Target
dir C:\ShinobiVMS\nas
```

- [ ] `LinkType : SymbolicLink`, `Target : \\<NAS_IP>\<SHARE>\cctv`
- [ ] `dir C:\ShinobiVMS\nas` lists what is on the NAS, not an empty local folder

If `mklink` reports *"You do not have sufficient privilege"*, the prompt is not
elevated. If local-to-remote symlinks have been disabled by policy, re-enable with
`fsutil behavior set SymlinkEvaluation L2R:1` and reboot.

> **Alternative, if symlinks are blocked by policy:** widen the path check in
> `backend\libs\folders.js` — `isValidPath()` — to accept a leading `\\`, and set
> `videosDir` to the UNC path directly. That is a one-line code change; the symlink
> is the no-code-change route and is what this runbook assumes.

### 2g. ⚠️ The marker file

```powershell
"nas-ok" | Out-File \\<NAS_IP>\<SHARE>\cctv\.nas-online -Encoding ascii
Get-Item C:\ShinobiVMS\nas\.nas-online | Select-Object FullName, Length
```

- [ ] The file is visible **through the symlink**, not just on the NAS

It has to live on the NAS itself. That is the whole point: when the NAS goes away
the marker goes with it, and the VMS refuses to start rather than quietly recording
to the local disk.

---

## 3. Install

### 3a. Copy the bundle to local disk

```powershell
robocopy E:\ShinobiVMS-Offline C:\ShinobiVMS /E /R:1 /W:1
```

**Do not run it from the USB stick.** Verify:

- [ ] `C:\ShinobiVMS\node\node.exe` exists
- [ ] `C:\ShinobiVMS\ffmpeg\ffmpeg.exe` and `ffprobe.exe` exist
- [ ] `C:\ShinobiVMS\app\backend\camera.js` exists
- [ ] `C:\ShinobiVMS\shinobi-service.exe` exists

```powershell
C:\ShinobiVMS\node\node.exe -v          # must print v20.x
C:\ShinobiVMS\ffmpeg\ffmpeg.exe -version | Select-Object -First 1
```

### 3b. Write `conf.json` — the NAS version

`INSTALL.bat` writes a **local storage** config with the mount guard switched off.
For a NAS install you must replace it. Create `C:\ShinobiVMS\app\backend\conf.json`
with exactly this, substituting nothing but the port if 8080 is taken:

```json
{
  "port": 8080,
  "databaseType": "sqlite3",
  "db": { "filename": "C:/ShinobiVMS/shinobi.sqlite" },
  "videosDir": "C:/ShinobiVMS/nas/",
  "binDir": "C:/ShinobiVMS/fileBin/",
  "streamDir": "C:/ShinobiVMS/streams/",
  "ffmpegDir": "C:/ShinobiVMS/ffmpeg/ffmpeg.exe",
  "useNullAsDefault": true,
  "cron": {},
  "pluginKeys": {}
}
```

Points that matter:

- **Forward slashes.** Backslashes in JSON need doubling and are a needless way to
  break the file.
- **`videosDir` is the symlink**, `C:/ShinobiVMS/nas/`, never the UNC path.
- **There is no `"requireStorageMount": false` line.** Its absence is what turns the
  NAS marker-file guard *on*. If you copy a config from a local-storage install,
  delete that line.
- `streamDir` is local and on the system drive — that is correct and intended.
- `db.filename` is local. Never put SQLite on an SMB share; it will corrupt.

Verify it is valid JSON before going further:

```powershell
Get-Content C:\ShinobiVMS\app\backend\conf.json -Raw | ConvertFrom-Json
```

### 3c. Superuser credentials

```powershell
Copy-Item C:\ShinobiVMS\app\backend\super.sample.json `
          C:\ShinobiVMS\app\backend\super.json -Force
```

Leave the default for now; you change it in the browser at Step 3g.

### 3d. Try it in the foreground first

Before making it a service, run it by hand so errors land on screen instead of in
a log you have not found yet.

```powershell
Push-Location C:\ShinobiVMS\app\backend
C:\ShinobiVMS\node\node.exe camera.js
```

You are looking for:

```
FFmpeg version : ...
Node.js version : v20.18.1
LIMCO : Web Server Listening on 8080
... is ready.
```

- [ ] It reaches "ready"
- [ ] It does **not** print `FATAL: storage sentinel not found` — if it does, the
      marker file (2g) or the symlink (2f) is wrong. Fix before continuing.

`Ctrl+C` to stop, then `Pop-Location`.

### 3e. Register the service, running as the service account

Edit `C:\ShinobiVMS\shinobi-service.xml` and add a `<serviceaccount>` block before
the closing `</service>`:

```xml
  <serviceaccount>
    <domain>.</domain>
    <user>shinobisvc</user>
    <password><SERVICE_ACCOUNT_PASSWORD></password>
    <allowservicelogon>true</allowservicelogon>
  </serviceaccount>
```

`<domain>.</domain>` means "this machine". `allowservicelogon` grants the account
the *Log on as a service* right, which it does not have by default.

If the file does not exist yet, run `INSTALL.bat` as administrator once to generate
it, then stop the service, edit the XML, and re-register:

```powershell
C:\ShinobiVMS\shinobi-service.exe stop
C:\ShinobiVMS\shinobi-service.exe uninstall
Start-Sleep -Seconds 3
C:\ShinobiVMS\shinobi-service.exe install
C:\ShinobiVMS\shinobi-service.exe start
```

Verify the identity actually took:

```powershell
sc.exe qc ShinobiVMS | Select-String "SERVICE_START_NAME"
```

- [ ] It says `.\shinobisvc`, **not** `LocalSystem`

If it says LocalSystem, the service is authenticating to the NAS as the machine
account and recording will fail. Fix it before going on:

```powershell
sc.exe config ShinobiVMS obj= ".\shinobisvc" password= "<SERVICE_ACCOUNT_PASSWORD>"
```

(The space after `obj=` and `password=` is required. That is not a typo.)

### 3f. Confirm it is running

```powershell
Get-Service ShinobiVMS | Select-Object Name, Status, StartType
Get-Content C:\ShinobiVMS\logs\*.log -Tail 30
Invoke-WebRequest http://localhost:8080/ -UseBasicParsing | Select-Object StatusCode
```

- [ ] Status `Running`, StartType `Automatic`
- [ ] StatusCode `200`

### 3g. First login and password change

1. Open `http://localhost:8080/super`
2. Log in with the credentials in `app\backend\super.json`
3. **Change the password immediately.** Write the new one down for the client.
4. Create the operator account the client will actually use — do not hand over the
   superuser account.

### 3h. Reboot test — do it now, not at the end

```powershell
Restart-Computer
```

After it comes back, without logging in as anyone:

- [ ] `Get-Service ShinobiVMS` shows Running
- [ ] `http://localhost:8080/` answers
- [ ] `dir C:\ShinobiVMS\nas` still shows the NAS

This is where a service running as the wrong account, or a NAS credential stored in
the wrong profile, shows up. Much better here than after you have added 40 cameras.

---

## 4. Per-camera setup

### 4a. In the camera's own web interface, first

Do this **before** adding the camera to the VMS. Open `http://<CAMERA_IP>` and set:

| Setting | Value | Why |
|---|---|---|
| Main stream → encoding | H.264 (H.265 is acceptable if you only record it) | Recording works either way; live view does not |
| Main stream → resolution | native (2 MP / 4 MP) | this is what gets recorded |
| Main stream → bitrate | CBR, 4096 kbps for 2 MP | predictable storage maths |
| **Substream → encoding** | **H.264 — not H.265, not MJPEG** | **this is the one browsers must decode** |
| Substream → resolution | 704×576 or 640×480 | a big substream wastes server CPU on every wall tile |
| Substream → frame rate | 10–15 fps | |
| Time / NTP | server IP or a local NTP source | wrong clocks make playback searches return nothing |
| RTSP port | 554 | |
| Account | a dedicated viewing account, not `admin` | |

The substream H.264 setting is the single most common cause of "camera added, no
picture". If you change nothing else, change that.

### 4b. Confirm the stream before touching the VMS

From the USB stick:

```powershell
.\Diagnose-Camera.ps1 -Ip <CAMERA_IP> -User <USER> -Password '<PASSWORD>'
```

It prints the working RTSP URL, the codec, the resolution and what to change if
anything is wrong. Quote the password in single quotes.

For a whole site at once:

```powershell
.\Diagnose-Camera.ps1 -ListFile cameras.txt -Out site-report.txt
```

- [ ] Every camera reports a working H.264 substream

Fix the cameras that do not, in their web interface, before adding any of them.
Adding a broken camera to the VMS just moves the problem somewhere harder to see.

### 4c. Add the camera to the VMS

Dashboard → **Add Monitor**:

| Field | Value |
|---|---|
| Name | somewhere a human would recognise, e.g. `Gate — East` |
| Mode | **Record** |
| Input type | H.264 / H.265 / H.264+ |
| Protocol | RTSP |
| Host | `<CAMERA_IP>` |
| Port | 554 |
| Username / Password | the camera account |
| RTSP path | the path the diagnostics tool reported, e.g. `/cam/realmonitor?channel=1&subtype=0` |
| RTSP Transport | **TCP** |
| Video codec (recording) | **copy** |
| Audio codec | copy, or no audio |
| Stream type | HLS |
| Stream video codec | **copy** |

**`copy` on both recording and streaming is not optional at scale.** In copy mode
ffmpeg moves packets; the CPU barely notices. Set it to `libx264` and each camera
costs 10–20× more CPU. Thirty cameras re-encoding will bury the server.

### 4d. Live view on the substream, recording on the main stream

This is the arrangement you want: full quality on disk, cheap pixels in the browser.

In the monitor's settings:

1. **Input → Stream Type** → `Only When Watching, Use Substream`
2. Open the **Substream** section and fill in **Input → Full URL Path** with the
   complete substream URL the diagnostics tool reported, credentials included:
   - CP Plus / Dahua: `rtsp://<USER>:<PASS>@<IP>:554/cam/realmonitor?channel=1&subtype=1`
   - Hikvision: `rtsp://<USER>:<PASS>@<IP>:554/Streaming/Channels/102`
3. **Substream → Input → RTSP Transport** → `TCP`
4. **Substream → video codec** → `copy`

- [ ] Stream Type is `Only When Watching, Use Substream`
- [ ] Full URL Path is filled in and is the **substream**, not the main stream
- [ ] Substream RTSP Transport is TCP

Recording stays on the main stream. Live view, the wall and the thumbnails all use
the substream, and the substream process only runs while someone is watching.

### 4e. Verify this one camera before adding the next

- [ ] Live view shows moving video within 15 seconds
- [ ] A file appears: `dir C:\ShinobiVMS\nas\<GROUP_KEY>\<MONITOR_ID>\`
- [ ] Wait 30 seconds — the newest file is **growing**

Only then add the next camera. Adding forty and then debugging is how a
one-evening job becomes a three-day job.

Add them in batches of ten, and after each batch:

```powershell
# One ffmpeg per camera. Two per camera if substreams are on.
(Get-Process ffmpeg -ErrorAction SilentlyContinue).Count

# CPU should stay well under 60% in copy mode
(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
```

---

## 5. Verification before you leave the site

Do every one of these. The export test is the one people skip.

### 5a. Streams

- [ ] Every camera shows live video in the dashboard
- [ ] Every camera's row shows **Recording**, not Watching, Idle or Died
- [ ] `(Get-Process ffmpeg).Count` matches the expected number of cameras
- [ ] Leave the wall open for five minutes — no tile goes black and stays black

### 5b. Recording is really landing on the NAS

```powershell
# Files exist and are recent
Get-ChildItem C:\ShinobiVMS\nas -Recurse -Filter *.mp4 |
  Sort-Object LastWriteTime -Descending | Select-Object -First 10 FullName, Length, LastWriteTime

# ...and they are growing
$f = Get-ChildItem C:\ShinobiVMS\nas -Recurse -Filter *.mp4 |
     Sort-Object LastWriteTime -Descending | Select-Object -First 1
$f.Length; Start-Sleep -Seconds 30; (Get-Item $f.FullName).Length
```

- [ ] The second number is bigger than the first

**And the check that catches the silent failure:**

```powershell
# This folder must stay EMPTY. Anything here means videosDir fell back to local.
Get-ChildItem C:\ShinobiVMS\app\backend\videos -Recurse -ErrorAction SilentlyContinue |
  Measure-Object | Select-Object -ExpandProperty Count
```

- [ ] The count is `0`

If it is not zero, the symlink or `videosDir` is wrong. Go back to Step 2f. You are
recording to the C: drive and the NAS is empty.

### 5c. Playback

- [ ] Open a recording from 10 minutes ago — it plays
- [ ] Scrub to the middle — it seeks
- [ ] Open one from a different camera — it plays

### 5d. ⚠️ Export produces a file that actually plays

The step everyone skips and everyone regrets. An export that produces a 0-byte file,
or an `.mp4` that only VLC will open, is discovered by the client three weeks later
when they need footage for an insurance claim.

1. In the dashboard, pick a recording and export a clip of about a minute.
2. Save it to the desktop.
3. **Open it in Windows Media Player or the Films & TV app** — not VLC. VLC plays
   things no one else will, which is exactly why it is the wrong test.
4. Check it plays, has the right timestamp, and shows the right camera.

```powershell
# Confirm the file is a real, complete video
C:\ShinobiVMS\ffmpeg\ffprobe.exe -hide_banner -v error `
  -show_entries format=duration,size,format_name `
  -show_entries stream=codec_name,width,height `
  -of default=noprint_wrappers=1 "$env:USERPROFILE\Desktop\<EXPORTED_FILE>.mp4"
```

- [ ] `duration` is roughly the length you asked for, and not 0
- [ ] `size` is not 0
- [ ] `codec_name` is `h264`
- [ ] It played in Windows Media Player
- [ ] **You watched the client do this themselves, once**

If the export is H.265, it will not play for them. Change the recording source to
the H.264 stream and re-test.

### 5e. Survives a restart

```powershell
Restart-Computer
```

- [ ] Service comes back on its own, without anyone logging in
- [ ] All cameras return to Recording within two minutes
- [ ] New files continue to appear on the NAS

### 5f. Retention is configured

- [ ] *Storage & Retention* → maximum days set to what the client agreed
- [ ] Days × cameras × 43 GB fits in the NAS free space measured at Step 1e
- [ ] Confirm with the client, out loud, how many days they are getting

### 5g. Handover

- [ ] Client can log in with their own account (not the superuser)
- [ ] Shown: how to find footage by date and time
- [ ] Shown: how to export a clip, and they did one themselves
- [ ] Given: dashboard URL, their credentials, this runbook
- [ ] Told, plainly: **the video is on one NAS. It is not backed up anywhere else.
      Fire or theft loses it.**
- [ ] Told: how to restart the service (`Get-Service` / `Restart-Service ShinobiVMS`
      from an admin PowerShell)

---

## 6. Troubleshooting — by symptom

Work down each list in order. The first checks are the cheap ones.

### "Camera added but no stream"

1. **Run the diagnostics tool.** It answers this in about 20 seconds:
   `.\Diagnose-Camera.ps1 -Ip <CAMERA_IP> -User <U> -Password '<P>'`
2. **Is it H.265?** By far the commonest cause. The player is black, the recording
   file is fine. Camera web interface → substream → H.264.
3. **Is the RTSP path right?** ONVIF discovery finds the camera on port 8000 and
   tells you nothing about its RTSP path. They are independent. The diagnostics
   tool prints the path that works.
4. **Is the password right for RTSP?** On CP Plus and Dahua the RTSP password is
   often not the ONVIF password. Check the camera's account page. Also check for
   `@ : / ? #` or a space in the password — those need URL-encoding and are a
   classic false "wrong password".
5. **TCP vs UDP.** Try switching *RTSP Transport* between TCP and UDP. TCP is the
   right default; some older firmware only offers UDP.
6. **Connection limit.** Many cameras allow only 2–4 simultaneous RTSP clients. If
   you and the NVR and the VMS are all connected, the VMS gets refused. Close the
   camera's own web preview and any other viewer, then restart the monitor.
7. **Port 554 closed.** `Test-NetConnection <CAMERA_IP> -Port 554`. If closed,
   RTSP is disabled or moved — camera web interface → Network → Port.

### "Stream works then drops"

1. **How often?** Check the camera's row in the dashboard, and:
   `Get-Content C:\ShinobiVMS\logs\*.log -Tail 100`
2. **Network saturation.** Recheck Step 1c. If cameras and NAS share one 1 GbE
   link, sustained load will cause exactly this. Confirm with:
   `Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes` sampled
   30 seconds apart.
3. **Camera bitrate set to VBR.** A VBR camera can spike to 3× its nominal rate on
   a busy scene. Set CBR in the camera.
4. **PoE switch overloaded or the camera rebooting.** `ping -t <CAMERA_IP>` and
   watch for gaps. Gaps mean it is the camera or the cable, not the VMS.
5. **UDP packet loss.** If transport is UDP, switch to TCP.
6. **NAS stall.** If several cameras drop at the same instant, suspect the NAS, not
   the cameras. Go to "NAS disconnects" below.
7. **Watch it flap.** `(Get-Process ffmpeg).Count` sampled every 10 seconds. A
   count that keeps changing means processes are dying and being restarted.

### "Recording produces no files"

1. **⚠️ Look at the local folder first.**
   ```powershell
   Get-ChildItem C:\ShinobiVMS\app\backend\videos -Recurse -ErrorAction SilentlyContinue | Measure-Object
   ```
   Anything there means `videosDir` fell back to local — the symlink is broken or
   `conf.json` has a UNC path in it. Step 2f.
2. **Is the symlink alive?**
   `Get-Item C:\ShinobiVMS\nas | Select-Object LinkType, Target` then
   `dir C:\ShinobiVMS\nas`. If the listing fails, the NAS or the credentials are
   gone.
3. **Is the monitor in Record mode?** "Watch Only" shows perfect live video and
   writes nothing. It is a very easy mistake to make.
4. **Can the service account still write?** Re-run the Step 2e scheduled-task test.
5. **Is the NAS full?** Check on the NAS web interface. A full NAS produces exactly
   this symptom.
6. **Is ffmpeg running?** `Get-Process ffmpeg`. No processes means the monitors are
   not starting — check `C:\ShinobiVMS\logs\*.log`.
7. **Is retention deleting faster than recording writes?** If the maximum days
   setting is far too large for the disk, the purge runs constantly. Compare
   *Storage & Retention* against the NAS free space.

### "NAS disconnects"

1. **Did the service stop?** With the marker-file guard on, the VMS refuses to
   start when the NAS is missing — which is correct, and looks like "the software
   crashed". `Get-Content C:\ShinobiVMS\logs\*.log -Tail 20`; look for
   `FATAL: storage sentinel not found`.
2. **Is the NAS up?** `Test-NetConnection <NAS_IP> -Port 445`
3. **Did the credentials expire?** A password change on the NAS breaks Method B
   silently. Re-run Step 2b, then Step 2e.
4. **SMB idle timeout.** Some NAS units drop idle sessions. This is why Shinobi
   writes continuously; if it still drops, raise the session timeout on the NAS,
   or disable SMB signing if the NAS is old and struggling.
5. **After the NAS returns, restart the service:**
   `Restart-Service ShinobiVMS`
6. **Recover the gap.** Footage during the outage is gone. Say so plainly rather
   than letting it be discovered later.

### The system will not start at all

```powershell
Get-Service ShinobiVMS
Get-Content C:\ShinobiVMS\logs\*.log -Tail 50

# Run it in the foreground — errors go to the screen, which is much faster
Push-Location C:\ShinobiVMS\app\backend
C:\ShinobiVMS\node\node.exe camera.js
```

| Message | Cause |
|---|---|
| `FATAL: storage sentinel not found` | `.nas-online` unreadable — NAS down, symlink broken, or credentials gone |
| `FATAL: No FFmpeg found` | `ffmpegDir` in `conf.json` points at nothing |
| `EADDRINUSE` | Port 8080 taken. Change `port` in `conf.json`, or find the culprit with `Get-NetTCPConnection -LocalPort 8080` |
| `SQLITE_CANTOPEN` | `db.filename` path wrong, or the service account cannot write `C:\ShinobiVMS`. Re-run the `icacls` in Step 2c |
| `Cannot find module` | Incomplete copy from the USB. Re-run the `robocopy` in Step 3a |
| Nothing at all in the logs | The service never started. `sc.exe qc ShinobiVMS` — usually a wrong service account password |

### Useful commands, all in one place

```powershell
Restart-Service ShinobiVMS
Get-Service ShinobiVMS
Get-Content C:\ShinobiVMS\logs\*.log -Tail 50 -Wait   # live tail
Get-Process ffmpeg | Measure-Object                        # one per camera
Get-Item C:\ShinobiVMS\nas | Select-Object LinkType,Target
sc.exe qc ShinobiVMS                                       # which account it runs as
Get-ChildItem C:\ShinobiVMS\nas -Recurse -Filter *.mp4 |
  Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

---

## 7. Rollback

If it does not work, back it out cleanly. Do not leave a half-installed system on
the client's server.

### 7a. Stop and remove the service

```powershell
# Elevated
C:\ShinobiVMS\shinobi-service.exe stop
C:\ShinobiVMS\shinobi-service.exe uninstall
Start-Sleep -Seconds 3
Get-Service ShinobiVMS -ErrorAction SilentlyContinue   # should report "not found"

# Any ffmpeg left behind
Get-Process ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
```

`UNINSTALL.bat` in the bundle does the first two steps if you would rather.

### 7b. Take the evidence with you

Before deleting anything, copy this to the USB stick — it is what lets you fix the
problem in the office instead of guessing:

```powershell
$out = "E:\rollback-$(Get-Date -Format yyyyMMdd-HHmm)"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item C:\ShinobiVMS\logs\*                   $out -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item C:\ShinobiVMS\app\backend\conf.json    $out -Force -ErrorAction SilentlyContinue
Copy-Item C:\ShinobiVMS\shinobi.sqlite           $out -Force -ErrorAction SilentlyContinue
Copy-Item C:\ShinobiVMS\shinobi-service.xml      $out -Force -ErrorAction SilentlyContinue
sc.exe qc ShinobiVMS         > "$out\service-config.txt" 2>&1
ipconfig /all                > "$out\ipconfig.txt"
Get-Service ShinobiVMS       > "$out\service-state.txt" 2>&1
```

⚠️ `conf.json` and `shinobi.sqlite` contain credentials. Keep that USB stick with
you, and wipe it when you are done.

### 7c. Undo the changes to the machine

```powershell
# The symlink. Remove-Item on a symlink deletes the LINK, not the NAS contents -
# but use rmdir to be certain of that.
cmd /c rmdir C:\ShinobiVMS\nas

# Stored NAS credentials, if you used Method B
cmdkey /list                       # find the entry
cmdkey /delete:<NAS_IP>

# The install folder
Remove-Item C:\ShinobiVMS -Recurse -Force

# The service account. Only if you created it and it is not used by anything else.
Remove-LocalUser -Name shinobisvc
```

### 7d. Leave the NAS as you found it

```powershell
Remove-Item \\<NAS_IP>\<SHARE>\cctv\.nas-online -ErrorAction SilentlyContinue
Remove-Item \\<NAS_IP>\<SHARE>\cctv\svc-write-test.txt -ErrorAction SilentlyContinue
```

Leave any recordings that were made — that is the client's footage, not yours to
delete. Tell them what is there and how much space it uses.

### 7e. Leave the cameras as you found them

If you changed substream encoding, resolution or NTP settings on the cameras, note
which ones. Either revert them or tell the client exactly what changed and why. A
camera whose substream you changed and then abandoned is a support call for someone
else in six months.

### 7f. Confirm the machine is clean

- [ ] `Get-Service ShinobiVMS` → not found
- [ ] `Get-Process ffmpeg` → nothing
- [ ] `C:\ShinobiVMS` gone
- [ ] `Get-NetTCPConnection -LocalPort 8080` → nothing listening
- [ ] The client knows what was done, what was removed, and what happens next

---

## Companion documents

| File | What it is for |
|---|---|
| `offline-windows/README.md` | Building and installing the offline bundle |
| `offline-windows/diagnostics/README.md` | The camera diagnostics tool — bundling checklist and usage |
| `DEPLOYMENT_GUIDE.md` | The **Linux** install, in plain language |
| `SERVER_REQUIREMENTS_150_CAMERAS.md` | Hardware sizing maths |
| `PRODUCTION_READINESS.md` | The full pre-launch checklist |
