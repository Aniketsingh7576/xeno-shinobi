# VMS Load-Test Plan — Staged Camera Scaling

**Goal:** prove the VMS software (not the hardware) reliably handles the target camera
count with **24/7 recording as the non-negotiable priority**. Recording must never break,
lose, corrupt, or stop.

**Method:** simulate cameras with the harness in this folder (real RTSP streams), scale in
stages, and gate each stage on hard pass/fail metrics before proceeding.

---

## Stages

| Stage | Cameras | Purpose |
|-------|---------|---------|
| 0 | 1 | Smoke test — one sim camera records + streams end to end |
| 1 | 40 | First real load — confirm process model + disk + DB stable |
| 2 | 80 | Double it — watch for non-linear degradation |
| 3 | 150 | Target for the first deal — full sustained load |
| 4 | 300+ | Stretch — find where a single node actually breaks |

**Do not advance a stage until the current one passes ALL gates below and holds for
≥ 30 minutes** (recording is 24/7 — a 5-minute test proves nothing about segment rotation,
memory drift, or the restart/backoff logic).

---

## What to measure (per stage)

Run `bash watch-load.sh 5 Shinobi <N>` throughout. Track:

1. **FFmpeg process count == camera count** (± a few for snapshots).
   - This is the **orphan/leak check** — the exact bug fixed in `9f71f2e`. If ffmpeg
     count climbs above camera count over time, processes are leaking. **FAIL.**
2. **Recording continuity** — every camera produces a new segment every ~15 min, with no
   gaps. Verify: `SELECT mid, COUNT(*), MAX(time) FROM Videos WHERE ... GROUP BY mid` —
   every camera should have fresh rows. A camera with a stale MAX(time) stopped recording.
3. **Memory** — flat over 30+ min. A steady climb = a leak. **FAIL** if it trends up with
   no plateau.
4. **CPU** — should be modest in copy mode (recording is remux, not transcode). If CPU is
   high, something is re-encoding — check no monitor slipped to libx264. 
5. **Disk write throughput** — keeps up with `N × bitrate` (150 × 4 Mbps ≈ 75 MB/s). If the
   disk can't keep up, segments back up. (Hardware, but the test surfaces it.)
6. **DB insert rate** — the Videos-row inserts on segment completion don't stall. Watch for
   DB lock/stall messages in the VMS log.
7. **Cameras stuck "Died / Reconnecting"** — should be ~zero. A few flapping under the
   sim's shared encoder is tolerable; many is a supervision problem.
8. **Live streaming under record load** — with all N recording, open ~10–50 live views
   (a wall). Confirm streams start and the recording cameras are unaffected.

---

## Pass / Fail gates (per stage)

A stage **PASSES** only if, sustained ≥ 30 min:

- ✅ ffmpeg process count stays == camera count (no upward drift)
- ✅ every camera has continuous, gap-free segments in `Videos`
- ✅ memory flat (no unbounded growth)
- ✅ no camera permanently stuck Died/Reconnecting
- ✅ DB inserts keep pace (no stall/lock errors in log)
- ✅ opening a wall of live views does not disrupt recording

Any ❌ = stop, diagnose, fix, re-run the stage. **Never sign off a count that hasn't held
a full stage.**

---

## Known software chokepoints to watch (from the architecture)

These are the places the design predicts stress first — watch them specifically:

- **Single Node.js main process** coordinates all cameras. At high counts, event-loop lag
  is the ceiling, not per-camera CPU. Watch for delayed status updates / sluggish UI.
- **Per-camera cmd-file write on spawn** — now async (fixed), but mass simultaneous starts
  still hit it. The staggered start queue (`monitorStartQueueDelay/Size`) should smooth it.
- **Stream-check / recording-check timers** — one pair per camera; at thousands these are a
  lot of timers. Confirm they fire correctly and don't pile up.
- **Multi-node**: beyond one server's limit, the child-node cluster spreads FFmpeg load —
  but the **master centralizes DB + file storage + web**, so the master is the ceiling for
  thousands. Test the cluster separately once single-node limits are known.

---

## Running a stage (quick reference)

```bash
cd load-test
bash make-seed.sh                      # once — makes seed.mp4 (~4 Mbps 2MP)
node gen-monitors.js 150 <groupKey> <simHost> record > monitors-150.json
#   import monitors-150.json into the VMS (configureMonitor API or adapt to SQL)
bash sim-cameras.sh 150                 # start 150 virtual cameras (Ctrl-C stops)
bash watch-load.sh 5 Shinobi 150        # in another terminal — sample the load
#   let it run 30+ min; check the gates; then scale to the next stage
```

---

## Honest caveat for the client

This harness validates the **software** at scale on **one machine**. It does **not**
replace a field pilot: real camera networks add bandwidth limits, packet loss, vendor RTSP
quirks, and independent clocks. The recommended sequence is: (1) pass these simulated
stages, (2) then a small **real-camera pilot** (10–20 cameras of the actual model) to catch
vendor-specific issues, (3) then full deployment with the staged bring-up.
