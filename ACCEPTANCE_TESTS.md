# VMS Acceptance Tests — must pass on both Shinobi and VMS-Go

The same tests, run identically against both apps, so the deployment decision is made on
evidence rather than preference. Record PASS / FAIL / NOT TESTED for each, with a note.
A test only passes if verified **from outside the app** — reading the storage
filesystem directly, not the app's own UI, because both apps have already been caught
reporting success while doing nothing.

**Any FAIL in group A or B is a blocker.** Do not deploy an app that fails one.

Setup for the storage side of these tests is in [NAS_TEST_SETUP.md](NAS_TEST_SETUP.md).
Known Shinobi failure modes and their evidence are in [PILOT_RISKS.md](PILOT_RISKS.md).

---

## Group A — Recording actually happens

### A1. Recording lands on the NAS
Configure recording to the NAS path. Run 4 cameras for 30 minutes. Then, **sitting at
the NAS or another machine**, confirm files exist, are growing, and are non-trivial in
size.

*Fails if:* files are on the local disk instead, or the folder is empty while the UI
says Recording.

### A2. Recorded files are actually playable
Take three files produced by A1 and open them with `ffprobe` and VLC. Confirm valid
duration, correct codec, and that video plays.

*Fails if:* files exist but are corrupt, zero-length, or missing a `moov` atom.

### A3. Playback and export work
Through the app's own UI, find footage from a specific time window, play it, and export
a clip. Open the exported file outside the app.

*Fails if:* the timeline shows footage that won't play, or export produces a file that
doesn't open.

### A4. Recording survives a service restart
Restart the service while recording. Confirm all cameras resume recording within a
couple of minutes and the gap in the timeline matches the restart duration.

*Fails if:* any camera does not come back, or the gap is silently hidden.

---

## Group B — Power cut and unattended recovery

This is the scenario the client will actually experience. Test it properly.

### B1. Both machines power-cycled together
With everything recording, cut power to **both** the VMS server and the NAS. Restore
power to both at the same time. Walk away. Come back in 15 minutes.

Expected: every camera recording again, files landing on the NAS, no manual
intervention.

*Fails if:* the service didn't auto-start, or is running but recording nothing, or is
recording to a local fallback path.

### B2. NAS unavailable at service start
The hard case, and the likely real-world sequence — the server boots faster than the
NAS.

Shut down the NAS. Start the VMS service. Wait 60 seconds. Then start the NAS.

Expected: the app either waits and starts recording once storage appears, or fails
loudly and retries. **It must not record to a local fallback, and must not report
healthy while recording nothing.**

*Fails if:* it silently records elsewhere, or sits idle with no error visible.

### B3. NAS disappears mid-recording
While recording, disconnect the NAS (unplug its network cable). Wait 5 minutes.
Reconnect.

Expected: a visible error while it's gone, and recording resumes automatically after
reconnection.

*Fails if:* cameras stay green while writing nothing, or recording doesn't resume
without a restart.

### B4. Service auto-starts on boot
Reboot the VMS server. Confirm the service starts by itself and recording resumes,
without anyone logging in.

*Fails if:* it requires a login or a manual start.

---

## Group C — Storage management

### C1. Old footage is deleted when storage fills
Set the retention quota below the available space so purging triggers during the test.
Run until the quota is reached. Confirm old files are deleted and recording continues.

*Fails if:* the disk fills instead, or recording stops, or deletion never triggers.
(Shinobi currently fails this by default — the quota ships larger than the volume.)

### C2. Disk-full behaviour
Fill the storage volume deliberately. Observe.

Expected: a clear, visible error. Cameras must not appear healthy.

*Fails if:* cameras stay green while recording nothing.

### C3. Retention is honoured
Confirm footage older than the configured retention is removed, and footage inside it
is kept.

---

## Group D — Cameras and vendors

### D1. Multi-vendor connection
Connect every camera vendor available (CP Plus, Alba, and any others). Confirm each
streams and records.

*Fails if:* any vendor cannot be added or streams unreliably.

### D2. H.265 handling
For a camera set to H.265, confirm the app either plays it in the browser or clearly
tells the operator it can't. Confirm the H.264 substream approach works for live view
while H.265 records.

*Fails if:* the operator gets a black tile with no explanation.

### D3. Camera reboot recovery
Reboot a camera while recording. Confirm the app reconnects automatically and the
timeline shows a correct gap.

### D4. Camera offline for an extended period
Disconnect a camera for 30 minutes. Confirm the app shows it as offline (not
"Initializing" forever), keeps retrying, and recovers when it returns.

---

## Group E — Endurance

### E1. 24-hour continuous run
Run all cameras for 24 hours. Sample every 5 minutes and log: free space, newest file
age per camera, process count, and memory use.

*Fails if:* any camera stops recording undetected, memory climbs steadily, or process
count grows.

### E2. Memory and handle stability
Review the E1 log. Memory should be flat or sawtooth, not a rising line. Process count
should be stable.

*Fails if:* the trend goes up over 24 hours — that's a leak, and it kills the app after
days.

---

## Group F — Operability

### F1. NAS path configurable in the admin UI
An operator can set the storage path in settings, without editing config files.

Both apps need work here — this is the feature your senior asked for.

*Fails if:* it requires a text editor, or accepts an invalid path without complaint.

### F2. Invalid storage path is rejected loudly
Enter a nonexistent or unreachable path in settings. The app must refuse it with a clear
message.

*Fails if:* it accepts the path and silently records somewhere else. (Shinobi currently
fails this — UNC paths are silently rejected and fall back to local.)

### F3. Failures are visible
For each of: camera offline, storage unreachable, disk full, recording failed — confirm
the operator can see what's wrong and why, in the UI.

*Fails if:* any of these produces a healthy-looking system.

### F4. Camera count is honest
Confirm the number of cameras the app reports matches the number actually recording.

*Fails if:* the UI shows cameras that aren't running. (Shinobi fails this at the licence
ceiling — dropped monitors show "Initializing" forever.)

---

## Scoring

| | Shinobi | VMS-Go |
|---|---|---|
| Group A — Recording | | |
| Group B — Power/recovery | | |
| Group C — Storage | | |
| Group D — Cameras | | |
| Group E — Endurance | | |
| Group F — Operability | | |

Record actual observations, not just PASS/FAIL. "A1 PASS — 4 cameras, 31 min, files
2.1 GB total on NAS, verified from NAS console" is useful. "PASS" alone is not.

---

## Notes on running these

**Run group A and B first.** They're the blockers, and if an app fails them the rest
doesn't matter.

**Run both apps against the same cameras and the same NAS**, ideally the same week. A
comparison is only meaningful if the conditions match.

**Group E takes a day** and can run in the background while you do other tests.

**Expect both apps to fail some of these initially.** That's the point — it tells you
what to fix. An app that passes everything on the first run means the tests are too
weak.

---

# Results recorded so far

Observations, not verdicts from a UI. Dates and figures are what was measured.

## B3 — NAS disappears mid-recording: **FAIL** (observed 2026-09-04, unplanned)

The share dropped at ~19:30 while Shinobi was recording four cameras to it. Nobody
triggered it — the office was being packed up — so this is the real thing rather than a
staged test.

What happened: **nothing.** The node process stayed alive, ffmpeg processes stayed alive,
and no error was raised anywhere. The sampler caught it precisely:

```
2026-09-04 19:24:59, ... free=96.94 footage=2.95 ff=4 ... ages 271-298s   (healthy)
2026-09-04 19:30:01, ... free=ERR   footage=0    ff=0 ... NOFILE x5       (share gone)
```

Fails on "a visible error while it's gone". The cause is known and is not a mystery:
`checkStorageTarget` runs at boot and on the two config write paths, and **nowhere else**.
The only periodic loop in `health.js:146` broadcasts CPU and RAM to the browser and never
touches the recording volume. Per PILOT_RISKS #3 ffmpeg blocks on a full stderr pipe
rather than exiting, so the processes do not even die to give a signal.

The recovery half — whether recording resumes when the share returns — was **not**
observed, because the machine left the site. Still worth running deliberately.

## C1 / E1 — retention purge: **NOT TESTED**

The 24-hour endurance run was stopped after **1h41m** when the office was packed up. In
that window it wrote **2.95 GB** against a purge threshold of **32 GB** (quota 40,000 MB ×
0.9 × 0.9). Purging was never approached, let alone triggered.

```
purge events (>0.5 GB freed between samples) : 0
peak footage on share                        : 2.95 GB
```

**Retention is unverified in both applications.** It needs a genuine 24-hour run, and it is
the single most dangerous untested area: the quota shipped at 1,000,000 MB (1 TB) against a
226 GB share, which is PILOT_RISKS #1 and would have filled the disk instead of purging.
The quota is now 40,000 MB, but that correction is itself unproven.

What E1 *did* establish, over 21 samples and four cameras:

- No unprompted restarts — one node PID throughout.
- No recording gaps while the share was up (`gapSamples=0` on all four).
- `filesWithNoRow` flat at the expected floor, not climbing.
- Throughput ~10.5 GB/camera/day for CP Plus 1080p main stream.

What it cannot tell you: **anything about memory or handle leaks.** 1h41m of a process
that garbage-collects is noise, and no slope from that window should be quoted.

## A1 / A2 — VMS-Go, Alba on local disk: **PASS** (2026-09-04 evening, offsite)

First segment VMS-Go has ever recorded from this camera, after the URL fix (`3777c17`):

```
url="rtsp://admin:***@192.168.1.168:554/rtsp/streaming?channel=1&subtype=0&onvif_metadata=true"
state change ... from=starting to=running
segment recorded ... file=2026-09-04T20-29-39+0530.mp4 bytes=3620457

ffprobe: h264 1920x1080, 22.21s, 330 frames (~333 expected at 15fps), 1.3 Mbps, valid mp4
```

Local disk, one camera — **not** the deployment configuration. A1 against the NAS with
five cameras remains untested for VMS-Go.
