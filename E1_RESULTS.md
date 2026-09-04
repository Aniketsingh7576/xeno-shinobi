# E1 — 24-hour endurance run

**Status: RUNNING. Started 2026-09-04 17:41 IST, due to finish 2026-09-05 ~17:41 IST.**
Findings below the line marked PENDING are not yet known. Nothing in this file is a
prediction — the sections fill in when the run completes.

Sampler: `E1_SAMPLES.csv` in this directory, one row every 5 minutes (288 expected).
Analysis: `offline-windows\diagnostics\Analyse-E1.ps1` turns the CSV into the findings.

---

## Configuration under test

| | |
|---|---|
| Cameras | 5 — 4 CP Plus (192.168.1.2 / .7 / .11 / .12) + 1 Alba (192.168.1.168) |
| Stream | **main** on all five (`/ch01.264`, and `subtype=0` for the Alba) |
| Codec | h264 stream-copy, no transcode; audio dropped (`acodec=no`) |
| Recording target | `//192.168.1.54/shared-cctv/shinobi-e1` — the NAS, over SMB |
| Mount guard | ON — `requireStorageMount: true`, marker `.vms-mount-marker` on the share |
| Segment cutoff | **5 minutes** (was 15) |
| Segment format | **fragmented MP4** — `movflags=+frag_keyframe+empty_moov+default_base_moof` |
| Storage quota | **40 000 MB**, was 1 000 000 MB (1 TB) |
| Purge threshold | quota × 0.9 × 0.9 ≈ **32 GB of footage** |
| Share capacity | 225.9 GB total, **99.9 GB free** at start |

Expected: ~10 GB/camera/day × 5 ≈ 50 GB/day, so the 32 GB purge threshold should be
crossed roughly **15–16 hours in**, leaving 8+ hours of observed purging.

## Fixes carried into this run

Three changes were made and confirmed before the run started, so the run measures the
fixed system rather than the old one.

### Fix 1 — fragmented MP4 (`movflags`)

[`backend/libs/ffmpeg/builders.js:575`](backend/libs/ffmpeg/builders.js#L575).
`faststart` writes the `moov` at the end of a segment, so any interruption left the file
permanently unplayable. Replaced with `+frag_keyframe+empty_moov+default_base_moof`.

Verified before starting:

| Check | Result |
|---|---|
| `ffprobe` a segment **while it is still being written** | **readable** — 96–117 s reported on five open files |
| Kill the process mid-segment (`TerminateProcess`, no handler runs) | **all 5 partial files playable**, 143–164 s of footage recovered each |
| Playback through Shinobi's own video route | served 35 103 411 bytes, playable, 273.7 s |
| Export a clip and open it independently | 30.0 s, 3.9 MB, h264 1920×1080, opens fine |
| Size overhead | **below measurement noise** — 1.025 Mbps vs 1.030 Mbps on the same camera and source |

Not tested: **VLC specifically.** This machine has no GUI session available to me, so
"opens in VLC" is unverified — `ffprobe` and a stream-copy remux are the evidence.

### Fix 2 — orphan-scan noise silenced

[`backend/libs/video/utils.js:60`](backend/libs/video/utils.js#L60). The scan spawned a
POSIX pipeline every cycle; on Windows that threw an uncaught `spawn sh ENOENT` roughly
every 10 seconds. Now it checks the platform once and logs a single line.

Before: 28 stderr lines per 90 seconds. After: **3 stderr lines total, 0 occurrences of
`spawn sh ENOENT`, exactly 1 notice on stdout.**

Orphan recovery itself is still broken on Windows — deliberately not fixed here. See
[ORPHAN_CLEANUP_HAZARD.md](ORPHAN_CLEANUP_HAZARD.md).

### Fix 3 — uniform baseline

The Alba was recording its 1280×720 substream. Switched to `subtype=0`, 1920×1080. All
five cameras now record 1080p main stream, so the endurance numbers describe one
configuration.

## Blocker found and worked around during setup

**Shinobi cannot record to a backslash UNC path**, independently of the storage
validation fixed earlier. `videosDir: \\192.168.1.54\shared-cctv\shinobi-e1` validated
correctly and was saved, then produced this ffmpeg output argument:

```
\192.168.1.54shared-cctvshinobi-e1/CTidgSfzFn/cpplus002/%Y-%m-%dT%H-%M-%S.mp4
```

Every backslash was eaten and all five cameras failed to start.

Cause: `splitForFFMPEG` at
[`backend/libs/ffmpeg/utils.js:187-197`](backend/libs/ffmpeg/utils.js#L187) tokenises the
command with `/\\?.|^$/g` and then strips the backslash from every `\X` pair
(`c.replace(/\\(.)/,"$1")`). It treats `\` as a shell escape, so **any** backslash in
**any** ffmpeg argument is silently removed. Windows paths normally survive only because
Shinobi stores them with forward slashes.

**Workaround in use:** the forward-slash UNC form `//192.168.1.54/shared-cctv/shinobi-e1`,
which the tokeniser leaves alone and Windows accepts. Confirmed: the live ffmpeg command
carries the path intact and footage is landing on the share.

Not fixed, because a change to the tokeniser affects every ffmpeg command in the product
and deserves its own testing. Worth noting that
[NAS_TEST_SETUP.md](NAS_TEST_SETUP.md)'s symlink approach (Option B) also sidesteps this,
for the same underlying reason.

---

## PENDING — results

Run `offline-windows\diagnostics\Analyse-E1.ps1` when the sampler finishes, then fill in:

- **Continuity** — did every camera record for the full 24 h, or were there gaps? Where
  and why? (A gap shows as `age_<camera>` exceeding ~420 s.)
- **Retention** — did purging trigger, delete oldest-first, and let recording continue?
- **Memory and handle trend** — flat/sawtooth or rising. This matters more than anything
  else in the test.
- **Unprompted restarts** — the analyser flags any change in the node PID. One restart at
  17:57 the previous day could not be accounted for; if it recurs with nobody touching
  the machine, it is real.
- **Total footage and measured GB/camera/day** across a full day/night cycle.
- **Unplayable segments** — whether fix 1 eliminated them. Re-probe every segment on the
  share at the end.

### Reading the CSV

| Column | Note |
|---|---|
| `age_<camera>` | seconds since the newest segment's **start time**, taken from the filename. Filename age is used because on a network share the directory entry lags while ffmpeg holds the file open, so `LastWriteTime` would report a healthy camera as dead. Healthy is < ~360 s with a 5-minute cutoff. |
| `ffmpegCount` | fluctuates ~5–10. Five are the per-camera recorders; the rest are short-lived snapshot/timelapse processes. A sustained value **below 5** is the failure. |
| `filesWithNoRow` | the leak counter. One open segment per camera is normally row-less, so ~5 is the expected floor. A **rising floor** is the leak. |
| `footageGB` | bytes of `.mp4` under the share's group directory. Drops indicate purging. |
| `freeGB` | free space on the whole share, which holds other data too. |

### Known caveats before anyone reads the numbers

- The `Videos` table was **not** reset before the run; it carries 64 rows from earlier
  local recording. Absolute row counts are not meaningful, only their trend.
- The share is not dedicated to this test — `freeGB` can move for reasons unrelated to
  recording. `footageGB` is the trustworthy figure.
- Shinobi is unactivated, which is fine at 5 cameras but caps the install at 15.
