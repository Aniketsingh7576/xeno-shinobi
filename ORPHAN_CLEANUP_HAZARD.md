# Windows recording hazards: footage that exists but cannot be seen, and processes that outlive their parent

**Status: NOTHING HERE IS FIXED. Recorded so it is not forgotten.**
Found 2026-09-04 while verifying the storage-path fix. Nothing in this note has been
changed in the code.

Two separate hazards, related by the same Windows weakness:

1. [Retention deletes DB rows even when the files cannot be deleted](#hazard-1)
2. [Killing the service orphans every ffmpeg child](#hazard-2)

<a name="hazard-1"></a>
## Hazard 1 — retention deletes DB rows even when the files cannot be deleted

## The short version

When the NAS is unavailable, the retention job deletes the database rows for expired
recordings anyway, because the row deletion does not depend on the file deletion having
worked. On its own that is defensible — the rows were expiring regardless. The problem is
what it combines with: **orphan recovery is broken on Windows**, so any recording that
loses its row can never get one back. A transient NAS blip during the retention pass
therefore makes footage that is still on disk permanently invisible in the UI.

This is a data-integrity bug, not a cosmetic one: the footage exists, and the operator
cannot find it or export it.

## Mechanism

### 1. The row delete is unconditional

[`backend/libs/cron/worker.js:194-243`](backend/libs/cron/worker.js#L194) —
`deleteVideosByDays` selects expiring rows, loops over them unlinking each file, then
issues one `delete` against the **same where-clause**:

```js
for (i = 0; i < videoRows.length; i++) {
    ...
    try{
        await fs.promises.unlink(dir + filename)
        ...
    }catch(err){
        normalLog('Video Delete Error',row)   // logged, and that is all
        normalLog(err)
    }
}
const deleteResponse = await knexQueryPromise({
    action: "delete",
    table: "Videos",
    where: whereQuery                          // runs whether or not any unlink worked
})
```

Nothing accumulates the failures, and nothing narrows the delete to the rows whose files
actually went away. If the share is unreachable for the duration of the pass, every
`unlink` throws, every row is still deleted, and the only trace is `Video Delete Error`
lines in the log.

There is a variable that looks like it was meant for exactly this —
`alreadyDeletedRowsWithNoVideosOnStart` at
[`worker.js:99`](backend/libs/cron/worker.js#L99) — declared and never read anywhere.
Likewise `config.cron.deleteNoVideo` is defaulted in two places
([`config.js:57`](backend/libs/config.js#L57),
[`worker.js:23`](backend/libs/cron/worker.js#L23)) and never consumed. Both suggest an
intended guard that was not finished.

### 2. Orphan recovery cannot put the rows back on Windows

[`backend/libs/video/utils.js:82`](backend/libs/video/utils.js#L82) — `scanForOrphanedVideos`
writes a shell script and runs it with `sh`:

```
find "<videos dir>" -maxdepth 1 -type f -mmin +1 -exec stat -c "%n" {} + | sort -r | head -n <max>
```

Under the Windows service (LocalSystem, no git-bash on PATH) `find` resolves to
`C:\Windows\System32\find.exe`, a text-search tool that does not understand these
arguments, and the scan returns nothing. This is finding #6 in
[PILOT_RISKS.md](PILOT_RISKS.md) and it is visible in the current logs:

```
2026-09-04T15:52:00+05:30 Orphaned Videos Found and Inserted {"CTidgSfzFn":{}}
```

An empty result every time, on an install that does have recordings on disk.

### 3. The two together

| | |
|---|---|
| NAS drops during a retention pass | rows deleted, files survive on the NAS |
| NAS returns | files are there, rows are gone |
| Orphan scan runs | returns nothing on Windows, so no row is ever recreated |
| Operator looks for the footage | not in the timeline, not exportable, no error shown |

The window does not have to be long. The retention pass only has to overlap a blip.

## What is not yet known

- **How much footage a single pass can affect.** `deleteVideosByDays` selects every row
  older than the retention window in one query, so the blast radius is "whatever expired
  since the last pass" — normally small, but large after any period where cron was not
  running.
- **Whether the NAS being unreachable makes `unlink` throw promptly or hang.** Measured
  separately during this session: a `stat` against an unreachable host took **21 seconds**
  to fail. If `unlink` behaves similarly, a pass over many rows could stall for a long
  time, which changes the shape of the problem (a stalled pass may be safer than a fast
  failing one, since fewer rows get through).
- **Whether the same pattern exists in the other deleters** — `deleteOldTimelapseFrames`
  ([worker.js:318](backend/libs/cron/worker.js#L318)) and `deleteOldFileBins`
  ([worker.js:472](backend/libs/cron/worker.js#L472)) were not examined.
- **Whether `mode=archive` rows are protected.** The where-clause excludes `archive != 1`,
  so archived footage appears to be exempt, but this was not tested.

## Related, already recorded elsewhere

- [PILOT_RISKS.md](PILOT_RISKS.md) finding #4 — a completed recording whose file is missing
  is silently discarded, which is the other way a file ends up with no row.
- [PILOT_RISKS.md](PILOT_RISKS.md) finding #6 — orphan recovery broken on Windows, the
  half of this that makes the loss permanent.
- [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) B3 (NAS disappears mid-recording) and C3
  (retention is honoured) — neither currently exercises a retention pass *during* an
  outage, which is the case that triggers this.

## Directions, when it is time to fix

Not decided, listed so the thinking is not lost:

1. **Narrow the delete to what actually got deleted.** Collect the ids whose `unlink`
   succeeded (plus those that failed with ENOENT — already gone is fine) and delete only
   those. Rows whose file could not be reached stay, and expire on a later pass.
2. **Gate the whole pass on storage health.** `backend/libs/storageCheck.js` now exists and
   does exactly this check; calling `checkStorageTarget` once at the top of the cron tick
   and skipping the pass when it fails would prevent the situation rather than handle it.
   Cheap, and it also protects the other deleters.
3. **Fix orphan recovery on Windows** so a lost row is recoverable regardless — replace the
   `find`/`sh` pipeline with `fs.readdir` plus `fs.stat`, which needs no shell at all. This
   is worth doing on its own merits; finding #6 has other consequences.

(1) or (2) stops the bleeding; (3) is what makes the failure survivable when it does
happen. They are independent.

---

<a name="hazard-2"></a>
## Hazard 2 — killing the service orphans every ffmpeg child

**MEASURED, 2026-09-04, path-filtered so VMS-Go's processes are excluded.** Shinobi's
parent was stopped with `Stop-Process -Force`:

```
Shinobi parent PID     : 12664
BEFORE  shinobi ffmpeg : 1   (PID 11360)
AFTER   shinobi ffmpeg : 1   (PID 11360 - the same process)
parent alive after kill: False
ORPHANED               : 1 of 1   (100%)
```

The child kept the same PID, so it plainly survived rather than being restarted.

**The same test against VMS-Go, on the same machine, minutes later:**

```
BEFORE  vms-go ffmpeg : 8
(Stop-Process -Force on vms.exe)
AFTER   vms-go ffmpeg : 0
ORPHANED              : 0 of 8   (0%)
```

VMS-Go puts its children in a Windows job object and the OS reaped all eight the moment
the parent died. Shinobi does not, and leaks 100% of them. That is the whole difference,
and it is worth quoting in the acceptance-test scoring.

(An earlier version of this note said "9 orphans". That was wrong: it counted VMS-Go's 8
processes, which were never Shinobi's children. The rate is what matters, and it is 100%.)

The mechanism is not in doubt even without that number. The children are spawned as
ordinary processes with no Windows **job object** binding them to the recorder's lifetime,
so when the parent dies they are reparented and keep running. The repo already documents
the same failure from another angle: the header of
[`test/snapshotTimeout.js`](test/snapshotTimeout.js) describes `worker.terminate()` killing
the JS thread without running its exit handler, leaving any live ffmpeg orphaned.

### Why this matters at scale

One orphan on a one-camera install is a nuisance. The reason to record it is that it scales
linearly: at the pilot's target of ~110 cameras, one ungraceful stop would leave on the
order of 110 ffmpeg processes running with no supervisor. They keep the camera RTSP sessions open, keep writing to the
recording volume, and keep holding file handles. The consequences compound:

- **The restart cannot get its cameras back.** Measured on this machine: the cameras
  refuse a third concurrent RTSP session (`DESCRIBE` succeeds, `SETUP` fails with
  `404 Stream Not Found`, on both TCP and UDP). Orphans holding the old sessions will lock
  the new instance out of its own cameras until someone kills them manually.
- **Two writers on the same segment path.** The orphan and the new process both write
  under `videos/<group>/<mid>/`, so the newer file can be truncated or interleaved.
- **It is invisible.** The service reports Stopped while 110 processes are still running.

### It also produces unplayable footage, every time

The segment open at the moment of the kill is left without a `moov` atom. Confirmed on
this machine with the bundled ffprobe, immediately after the restart above:

```
2026-09-04T15-51-51.mp4   h264 1280x720  duration=489.8s  53.1 MB   OK
2026-09-04T15-45-00.mp4   moov atom not found                        CORRUPT
2026-09-04T15-30-00.mp4   h264 1280x720  duration=899.9s  108.5 MB  OK
```

`2026-09-04T15-45-00.mp4` is 40 MB on disk and has **no row in the `Videos` table**. That
is the good news and the bad news: the timeline will not offer footage that cannot play,
but the file is now invisible to the UI *and* to retention, which only ever deletes rows
it can see. Nothing will ever reclaim it, and orphan recovery cannot re-index it
(Hazard 1, section 2). At 110 cameras that is ~110 unreclaimable files per restart.

This is finding #5 in [PILOT_RISKS.md](PILOT_RISKS.md) ("up to 15 minutes per camera is
lost and left corrupt on every restart"), now reproduced end to end and tied to the row
that never gets written.

### One more thing seen in the same data

The `Videos` table contains a duplicate row for `2026-09-04T14-23-44.mp4` — the same file,
same size, twice. The orphan-scan comment at
[`video/utils.js:75`](backend/libs/video/utils.js#L75) describes exactly this ("a premature
phantom row which the completed-segment insert then duplicates"). Not investigated further.

### Directions, when it is time to fix

1. **Put the children in a Windows job object** with
   `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, so the OS reaps them when the recorder dies,
   however it dies. This is the only approach that survives `TerminateProcess` — a
   graceful-shutdown handler does not run when the process is killed. VMS-Go solved the
   same problem this way in `internal/procgroup`; that code is worth reading first.
2. **Reap on startup as a backstop.** Before starting monitors, kill any ffmpeg whose
   command line points at this install's directories. Cheaper than (1), catches the common
   case, and does not help if the machine is not restarted.

(1) is the real fix. (2) is worth having anyway, because it also clears orphans left by a
power cut.

### Housekeeping for whoever is testing

Filter by path when clearing ffmpeg. `Get-Process ffmpeg | Stop-Process -Force` also kills
VMS-Go's live test, which runs from `D:\vms-go\live-test\ffmpeg\`. Shinobi's ffmpeg lives
under the Shinobi install directory:

```powershell
Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" |
    Where-Object { $_.CommandLine -like '*ShinobiVMS-Offline*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

---

## Proposal for the unreclaimable-segment leak (investigated 2026-09-04, NOT applied)

Two options were asked for. They are independent; (b) is the one that reclaims space, (a)
is the one that stops creating the problem.

### Facts the sizing rests on

- `processKill` ([`monitor/utils.js:90-118`](backend/libs/monitor/utils.js#L90)) **already
  closes ffmpeg gracefully**: it writes `q\r\n` to stdin, waits 5s, then `taskkill /pid /t`
  (no `/f`), then a last resort. Sending `q` is exactly what makes ffmpeg write the moov.
  The machinery exists and works.
- **Nothing calls it on process shutdown.** `backend/camera.js` installs no `SIGINT` /
  `SIGTERM` / `exit` handler at all. When the recorder dies, each camera's ffmpeg is simply
  abandoned — measured: 1 of 1 children orphaned.
- The per-camera worker's own `exitAction`
  ([`cameraThread/singleCamera.js:72-86`](backend/libs/cameraThread/singleCamera.js#L72))
  uses `taskkill /f /t` — a **force** kill, which is precisely what truncates the segment.
- The service definition written by `INSTALL.bat` has no `<stoptimeout>` and no
  `<stopparentprocessfirst>`, so WinSW's stop path is its default. A Node process under
  WinSW does not reliably receive SIGINT/SIGTERM.

### (a) Close segments cleanly on shutdown

**What:** add a shutdown handler to `camera.js` that iterates the running monitors, calls
the existing `processKill` for each, and waits — with one overall deadline — before
exiting. Change `singleCamera.js`'s `exitAction` to try `q` on stdin before `taskkill /f`.

**Size:** small. ~30-50 lines, no new dependencies, reusing `processKill` unchanged.

**Risk:** moderate, and the benefit is narrower than it looks.

- It only fires on a *graceful* stop. It does nothing for `TerminateProcess`, a power cut,
  or an OOM kill — the cases that actually produce the stubs in the field.
- Under WinSW as currently configured, the handler may never run at all. Making this
  worthwhile probably means also adding `<stoptimeout>` and a stop signal to the service
  XML, which is a second change to a file that installs the service.
- At 110 cameras, flushing serially could exceed the service stop timeout and get the
  process killed mid-flush — leaving stubs anyway, on a subset of cameras. Needs a bounded
  overall deadline and parallel flush.

**Verdict:** worth doing, but it reduces the frequency of the problem rather than removing
it. It does not make the existing stubs go away.

### (b) Sweep unplayable orphans at startup

**What:** at startup, list `videos/<ke>/<mid>/*.mp4`, find files with no row in `Videos`,
and for each: `ffprobe` it; if valid, insert the row (this is the orphan *recovery* that is
currently broken); if invalid, quarantine or delete.

**Size:** moderate. The scan itself is small once the `find`/`sh` pipeline is replaced with
`fs.readdir` + `fs.stat` (~40 lines, and it fixes finding #6 as a side effect). The
ffprobe-per-orphan step adds a spawn per file and needs a concurrency cap.

**Risk:** this one **deletes footage**, so it is the higher-risk option by a distance.

- A false negative destroys evidence. Mitigations, all necessary: never touch a file
  younger than ~2× the segment length (the in-progress segment must be untouched); require
  ffprobe to be present and fail closed if it is not; **quarantine to a folder rather than
  delete**, at least for the first deployment.
- Startup cost: 110 cameras × N orphans × one ffprobe each, before recording starts. Needs
  a cap and should not block monitor start.

**Verdict:** the valid-orphan half (re-index) is pure gain and low risk — it recovers
footage that is currently invisible, and once a file has a row, normal retention will
reclaim it without any delete logic of ours. The invalid-orphan half should quarantine, not
delete, until it has run on a real site for a while.

### Recommended order

1. Replace the `find`/`sh` orphan scan with `fs.readdir` (fixes finding #6, low risk).
2. Re-index valid orphans — retention then reclaims them on its own schedule.
3. Quarantine unplayable orphans; revisit deleting them once the quarantine folder shows
   it only ever catches genuine stubs.
4. Graceful shutdown (a), together with the service XML changes it needs.

Steps 1-3 shrink the existing leak with no new delete path. Step 4 slows new stubs.
Neither removes the underlying cause, which is (Hazard 2) the absence of a job object.
