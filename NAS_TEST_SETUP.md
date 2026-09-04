# 24-hour SMB recording test — setup and verification

Recording from the Shinobi machine to a second Windows desktop over SMB, designed
around the known failure modes in this codebase rather than into them.

## The one thing to understand before you start

You asked for Option A **or** Option B. You need **both**, because they solve two
different problems:

| Problem | Solved by |
|---|---|
| The service runs as LocalSystem and cannot authenticate to the share | **Option A** — run the service as a real account |
| `isValidPath()` rejects UNC, so `videosDir: "\\PC\share"` silently falls back to local | **Option B** — symlink, so Shinobi sees a local path |

Option B alone does **not** fix authentication. A symlink is a pointer, not a
credential: when the service walks through it, Windows opens the UNC target using
*the service's own token*. LocalSystem still fails. So B without A gives you a
service that can see the path and cannot write to it.

Option A alone does not fix the path validation. A UNC `videosDir` is still rejected
and still falls back silently — the exact failure you most want to avoid.

**Do both.** The rest of this document assumes that.

### Verified on your machine before writing this

```
regex: /^([a-zA-Z]:)?([\/\\]?[a-z0-9A-Z\-_. ]+)*[\/\\]?$/

ACCEPT  C:/ShinobiVMS/nasvideos            local path behind a symlink   <- the plan
ACCEPT  Z:/ShinobiVideos                   drive letter
REJECT  \\DESKTOP-B\ShinobiVideos          UNC backslashes               <- must avoid
REJECT  //DESKTOP-B/ShinobiVideos          UNC forward slashes           <- must avoid

Local-to-remote symbolic link evaluation is: ENABLED
ComputerName : LONEWOLF
PartOfDomain : False
Workgroup    : WORKGROUP
```

Two things follow from that last line. You are on a **workgroup, not a domain**, so
authentication uses *mirrored accounts* (explained in stage 1). And local-to-remote
symlink evaluation is enabled, so the symlink approach will work without a policy
change.

---

## Fill these in first

Substitute these throughout. Everything below uses them literally.

| Placeholder | Value | Notes |
|---|---|---|
| `STORAGE-PC` | *your second desktop's name* | `hostname` on that machine |
| `LONEWOLF` | Shinobi machine | already confirmed |
| `ShinobiSvc` | service account name | created on **both** machines |
| `<PASSWORD>` | a strong password | **must not be blank** — Windows refuses blank-password network logons |
| `ROOT` | `D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline` | your current install |
| `CTidgSfzFn` | group key | already confirmed |
| `D:\ShinobiVideos` | storage folder on STORAGE-PC | pick a drive with ~100 GB free |

### Stage 0 — stop the console instance

The instance running now was started from a terminal and dies with that session. The
whole point of this test is to exercise the **service** identity, so the test must run
as the service.

```powershell
# on LONEWOLF
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*camera.js*' } |
  ForEach-Object { taskkill /F /T /PID $_.ProcessId }

Get-Service ShinobiVMS | Select-Object Name, Status, StartType
```

**Verify:** no `node.exe` running `camera.js`, and the service shows `Stopped`.

---

## Stage 1 — the share, and the two permission layers

### Why there are two layers

Windows checks **two independent sets of permissions** when someone reaches a folder
over the network, and you get the **intersection** — the more restrictive of the two
wins. This trips people up constantly because fixing one and not the other looks like
the permissions "didn't take".

- **Share permissions** live on the share object. They apply *only* to access arriving
  over the network. Someone sitting at the storage desktop bypasses them entirely.
- **NTFS permissions** live on the folder on disk. They apply *always* — local or
  network.

So a folder with NTFS "Full Control" behind a share with "Read" is **read-only** over
the network. The usual convention, and what we do here, is: grant the share layer
Full Control to the one account that needs it, and express the real intent in NTFS.

### Which account needs access, and why "mirrored"

The Shinobi service will authenticate to the share **as the Windows account it runs
as**. On a domain there would be one account both machines recognise. You are in a
workgroup, where each machine keeps its own separate account database — `ShinobiSvc`
on LONEWOLF and `ShinobiSvc` on STORAGE-PC are, to Windows, two unrelated accounts.

The workgroup mechanism that makes this work is **mirrored accounts**: create an
account with the **same username and the same password** on both machines. When the
service on LONEWOLF connects, it sends that username and password hash over NTLM;
STORAGE-PC checks them against *its own* local `ShinobiSvc` and lets it in. The
accounts are not linked in any way — they just happen to match.

If the passwords differ by even one character, this fails with "access denied" and no
useful explanation.

### On STORAGE-PC

```powershell
# 1. the folder that will hold footage
New-Item -ItemType Directory -Path D:\ShinobiVideos -Force

# 2. the mirrored account (same name AND password as on LONEWOLF)
$pw = Read-Host -AsSecureString "Password for ShinobiSvc"
New-LocalUser -Name ShinobiSvc -Password $pw -PasswordNeverExpires -AccountNeverExpires
# deliberately NOT added to Administrators - it only needs this one folder

# 3. share layer: Full Control, to that account only
New-SmbShare -Name ShinobiVideos -Path D:\ShinobiVideos -FullAccess "$env:COMPUTERNAME\ShinobiSvc"

# 4. NTFS layer: Modify, inherited by files and subfolders
#    (OI)=object inherit  (CI)=container inherit  (M)=modify
icacls D:\ShinobiVideos /grant "ShinobiSvc:(OI)(CI)(M)"

# 5. let SMB through the firewall
Enable-NetFirewallRule -DisplayGroup "File and Printer Sharing"

# 6. the mount sentinel - this file is what proves to Shinobi the share is really there
Set-Content -Path D:\ShinobiVideos\.nas-online -Value "storage online" -Encoding utf8
```

**Verify, on STORAGE-PC:**

```powershell
Get-SmbShare ShinobiVideos | Format-List Name, Path
Get-SmbShareAccess ShinobiVideos          # expect ShinobiSvc, Allow, Full
icacls D:\ShinobiVideos                   # expect ShinobiSvc:(OI)(CI)(M)
Get-LocalUser ShinobiSvc | Format-List Name, Enabled
Test-Path D:\ShinobiVideos\.nas-online    # expect True
```

Do not move on until `Get-SmbShareAccess` names `ShinobiSvc` and `icacls` shows the
`(OI)(CI)(M)` entry. Those are the two layers.

### On LONEWOLF — the matching half of the mirror

```powershell
$pw = Read-Host -AsSecureString "SAME password as on STORAGE-PC"
New-LocalUser -Name ShinobiSvc -Password $pw -PasswordNeverExpires -AccountNeverExpires
```

**And this is the step people miss:** LocalSystem could read and write the install
directory implicitly. A normal user account cannot. The service needs to write the
SQLite database, the logs and the HLS stream files, so grant it the install tree:

```powershell
icacls "D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline" /grant "ShinobiSvc:(OI)(CI)(M)" /T
icacls "C:\Windows\Temp" /grant "ShinobiSvc:(OI)(CI)(M)"
```

Skip this and the service starts, fails to open the database, and stops — with the
cause buried in the WinSW log.

---

## Stage 2 — point the service at the share

### Option B first: the symlink

```cmd
:: elevated Command Prompt (mklink is a cmd builtin, not a PowerShell cmdlet)
mklink /D "D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\nasvideos" "\\STORAGE-PC\ShinobiVideos"
```

PowerShell equivalent if you prefer:

```powershell
New-Item -ItemType SymbolicLink `
  -Path   "D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\nasvideos" `
  -Target "\\STORAGE-PC\ShinobiVideos"
```

**Why a symlink works for a service when a mapped drive does not.** A drive letter is
created in the **per-logon-session** device namespace. It exists only inside the
session that created it and vanishes with it — which is why `Z:\` mapped in your
desktop session is invisible to a service, and invisible to *you* in an elevated
prompt too. A symlink is a **reparse point stored in the filesystem itself**. It is
part of the volume, identical for every process on the machine regardless of session
or account. Nothing per-user about it.

**What the symlink does not do:** carry credentials. It is a pointer. Traversing it
opens the UNC target with the calling process's token. That is why Option A is still
required.

**Verify:**

```powershell
Get-Item "D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\nasvideos" |
  Select-Object Name, LinkType, Target        # LinkType must be SymbolicLink
fsutil behavior query SymlinkEvaluation       # "Local to remote ... ENABLED"
```

Use a **new, separate** directory name (`nasvideos`), not the existing `videos`.
`INSTALL.bat` does `if not exist "%ROOT%\videos" mkdir` and folders.js does its own
`mkdirSync`; keeping them apart avoids both tripping over the link.

### Option A: run the service as ShinobiSvc

First find which WinSW major version you have — the XML element names changed:

```powershell
cd "D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline"
.\shinobi-service.exe --version
```

Edit `shinobi-service.xml` and add a `<serviceaccount>` block inside `<service>`.

**WinSW v2.x:**

```xml
<serviceaccount>
  <domain>LONEWOLF</domain>
  <user>ShinobiSvc</user>
  <password>PASSWORD_HERE</password>
  <allowservicelogon>true</allowservicelogon>
</serviceaccount>
```

**WinSW v3.x:**

```xml
<serviceaccount>
  <username>LONEWOLF\ShinobiSvc</username>
  <password>PASSWORD_HERE</password>
  <allowservicelogon>true</allowservicelogon>
</serviceaccount>
```

**What `allowservicelogon` does.** Windows refuses to start a service under an account
that lacks the "Log on as a service" privilege (`SeServiceLogonRight`) — you get
error 1069, "The service did not start due to a logon failure", which sounds like a
wrong password and usually isn't. That flag tells WinSW to grant the privilege to the
account at install time so you don't have to go into Local Security Policy.

Now reinstall — the account is baked in at registration time, so an existing service
must be removed and re-added:

```powershell
cd "D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline"
.\shinobi-service.exe stop
.\shinobi-service.exe uninstall
Start-Sleep -Seconds 3
.\shinobi-service.exe install
```

Do **not** start it yet — stage 3 comes first.

> **Trap:** `INSTALL.bat` regenerates `shinobi-service.xml` from scratch every time it
> runs, which will silently delete your `<serviceaccount>` block and put the service
> back to LocalSystem. After this point, never re-run `INSTALL.bat` on this machine
> without re-adding the block.

**Verify the identity actually changed** — this is the whole point of Option A:

```powershell
Get-CimInstance Win32_Service -Filter "Name='ShinobiVMS'" |
  Select-Object Name, State, StartName
```

`StartName` must read `LONEWOLF\ShinobiSvc`. If it still says `LocalSystem`, the XML
block was not picked up and nothing downstream will work.

### Which to use where

**For this 24-hour test: A + B**, as above. It is the arrangement you will use at the
client site, so rehearse it rather than something simpler.

**For the client site: A + B as well, with two changes.** If the site is
domain-joined, use a *domain* service account instead of mirrored local accounts —
authentication is Kerberos and the mirroring trick is unnecessary and won't work.
And at some point fix `isValidPath()` to accept UNC properly, so you can drop the
symlink; it is a workaround for a bug, not an architecture. Until that fix ships, the
symlink is the safer of the two because it is verifiable — you can see the link and
test through it.

---

## Stage 3 — prove the service account can write, before touching Shinobi

This is the step that decides whether anything downstream can possibly work.

**Why your own test proves nothing.** When you open `\\STORAGE-PC\ShinobiVideos` in
Explorer, you go as *you*, with your token and possibly cached credentials Windows
stored earlier. The service goes as `ShinobiSvc`, in a different session, with no
cached credentials and a different token. Those are unrelated code paths. "It works in
Explorer" has never once predicted that a service can write.

We use a scheduled task because it runs a command as an arbitrary account with only
built-in tools — no downloads, which matters for the offline client site.

```cmd
:: elevated Command Prompt on LONEWOLF
:: writes THROUGH the symlink - tests path, credentials and symlink evaluation at once
schtasks /create /tn "ShinobiSvcWriteTest" ^
  /tr "cmd /c echo service-write-ok > \"D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\nasvideos\_svc-write-test.txt\"" ^
  /sc once /st 23:59 /ru "LONEWOLF\ShinobiSvc" /rp "PASSWORD_HERE" /rl LIMITED /f

schtasks /run /tn "ShinobiSvcWriteTest"
```

**Verify — and verify it on STORAGE-PC, reading its own local disk:**

```powershell
# on STORAGE-PC, not on LONEWOLF
Get-Content D:\ShinobiVideos\_svc-write-test.txt
```

You must see `service-write-ok`. If the file is not there, **stop** — Shinobi will not
work, and configuring it further only buries the cause.

Clean up once it passes:

```cmd
schtasks /delete /tn "ShinobiSvcWriteTest" /f
```

### If it fails, work down this ladder

Repeat the task with the target changed to the **raw UNC path**
(`\\STORAGE-PC\ShinobiVideos\_svc-write-test.txt`) to split the symlink out of the
picture:

| Symptom | Meaning | Fix |
|---|---|---|
| UNC works, symlink does not | symlink evaluation or the link itself | re-check `fsutil behavior query SymlinkEvaluation` and `Get-Item ... Target` |
| Neither works, "access is denied" | share or NTFS ACL | re-run `Get-SmbShareAccess` and `icacls` from stage 1 |
| Neither works, "network path not found" | name resolution or firewall | `Test-NetConnection STORAGE-PC -Port 445` |
| Neither works, "logon failure" | passwords do not match | reset both accounts to an identical password |
| Task never ran at all | task credentials | `schtasks /query /tn "ShinobiSvcWriteTest" /v /fo LIST` |

---

## Stage 4 — Shinobi configuration

### conf.json

Edit `...\ShinobiVMS-Offline\app\backend\conf.json`:

```json
{
  "port": 8080,
  "databaseType": "sqlite3",
  "db": { "filename": "D:/xeno-shinobi/xeno-shinobi/offline-windows/dist/ShinobiVMS-Offline/shinobi.sqlite" },
  "videosDir": "D:/xeno-shinobi/xeno-shinobi/offline-windows/dist/ShinobiVMS-Offline/nasvideos",
  "ffmpegDir": "D:/xeno-shinobi/xeno-shinobi/offline-windows/dist/ShinobiVMS-Offline/ffmpeg/ffmpeg.exe",
  "useNullAsDefault": true,
  "requireStorageMount": true,
  "storageSentinelFile": ".nas-online",
  "cron": {},
  "pluginKeys": {}
}
```

Three deliberate choices:

- **`videosDir` is a local path** — the symlink. Never a UNC string, which is silently
  rejected.
- **`requireStorageMount` is back to `true`.** The bundle ships it `false`, which
  disables the one guard that makes a missing share loud. With it on, Shinobi checks
  for `.nas-online` *through the symlink* at startup and **refuses to start** if the
  share is not there, instead of quietly recording to local disk. This is your single
  best protection against being fooled again.
- **The SQLite database and the stream directory stay local.** Do not move either onto
  the share. SQLite over SMB is a well-known corruption risk, and the HLS segments are
  written and deleted every two seconds — putting them on a network path invites
  exactly the playlist-rename problem we already hit. Leaving `streamDir` unset keeps
  it on `C:/Windows/Temp`, which is correct.

### Storage quota — the arithmetic

Measured on your install: **~125 KB/s per camera ≈ 10.8 GB/day**, so six cameras
produce **~65 GB/day ≈ 2.7 GB/hour**.

Purging triggers at `quota × videoPercent(90%) × purgeOffset(0.9)` = **quota × 0.81**.

Set **Max Storage Amount = 20000 MB (20 GB)** in Account Settings.

```
threshold   = 20000 MB × 0.81  ≈ 16.2 GB
time to hit = 16.2 GB ÷ 2.7 GB/h ≈ 6 hours
```

That gives roughly six hours of fill followed by **eighteen hours of continuous
purging to observe** — which is what makes deletion testable rather than assumed.

The second reason for 20 GB is a safety property worth stating explicitly: if purging
turns out to be **completely broken**, 24 hours of recording is ~65 GB against ~100 GB
free. The disk still does not fill, the test still completes, and you find out that
purging is broken without losing the machine. A quota near the disk size would give
you neither answer safely.

**Leave retention days at 90.** At 24 hours nothing ages out, so size-based purging is
the only mechanism in play and any deletion you observe is unambiguously attributable
to it.

### Cutoff

Set **Cutoff = 5** minutes on every monitor (currently 15).

- Caps the loss window on an unexpected restart to 5 minutes per camera instead of 15
  (a killed segment is an unplayable 48-byte file, so this is real footage lost).
- Closes a file every 5 minutes, so "is recording landing?" answers itself quickly.
- Produces more rows and more files, so purging has something to chew on.
- Side benefit: the backend `recordingChecker` fires at `cutoff × 1.3`, so a stuck
  camera is force-restarted after ~6.5 minutes instead of ~19.5.

### Start it and verify

```powershell
Start-Service ShinobiVMS
Start-Sleep -Seconds 20
Get-CimInstance Win32_Service -Filter "Name='ShinobiVMS'" | Select-Object State, StartName
Get-Content "D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\logs\*.out.log" -Tail 30
```

Expect `LIMCO is ready`, no `FATAL: storage sentinel not found`.

### The negative test — do not skip this one

This is the test that proves you *cannot* be silently fooled. It takes two minutes and
it directly exercises the failure that has burned you before.

```powershell
# 1. on STORAGE-PC - hide the sentinel
Rename-Item D:\ShinobiVideos\.nas-online D:\ShinobiVideos\.nas-offline

# 2. on LONEWOLF - restart and watch it refuse
Restart-Service ShinobiVMS
Start-Sleep -Seconds 15
Get-Service ShinobiVMS | Select-Object Status
Get-Content "D:\xeno-shinobi\...\logs\*.err.log" -Tail 20

# 3. on STORAGE-PC - put it back
Rename-Item D:\ShinobiVideos\.nas-offline D:\ShinobiVideos\.nas-online

# 4. on LONEWOLF
Start-Service ShinobiVMS
```

**Expected at step 2:** the service does *not* stay running, and the log carries
`FATAL: storage sentinel not found`. If instead it starts happily and begins
recording, the guard is not working — find out why before running the 24-hour test,
because you have just reproduced the silent-fallback bug live.

---

## Stage 5 — prove recording is landing on the share

Run this **on STORAGE-PC**, reading `D:\ShinobiVideos` directly. Not Shinobi's UI, not
the symlink, not the share path from the other machine — the storage desktop's own
local filesystem. That is the only view nothing in this chain can fake.

```powershell
# on STORAGE-PC
$root = 'D:\ShinobiVideos\CTidgSfzFn'
Get-ChildItem $root -Directory |
  Where-Object { $_.Name -notlike '*_timelapse' } |
  ForEach-Object {
    $f = Get-ChildItem $_.FullName -Filter *.mp4 -ErrorAction SilentlyContinue
    # Sort by NAME, not LastWriteTime: filenames are timestamps and sort correctly,
    # whereas the in-progress file's cached mtime makes it look like the OLDEST.
    $newestName = $f | Sort-Object Name -Descending | Select-Object -First 1
    # Re-stat the newest file DIRECTLY. See the warning below - a directory
    # listing reports the file currently being written as 0 bytes.
    $newest = if ($newestName) { Get-Item $newestName.FullName } else { $null }
    [pscustomobject]@{
      Camera   = $_.Name
      Files    = ($f | Measure-Object).Count
      NewestMB = if ($newest) { [math]::Round($newest.Length/1MB, 1) } else { $null }
      AgeSec   = if ($newest) { [int]((Get-Date) - $newest.LastWriteTime).TotalSeconds } else { $null }
    }
  } | Format-Table -AutoSize
```

**Run it twice, sixty seconds apart.** What you need to see:

- Six camera folders.
- `NewestMB` **larger the second time** — the current segment is growing.
- `AgeSec` in the low seconds.
- `Files` increasing by one per camera every ~5 minutes.

> ### Do not use `Get-ChildItem` alone to judge this — measured on your machine
>
> Windows does not flush the directory entry for a file that has an open write
> handle. A directory listing reports the segment currently being recorded as
> **0 bytes with a timestamp frozen at file creation**, while the file is in fact
> growing normally. Measured on the live install, three samples three seconds apart:
>
> ```
> 13:12:39  Get-ChildItem:  0 bytes / 13:00:01   Get-Item:  97255472 bytes / 13:12:39
> 13:12:42  Get-ChildItem:  0 bytes / 13:00:01   Get-Item:  97517616 bytes / 13:12:42
> 13:12:45  Get-ChildItem:  0 bytes / 13:00:01   Get-Item:  98041904 bytes / 13:12:45
> ```
>
> A check built on the directory listing would have reported a perfectly healthy
> camera as recording nothing for twelve minutes — a false alarm that looks exactly
> like the real failure. `Get-Item` on the full path forces a real query and returns
> the truth. Both scripts here do that; if you write your own check, do the same.
>
> This is local NTFS. Over SMB the caching may differ again, so the direct-stat rule
> matters more, not less.

---

## Stage 6 — the 24-hour watcher

Run on **LONEWOLF** (it needs the process metrics). Save as `nas-watch.ps1` and start
it in its own PowerShell window.

```powershell
$Share    = '\\STORAGE-PC\ShinobiVideos'
$VidRoot  = 'D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\nasvideos\CTidgSfzFn'
$Csv      = 'D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline\logs\nas-test.csv'
$Interval = 180

# GetDiskFreeSpaceEx is the only reliable way to get free space on a UNC path
Add-Type -Name Vol -Namespace W32 -MemberDefinition @'
[DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
[return: MarshalAs(UnmanagedType.Bool)]
public static extern bool GetDiskFreeSpaceEx(string path, out ulong freeAvail, out ulong total, out ulong totalFree);
'@

while ($true) {
    $row = [ordered]@{ Time = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }

    # --- free space on the share (must survive the share vanishing) ---
    $avail = [uint64]0; $total = [uint64]0; $tfree = [uint64]0
    $ok = $false
    try { $ok = [W32.Vol]::GetDiskFreeSpaceEx($Share, [ref]$avail, [ref]$total, [ref]$tfree) } catch { }
    if ($ok) { $row.ShareFreeGB = [math]::Round($avail/1GB, 2) } else { $row.ShareFreeGB = -1 }

    # --- per-camera file counts and sizes ---
    $cams = 0; $files = 0; $mb = 0.0; $worstAge = -1
    if (Test-Path $VidRoot) {
        Get-ChildItem $VidRoot -Directory -ErrorAction SilentlyContinue |
          Where-Object { $_.Name -notlike '*_timelapse' } | ForEach-Object {
            $cams++
            $c = Get-ChildItem $_.FullName -Filter *.mp4 -ErrorAction SilentlyContinue
            if ($c) {
                $files += ($c | Measure-Object).Count
                # Sort by Name: filenames are timestamps, and mtime on the open file
                # is stale, so sorting by mtime picks the wrong file.
                $nName = $c | Sort-Object Name -Descending | Select-Object -First 1
                # Sum the CLOSED segments only - explicitly excluding the newest.
                # The directory listing usually reports the open file as 0 bytes, but
                # not always; excluding it by name is what stops it being counted twice.
                $closed = ($c | Where-Object { $_.Name -ne $nName.Name } |
                           Measure-Object Length -Sum).Sum
                # Then add the in-progress file's TRUE size from a direct stat.
                $n    = Get-Item $nName.FullName
                $mb  += ($closed + $n.Length) / 1MB
                $age = [int]((Get-Date) - $n.LastWriteTime).TotalSeconds
                if ($age -gt $worstAge) { $worstAge = $age }
            } else { $worstAge = 999999 }
          }
    }
    $row.Cameras           = $cams
    $row.Files             = $files
    $row.TotalMB           = [math]::Round($mb, 1)
    $row.WorstNewestAgeSec = $worstAge

    # --- ffmpeg: how many, and how recently the newest one started ---
    $ff = Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" -ErrorAction SilentlyContinue
    $row.FfmpegCount = ($ff | Measure-Object).Count
    if ($ff) {
        $newest = ($ff | Sort-Object CreationDate -Descending | Select-Object -First 1).CreationDate
        $row.NewestFfmpegAgeMin = [int]((Get-Date) - $newest).TotalMinutes
    } else { $row.NewestFfmpegAgeMin = -1 }

    # --- main Shinobi process memory ---
    $node = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -like '*camera.js*' } | Select-Object -First 1
    if ($node) { $row.NodeMB = [math]::Round($node.WorkingSetSize/1MB, 1) } else { $row.NodeMB = -1 }

    [pscustomobject]$row | Export-Csv -Path $Csv -NoTypeInformation -Append
    Start-Sleep -Seconds $Interval
}
```

### What a healthy 24 hours looks like

| Column | Healthy | Problem |
|---|---|---|
| `ShareFreeGB` | falls ~2.7 GB/h for ~6 h, then **flattens** near 80 GB | keeps falling past hour 8 → purging is not working |
| `Files` | rises, then plateaus (purge deleting as fast as recording creates) | plateau never arrives, or drops to near zero → over-purge |
| `TotalMB` | plateaus around 16000-20000 | climbs past 25000 → quota not being enforced |
| `Cameras` | constant 6 | drops → a camera stopped writing entirely |
| `FfmpegCount` | constant 6 | below 6 → camera died; above 7 → leaked processes |
| `NewestFfmpegAgeMin` | climbs steadily, never resets | keeps resetting to 0 → restart loop |
| `WorstNewestAgeSec` | low single/double digit seconds | climbing past ~120 s while `FfmpegCount` is 6 → the silent-freeze case |
| `NodeMB` | rises early, then plateaus | steady climb all 24 h → memory leak |
| `ShareFreeGB = -1` | never | share unreachable at that sample |

The flattening of `ShareFreeGB` around hour 6 is the single most informative thing in
the file. It is purging working, observed rather than assumed.

`NewestFfmpegAgeMin` resetting repeatedly is the signature of the stderr-pipe stall
from the risk review: cameras freezing and being force-restarted by `recordingChecker`
every ~6.5 minutes. If you see that, apply `stream-failure-logging.patch` — it will
tell you what ffmpeg was complaining about.

### Optional fault injection

Two cheap deliberate faults worth more than the quiet hours around them:

**At about T+8h — pull the network cable on STORAGE-PC for 60 seconds.** Expect
`ShareFreeGB` to go to -1, cameras to fail writes, and `recordingChecker` to restart
them within ~6.5 minutes of the share returning. Confirm recording resumes by itself.
This is the closest you can get to a NAS reboot without owning one.

**At about T+12h — `Restart-Service ShinobiVMS`.** Confirm it comes back, then count
the corrupt stubs it left behind on STORAGE-PC:

```powershell
Get-ChildItem D:\ShinobiVideos\CTidgSfzFn -Recurse -Filter *.mp4 |
  Where-Object { $_.Length -lt 10000 } | Select-Object FullName, Length
```

Expect roughly one tiny file per camera — the in-progress segment, unplayable. That is
the reboot cost, measured on your own footage.

---

## Stage 7 — what this test does and does not prove

### It genuinely covers

- **The Windows service identity problem end to end.** Mirrored workgroup accounts,
  both permission layers, "log on as a service", and install-tree ACLs. This is the
  same mechanism as any SMB target and the most likely thing to bite you on site.
- **The `isValidPath()` UNC trap and the symlink workaround**, proven under a real
  service rather than reasoned about.
- **The sentinel guard**, proven by the negative test to actually refuse to start.
- **Size-based purging actually deleting files** — the mechanism, exercised at a small
  quota, observed over 18 hours.
- **ffmpeg writing mp4 segments continuously to an SMB target** for a day at your real
  bitrates, and whether segment closes over SMB behave.
- **Restart and recovery behaviour**, and the real cost in lost footage.
- **Process and memory stability** over a day.

### It does not cover

- **A real NAS is a different SMB server.** A Windows desktop runs Microsoft's SMB
  server; a Synology or QNAP runs Samba. Different dialect negotiation, different
  oplock and lease behaviour, different timeout and reconnect semantics. ffmpeg's
  write pattern can behave differently against Samba. **This is the largest gap.**
- **Domain versus workgroup.** You are testing mirrored local accounts on a workgroup.
  If the client is domain-joined, authentication is Kerberos with a domain account and
  the mirroring is irrelevant — a different setup you will not have rehearsed.
- **RAID behaviour** — degraded arrays, rebuilds, disk failure, the write stalls a
  rebuild causes. A single desktop disk cannot show you any of this.
- **Disk-full behaviour.** Deliberately avoided by sizing the quota. The
  quota → ffmpeg-stall → silent-discard chain in the risk review stays untested end to
  end.
- **Slow leaks.** 24 hours is short. The stderr pipe fill needs a chatty camera and
  possibly days. A memory leak of a few MB/hour will not be obvious.
- **Scale.** Six cameras at ~1 Mbps is ~6 Mbps aggregate — light. More cameras or
  higher bitrates is a different load, and SMB degrades non-linearly.
- **The client's network.** Their switch, cabling, VLANs, and whether anything is on
  Wi-Fi. A desktop on your gigabit LAN is close to a best case.
- **Power-cut behaviour**, unless you do the optional restart injection — and a
  service restart is gentler than losing mains.

### The honest summary

A pass here is a **floor, not a ceiling**. It proves the Windows-side plumbing — the
part that is fiddly, that you are least comfortable with, and that fails in ways that
look like success. That is exactly the right thing to rehearse.

It does not tell you the client's NAS will behave. Budget half a day on site for the
storage path alone, and re-run stages 3, 4 (negative test) and 5 against their actual
hardware before you consider it working. Those three stages are the ones that catch
silent failure, and they take about twenty minutes.
