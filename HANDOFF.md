# HANDOFF — Session Recap for Claude Code

> **If you are Claude Code and the user said "hello recap" (or similar): READ THIS WHOLE
> FILE, then give the user a short plain-language summary of where things stand and the
> immediate next step (the NAS recording test). Then continue helping from "Where we are
> right now" below.**
>
> **If you are the human (Tanishq / the LIMCO VMS owner):** on a new machine, tell Claude
> Code *"read HANDOFF.md and recap where we are"* and it will pick up with full context.

This file is the memory that travels with the repo. It captures a long planning + hardening
session so work can continue seamlessly on the Ubuntu VMS box (or any machine).

---

## What this project is

**LIMCO VMS** — a production Video Management System (CCTV/NVR) built on a hardened fork of
**Shinobi** (Node.js + FFmpeg). Records many IP cameras 24/7, streams them live, with **AI
detection as a pluggable EXTERNAL service** (never baked into the core). Branch: **`vms-core-hardening`**.

**Top priority, always:** recording is sacred — 24/7, gapless, never lost/corrupted.

**Key design fact:** records in **`copy` mode** (no re-encoding) → low CPU → the reason one
server handles ~150 cameras. Never let cameras re-encode at scale.

---

## The user (important context)

- Owns/leads this VMS product; is **non-deeply-technical** — wants plain-language
  explanations, not jargon. Explain the *what and why* alongside commands, not just steps.
- Go step-by-step; confirm before changing working setups; back up before editing configs.
- Two Ubuntu 22 PCs set up as a test rig (see "Test rig" below). VMS also has a demo instance
  in Docker on a Windows laptop (that's the DEMO; the Ubuntu box is where standalone+NAS is
  being validated).

---

## What was done this session (all committed + pushed to origin/vms-core-hardening)

**Core hardening (commit 9f71f2e):**
- Fixed an orphaned-FFmpeg-process leak (verified live: 3 stale ffmpeg processes stacked on
  one camera). Root cause was `cameraDestroy` using `e.id` inconsistently; fixed.
- Fixed a stream-viewer timeout leak, made a sync `writeFileSync` in the camera-spawn path
  async, scoped the global 8mb body-parser limit back down, removed a hidden fake-fire
  trigger (F-key injected fabricated fire events into the real DB — a production hazard).

**Security (523a56d):** dependency vulnerabilities 24 → 4 via lockfile-only fixes (safe,
no behavior change). Deferred (need testing): nodemailer v9, cws→ws migration, mysql→mysql2,
googleapis. NOTE: the `cws` library is abandoned but load-bearing (7 files incl. the
websocket engine) — migrate to `ws` later, carefully.

**Generic Detections UI (6cbb436):** made the dashboard detection-AGNOSTIC. New shared
`frontend/assets/js/bs5.dynatech-event-registry.js` maps any event `reason` → label/color/
icon/severity (fire/linex seeded; unknown types get a neutral default; `motion` hidden by
default). Any new AI service's event type now appears with ZERO VMS code change. Independently
reviewed.

**Full documentation (in `docs/`):**
- `01-HLD` / `02-LLD` / `03-Data-Flow-and-APIs` — system design traced from real code
  (8 subsystems, ~130 API routes, DB schema, the pluggable-AI `/motion` contract).
- `04-Glossary` — plain-language definitions of every term (RTSP, FFmpeg, ONVIF, codecs,
  copy mode, processes, DB, API, scaling, AI).
- `05-Scaling-Architecture` — how to fix the master bottleneck.
- `06-Architecture-Decision` — the verified go/no-go (see "Big decisions" below).
- `07-Standalone-Rollout-Plan` — the concrete rollout plan.
- `system-design.html` + `scaling-comparison.html` — self-contained visual pages
  (open in a browser; also published as claude.ai artifacts).

**Load-test harness (`load-test/`):** camera simulator to test hundreds/thousands of cameras
without owning them — `make-seed.sh` (synthetic RTSP clip), `sim-cameras.sh` (MediaMTX + N
ffmpeg RTSP publishers), `gen-monitors.js` (bulk monitors), `watch-load.sh` (samples load),
`LOAD_TEST_PLAN.md` (staged 40→80→150 plan), `TEST_NAS_SETUP.md` (the NFS NAS guide we're
following now).

---

## Big architecture decisions (settled, evidence-backed)

1. **Move to the STANDALONE pattern, NOT the master/child cluster.** An exhaustive adversarial
   analysis (28 agents, verified against code) found the current cluster has verified
   CATASTROPHIC failures: if the master dies, every child kills all its FFmpeg → **all
   recording stops fleet-wide** (`childUtils.js:71-86`); a network blip does the same; mid-
   transfer master death = silent unrecoverable data loss. These are the funnel's *design*,
   not patchable bugs. **Standalone is the DEFAULT code path** (`childNodes.enabled=false`) —
   moving to it turns OFF the risky code, adds none. Full detail: `docs/06`.

2. **Scale model:** each physical server records ~150 cameras (copy mode); add MORE servers
   (not a bigger one) for more cameras. A thin "directory" (one login + who-owns-what) comes
   only when there are multiple servers — it routes, never proxies video. Real VMS (Milestone/
   Genetec/Nx) all work this way. Full detail: `docs/05`.

3. **Durability bar chosen: RAID-level** (survive a drive failing) — RAID 6 + backups +
   watchdogs. N+1 whole-server failover is designed-for-LATER, not built now. Full detail:
   `docs/07`.

4. **Recording resolution standard:** modern standard is ~4 MP main-stream (H.265) for
   recording, 720p sub-stream for live view. Recording res is the biggest lever on storage +
   camera-density.

5. **NAS:** each server owns its own storage (NAS volume) — per-server, not one shared NAS
   funnel. NFS mount + point `videosDir` at it. This is the professional method.

---

## Test rig (the two Ubuntu 22 boxes)

- **VMS box** — Ubuntu 22, VMS runs NATIVELY (no Docker), deps installed, MariaDB working,
  `conf.json` set up, VMS runs fine locally. Repo is a git clone on branch `vms-core-hardening`.
- **NAS box** — Ubuntu 22, acts as an **NFS test NAS**. Shares folder `/srv/nas/videos`.
- **Networking:** both on WiFi (router, 192.168.1.x) AND a **direct ethernet cable** between
  them = a dedicated storage link with STATIC IPs: **NAS box = 10.10.10.1**, **VMS box =
  10.10.10.2** (set via GUI Settings→Network→Wired→IPv4→Manual; ping works).
- **Mount:** on the VMS box, the NAS is mounted at **`/mnt/nas`** (from `10.10.10.1:/srv/nas/videos`),
  made PERMANENT via `/etc/fstab` (`_netdev`), auto-mounts on boot. A sentinel file
  `/srv/nas/videos/.nas-online` (contains `nas-ok`) exists for the health check.
- **NFS export** on the NAS box allows both `192.168.1.0/24` and `10.10.10.0/24`.
- CAVEAT: this rig is a FUNCTIONAL test only (single SD/SSD, WiFi/basic ethernet) — NOT a
  throughput/RAID/capacity test. Do NOT run the heavy load test through the NAS box; load-test
  to the VMS box's fast LOCAL disk instead.

---

## WHERE WE ARE RIGHT NOW (resume here)

The NAS integration is BUILT and WORKING: dedicated ethernet link, static IPs, NFS share,
permanent mount at `/mnt/nas`, sentinel file present. Code is synced to the Ubuntu VMS box.

**Immediate next steps (the NAS recording test):**
1. **Point the VMS at the NAS:** back up `conf.json`, then set `videosDir` to `/mnt/nas`
   (or `/mnt/nas/videos` — verify the exact mount target with `ls -la /mnt/nas` first;
   `/mnt/nas` already IS the NAS's `/srv/nas/videos`, so likely record straight to `/mnt/nas`).
   `conf.json` is gitignored so it's the box's own file — back it up before editing.
2. **Restart the VMS**, add/start a camera in **record** mode (a real RTSP camera on the
   network, OR a simulated one via `load-test/sim-cameras.sh`).
3. **Verify:** on the NAS box, watch `.mp4` segments appear in `/srv/nas/videos`. That proves
   the whole chain works.
4. **Build + test the MOUNT-HEALTH CHECK** (the one required code item from `docs/07` Phase 0):
   before recording, confirm `/mnt/nas/.nas-online` exists; if not, the NAS is not really
   mounted → refuse to record (so footage never silently writes to the wrong local disk).
   Test it by killing the NFS share and confirming the check catches it. This is a small
   addition to the VMS storage startup path (see `libs/folders.js` where recording dirs are
   made, and `libs/videos.js`).

**Deferred backlog (later):** clip-share redesign, cws→ws migration, remaining dep upgrades
(nodemailer/mysql2/googleapis), and RUNNING the staged load test.

---

## How to work with this user
- Plain language, explain the why, go step by step, back up before changing working things,
  be honest about what a test does/doesn't prove. They caught real issues by asking good
  questions — encourage that.
