# Pilot risk review — silent failures

Scope: the "reports success while failing" class of bug, on the recording, storage,
restart and Windows/SMB paths. Investigation only — **no code was changed for this
report.**

Read this first:

- **Measured** findings were reproduced on this machine with the bundled ffmpeg and
  the live install. They are facts, not readings.
- **Read** findings come from tracing the code. They are well-supported but not
  executed.
- I checked three things I initially got wrong and they are *not* bugs. They are
  listed under "Checked and cleared" so nobody re-raises them.

The single most urgent item is not a code bug. It is a setting: **this install will
fill its disk in roughly eight hours and then stop recording.** That is first on the
list below.

---

## List 1 — Fix before the pilot

Kept deliberately short. Two of the four need no code change at all.

| # | Item | Change type | Why it qualifies |
|---|------|-------------|------------------|
| 1 | Storage quota is 1 TB on an 80 GB volume | **Setting only** | Certain failure, ~8 h away, silent |
| 2 | Service runs as LocalSystem — cannot reach SMB | **Installer only** | Certain failure if a NAS is used |
| 3 | ffmpeg stderr is never read, so ffmpeg blocks | Code (patch you already wrote) | Measured; camera freezes, no error |
| 4 | Completed recording with a missing file is a silent no-op | Code (add a log line) | Removes your only blind spot on the record path |

### 1. Storage quota is larger than the disk — recording stops in ~8 hours

**What breaks.** Purging is driven by the configured quota, not by free space. The
account quota is `size = "1000000"` MB (1 TB) and retention is `days = "90"`. The
purge threshold is quota × videoPercent × purgeOffset = 1 TB × 90% × 90% ≈ **810 GB**.
The volume holds 80 GB with **23 GB free**. The threshold is unreachable, so nothing
is ever deleted; the disk fills to 0 instead.

Measured growth on this install: ~125 KB/s per camera (~1 Mbps) × 6 cameras ≈
**65 GB/day**. 23 GB free ÷ 65 GB/day ≈ **8.5 hours to full.**

**What the operator sees.** Cameras green and streaming, right up until the disk is
full. Then ffmpeg fails to write, and by finding #3 below it blocks rather than
exits — so the cameras stay "connected" and simply stop recording.

**Likelihood here: certain.** **Severity: total loss of the product's purpose.**

**Fix.** Account Settings → Max Storage Amount. Set it below the usable volume size
with headroom (for an 80 GB volume, ~60000 MB). Also set retention days to something
the quota can actually deliver. No code change.

The existing `/storageStatus` endpoint already classifies this exact condition as
`critical` ("Storage quota is larger than the volume it writes to",
[storageStatus.js:246](backend/libs/webPaths/storageStatus.js#L246)). It is worth
opening that page before you leave site.

**Also decide where footage goes.** At this client the install path will likely be
`C:\ShinobiVMS`, which puts `videos\` on the **OS disk**. A full OS disk stops
Windows, not just recording. Put recordings on a separate volume.

### 2. The Windows service cannot reach an SMB share

**What breaks.** [INSTALL.bat](offline-windows/dist/ShinobiVMS-Offline/INSTALL.bat)
writes a WinSW service definition with no `<serviceaccount>`, so the service runs as
**LocalSystem**. LocalSystem reaches the network as the machine account, which on a
workgroup network is effectively anonymous. Two consequences:

- A UNC path to a credentialed SMB share fails for the service.
- **Mapped drive letters do not exist for a service.** A share mapped as `Z:\` in your
  interactive session is invisible to LocalSystem. `Z:\` will resolve to nothing.

**What the operator sees.** You test the path in Explorer as yourself — it works. The
service then writes somewhere else or fails, and (see #4) says nothing.

**Likelihood: high if a NAS is in the plan; not applicable if recording stays local.**
**Severity: critical.**

**Fix.** Either keep recording on a local volume for the pilot (simplest, and what I
would do), or add a `<serviceaccount>` block to the service XML with a domain/local
account that has rights on the share, and use a UNC path — never a drive letter.

Two related traps if you do go to a NAS:

- `isValidPath()` still rejects UNC. The branch fix
  ([folders.js:8](backend/libs/folders.js#L8)) added drive letters (`C:/`) but the
  repeating group cannot match the leading `\\` of `\\server\share`. A UNC
  `videosDir` still silently falls back to the local default.
- The guard that would have made that loud is **off in the shipped bundle**:
  `"requireStorageMount": false` in
  [conf.template.json](offline-windows/dist/ShinobiVMS-Offline/conf.template.json)
  and [make-bundle.ps1:84](offline-windows/make-bundle.ps1#L84). With the guard
  disabled, the UNC rejection is silent again — exactly the bug you already found,
  re-armed by the packaging.

### 3. ffmpeg blocks forever on a full stderr pipe — MEASURED

**What breaks.** [ffmpeg.js:86-88](backend/libs/ffmpeg.js#L86) spawns the camera
wrapper and attaches only a `'close'` listener to `cameraProcess.stderr`. A `'data'`
listener is attached **only** when `config.debugLog === true && config.debugLogMonitors
=== true`. In the shipped config `debugLog` is `false`, so nothing ever reads that
pipe. In Node a stdio pipe with no `'data'` listener stays paused, so the OS pipe
buffer fills and the writer blocks.

`singleCamera.js` gives ffmpeg the wrapper's own fd 2
([singleCamera.js, `case 2: newPipes[i] = 2`](backend/libs/cameraThread/singleCamera.js)),
so ffmpeg's stderr lands in that same unread pipe.

Measured with the bundled ffmpeg, spawned exactly as `ffmpeg.js` does:

```
WITHOUT drain listener -> ffmpeg produced        48 bytes of output in 6s
WITH    drain listener -> ffmpeg produced   302,491 bytes of output in 6s
```

ffmpeg stops dead. Not slow — stopped.

**What the operator sees.** A camera that is "connected", process alive, that has
silently stopped producing segments and recordings.

**Likelihood.** Depends on how chatty the camera is. With `-loglevel warning` a healthy
camera emits almost nothing and will run for weeks. A camera with RTSP packet loss or
DTS problems emits steadily and will reach the ~64 KB buffer. At a site with five
cameras over days, I would expect at least one to get there. The Alba is the obvious
candidate — it already restarted once unexplained.

**Partial mitigation already present.** `recordingChecker`
([monitor/utils.js:1060](backend/libs/monitor/utils.js#L1060)) force-restarts a
`mode === 'record'` monitor after `cutoff × 1.3` minutes without a completed
recording — ~19.5 min at the current 15-minute cutoff. So the likely symptom is a
**restart loop with ~20-minute recording gaps**, not permanent death. That is a real
mitigation and it lowers this from catastrophic to serious. It also means the failure
is detectable (see the checks below).

**Fix.** You already wrote it. `stream-failure-logging.patch` in the working tree adds
`cameraProcess.stderr.on('data', ...)`, which both captures the diagnostics and drains
the pipe. It is log-only — it does not change a single ffmpeg argument. Of all the code
changes here this is the one I would take, because it also turns findings #4, #1 and
every future camera fault from invisible into visible.

### 4. A completed recording whose file is missing is silently discarded

**What breaks.** [videos.js:105](backend/libs/videos.js#L105),
`s.insertCompletedVideo`. It looks for the file in the monitor directory, then the
default videos directory, then each `addStorage` path. If none has it, the entire
function body is skipped — there is **no `else`**, no log, and the caller's callback is
never invoked, so the `Video Finished` log line in
[monitor/utils.js:1429](backend/libs/monitor/utils.js#L1429) never runs either.

ffmpeg reported a finished segment on fd 8; the file is not there; the system records
nothing anywhere.

**What the operator sees.** Nothing at all. No DB row, no log line, no UI error. The
camera stays green. Footage is simply absent when someone goes looking.

This is the same shape as the three bugs you already found, sitting on the most
important path in the product.

**Likelihood: medium** — it needs a write to have failed first (disk full, permission
denied, share vanished). **Severity: high**, because it is the failure that erases your
evidence that anything went wrong.

**Fix.** An `else` branch that logs. Roughly four lines, no behaviour change. This is
the smallest, safest code change on the list.

---

## List 2 — Monitor and work around

Real, but detectable or avoidable by configuration. No code change.

### 5. Up to 15 minutes per camera is lost and left corrupt on every restart — MEASURED

`-f segment` with mp4 writes the `moov` atom only when a segment closes. Killing
ffmpeg mid-segment produces an unplayable file. Measured with the bundled ffmpeg using
the VMS's own muxer flags:

```
partial segment: 48 bytes
ffprobe: moov atom not found — Invalid data found when processing input
```

Not "partially playable". 48 bytes. With `cutoff = 15` and six cameras, an unplanned
reboot loses **up to 90 camera-minutes** and leaves six corrupt stubs.

**Since confirmed on real footage.** The console instance died unattended at ~14:15 on
2026-09-04. Of the six segments open at that moment, **five are unplayable** — 52-58 MB
each, ~270 MB total, every one failing `ffprobe` with `moov atom not found`. A segment
that closed normally minutes later probes fine (`duration=899.886967`). So the bytes
reach the disk and the footage is still lost. This is no longer a lab result.

**Workaround, no code:** lower Cutoff from 15 to 3-5 minutes per monitor. That caps the
loss window at 3-5 minutes per camera, at the cost of more files.

**Note:** `checkIfVideoIsOrphaned` accepts any file over 10 bytes
([video/utils.js:27](backend/libs/video/utils.js#L27)), so a 48-byte stub would be
inserted as a real recording — an entry in the timeline that will not play. On Windows
this does not currently happen, but only because of finding #6.

### 6. Orphan recovery does not work on Windows

`scanForOrphanedVideos` shells out to a Unix pipeline —
`find "..." -maxdepth 1 -type f -mmin +1 -exec stat -c "%n" {} + | sort -r | head`
([video/utils.js:82](backend/libs/video/utils.js#L82)). Under the service (LocalSystem,
no git-bash on PATH) `find` resolves to `C:\Windows\System32\find.exe`, a text search
tool, and the scan returns nothing. You can see it failing in the current logs:

```
2026-09-04T12:11:01+05:30 find: 'D:/.../videos/CTidgSfzFn/Xp52O88umH80': No such file or directory
2026-09-04T12:28:44+05:30 Orphaned Videos Found and Inserted {"CTidgSfzFn":{}}
```

**Consequence:** a recording that exists on disk but never got a DB row (finding #4) is
**never recovered**. It is invisible in the UI permanently, even though the footage is
right there.

**Workaround:** if footage is ever missing from the UI, check the filesystem directly
before concluding it was not recorded. `libs/uploaders/mount.js:335` has the same
Unix-pipeline assumption.

### 7. The stream watchdog you may be relying on runs in the browser, not the server

`signal_check` (set to 10 on every monitor) has **no backend implementation**. It exists
only in `frontend/assets/js/bs5.liveGrid.js:636` and `bs5.embed.js:322` — it runs in an
operator's browser while a live view is open. On an unattended server it never runs.

The backend equivalents are `recordingChecker` (~19.5 min, `mode === 'record'` only) and
`resetStreamCheck` (60 s, driven by stream data). Do not read "Signal Check: 10" on the
settings page as server-side supervision.

### 8. The service has no health check; "Running" does not mean working

The WinSW definition has `<onfailure action="restart" delay="10 sec"/>`, which only
fires when the process **exits**. A hung node process, or live node with frozen ffmpeg
children (finding #3), is "Running" as far as the SCM is concerned, indefinitely.

There is also no `<delayedAutoStart>`, so after a power cut the service can start
before the network is up. If you later enable `requireStorageMount`, that becomes an
exit-1 crash loop until the share appears — noisy but self-correcting; with the guard
off (as shipped) it silently records to the wrong place instead.

### Checks to leave running

Run these from the box. Each detects a specific finding above.

```powershell
# A) Recording actually landing on disk (findings #1, #3, #4)
#    Every camera should show a file modified in the last ~2 minutes.
Get-ChildItem "D:\...\ShinobiVMS-Offline\videos\CTidgSfzFn" -Directory |
  ForEach-Object {
    $newest = Get-ChildItem $_.FullName -Filter *.mp4 -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    "{0,-16} {1}" -f $_.Name, $(if($newest){"$([int]((Get-Date)-$newest.LastWriteTime).TotalSeconds)s ago"}else{"NO FILES"})
  }

# B) Free space (finding #1) — this is the one that matters most
Get-PSDrive D | Select-Object @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}}

# C) Camera processes alive and not restart-looping (finding #3)
#    Six ffmpeg processes; if their start times keep resetting, they are restart-looping.
Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" |
  Select-Object ProcessId, CreationDate

# D) Leaked snapshot processes (the bug fixed earlier today)
(Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" |
  Where-Object { $_.CommandLine -like '*mjpeg*' }).Count   # should be 0 or 1, never growing
```

Check A is the important one. It is the only check that distinguishes "camera looks
healthy" from "camera is recording", and it reads the disk rather than the app's own
opinion — which is precisely the distinction every bug in this report turns on.

The built-in `/storageStatus` and `/nasStatus` endpoints
(`{apiKey}/storageStatus/CTidgSfzFn`) already cover findings #1 and #2 in a readable
form and are worth opening before you leave site.

---

## List 3 — Note for later

- **`isValidPath` UNC rejection** ([folders.js:8](backend/libs/folders.js#L8)) — only
  matters if you move to a NAS. Fix properly then, alongside the service account.
- **Storage sentinel is checked once at startup only** — a NAS that disappears
  mid-run is never noticed. Irrelevant while storage is local.
- **22 empty `catch` blocks** in `libs/` — I reviewed them; the large majority are
  `JSON.parse` guards where a default is genuinely correct. Not a pilot risk.
- **`purgeDiskForGroup` looks like an empty stub** at
  [user.js:68](backend/libs/user.js#L68). It is not — the empty function is the async
  queue's completion callback and the real work happens in `purgeDiskGroup`. Flagging
  it only so the next reader does not raise it as a bug, as I did.

---

## Checked and cleared — not bugs

Three things I suspected and disproved. Recorded so they are not re-investigated.

1. **"Nothing is recording."** True when I first looked, but correct behaviour: all six
   monitors were `mode = 'start'`, which in this codebase means *watch only*
   ([monitor/utils.js:1602](backend/libs/monitor/utils.js#L1602)). They are now
   `mode = 'record'` and all six are writing mp4 files. Not a bug.
2. **"Age-based deletion is disabled by the shipped `"cron": {}`."** Wrong.
   `config.cron.deleteOld` and `deleteOverMax` both default to `true`
   ([config.js:56-59](backend/libs/config.js#L56)). Deletion is enabled.
3. **"Size-based purging is unimplemented."** Wrong, as noted above — it is wired
   through `diskUsedEmitter` → `runQuery` → `purgeDiskGroup`. The mechanism works; the
   problem in finding #1 is purely that the threshold is set above the disk size.

---

## What I did not cover

Stated plainly so the gaps are not mistaken for clean bills of health.

- **Timer and handle leaks generally.** I confirmed the thumbnail-ffmpeg leak (fixed
  earlier today) and the stderr pipe. I did **not** systematically audit the many
  `setTimeout`/`setInterval` sites for orphaning on the error and restart paths. That
  is the one area of your section 5 I left incomplete.
- **Frontend websocket handler coverage.** I did not enumerate which backend `s.tx`
  event names have no listener in `frontend/assets/js`. `monitor_edit_failed` is your
  known example; there are likely more. This is mechanical to check and worth doing.
- **REST endpoints returning 200 with `ok:false`.** Not enumerated. Your ONVIF example
  is confirmed; I did not sweep the rest of `webServerPaths.js`.
- **Authentication, permissions, and the licence ceiling itself.** Out of scope per
  your framing.
- **Behaviour under an actual disk-full condition.** I did not fill the disk to observe
  it. The chain in finding #1 → #3 → #4 is reasoned from measured components, not
  observed end to end.

---

## One thing worth deciding now

Findings #1 and #2 need no code. Finding #3 is a patch you already wrote and reviewed,
which is log-only. Finding #4 is roughly four lines that add a log line to a path that
currently has none.

If you take only one code change, take #3 — not because that failure is the most
likely, but because it is the change that makes every other failure on this list
visible while you are still on site.
