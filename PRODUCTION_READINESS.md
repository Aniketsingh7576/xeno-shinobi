# LIMCO VMS — Production Readiness Checklist

**Deployment:** 150 cameras · 24/7 recording · live view · ONVIF onboarding
**Hardware:** Dell R670 + NAS · **Branch:** `vms-core-hardening`
**Scope:** recording, live view, ONVIF onboarding. *Not in scope:* PTZ control, AI detection.

---

## 0. How to use this

Every item is a **test with a pass criterion**, not a "look at the code" task. Work top-down —
sections are ordered so the things that lose footage come before the things that annoy operators.

| Tag | Meaning |
|-----|---------|
| **P0** | **Go-live blocker.** Silent data loss, total outage, or a security hole. Do not deploy without it. |
| **P1** | **Required before client sign-off.** |
| **P2** | Operational maturity. Can follow shortly after go-live. |

**The sign-off rule:** a failed item stops that stage. Diagnose, fix, re-run the item — do not
"come back to it later". Recording is the product; a checklist item skipped here is footage lost
in the field.

**Recommended order:**

1. **Bench** — sections B–E on the real server, no cameras yet.
2. **Function** — sections F–L with 5–10 cameras. Everything must work small before it works big.
3. **Load** — section M: the staged 40 → 80 → 150 simulation (`load-test/LOAD_TEST_PLAN.md`).
4. **Chaos** — section N: deliberately break things and confirm recovery.
5. **Pilot** — 10–20 *real* cameras of the actual models, running for a week.
6. **Full rollout** — all 150, staged.

**Companion documents** (this checklist does not repeat them):
[`docs/07-Standalone-Rollout-Plan.md`](docs/07-Standalone-Rollout-Plan.md) ·
[`load-test/LOAD_TEST_PLAN.md`](load-test/LOAD_TEST_PLAN.md) ·
[`SERVER_REQUIREMENTS_150_CAMERAS.md`](SERVER_REQUIREMENTS_150_CAMERAS.md) ·
[`docs/04-Glossary.md`](docs/04-Glossary.md) (plain-language definitions of every term used here)

---

## A. Blockers at a glance

All **32 P0 items** in this document, in one place. **If any is unchecked, do not go live.**

**The four that would silently lose footage** — no error, no alert, everything looks fine:

| # | Blocker | Section |
|---|---------|---------|
| 1 | **Retention defaults to 5 days** — set the retention window | [C](#c-storage--nas) |
| 2 | **Storage quota defaults to 10 GB** — set it to the NAS size | [C](#c-storage--nas) |
| 3 | **No NAS mount-health check** — an unmounted NAS records to the OS disk | [C](#c-storage--nas) |
| 4 | **A corrupt `conf.json` boots with empty defaults** and records to the wrong disk | [E](#e-deployment--process-supervision) |

**Capacity & configuration**

| # | Blocker | Section |
|---|---------|---------|
| 5 | Prove all 150 monitors actually load — there is a camera-count ceiling | [B](#b-server-os--platform-baseline) |
| 6 | Quota must be smaller than the physical volume | [C](#c-storage--nas) |
| 7 | Remove or relocate the local-disk `addStorage` target | [C](#c-storage--nas) |
| 8 | Size `/dev/shm` — live streams are written to RAM | [B](#b-server-os--platform-baseline) |
| 9 | Raise the open-file limit (`LimitNOFILE`) | [B](#b-server-os--platform-baseline) |
| 10 | Pin Node 20 (`engines` + `.nvmrc`) | [B](#b-server-os--platform-baseline) |
| 11 | Verify patch-package applied after install | [E](#e-deployment--process-supervision) |
| 12 | Fix the systemd unit's hardcoded nvm path | [E](#e-deployment--process-supervision) |
| 13 | Decide the root-user question | [E](#e-deployment--process-supervision) |
| 14 | Add a UNIQUE index on `Monitors(ke, mid)` | [D](#d-database) |

**Recording correctness**

| # | Blocker | Section |
|---|---------|---------|
| 15 | Fix the 1-hour blackout after 3 camera failures | [F](#f-recording--the-sacred-path) |
| 16 | Prove gap-free recording for 24 h across all cameras | [F](#f-recording--the-sacred-path) |
| 17 | Enforce copy mode on all 150 cameras | [F](#f-recording--the-sacred-path) |
| 18 | Every recorded file has a database row | [F](#f-recording--the-sacred-path) |
| 19 | Duplicate prevention — the three cases | [H](#h-camera-onboarding--onvif) |
| 20 | A ≥ 24-hour soak at 150 cameras | [M](#m-scale--load-validation) |

**Security**

| # | Blocker | Section |
|---|---------|---------|
| 21 | Change `super.json` credentials from defaults | [K](#k-web-api--auth) |
| 22 | Firewall the server — it binds all interfaces | [K](#k-web-api--auth) |
| 23 | Keep the child-node cluster disabled (hardcoded default secret) | [K](#k-web-api--auth) |

**Resilience drills — break it deliberately and confirm recovery**

| # | Blocker | Section |
|---|---------|---------|
| 24 | Prove RAID survives a drive failure — storage sign-off | [C](#c-storage--nas) |
| 25 | Pull a RAID drive while recording — chaos drill | [N](#n-failure--recovery-drills) |
| 26 | Kill the NAS mid-recording | [N](#n-failure--recovery-drills) |
| 27 | Cold power-cut | [N](#n-failure--recovery-drills) |
| 28 | Full restore-from-backup rehearsal | [N](#n-failure--recovery-drills) / [P](#p-backup--disaster-recovery) |

**Operations — without these you are blind**

| # | Blocker | Section |
|---|---------|---------|
| 29 | Log rotation — the log file grows unbounded | [O](#o-observability--alerting) |
| 30 | External recording-liveness check (the most valuable alert) | [O](#o-observability--alerting) |
| 31 | Scheduled database backup, off-box | [P](#p-backup--disaster-recovery) |
| 32 | **Tested** restore — a backup never restored is not a backup | [P](#p-backup--disaster-recovery) |

---

## B. Server, OS & platform baseline

- [ ] **P0 · Prove all 150 monitors actually load.** There is a camera-count ceiling enforced in
      two places, and the limit value comes from an **obfuscated** license checker
      (`libs/checker/actCheck.js`) that cannot be read from source. Worse, at boot the loader
      **silently stops** past the limit — no error, no warning, the extra cameras just never start.
      *Do:* create 150 monitors (use `load-test/gen-monitors.js`), restart, then count what loaded.
      *Pass:* `SELECT COUNT(*) FROM Monitors` = 150 **and** all 150 appear in
      `GET /:auth/monitor/:ke` **and** `/super/:auth/system/info` reports "Maximum Cameras" ≥ 150.
      *Why:* `libs/startup.js:75` (`loadCompleted <= s.cameraCount`) silently truncates the load;
      `libs/checker/utils.js:12-16` also caps at 2 (EC2) or 50 (`isHighCoreCount`).
      **This is the single most important item in this document — verify it before anything else.**
- [ ] **P0 · Pin Node 20.** Add an `engines` field to `package.json` and an `.nvmrc`. Neither
      exists today; Node 20 is enforced only by convention in three separate files, and the box's
      system Node is 12.
      *Pass:* a fresh clone on the server refuses to install/run on the wrong Node with a clear error.
      *Why:* `package.json` has no `engines`; `RUN_LOCAL.md` notes system Node is 12.
- [ ] **P1 · R670 BIOS/power profile** set to Performance (not balanced/power-saving), C-states
      configured for sustained throughput.
      *Pass:* recorded in the as-built config sheet.
- [ ] **P1 · RAID controller mode** — verify the controller presents the array as intended (HBA/IT
      mode for ZFS, or RAID 6 with write-back cache + BBU/supercap for hardware RAID).
      *Pass:* controller mode and cache policy recorded in the as-built sheet.
      *Why:* a write-back cache without battery backup loses in-flight writes on a power cut.
- [ ] **P1 · Ubuntu Server LTS** installed, fully patched, unattended-security-upgrades decided
      (on, but **not** auto-rebooting).
      *Pass:* `unattended-upgrade --dry-run` behaves as intended; no automatic reboot configured.
- [ ] **P1 · FFmpeg version and codec support.** The app only *prints* the ffmpeg version, never
      asserts it — and if ffmpeg is missing it logs "No FFmpeg found." and **keeps booting**.
      *Do:* confirm `ffmpeg -codecs | grep -E 'hevc|h264'` shows both decoders.
      *Pass:* version recorded; H.265 and H.264 both present.
      *Why:* `libs/ffmpeg.js:129-155` continues startup without ffmpeg.
- [ ] **P0 · `/dev/shm` sized for 150 HLS streams.** Live-stream segments are written to
      **`/dev/shm/streams/` — a RAM disk**, not the NAS. With 150 cameras this is real memory.
      *Do:* size `/dev/shm` explicitly in `/etc/fstab` (or set `streamDir` to a real disk), then
      watch `df -h /dev/shm` with all cameras streaming.
      *Pass:* `/dev/shm` usage stays below 60% with every camera streaming for 1 h.
      *Why:* `libs/folders.js:16-27`. If it fills, live view breaks in a way that looks unrelated.
- [ ] **P0 · Raise the open-file limit.** Each camera runs a Node wrapper + ffmpeg with ~8 stdio
      pipes plus sockets. 150 cameras ≈ 300 processes and thousands of descriptors.
      *Do:* set `LimitNOFILE=65535` in the systemd unit (the shell's `ulimit` does **not** apply to
      a systemd service).
      *Pass:* `cat /proc/$(pgrep -f "node camera.js")/limits` shows the raised limit with all
      cameras running.
- [ ] **P1 · inotify limits raised** — the app puts an `fs.watch` on every camera's recording
      directory.
      *Do:* raise `fs.inotify.max_user_watches` and `max_user_instances` in `/etc/sysctl.d/`.
      *Pass:* no `ENOSPC` from `fs.watch` in the log with 150 cameras running.
- [ ] **P1 · NTP synchronised and monitored.** Recording filenames are wall-clock strftime and
      segment cuts are clock-aligned, so a time step distorts the archive.
      *Pass:* `timedatectl` shows "System clock synchronized: yes"; drift alarms configured.
- [ ] **P1 · Server timezone fixed and documented; decide `useUTC`.** The offset is captured
      **once at process start**, so a DST transition while running leaves a stale offset.
      *Do:* either set `"useUTC": true` in `conf.json`, or accept local time and plan a restart
      around DST changes.
      *Pass:* decision recorded in the as-built sheet.
      *Why:* `libs/process.js:35`, `libs/basic.js:143-148`.
- [ ] **P1 · UPS with graceful shutdown** — `nut`/`apcupsd` configured to shut the VMS down cleanly
      before battery exhaustion.
      *Pass:* pull mains power; the server shuts down cleanly, not abruptly.
- [ ] **P1 · Dual PSU on separate circuits**, both live.
- [ ] **P2 · Swap sized sanely** (small or off — swapping a VMS is worse than failing fast).
- [ ] **P2 · Network:** 10 GbE (or bonded 1 GbE) confirmed at link speed; camera VLAN separated
      from the management network.
      *Pass:* `iperf3` sustains > 2 Gbps; ~600 Mbps of camera traffic has ample headroom.

---

## C. Storage & NAS

- [ ] **P0 · Set the retention window.** If `Users.details.days` is unset, the hourly cron
      **deletes every recording older than 5 days** — no matter how large the NAS is.
      *Do:* Account Settings → set "Days to keep" to the contracted retention (e.g. 30).
      *Pass:* recordings older than 5 days still exist after the cron has run several times.
      *Why:* `libs/cron/worker.js:238` — `v.d.days ... : 5`.
- [ ] **P0 · Set the storage quota.** If "Max Storage Amount" is unset it defaults to
      **10000 MB (10 GB)**. Purge keeps usage under that — across 150 cameras retention would
      collapse to *minutes*.
      *Do:* set the quota to NAS usable size **minus ~15% headroom** (e.g. 100 TB → ~85,000,000 MB).
      *Pass:* disk usage climbs well past 10 GB without footage being purged.
      *Why:* `libs/startup.js:145`, `libs/user.js:172`.
- [ ] **P0 · Quota must be smaller than the physical volume.** If the quota exceeds the disk, the
      disk hits 100% before purge ever triggers and recording stops.
      *Pass:* quota (+ headroom) < `df` reported size of the NAS volume. Recorded in the as-built sheet.
- [ ] **P0 · Build and test the NAS mount-health check.** If `/mnt/nas` is not mounted, the app
      calls `mkdirSync` and **silently records to the local OS disk**, where footage is orphaned
      and fills the root partition.
      *Do:* implement the sentinel-file check from `docs/07` Phase 0 — refuse to start recording
      unless `/mnt/nas/.nas-online` exists.
      *Pass:* unmount the NAS, start the VMS → it refuses to record and says why. Nothing is
      written under `/mnt/nas` on the local disk.
      *Why:* `libs/folders.js:41-51`. **The one required code item before trusting NAS storage.**
- [ ] **P0 · Resolve the local-disk `addStorage` target.** `conf.json` correctly sets
      `videosDir: "/mnt/nas"` but still declares `addStorage[0].path: "__DIR__/videos2"` — a second
      storage target on the **OS disk**.
      *Do:* remove it, or repoint it to a second NAS volume.
      *Pass:* no monitor is assigned to a storage location on the OS disk; `/` usage stays flat
      during a 24 h recording run.
- [ ] **P0 · Prove RAID survives a drive failure.** Physically pull one drive while recording.
      *Pass:* recording continues uninterrupted; the array reports degraded; the hot spare rebuilds;
      no `Videos` rows are lost. Re-seat and confirm the rebuild completes.
- [ ] **P1 · RAID 6 + hot spare configured** (not RAID 5 — rebuild times on large drives make a
      second failure likely).
      *Pass:* array config recorded in the as-built sheet.
- [ ] **P1 · Enterprise/surveillance-rated drives** confirmed by model number against the BOQ.
      *Why:* desktop drives are not rated for continuous write workloads.
- [ ] **P1 · NFS mount options correct** — `_netdev`, `hard` (not `soft`), sensible `timeo`/`retrans`,
      and the mount is in `/etc/fstab` so it survives reboot.
      *Pass:* reboot the server; `/mnt/nas` is mounted before the VMS starts.
      *Why:* `soft` mounts return I/O errors on a blip and corrupt in-flight segments.
- [ ] **P1 · Sustained write throughput proven.** 150 × 4 Mbps ≈ **75 MB/s sustained, forever**.
      *Do:* `fio --rw=write --bs=1M --numjobs=8 --size=10G --runtime=600 --time_based` against `/mnt/nas`.
      *Pass:* ≥ 150 MB/s sustained (2× headroom) with no latency spikes above 1 s.
- [ ] **P1 · OS/DB on NVMe, recordings on the array.** Mixing them causes database stalls under
      write load.
      *Pass:* `df` confirms `/`, the MariaDB datadir, and `/mnt/nas` are on different devices.
- [ ] **P1 · Purge deletes oldest-first and actually frees space.** Purge triggers at 90% of the
      quota (`deleteOverMaxOffset`).
      *Do:* set a small temporary quota, record until it trips.
      *Pass:* the oldest `Videos` rows and their files disappear; disk usage drops back below the
      threshold; recording never stops. *Restore the real quota afterwards.*
- [ ] **P1 · Deliberate disk-full drill.** Fill the NAS volume to 100% with a junk file while
      recording.
      *Pass:* the app detects "No space left on device", triggers a purge, and recording resumes
      without a restart. Note how much footage was lost.
      *Why:* `libs/monitor/utils.js:1488-1491`.
- [ ] **P2 · Storage growth measured, not assumed.** Record 10 real cameras for 24 h and measure.
      *Pass:* actual GB/camera/day recorded; retention math redone with the real number.
- [ ] **P2 · `fileBin` and timelapse percentage splits** reviewed (default 90% video / 5% timelapse
      / 5% fileBin of the quota).
      *Pass:* splits match how the system is actually used.

---

## D. Database

- [ ] **P0 · Add a UNIQUE index on `Monitors(ke, mid)`.** The table has only a *non-unique* index,
      so a re-add can create a second row for one camera → two ffmpeg processes → doubled RTSP
      connections → cameras hit their connection cap and live view breaks. The current fix is a
      non-atomic delete-then-insert with **no error handling on the delete** — a crash between the
      two loses the monitor entirely.
      *Pass:* the index exists; adding a duplicate fails cleanly instead of creating a second row.
      *Why:* `libs/monitor.js:658-676`, `libs/database/preQueries.js:144`.
- [ ] **P1 · Raise and test the connection pool.** Knex pool max defaults to **10**, and all queries
      additionally funnel through a **4-wide** queue — untested at a 150-camera insert rate.
      *Do:* set `databasePoolMax` in `conf.json` (start at 30) and load-test.
      *Pass:* no pool-timeout errors in the log during the 150-camera stage; segment inserts keep pace.
      *Why:* `libs/sql.js:9`, `libs/database/utils.js:4-6`.
- [ ] **P1 · MariaDB tuned** — `innodb_buffer_pool_size` (~25% of RAM), `innodb_flush_log_at_trx_commit`,
      `max_connections` above the pool size.
      *Pass:* settings recorded; no "too many connections" under load.
- [ ] **P1 · Database on NVMe, not the NAS.**
      *Pass:* `SHOW VARIABLES LIKE 'datadir'` points at the SSD.
- [ ] **P1 · Clean-database bring-up works.** The schema is created in code at boot, not from a
      `.sql` file.
      *Pass:* on an empty database the app creates every table and starts without manual steps.
      *Why:* `libs/database/preQueries.js`.
- [ ] **P1 · `Videos` table growth is sustainable.** At 15-minute segments, 150 cameras produce
      ~14,400 rows/day.
      *Pass:* after the load test, time a typical timeline query — under 2 s at ≥ 1M rows.
      Confirm the index on `time` is being used (`EXPLAIN`).
- [ ] **P1 · Segment inserts keep pace under full load.**
      *Pass:* no DB lock/stall messages in the log during the 150-camera stage; every camera has a
      fresh `MAX(time)`.
- [ ] **P1 · Database restart while recording.** `systemctl restart mariadb` with all cameras running.
      *Pass:* the app reconnects on its own; recording continues; orphaned files are picked up by
      the orphan scan. If it does **not** reconnect, that is a P0 — document the required restart.
- [ ] **P2 · Migrations are forward-only** — there are no down-migrations. Take a DB dump before
      any upgrade.
      *Pass:* noted in the upgrade runbook.
- [ ] **P2 · `Logs` table retention** reviewed (`log_days`, default 10). Every `systemLog` call
      writes a row.
      *Pass:* table size stable over a week.
- [ ] **P2 · Character set / collation** consistent (utf8mb4) so camera names with non-ASCII
      characters survive.

---

## E. Deployment & process supervision

- [ ] **P0 · Protect `conf.json` from the corrupt-config trap.** Config is writable at runtime from
      the super panel with **no backup, no validation, and no atomic rename**. If the file ends up
      malformed, the app **catches the parse error and boots with an empty config** — port 8080,
      recordings to `backend/videos/` on the local disk, database credentials gone. It starts
      successfully and quietly records to the wrong disk.
      *Do:* back up `conf.json` before every change; add a startup assertion that `videosDir` and
      `db` are present, or make the app refuse to boot on a config parse failure.
      *Pass:* deliberately corrupt a copy of `conf.json` → the app refuses to start (or loudly
      alerts) rather than silently running with defaults.
      *Why:* `libs/config.js:13-19`, `libs/system/utils.js:47-66`.
- [ ] **P0 · Verify patch-package applied after install.** `shinobi-onvif` is still used by the
      ONVIF Device Manager, and its vendored patch fixes a crash that hangs `init()` forever. A
      `npm ci --ignore-scripts` silently reintroduces it.
      *Do:* after every install, confirm the patch is present in `node_modules`.
      *Pass:* `grep -c "lastError &&" node_modules/shinobi-onvif/lib/modules/device.js` returns ≥ 2.
      *Why:* `patches/shinobi-onvif+0.2.2.patch`; the migration to `onvif` was only partial.
- [ ] **P0 · Fix the systemd unit's hardcoded paths.** `ExecStart` points at
      `/home/brain/.nvm/versions/node/v20.20.2/bin/node` — an nvm upgrade or a different user
      breaks boot silently.
      *Do:* install Node 20 system-wide (or symlink a stable path) and use that.
      *Pass:* `systemctl start limco-vms` works after simulating an nvm version change.
- [ ] **P0 · Decide the root-user question.** The unit runs the **entire web application as root**,
      justified because the super panel's Mount Manager writes `/etc/fstab` directly.
      *Do:* either (a) run as a dedicated `limco` user and stop using Mount Manager (do mounts in
      `/etc/fstab` by hand), or (b) formally accept the risk in writing.
      *Pass:* decision recorded in the as-built sheet with a named owner.
      *Why:* `deploy/limco-vms.service`. Running as root means any web vulnerability is a full
      server compromise.
- [ ] **P1 · `Restart=always` proven.** `kill -9` the node process.
      *Pass:* systemd restarts it within `RestartSec`; all cameras return to recording.
- [ ] **P1 · Cold-boot test.** Power-cycle the server.
      *Pass:* MariaDB → NAS mount → VMS start in the right order; every camera records again with
      no manual intervention.
- [ ] **P1 · `RequiresMountsFor` proven.** Boot with the NAS deliberately unreachable.
      *Pass:* the VMS does **not** start (rather than recording to the local disk).
- [ ] **P1 · Measure the 150-camera cold-start time.** Startup is serial: a ~1 s per-monitor loop,
      a concurrency-1 start queue with a 0.5 s delay, plus an ffprobe per monitor.
      *Do:* time from `systemctl start` to the last camera recording.
      *Pass:* the time is measured, documented, and acceptable to the client — expect **several
      minutes**. If not acceptable, raise `monitorStartQueueSize` and re-test.
      *Why:* `libs/startup.js:79-95`, `libs/config.js:24-25`, `probeMonitorOnStart`.
- [ ] **P1 · Clean-machine install rehearsal.** Build the server from scratch following the runbook.
      *Pass:* a person other than the author gets to a working VMS using only the written steps.
- [ ] **P1 · Deployed commit recorded.** Tag the release; note the SHA in the as-built sheet.
- [ ] **P2 · Rollback plan written** — how to get back to the previous commit + database state.
- [ ] **P2 · `run.sh` / `RUN_LOCAL.md` credentials** match the production database user (they
      currently reference the dev `majesticflame` account).

---

## F. Recording — the sacred path

> This is the product. Everything in this section is about one question: **is footage being
> written, indexed, and kept — always?**

- [ ] **P0 · Fix the 1-hour blackout after 3 failures.** When a camera fails 3 times in a row, the
      retry delay jumps from 5 seconds to **one hour**. The failure counter only resets after 60
      seconds of clean running — so a camera that flaps during a brief network blip goes dark for
      an hour, with nothing but a log line.
      *Do:* change the backoff to a bounded ramp (e.g. 5 s → 30 s → 2 min → 5 min, capped), or add
      an alert that fires the moment a camera enters long backoff.
      *Pass:* unplug a camera 3 times in quick succession, then reconnect it → it resumes recording
      within minutes, not an hour.
      *Why:* `libs/monitor/utils.js:1810`. **The most likely cause of unexplained missing footage.**
- [ ] **P0 · Prove gap-free recording for 24 h across all cameras.** The real acceptance test.
      *Do:* run all cameras for ≥ 24 h, then query for gaps — consecutive `Videos` rows per `mid`
      where the next `time` is more than ~1 segment after the previous `end`.
      *Pass:* zero unexplained gaps. Every gap is traced to a known cause (deliberate restart,
      camera unplugged) and documented.
- [ ] **P0 · Enforce copy mode on all 150 cameras.** Copy mode (no re-encoding) is what makes 150
      cameras possible on one server. A single camera slipped to `libx264` costs ~10–20× the CPU.
      *Do:* audit every monitor's video codec setting.
      *Pass:* `SELECT mid, details FROM Monitors` shows no `libx264`/`libx265` in any recording
      codec field; total CPU stays modest at full load.
- [ ] **P0 · Every recorded file has a database row.** A file with no row is invisible to playback.
      *Do:* after a 24 h run, compare the file count on disk with `SELECT COUNT(*) FROM Videos`.
      *Pass:* counts match (allow for one in-progress segment per camera).
- [ ] **P1 · Orphan recovery works.** `kill -9` an ffmpeg process mid-segment.
      *Pass:* the partial file is picked up and inserted by the orphan scan; it is playable.
      *Why:* `libs/video/utils.js:22-224`, `config.insertOrphans`.
- [ ] **P1 · Review the stall watchdog timing.** The recording watchdog fires at `cutoff × 1.3` —
      with the default 15-minute segment that is **~19.5 minutes of lost footage** before a restart.
      *Do:* decide whether to shorten `cutoff` (faster detection, more files and DB rows) or accept
      the window. Shorter segments also reduce loss from an unclean shutdown.
      *Pass:* decision recorded; the actual detection time measured by stalling a camera.
      *Why:* `libs/monitor/utils.js:1048-1068`.
- [ ] **P1 · Camera unplug → reconnect.** Pull a camera's network cable for 5 minutes.
      *Pass:* the monitor shows Died/Reconnecting; on reconnection recording resumes automatically;
      the gap is bounded and matches the outage.
- [ ] **P1 · H.265 main + H.264 sub per camera.** Browsers cannot play H.265 — the sub-stream must
      be H.264 for live view while the main stream stays H.265 for efficient recording.
      *Pass:* every camera's sub-stream is H.264 and plays in the browser; the main stream records
      in the camera's native codec without re-encoding.
- [ ] **P1 · No ffmpeg orphans over 24 h.** Process leaks were a real, fixed bug on this branch —
      confirm the fix holds at scale.
      *Do:* sample `pgrep -c ffmpeg` hourly for 24 h.
      *Pass:* the count stays equal to the camera count (± a few for snapshots) with **no upward
      drift**.
- [ ] **P1 · Node wrapper process count is stable.** Each camera also runs a `singleCamera.js` Node
      wrapper — roughly 300 processes total at 150 cameras.
      *Pass:* `pgrep -fc singleCamera` equals the camera count; total RSS is within the RAM budget.
- [ ] **P1 · Recording survives a UI restart.** Restart the browser / log out and back in.
      *Pass:* recording is completely unaffected.
- [ ] **P1 · Recording survives an operator opening a video wall.** See section I — call it out here
      because it is the assertion the whole architecture rests on.
      *Pass:* opening 50 live views causes **zero** recording gaps.
- [ ] **P1 · Timestamp correctness across midnight.** Recording filenames are wall-clock strftime;
      the start time is parsed back out of the filename.
      *Pass:* segments spanning midnight appear in the correct order in the timeline with correct dates.
      *Why:* `libs/ffmpeg/builders.js:619`, `libs/videos.js:142`, `libs/basic.js:105-110`.
- [ ] **P1 · Timestamp correctness across an NTP step.** Segment cuts are clock-aligned
      (`-segment_atclocktime 1`), so a time correction can produce a very short or very long segment.
      *Do:* step the clock forward and back by a few minutes while recording.
      *Pass:* no crash, no lost rows; the anomaly is understood and documented.
- [ ] **P1 · DST plan.** The UTC offset is captured **once at process start**. A DST transition
      while running leaves a stale offset, and the fall-back hour produces ambiguous filenames.
      *Do:* set `"useUTC": true`, **or** schedule a restart at each DST change.
      *Pass:* decision recorded and, if applicable, the restart is scheduled.
      *Why:* `libs/process.js:35`.
- [ ] **P1 · Power-cut mid-segment.** Pull power (after the UPS test) with cameras recording.
      *Pass:* on reboot, the in-progress files are either repaired by the moov-atom fix and playable,
      or cleanly discarded — never silently listed as playable-but-broken.
      *Why:* `postProcessCompletedMp4Video`, `libs/video/utils.js:790-868`.
- [ ] **P1 · NAS yank mid-recording.** Kill the NFS export while recording.
      *Pass:* the app does not write to the local disk (the mount-health check holds); it recovers
      when the NAS returns; the loss is bounded and logged.
- [ ] **P1 · Disk-full mid-recording** — covered in section C; confirm from the *recording* side
      that cameras resume without a restart.
- [ ] **P1 · Corrupt-file handling.** `deleteCorruptFiles` defaults to true.
      *Do:* truncate a recorded file, then browse to it.
      *Pass:* it is handled cleanly — no crash, no broken timeline.
- [ ] **P2 · `fatal_max` reviewed per monitor** (0 = retry forever). Decide whether a permanently
      dead camera should stop retrying, and make sure "stopped" is alerted on.
- [ ] **P2 · Snapshot / JPEG API load.** `doSnapshot` and `liveJpegApiEnabled` both default on and
      add work per camera.
      *Pass:* disable them if unused; confirm no CPU cost at 150 cameras.
- [ ] **P2 · Event-based recording paths** unused in this deployment are switched off (no detector,
      no timelapse) so they cost nothing.
- [ ] **P2 · Segment length decision recorded** — the trade-off between stall-detection speed, file
      count, DB rows, and loss-on-crash.

---

## G. Storage lifecycle & retention

- [ ] **P1 · Both retention controls verified together.** There are **two independent** mechanisms:
      age-based (`days`, cron) and size-based (quota + purge). Whichever hits first wins.
      *Pass:* a written statement of the actual retention the client will get, with both values.
- [ ] **P1 · Retention proven over a multi-day soak.** Run ≥ 3 days and watch the oldest footage.
      *Pass:* the oldest recording is exactly as old as the configured retention — not older, not newer.
- [ ] **P1 · The hourly cron completes within the hour at 150 cameras.** It processes every account
      sequentially with a per-group lock.
      *Pass:* cron start/finish log lines show it finishing well inside its interval.
- [ ] **P1 · `max_keep_days` per monitor honoured** if any camera has a different retention.
      *Pass:* per-monitor retention behaves as configured.
- [ ] **P1 · Purge does not disturb recording.** Purge runs as a serial queue while recording continues.
      *Pass:* no recording gaps correlate with purge activity in the log.
- [ ] **P2 · Stale purge locks swept.** A crashed purge can leave a lock that blocks future purges.
      *Pass:* `/super/:auth/system/checkForStalePurgeLocks` returns clean; the hourly sweep is running.
- [ ] **P2 · Events / logs / fileBin retention** set (defaults: events 10 days, logs 10, fileBin 10,
      timelapse 60).
      *Pass:* table sizes stable over a week.
- [ ] **P2 · Retention change procedure documented** — what to do when the client asks for 60 days
      instead of 30 (quota, disk, and the `days` value all move together).

---

## H. Camera onboarding & ONVIF

> This is the **most recently rewritten custom code** in the fork, and the least battle-tested.
> Test it harder than anything except recording.

- [ ] **P0 · Duplicate prevention — the three cases.** Duplicates create two ffmpeg processes for
      one camera, doubling RTSP connections; most cameras cap concurrent streams, so live view
      breaks too. The client-side dedupe matches on **`host` only**.
      *Do:* test each: (a) add the same camera twice; (b) a camera whose IP changed since it was
      added; (c) two cameras reachable at the same host on different ports.
      *Pass:* exactly one `Monitors` row per physical camera in all three cases.
      *Why:* `libs/monitor.js:658-676`, `frontend/assets/js/bs5.onvifScanner.js`.
- [ ] **P1 · Scan a real subnet at production scale.** Scan the full camera VLAN range.
      *Pass:* every camera is found; the scan completes without hanging; the server stays responsive.
- [ ] **P1 · Memory during a full-range scan.** Every result — including base64 snapshots — is
      accumulated in memory for the life of the scan and broadcast to the whole group.
      *Do:* watch RSS during a full /24 scan with snapshots.
      *Pass:* memory returns to baseline after the scan completes.
      *Why:* `libs/scanners/utils.js`.
- [ ] **P1 · Every camera model in the fleet produces a correct RTSP URL.** Test one of *each model*.
      *Pass:* the discovered URL plays in `ffplay`/VLC before it is ever added as a monitor.
- [ ] **P1 · Media2 / `GetServices` cameras work.** These are exactly why the ONVIF library was
      switched — cameras that returned empty capabilities used to hang discovery forever.
      *Pass:* the models that previously failed now probe successfully.
- [ ] **P1 · Wrong-credential handling.** Scan with a bad password.
      *Pass:* a clear "Enter Camera Username and Password" message — no hang, no crash. **Confirm no
      camera locks out** after the failed attempts.
- [ ] **P1 · Bulk ONVIF config tested on a *narrow* range first.** This writes encoder settings to
      every device in an IP range using one shared credential.
      *Do:* run it against 2–3 test cameras before any wide range. Confirm the "before" values shown
      in the UI are correct so a change can be reversed.
      *Pass:* settings apply correctly; **no unrelated device is touched**; no camera locks out.
      *Why:* `libs/scanners/utils.js:201-253`. A mistyped range reconfigures the wrong devices.
- [ ] **P1 · Bulk monitor edit dry-run on 2 cameras before 150.** Each save **restarts** that
      monitor, serially — applying to 150 restarts the whole fleet one by one.
      *Do:* apply to 2 monitors, verify, then decide whether to do the fleet in batches.
      *Pass:* settings apply; the restart storm is understood and scheduled for a maintenance window.
      *Why:* `frontend/assets/js/bs5.monitorBulkEdit.js`.
- [ ] **P1 · Passwords containing `@`, `:` or `/`.** The bulk-edit tool parses RTSP URLs with a
      hand-rolled regex that mangles these.
      *Do:* test a camera with such a password through bulk edit.
      *Pass:* either it works, or a documented rule bans those characters in camera passwords.
- [ ] **P1 · ONVIF Device Manager still works.** It runs on the *older* library that the vendored
      patch fixes.
      *Pass:* the Device Manager page opens and reads device info without hanging.
- [ ] **P1 · Add permission checks to the ONVIF socket actions.** The websocket verbs (`onvif`,
      `onvif_bulk_config`, scan cancel/pause/resume) have **no permission check**, while the
      equivalent HTTP route does. Scans are keyed by group, so any group member can cancel another's
      scan, and results — including snapshots — broadcast to the whole group.
      *Pass:* a sub-account without `control_monitors` cannot start or cancel a scan.
      *Why:* `libs/scanners.js:17-30`.
- [ ] **P1 · Scan cancel / pause / resume behave.**
      *Pass:* cancel actually stops the scan and frees memory; resume continues correctly.
- [ ] **P2 · Camera connection limits documented.** Many cameras allow only 2–4 concurrent RTSP
      clients — recording + live view + any future AI service all count.
      *Pass:* the per-model limit is recorded, and the planned client count fits within it.
- [ ] **P2 · Camera firmware and passwords standardised** across the fleet before onboarding.
- [ ] **P2 · Static IPs or DHCP reservations for all 150 cameras.** A camera that changes IP will
      be re-added as a duplicate.
      *Pass:* every camera has a fixed address recorded in the as-built sheet.
- [ ] **P2 · Camera time synced to NTP** so camera-side overlays match the archive.

---

## I. Live streaming & video wall

- [ ] **P1 · The wall does not disturb recording.** With all 150 recording, open a 30–50 camera wall.
      *Pass:* **zero** new recording gaps during and after. This is the assertion the architecture
      rests on — test it explicitly.
- [ ] **P1 · Each stream type works** for the chosen configuration: HLS, MP4/MSE, MJPEG, FLV.
      *Pass:* the type in production use plays reliably in the client's actual browser.
- [ ] **P1 · Sub-stream starts on demand and tears down.** Sub-streams spawn an extra ffmpeg per
      viewed camera and stop ~10 s after the last viewer leaves.
      *Pass:* open then close a wall → the extra ffmpeg processes appear and then **disappear**.
      Total ffmpeg count returns to the camera count.
- [ ] **P1 · Blank-stream diagnosability.** Frames arriving before a viewer subscribes are silently
      dropped with no log line, which makes "live view is blank" hard to diagnose.
      *Do:* add a debug log at those drop points, or write a documented triage procedure.
      *Pass:* an operator has a written "live view is blank — check these 4 things" procedure.
      *Why:* `libs/monitor/utils.js` (~1367, 1375, 1388).
- [ ] **P1 · Browser memory over a long shift.** Leave a wall open for 8 hours.
      *Pass:* browser memory plateaus rather than climbing until the tab dies.
- [ ] **P1 · Websocket count per browser is understood.** Each tile opens its **own** websocket —
      a 150-tile wall means ~151 sockets from one browser, and the server pings every socket every
      8 seconds.
      *Do:* measure with the intended wall size and operator count.
      *Pass:* the server handles the intended number of concurrent operators; a maximum wall size
      is recommended to operators in writing.
- [ ] **P1 · Multiple operators concurrently.** Have the expected number of operators view
      simultaneously.
      *Pass:* no stream degradation; recording unaffected.
- [ ] **P1 · Viewer-count accounting is correct.** Sub-stream teardown depends on it, and there is a
      known cleanup path that skips the accounting for MP4 sockets on disconnect.
      *Do:* open and close views repeatedly (30+ cycles), including by closing the browser abruptly.
      *Pass:* sub-stream ffmpeg processes are not left running; the count returns to zero.
- [ ] **P1 · H.265 camera → browser via the H.264 sub-stream.**
      *Pass:* live view works for every H.265 camera in the fleet.
- [ ] **P2 · `stream_mjpeg_clients` ceiling** (default 20 listeners) is above the expected concurrent
      viewer count if MJPEG is used.
- [ ] **P2 · Stream start latency** measured and acceptable to the client.
- [ ] **P2 · Snapshot / icon endpoints** work for every camera (used by the dashboard tiles).

---

## J. Playback, timeline, export

- [ ] **P1 · Seek within a long recording.** Scrub back and forth in a full-length segment.
      *Pass:* seeking is responsive and accurate (Range requests are honoured).
- [ ] **P1 · Timeline across segment boundaries.** Play continuously across several segments.
      *Pass:* playback is continuous; no missing minutes at the joins.
- [ ] **P1 · Timeline across midnight and across a retention boundary.**
      *Pass:* dates are correct; footage that should have been purged is absent, and everything
      newer is present.
- [ ] **P1 · Find footage by date and time** — the single most common operator task.
      *Pass:* an operator can find a specific 30-second moment from 3 days ago in under a minute.
- [ ] **P1 · Clip export (slice).** Cut a clip from a recording.
      *Pass:* the clip downloads and plays in a standard player (VLC and the client's PC).
- [ ] **P1 · Merge across segments.** Export a span covering several segments.
      *Pass:* one continuous playable file.
- [ ] **P1 · Export a multi-hour range.**
      *Pass:* it completes without exhausting memory or timing out; note the practical limit.
- [ ] **P1 · Playback while the same camera is recording.**
      *Pass:* reviewing footage never interrupts the live recording.
- [ ] **P2 · fileBin** — exported clips list, download, delete.
      *Pass:* all three work; deleted clips free disk space.
- [ ] **P2 · Evidence export procedure documented** — the exact steps an operator follows to hand
      footage to a third party, including the file format and how to verify it plays.

---

## K. Web, API & auth

- [ ] **P0 · Change `super.json` credentials from the defaults.**
      *Pass:* default credentials do not work; the new ones are stored in the password manager.
- [ ] **P0 · Firewall the server.** With no `ip` set in `conf.json` the server binds **all
      interfaces**.
      *Do:* restrict port 8080 (and any HTTPS port) to the operator network with `ufw`/`nftables`.
      *Pass:* the VMS is unreachable from outside the intended network; verified by scanning from
      another subnet.
      *Why:* `libs/config.js:34`.
- [ ] **P0 · Keep the child-node cluster disabled.** It ships with a **hardcoded default shared
      secret** on port 8288, and its failure modes are documented as catastrophic in
      [`docs/06`](docs/06-Architecture-Decision.md).
      *Pass:* `childNodes` is absent/disabled in `conf.json`; port 8288 is closed at the firewall.
- [ ] **P1 · Admin and sub-account login both work**, including logout and session expiry.
- [ ] **P1 · Permission sets actually restrict access.** Create a sub-account limited to a few
      cameras.
      *Pass:* it cannot view, stream, or export any camera outside its set — verified by calling the
      API directly, not just by looking at the UI.
- [ ] **P1 · API keys are scoped and IP-pinned** if any integration uses them.
      *Pass:* a key used from an unexpected IP is rejected.
- [ ] **P1 · Brute-force protection works.** Attempt repeated bad logins.
      *Pass:* the account/IP is throttled; the reset procedure is documented.
- [ ] **P1 · HTTPS decision made.** Either terminate TLS at a reverse proxy or configure it in the
      app — do not send operator passwords over plain HTTP on a shared network.
      *Pass:* decision recorded; if HTTPS, the certificate renewal process is documented.
- [ ] **P1 · Password hashing confirmed** (`passwordType: sha256` is set).
      *Pass:* `SELECT pass FROM Users` shows no plaintext.
- [ ] **P1 · Dependency vulnerability re-scan** before go-live.
      *Pass:* `npm audit --production` reviewed; anything unfixed is listed in section S.
- [ ] **P2 · Unused services off** — RTMP ingest, P2P/remote management, plugin auto-load, Shinobi
      Hub, cloud uploaders. Every one is attack surface.
      *Pass:* confirmed disabled in `conf.json` / the super panel.
- [ ] **P2 · Deferred upgrades accepted in writing** — `cws` (abandoned but load-bearing),
      `nodemailer`, `mysql`→`mysql2`, `googleapis`. See section S.

---

## L. Events & the `/motion` seam

> AI detection is **out of scope** for this deployment, but the seam must not break — it is how the
> AI service will attach later, and a broken seam is a nasty surprise on the next project.

- [ ] **P2 · The `/motion` route still records and broadcasts.**
      *Pass:* a manual `GET /<API_KEY>/motion/<GROUP>/<MONITOR>?reason=Test&confidence=90` creates an
      `Events` row and a live alert.
- [ ] **P2 · Unknown event types render with a neutral default** in the dashboard.
      *Pass:* an invented `reason` appears in the UI with no code change.
- [ ] **P2 · `Events` table growth and purge** confirmed if any events are generated.
- [ ] **P2 · Built-in motion detection is off** on all 150 cameras (it costs CPU and is not in scope).
      *Pass:* no monitor has a detector enabled.
- [ ] **P2 · No fabricated-event injector remains.** A hidden hotkey that wrote fake events into the
      real database was removed on this branch — confirm it is gone.
      *Pass:* no fake events can be injected from the UI.

---

## M. Scale & load validation

Execute [`load-test/LOAD_TEST_PLAN.md`](load-test/LOAD_TEST_PLAN.md). Its gates are the pass
criteria; the items below add what that plan does not yet cover.

- [ ] **P1 · Stage 0 — 1 camera smoke test** passes end to end.
- [ ] **P1 · Stage 1 — 40 cameras**, held ≥ 30 min, all gates green.
- [ ] **P1 · Stage 2 — 80 cameras**, held ≥ 30 min, all gates green. Compare against stage 1 for
      **non-linear** degradation.
- [ ] **P1 · Stage 3 — 150 cameras**, held ≥ 30 min, all gates green.
- [ ] **P0 · A ≥ 24-hour soak at 150 cameras.** The staged plan only requires 30 minutes — that
      proves nothing about segment rotation over a day, memory drift, or the hourly cron.
      *Pass:* memory flat, ffmpeg count stable, zero recording gaps, cron completed every hour.
- [ ] **P1 · Event-loop responsiveness at full load.** Everything runs in **one** Node process.
      *Pass:* the UI stays responsive and monitor status updates are timely with 150 cameras running.
- [ ] **P1 · Memory ceiling established.** Roughly 300 processes at 150 cameras.
      *Pass:* peak RSS recorded and comfortably within the 64 GB budget, including `/dev/shm`.
- [ ] **P1 · A 10–20 camera real-camera pilot for ≥ 1 week.** The simulator cannot reproduce vendor
      RTSP quirks, packet loss, or camera clock drift.
      *Pass:* a week with no unexplained gaps, using the actual camera models.
- [ ] **P2 · Find the actual ceiling** — push past 150 in simulation to know how much headroom exists.
      *Pass:* the breaking point is documented, so growth requests get an honest answer.

---

## N. Failure & recovery drills

For each: break it deliberately, observe, confirm recovery, **and write down what an operator
should do**. An untested recovery procedure is not a recovery procedure.

- [ ] **P0 · Pull a RAID drive** while recording → array degrades, recording continues, spare rebuilds.
- [ ] **P0 · Kill the NAS** (stop the NFS export) → no writes to the local disk; clean recovery.
- [ ] **P0 · Cold power-cut** (no graceful shutdown) → everything returns automatically on boot.
- [ ] **P1 · Stop MariaDB** while recording → observed behaviour documented; recovery confirmed.
- [ ] **P1 · `kill -9` the VMS process** → systemd restarts it; all cameras return.
- [ ] **P1 · Unplug one camera** for 10 minutes → bounded gap, automatic recovery (see the backoff
      item in section F).
- [ ] **P1 · Unplug 20 cameras at once** (simulating a switch failure) → the server does not
      destabilise; all recover.
- [ ] **P1 · Fill the recording disk** → purge trips, recording resumes.
- [ ] **P1 · Fill `/dev/shm`** → live view degrades but **recording is unaffected**.
- [ ] **P1 · Saturate the network link** → recording degrades gracefully; no crash.
- [ ] **P1 · Corrupt a segment file** → the timeline and playback handle it cleanly.
- [ ] **P0 · Full restore-from-backup rehearsal** — see section P.

---

## O. Observability & alerting

> Today the system is operationally blind: **no health endpoint, no metrics, no log rotation, and
> monitor status is never persisted** — so nothing can answer "which cameras died overnight?".

- [ ] **P0 · Log rotation.** The systemd unit *appends* to `/var/log/limco-vms.log` forever.
      *Do:* add a `logrotate` config (or switch to journald).
      *Pass:* the log rotates and old logs are pruned; `/var` cannot fill.
- [ ] **P0 · External recording-liveness check.** The single most valuable alert: is footage still
      being written?
      *Do:* a cron/monitoring script that checks every camera has a `Videos` row newer than ~2
      segment lengths, and alerts on any that does not.
      *Pass:* stop one camera → an alert fires within minutes.
- [ ] **P1 · Disk-usage alerting** at 80% and 90% of the volume — independent of the app's own purge.
      *Pass:* alerts fire on a test threshold.
- [ ] **P1 · Camera-down alerting**, including cameras stuck in the long retry backoff.
      *Pass:* a camera unplugged for 10 minutes triggers an alert.
- [ ] **P1 · ffmpeg process-count alerting** — a leak or a mass failure both show up here first.
      *Pass:* alert fires if the count deviates from the camera count by more than a small margin.
- [ ] **P1 · Host metrics** (CPU, RAM, disk I/O, network, `/dev/shm`) collected and retained.
      *Pass:* a dashboard exists showing the last 30 days.
- [ ] **P1 · Alert delivery tested end to end** — the alert actually reaches a human who is awake.
      *Pass:* a test alert is received by the on-call person.
- [ ] **P1 · `debugLog` off in production** (it is off by default — confirm).
      *Pass:* `conf.json` has `debugLog: false`.
- [ ] **P2 · Know that ffmpeg diagnostics are discarded by default.** ffmpeg's stderr is filtered
      and only printed when *both* `debugLog` and `debugLogMonitors` are true.
      *Pass:* the troubleshooting runbook says how to turn them on when diagnosing a camera.
      *Why:* `libs/ffmpeg.js:91-121`.
- [ ] **P2 · Escalation defined** — who gets paged, when, and what they do first.

---

## P. Backup & disaster recovery

- [ ] **P0 · Scheduled database backup.** There is **no** backup mechanism in the repo — the super
      panel's export omits several tables and loads whole tables into memory (it will exhaust
      memory on a 150-camera `Videos` table).
      *Do:* a `mysqldump` cron to a location **off this server**.
      *Pass:* backups appear daily off-box and are non-empty.
- [ ] **P0 · Tested restore.** A backup that has never been restored is not a backup.
      *Do:* restore the dump onto a clean machine and start the VMS against it.
      *Pass:* all monitors, users, and permissions come back and cameras start recording.
- [ ] **P1 · Config backed up** — `conf.json` and `super.json` (both gitignored, both carrying
      credentials), copied off-box on every change.
      *Pass:* current copies exist off-box; the procedure is in the runbook.
- [ ] **P1 · RTO documented** — how long to rebuild the server from bare metal, measured during the
      clean-machine rehearsal.
      *Pass:* a number the client has agreed to.
- [ ] **P1 · State clearly that footage is not backed up.** Recordings are protected by RAID only.
      A fire, theft, or array loss loses the archive.
      *Pass:* the client has acknowledged this in writing.
- [ ] **P2 · Backup restore drill repeated quarterly** — added to the operations calendar.

---

## Q. UI regression pass

Walk every page an operator will touch, in the client's actual browser. Confirm it loads, does its
job, and shows no console errors.

- [ ] **P1 · Login page** — including a wrong password and logout.
- [ ] **P1 · Home dashboard** — camera tiles, disk usage, system status.
- [ ] **P1 · Monitor list** — 150 cameras render without the page becoming unusable.
- [ ] **P1 · Monitor settings** — open, change one field, save, confirm the camera restarts and records.
- [ ] **P1 · Live grid / video wall** — including fullscreen and cycling.
- [ ] **P1 · Timeline / wall video view.**
- [ ] **P1 · Video browser** (calendar/date view).
- [ ] **P1 · ONVIF scanner**, **ONVIF bulk config**, **bulk monitor edit** — see section H.
- [ ] **P2 · Sub-account manager, permission sets, API keys.**
- [ ] **P2 · Super panel** — system info, config editor, log viewer, mount manager.
- [ ] **P2 · Branding correct** ("Powered by LIMCO") and no stray upstream Shinobi branding or the
      "not activated" nag confusing operators.

---

## R. Documentation & handover

- [ ] **P1 · Operator runbook** — daily checks, how to find footage, how to export a clip.
- [ ] **P1 · "A camera is down" procedure** — how to tell, what to check, when to escalate.
- [ ] **P1 · Restart & recovery procedure** — how to safely restart the VMS and what to expect
      (including the multi-minute camera start time).
- [ ] **P1 · As-built configuration sheet** — every value decided in this checklist: retention days,
      storage quota, camera count, IP scheme, credentials location, deployed commit SHA.
- [ ] **P1 · Operator training session** delivered, with the runbook in hand.
- [ ] **P1 · Escalation contacts** — who to call, in what order, with what information.
- [ ] **P1 · Acceptance sign-off sheet** — the client signs that the system does what was agreed,
      referencing this checklist.

---

## S. Explicitly accepted risks

Every item here is a **decision**, not an oversight. Each should be initialled by whoever accepts it,
so nothing becomes a surprise later.

- [ ] **No whole-server failover.** Durability is RAID-level: a failed *drive* is survived; a failed
      *server* stops recording until it is fixed. N+1 failover is designed-for-later per
      [`docs/07`](docs/07-Standalone-Rollout-Plan.md). — *Accepted by: ______*
- [ ] **Footage is not backed up off-box.** RAID protects against drive failure, not against fire,
      theft, or array loss. — *Accepted by: ______*
- [ ] **`cws` is abandoned but load-bearing** (7 files, including the websocket engine). Migration to
      `ws` is deferred. — *Accepted by: ______*
- [ ] **The ONVIF library migration is partial.** The Device Manager still uses the older library
      kept alive by a vendored patch. — *Accepted by: ______*
- [ ] **There is no automated test suite** and no CI tests or linting. Quality rests on this
      checklist and the load test. — *Accepted by: ______*
- [ ] **Deferred dependency upgrades** — `nodemailer`, `mysql`→`mysql2`, `googleapis`. — *Accepted by: ______*
- [ ] **The master/child cluster is deliberately disabled** — its failure modes are catastrophic by
      design (see [`docs/06`](docs/06-Architecture-Decision.md)). Growth means *more servers*, not
      clustering. — *Accepted by: ______*
- [ ] **PTZ control is out of scope** for this deployment. — *Accepted by: ______*
- [ ] **AI detection is out of scope.** The `/motion` seam remains available for a future external
      service. — *Accepted by: ______*

---

## Sign-off

| Stage | Owner | Date | Result |
|-------|-------|------|--------|
| Bench (B–E) | | | |
| Function (F–L) | | | |
| Load (M) | | | |
| Chaos (N) | | | |
| Real-camera pilot | | | |
| **Go-live approved** | | | |
