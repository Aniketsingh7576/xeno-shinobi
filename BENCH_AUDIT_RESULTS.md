# LIMCO VMS — Bench Audit Results

**Date:** 2026-08-31 · **Against:** `PRODUCTION_READINESS.md` · **Method:** 7 parallel read-only audit agents (code + read-only DB/system) + live functional confirmations on the bench.
**Environment:** H310M dev box (NOT the target R670), `limco-vms.service` running, 4 cameras (.2/.7/.12 recording, .11 Watch-Only), NAS on NFS.

> **Scope honesty:** this is a *bench* pass. It proves code-level defects and small-scale behaviour. It does **not** substitute for the R670, 150 real cameras, sudo-level infra, multi-day soaks, or the physical chaos drills — those are marked NEEDS-HARDWARE and remain open in `PRODUCTION_READINESS.md`.

---

## Executive summary

- **Verified live:** the **camera-count ceiling is 15** on this install (`storageStatus.monitors.cameraCountCeiling=15`). At boot, `startup.js:75` silently stops loading monitors past the ceiling. **150 cameras cannot load** until this licensing/activation limit is resolved. This is the single most important blocker and is **not a code fix**.
- **~16 P0-level blockers** confirmed (code-proven or live). **Many strong passes** on the core recording path (copy mode, file↔row integrity, orphan recovery, oldest-first non-blocking purge, 90-day+quota retention).
- **11 new issues** found that are NOT in the checklist (phantom Videos rows, substream teardown bugs, unauthenticated ONVIF socket, restart-storm gap, RTSP password parser, XFF trust, utf8mb3, time-only Videos index, disk-accounting drift, stale purge lock, CDN phone-home).

---

## P0 blockers (confirmed)

| # | Blocker | § | Verdict | Evidence |
|---|---------|---|---------|----------|
| 1 | **Camera-count ceiling = 15** — 150 cannot load (licensing) | B#5 | **LIVE-CONFIRMED** | `cameraCountCeiling=15`; `startup.js:75`, `checker/utils.js:12-18`, obfuscated `actCheck.js` |
| 2 | **No UNIQUE(ke,mid) on Monitors** + non-atomic delete-then-insert (delete err swallowed) | D#14 | FAIL | `SHOW INDEX`: only non-unique `monitors_index`; `monitor.js:661-674`; `preQueries.js:162` |
| 3 | **NAS mount-health NOT enforced** — unmounted NAS records to OS disk | C#3 | FAIL/GAP | sentinel `.nas-online` unused; `folders.js:44-47` mkdir unconditional; `fs.existsSync('/mnt/nas')` true even unmounted |
| 4 | **addStorage OS-disk target armed** (`videos2` on `/`) | C#7 | PARTIAL | `conf.json:14-16`; offered in storage dropdown; currently unassigned |
| 5 | **conf.json corruption trap** — boots empty → random port, no DB creds, records to `backend/videos/` on OS disk; non-atomic write | E | FAIL | `config.js:13-19`; `folders.js:30`; `system/utils.js:62-63` |
| 6 | **systemd hardcoded nvm node path** — any Node change → boot fails to system node v12 | E#12 | FAIL | unit `ExecStart=/home/brain/.nvm/.../v20.20.2/bin/node` |
| 7 | **Node 20 not pinned** (no `engines`, no `.nvmrc`) | B#10 | FAIL | grep empty; system node v12.22.9 |
| 8 | **/dev/shm sizing unproven** for 150 streams | B#8 | GAP/NEEDS-HW | bench `/dev/shm`=3.9G; no fstab pin; `streamDir` unset |
| 9 | **1-hour blackout after 3 failures** — sub-second flap → 1h dark | F#15 | FAIL | `monitor/utils.js:1810` (`>=3 ? 3600000 : 5000`), reset re-armed each launch `:1615-1618` |
| 10 | **Log rotation absent** — `/var/log/limco-vms.log` appends forever → `/var` fills | O#29 | FAIL | unit `StandardOutput=append:`; no `/etc/logrotate.d/limco-vms` |
| 11 | **External recording-liveness check absent** (in-app `nasStatus` does NOT satisfy it) | O#30 | GAP | no cron/script; `nasStatus.js` dies with the process it watches |
| 12 | **No scheduled DB backup**; super-panel export OOMs on big Videos + omits Events | P#31/#32 | GAP | no mysqldump/cron; `webServerSuperPaths.js:505-552` |
| 13 | **Duplicate prevention fails 2/3 cases** — IP-change → dup row; same-host-diff-port → camera dropped | H#19 | FAIL | host-only dedupe `bs5.onvifScanner.js:115,127`; random `mid` per scan |
| 14 | **Server binds all interfaces** (0.0.0.0), no firewall | K#22 | FAIL | `config.js:34` leaves `bindip` undefined → `listen(8080, undefined)` |
| 15 | **super.json email still default** `admin@shinobi.video`; unsalted SHA-256 (password WAS changed) | K#21 | PARTIAL | `super.json`; `basic.js:101`; `auth.js:288-289` |
| 16 | **Unauthenticated ONVIF socket** — pre-login SSRF + camera reconfig | H/K | FAIL (escalate P0) | `scanners.js:13-58` no `s.auth`/perm; fires before `init`; `socketio.js:1049` |

---

## New issues (not in the checklist)

| Issue | Sev | Evidence / effect |
|-------|-----|-------------------|
| **Phantom Videos rows** — orphan-scan races the live segment, inserts a duplicate ~15s "ghost" row | P2 | LIVE-CONFIRMED dup `(mid,time)`; `video/utils.js:22-58` + `videos.js:105+` plain INSERT; corrupts timeline + **disk/quota accounting** (231MB file recorded as 120MB) |
| **RTSP password `@`/`:`/`/` parser bug** in bulk edit | P1 (P0 per-camera) | LIVE-CONFIRMED: `p@ss` → pass="p", host="ss@192.168.1.2"; `monitorBulkEdit.js:25` → mangled URL on save → camera stops recording |
| **Substream teardown bugs** | P1 | `setActiveViewer` `splice(indexOf=-1,1)` drops the wrong viewer (`utils.js:548`); spawn-without-viewer leaks ffmpeg forever; disconnect `return` after video-cleanup skips `watch_off` (`socketio.js:1020-1024`) |
| **No restart-storm protection** — explains the Aug 12/26 boot failures | P1 | unit has `Restart=always` but no `StartLimitIntervalSec` → after 5 quick fails systemd gives up, VMS dead, no retry |
| **X-Forwarded-For trusted** — API IP-pin bypass + brute-force IP poisoning | P1 | `auth.js:168` prefers XFF/CF headers; IP match is substring `indexOf` |
| **No HTTPS** — operator passwords/tokens in cleartext on :8080 | P1 | no `ssl` in conf.json |
| **Videos index is time-only, not composite** — filesort at scale | P1 | `SHOW CREATE TABLE Videos` → `KEY videos_index (time)`; add `(ke,mid,time)` |
| **DB tables are utf8mb3, not utf8mb4** — 4-byte chars (emoji/rare CJK) error/truncate | P2 | `preQueries.js` hard-codes `utf8`; MariaDB `utf8`=utf8mb3 |
| **usedSpace never reconciled vs statfs at runtime** — drift makes purge fire early/late | P2 | `user.js` event-sourced counter; only recomputed at startup |
| **Stale purge lock only cleared above 100% quota** | P2 | `user.js:485` sweep condition `usedSpace > sizeLimit`, not the 81% trigger |
| **CDN phone-home at every boot** even with P2P off | P2 | `commander.js:72` fetches cdn.shinobi.video |

---

## Per-section verdicts (condensed)

**B/E Platform & Deploy:** ceiling=15 (P0), conf-corruption trap (P0), nvm path (P0), Node pinning (P0), /dev/shm (P0/HW), restart-storm (P1), root-user decision unrecorded (P1), ffmpeg-missing not asserted (P1). PASS: patch-package applied, ffmpeg h264+hevc present, inotify adequate, LimitNOFILE effectively 524288 (but not pinned).

**C Storage/NAS:** mount-health enforcement (P0), addStorage trap (P0). PASS: quota 390GB<volume 468GB, purge oldest-first & non-blocking, mount detection correct, NFS `hard,_netdev,timeo=600` safe. GAP(P2): stale purge lock, usedSpace drift. NEEDS-HW: real array sizing.

**D Database:** no UNIQUE(ke,mid) (P0). P1: pool max 10 / 4-wide queue (load-test), time-only Videos index, callback-path no-retry on reconnect. P2: utf8mb3. PASS: clean-DB bring-up, Logs retention bounded.

**F/G Recording:** 1-hour blackout (P0), DST frozen offset (P1), 19.5-min stall window (P1), fatal_max=0 retry-forever no-alert (P2), phantom rows (P2). PASS: copy mode, file↔row integrity, orphan recovery, midnight timestamps, snapshot/JPEG off, 90-day+quota retention honored, oldest-first purge. NEEDS-HW: 24h gap-free soak, NTP-step, corrupt-file, multi-day retention.

**H/I ONVIF/Streaming:** duplicate 3-cases (P0), unauth ONVIF socket (P0), RTSP password parser (P1), substream teardown (P1), blank-stream silent drops (P1), bulk-edit restart storm ~6-7min (P1), scan memory port-range typo unbounded (P1). PASS: H.264 sub browser-playable. Note: wall ping is 60s not 8s (fd/RSS is the real cost).

**K Auth/Security:** binds-all-interfaces (P0), super email default (P0), unauth ONVIF socket (P0). P1: no HTTPS, XFF trust, API-pin substring, unsalted hash, brute-force keyed on username only. PASS: child-node cluster disabled, password hashed, unused services (RTMP/P2P/Hub/plugins/cloud) all off.

**L Events/motion:** PASS: /motion seam records+broadcasts (Events row needs `detector_save:'1'`), motion detection off on all monitors, fake-event injector gone.

**O/P Observability/Backup:** log rotation (P0), external liveness (P0), DB backup (P0). P1: monitor-status not persisted, no metrics/retention, no operational alerting (SMTP wired only to events, placeholder address), config not backed up on write. PASS: debugLog off.

---

## What can only be done off-bench (still open in the checklist)
- **Fix the ceiling** — licensing/activation with Shinobi (gates everything).
- Physical chaos drills: pull RAID drive, cold power-cut, kill NAS mid-record, UPS shutdown (N).
- 150-camera load stages + ≥24h soak; real-camera ≥1-week pilot (M).
- R670 BIOS/RAID/PSU/UPS/network; /dev/shm & NOFILE on real hardware (B).
- Restore-from-backup rehearsal; RTO (P).
- HTTPS/firewall rollout; all the "decision recorded / accepted by ___ / client sign-off" items (E,K,R,S).
- Visual UI regression in the client's browser (Q).

---

## Recommended fix order (footage-loss first)
1. **Ceiling (P0, external)** — raise with Shinobi now; nothing else matters at 150 if this stays 15.
2. **NAS mount-health enforcement** + remove addStorage OS-disk target (C) — stops silent OS-disk recording.
3. **conf.json** atomic write + boot assertion (E) — same silent-wrong-disk class.
4. **UNIQUE(ke,mid) + upsert add** (D) — also kills the phantom-rows and duplicate-monitor bugs.
5. **1-hour blackout → bounded backoff + alert** (F).
6. **Security batch:** bind IP + firewall, auth-gate the ONVIF socket, default super email, HTTPS (K/H).
7. **Ops batch:** log rotation, external liveness cron+alert, off-box DB backup (O/P).
8. **systemd:** stable node path + `StartLimitIntervalSec=0` + LimitNOFILE (E/B).
9. **Onboarding correctness:** dedupe on host:port:path, fix RTSP password parser (H).
10. P1/P2 hardening: Videos composite index, utf8mb4, DST `useUTC`, substream teardown guards, XFF, purge-lock/drift.
