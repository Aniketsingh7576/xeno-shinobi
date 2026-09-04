# Power-cut and storage-loss tests — B1, B2, B3

Procedure for the three tests that decide whether this system survives an unattended
site. Written 2026-09-04 against the current build.

**Read the "Known blockers" section first.** Three of these will fail as the system is
configured right now, and two of the causes are one-line service settings. Fixing them
before you test saves you a wasted afternoon.

---

## Known blockers — fix before testing, or expect these failures

### 1. The service will not start on boot at all

`sc qc ShinobiVMS` on this machine, today:

```
START_TYPE : 3   DEMAND_START          <- Manual, not Automatic
BINARY_PATH_NAME : "C:\ShinobiVMS-test\shinobi-service.exe"
SERVICE_START_NAME : LocalSystem
```

`INSTALL.bat` writes `<startmode>Automatic</startmode>` into `shinobi-service.xml`, but
the registered service is **Manual**. Whatever the XML says, the SCM is what runs at boot.

**B1 and B4 fail immediately in this state — nothing starts after a power cut.**

Fix, as administrator:

```bat
sc config ShinobiVMS start= delayed-auto
```

`delayed-auto`, not `auto`, and this matters more than it looks. `auto` starts the
service early in boot, before the network stack has finished and long before an SMB share
on another machine is reachable. `delayed-auto` waits until after the boot burst
(typically ~2 minutes), which is roughly when a NAS on the same power circuit becomes
available. Confirm with `sc qc ShinobiVMS` — you want `START_TYPE : 2 AUTO_START
(DELAYED)`.

### 2. It will retry once, then give up

`sc qfailure ShinobiVMS`:

```
RESET_PERIOD (in seconds) : 86400
FAILURE_ACTIONS           : RESTART -- Delay = 10000 milliseconds.
```

One action. Windows takes three: first failure, second failure, subsequent failures.
Only the first is set here, so the sequence is **fail → wait 10 s → fail → stop trying**,
and the failure counter does not reset for a day.

The recorder now deliberately exits non-zero when storage is missing, which is correct —
but with this recovery policy that means one retry, ~10 seconds apart. If the NAS takes
90 seconds longer to boot than the server, the service is dead before storage appears and
**stays** dead.

Fix, as administrator:

```bat
sc failure ShinobiVMS reset= 3600 actions= restart/30000/restart/30000/restart/60000
```

That gives restart after 30 s, again after 30 s, then every 60 s indefinitely, with the
counter resetting after an hour of health. Combined with delayed-auto that is a retry
window of many minutes, which is what B2 requires. Verify with `sc qfailure ShinobiVMS`.

### 3. B3 will fail — storage is only checked at startup

`checkStorageTarget` is called in exactly three places: once at boot
([`folders.js:61`](backend/libs/folders.js#L61)) and in the two configuration save paths.
**Nothing re-checks it while running.** The only periodic loop in `health.js` broadcasts
CPU and RAM to the browser ([`health.js:146`](backend/libs/health.js#L146)) and never
touches the recording volume.

So when the NAS disappears mid-recording:

- no error appears anywhere, because nothing is looking;
- the cameras stay green, because their ffmpeg processes are still alive;
- per finding #3 in [PILOT_RISKS.md](PILOT_RISKS.md), ffmpeg blocks on a full stderr pipe
  rather than exiting, so the processes do not even die to give you a signal.

**Expect B3 to fail on "a visible error while it is gone".** Whether recording resumes
after reconnection is genuinely unknown and worth measuring — that part of the test is
still informative. Run it, record what happens, and score B3 as a documented fail rather
than skipping it.

### 4. The service points at a different install

`BINARY_PATH_NAME` is `C:\ShinobiVMS-test\...`, while the endurance run is a console
instance under `D:\xeno-shinobi\xeno-shinobi\offline-windows\dist\ShinobiVMS-Offline`.
Before any of these tests, decide which install is under test and re-run `INSTALL.bat`
from that bundle so the service and the thing you have been testing are the same code.
Confirm with `Compare-Bundle.ps1 -Target <install>\app`.

---

## Before every test — the baseline

Run this and keep the output. It is what you compare against afterwards.

```powershell
# what the service is configured to do
sc qc ShinobiVMS ; sc qfailure ShinobiVMS

# where recordings are configured to go, and whether the guard is on
Get-Content "<install>\app\backend\conf.json" | ConvertFrom-Json |
    Select-Object videosDir, requireStorageMount, storageSentinelFile

# the marker must exist ON THE NAS, not on the local disk
Test-Path "\\192.168.1.54\shared-cctv\<recdir>\.vms-mount-marker"

# current recorders
Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" |
    Where-Object { $_.CommandLine -like '*ShinobiVMS*' } | Measure-Object
```

Filter ffmpeg by install path, always. A bare `Get-Process ffmpeg` will also match
anything else on the machine.

---

## B2 — NAS unavailable at service start

The likely real sequence at the site: mains returns, both machines boot, the server wins.

### Run

1. Note the time. Shut the NAS down cleanly.
2. Confirm it is gone: `Test-Path \\192.168.1.54\shared-cctv` → `False`.
3. Start the service: `sc start ShinobiVMS`.
4. **Wait 60 seconds.** Do not intervene.
5. Power the NAS on. Note the time it becomes reachable — poll from the server:
   ```powershell
   $t0 = Get-Date
   while (-not (Test-Path '\\192.168.1.54\shared-cctv')) { Start-Sleep 5 }
   "NAS reachable after $([math]::Round(((Get-Date)-$t0).TotalSeconds)) s"
   ```
6. Wait a further 5 minutes, then check the outcome.

### What to watch, while it runs

```powershell
# does it keep trying, and how often?
Get-Content "<install>\logs\ShinobiVMS.err.log" -Wait -Tail 30

# service state over time
while ($true) { "{0}  {1}" -f (Get-Date -f HH:mm:ss), (Get-Service ShinobiVMS).Status; Start-Sleep 5 }
```

### What each outcome means

| What you see | Meaning |
|---|---|
| `FATAL: the recording directory ... is not usable` + `Storage path is UNREACHABLE`, service stops, restarts on the recovery schedule, and starts recording once the NAS appears | **PASS.** This is the designed behaviour |
| Same message, but the service stays Stopped and never retries | Recovery policy — blocker 2 above. Not a code fault |
| Service runs and records, but into `<install>\videos` | **CRITICAL FAIL.** A silent local fallback. This is the failure the whole storage guard exists to prevent; capture `conf.json` and the ffmpeg command line and stop |
| Service runs, cameras appear healthy, nothing on the NAS | **CRITICAL FAIL.** Reporting healthy while recording nothing |
| Service refuses to start and never recovers even after the NAS is up and the retry schedule has run | Real fault. Capture the log and the ffmpeg command line |

### Confirm from the NAS side, not from the app

Both apps have been caught reporting success while doing nothing, so verify from the
storage machine. Sitting **at the NAS**:

```powershell
$dir = 'D:\shared-cctv\<recdir>\CTidgSfzFn'     # local path ON the NAS
Get-ChildItem $dir -Recurse -File -Filter *.mp4 |
    Sort-Object LastWriteTime -Descending | Select-Object -First 10 FullName, Length, LastWriteTime
```

Take the reading twice, five minutes apart. Files must be **new**, not merely present.
Then probe one with ffprobe on the NAS itself — a file that exists but will not play is
still a failure.

---

## B1 — both machines power-cycled together

### Run

1. Everything recording. Note the time and the newest file per camera.
2. Cut power to **both** the VMS server and the NAS. Not a shutdown — pull the power, so
   this exercises the same ungraceful path as a real outage.
3. Restore power to both at the same moment.
4. **Walk away for 15 minutes.** No logging in, no starting anything.
5. Come back and check.

### Pass criteria

- Every camera recording again
- Files landing on the NAS, verified from the NAS
- No manual intervention at any point
- The gap in the timeline is roughly the outage plus the recovery, and is not hidden

### Timing to record, because it decides whether the retry window is enough

| Measure | How |
|---|---|
| Server boot → service first start attempt | Event Viewer, System log, Service Control Manager entries for ShinobiVMS |
| Power on → NAS share reachable | the poll loop in B2 step 5, run from another machine that is already up |
| Difference between the two | this is the number that matters |

If the NAS is slower than the server by more than the retry window, B1 cannot pass no
matter how correct the recorder is. With the recommended
`restart/30000/restart/30000/restart/60000` the window is effectively unbounded, so any
NAS delay is survivable. With today's single 10-second retry, anything over ~15 seconds
of NAS lag fails.

### Also check afterwards

Segments open at the moment power was cut. With the fragmented-MP4 change now in place
they should be **playable and simply short**, not zero-length stubs:

```powershell
$fp = '<install>\ffmpeg\ffprobe.exe'
& $fp -v error -show_entries format=duration -of csv=p=0 "<last file before the cut>"
```

A duration means the change did its job. `moov atom not found` means it did not, and that
is worth knowing immediately.

---

## B3 — NAS disappears mid-recording

Run it even though it is expected to fail, because the recovery half is unknown.

### Run

1. Everything recording. Note the newest file per camera.
2. Unplug the NAS network cable. Note the time.
3. Wait 5 minutes. Watch the UI and the log.
4. Reconnect. Note the time.
5. Wait 5 minutes, then check.

### What to record

| Question | Expected today |
|---|---|
| Does the UI show an error? | **No** — nothing re-checks storage after boot |
| Do the cameras go red? | **No** — ffmpeg stays alive and blocks |
| Does anything appear in the log? | Probably not |
| Does recording resume after reconnect? | **Unknown — this is the part worth measuring** |
| Is there a gap, and is it honest? | Unknown |
| Are the segments spanning the outage playable? | Should be, with fragmented MP4 |

If recording does not resume without a restart, that is a second finding on top of the
missing error, and it changes the priority of adding a periodic storage check.

### The fix this test is arguing for

A periodic re-check: call `checkStorageTarget` on a timer, and on transition to unhealthy
raise a visible error and stop the affected cameras rather than letting them write into a
void. `backend/libs/storageCheck.js` already does exactly the check needed. Note the
measured caveat recorded in that file: a `statSync` against an unreachable host takes
**~21 seconds** to fail, so this must not run on the main thread — 21 seconds of blocked
event loop would stop every camera, which is worse than the problem.

---

## Scoring

Record actual observations, not just PASS/FAIL, and file them into
[ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md).

| Test | Expected outcome as configured today |
|---|---|
| B1 both power-cycled | **FAIL** until start type is delayed-auto and recovery is three actions |
| B2 NAS late | **FAIL** on the retry window; the refuse-to-start half should pass |
| B3 NAS drops mid-recording | **FAIL** on visible error; resumption unknown |
| B4 service auto-starts on boot | **FAIL** — service is Manual |

Three of the four failures are service configuration, not code. Fix those two `sc`
commands first and re-run; what remains after that is the real result.
