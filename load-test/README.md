# VMS Load-Test Harness — Camera Simulator

Simulate **N virtual cameras** (real RTSP streams) to load-test the VMS toward
hundreds/thousands of cameras — **without owning that many physical cameras**.

The VMS records in **copy mode**, so a simulated H.264 RTSP stream stresses the exact
same paths as a real camera: ingest → segment → disk write → DB row → (optional) live
view. This is a faithful load test of recording + streaming, not a mock.

---

## Architecture

```
 loop.mp4 ──ffmpeg──▶ rtsp://SIM_HOST:8554/camN   (one publisher per virtual camera)
   (H.264)             │
                       ▼
                 MediaMTX (RTSP server)  ◀── the VMS connects here as if to real cameras
                       │
                       ▼
                 VMS monitors camN  ──▶ 24/7 recording + live streaming
```

- **MediaMTX** — a single lightweight RTSP server that hosts all virtual camera paths.
- **FFmpeg publishers** — one per camera, looping a seed clip, published as H.264 (copy
  where possible). Staggered start to mimic real fleet bring-up.
- **The VMS** — you register N monitors pointing at `rtsp://SIM_HOST:8554/camN`.

---

## Why this is a REAL test (and its limits)

**Faithful:** ingest, RTSP/TCP handling, per-camera ffmpeg process, segment rotation,
disk write throughput, DB insert rate, per-camera memory/FD cost, restart/backoff — all
identical to production copy-mode.

**Not identical to the field (be honest with the client):**
- Simulated streams share one host's encoder — real cameras have independent clocks,
  jitter, packet loss, variable bitrate, and vendor RTSP quirks. Add impairment with
  MediaMTX/ffmpeg options if needed.
- Network path is loopback/LAN, not the real camera network. Real deployments must still
  validate NIC/switch bandwidth (600 Mbps @ 150 cams).
- One seed clip's bitrate ≈ all cameras. Use a clip whose bitrate matches the target
  (2 MP ≈ 4 Mbps) so disk/network numbers are representative.

---

## Prerequisites

1. **FFmpeg** on PATH (already present in this environment).
2. **MediaMTX** — download the single binary for your OS from
   https://github.com/bluenviron/mediamtx/releases and put `mediamtx`(`.exe`) on PATH or
   in this folder. (No install, just the binary.)
3. **A seed clip** `seed.mp4` — an H.264 clip at ~4 Mbps, ~1–2 min. Generate one with
   `make-seed.sh` (synthetic) or drop in a real camera recording.

---

## Usage

```bash
# 1. make a synthetic 2MP ~4Mbps seed clip (or provide your own seed.mp4)
bash make-seed.sh

# 2. start the RTSP server + N publishers (staggered). Ctrl-C stops everything.
bash sim-cameras.sh 40          # 40 virtual cameras
bash sim-cameras.sh 150         # scale up

# 3. in the VMS, add N monitors pointing at rtsp://<this-host>:8554/cam1 ... camN
#    (or use gen-monitors.js to emit a bulk-import JSON / SQL for the Monitors table)
node gen-monitors.js 150 > monitors-150.json

# 4. watch the VMS under load
bash watch-load.sh              # samples CPU/RAM/ffmpeg-count/disk-write every 5s
```

**Staged plan (per SERVER_REQUIREMENTS): 40 → 80 → 150 → beyond.** Confirm stable at each
step before scaling. Watch for: ffmpeg process count == camera count (no leaks/orphans —
this is the bug we fixed), flat memory (no growth), disk write keeping up, DB insert rate,
and no cameras stuck "Died/Reconnecting".

See `LOAD_TEST_PLAN.md` for the full method, metrics, and pass/fail thresholds.
