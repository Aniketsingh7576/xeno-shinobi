# LIMCO VMS — Deploy Steps & Owner Actions

Companion to `PRODUCTION_READINESS.md` and `BENCH_AUDIT_RESULTS.md`. This lists (1) what
was fixed in code, (2) the steps that need **sudo/you**, and (3) the migrations to run
**supervised** (not blind). Applied to branch `vms-core-hardening`.

---

## 0. THE GATING BLOCKER — camera-count ceiling = 15 (your action)
`s.cameraCount` is a Shinobi **license/subscription ceiling**, measured live at **15** on
this install. At boot, monitors past 15 **silently never load**. It comes from an obfuscated
checker (`libs/checker/actCheck.js`) and is a **licensing/activation matter, not a code fix**.
**150 cameras cannot run until this is raised.** Resolve with Shinobi licensing/activation
before anything at scale. *(I did not attempt to bypass a license check.)*

---

## 1. Code fixes already applied (activate on next restart)
These are committed to the working tree; they take effect on the next `systemctl restart`.

| File | Fix | Checklist |
|------|-----|-----------|
| `backend/conf.json` | removed OS-disk `addStorage`; added `requireStorageMount`, `databasePoolMax:30` | C#7, D |
| `backend/libs/folders.js` | **NAS mount-health guard** — refuses to boot if the `.nas-online` sentinel isn't readable (no more silent OS-disk recording) | C#3 |
| `backend/libs/config.js` | **fatal on corrupt conf.json** — refuses to boot with empty defaults | E |
| `backend/libs/system/utils.js` | **atomic config write** + `.bak` backup + JSON validation | E, P |
| `backend/libs/monitor/utils.js` | **bounded backoff ramp** (was 1 hour → now 5-min cap); **substream `splice(-1)` guard** | F#15, I |
| `backend/libs/scanners.js` | **auth-gate ONVIF socket verbs** (was unauthenticated pre-login SSRF / camera reconfig) | H/K |
| `frontend/assets/js/bs5.monitorBulkEdit.js` | **RTSP password parser** handles `@ : /` (no more silent recording loss on bulk edit) | H |
| `frontend/assets/js/bs5.onvifScanner.js` | **dedupe on host:port:path** (no longer drops a 2nd camera behind one host) | H#19 |

**To activate:**
```bash
sudo systemctl restart limco-vms
```
Then confirm: single instance, all record-mode cameras writing, no boot error in the log.

> ⚠️ The **mount-health guard is fail-closed**: if `/mnt/nas/.nas-online` is not readable it
> refuses to boot (by design). The bench sentinel is present, so it boots. To disable for a
> legitimate local-storage install, set `"requireStorageMount": false` in conf.json.

---

## 2. systemd unit — install the hardened version (sudo)
`deploy/limco-vms.service` now adds `StartLimitIntervalSec=0` (keeps retrying after a slow
boot — fixes the Aug-12/26 "gave up after reboot" failures) and `LimitNOFILE=65535`.
```bash
sudo cp deploy/limco-vms.service /etc/systemd/system/limco-vms.service
sudo systemctl daemon-reload
sudo systemctl restart limco-vms
```
**Stable Node path (P0 — do when convenient):** the unit still pins the nvm path. Install
Node 20 system-wide (or symlink) and change `ExecStart` to a stable path:
```bash
# option A: symlink the current node to a stable path
sudo ln -sf "$(readlink -f "$(which node)")" /usr/local/bin/node
# then edit ExecStart=/usr/local/bin/node camera.js  and daemon-reload + restart
```

---

## 3. Log rotation (sudo) — P0
```bash
sudo cp deploy/logrotate-limco-vms /etc/logrotate.d/limco-vms
sudo logrotate --debug /etc/logrotate.d/limco-vms   # dry-run to confirm
```

## 4. External recording-liveness alert (sudo/cron) — P0
Runs outside the VMS, so it catches a dead camera.js. Set `ALERT_EMAIL` for delivery.
```bash
sudo chmod +x /home/brain/xeno-shinobi/deploy/liveness-check.sh
# every 5 min (adjust DB_USER/KE/ALERT_EMAIL for production):
( sudo crontab -l 2>/dev/null; echo "*/5 * * * * ALERT_EMAIL=ops@yourco.com /home/brain/xeno-shinobi/deploy/liveness-check.sh >> /var/log/limco-liveness.log 2>&1" ) | sudo crontab -
```

## 5. Off-box DB + config backup (sudo/cron) — P0
Point `DEST` at an OFF-box location (another host/array). Uses `--single-transaction` (no
OOM, no lock — unlike the super-panel export).
```bash
sudo chmod +x /home/brain/xeno-shinobi/deploy/db-backup.sh
( sudo crontab -l 2>/dev/null; echo "30 2 * * * DEST=/mnt/backup/limco /home/brain/xeno-shinobi/deploy/db-backup.sh >> /var/log/limco-backup.log 2>&1" ) | sudo crontab -
```
**Then rehearse a restore** onto a clean machine (P0 — a backup never restored is not a backup).

---

## 6. Network hardening (your decision)
- **Bind + firewall (P0):** the app binds all interfaces. Set `"ip": "<LAN-IP>"` in conf.json,
  and firewall port 8080 to the operator subnet: `sudo ufw allow from <subnet> to any port 8080`.
  *(Not changed on the bench — a wrong bind would lock you out of the UI.)*
- **HTTPS (P1):** terminate TLS at a reverse proxy (nginx/caddy) or set `ssl` in conf.json —
  operator passwords currently traverse the network in cleartext.
- **super.json email (P0):** change the superuser mail from the default `admin@shinobi.video`
  (password was already changed). Consider salted hashing (`passwordType` PBKDF2 mode).

---

## 7. Supervised DB migrations — DO NOT run blind (need runtime validation)
Run these in a maintenance window, with the ability to roll back, and watch recording after.

**(a) Monitors uniqueness (P0, D#14):**
```sql
SELECT ke,mid,COUNT(*) c FROM Monitors GROUP BY ke,mid HAVING c>1;   -- expect none; dedup if any
ALTER TABLE Monitors ADD UNIQUE KEY monitors_ke_mid_unique (ke,mid);
```
After this the add-path can be switched to an idempotent upsert (`INSERT ... ON DUPLICATE KEY
UPDATE`) — code change, test a re-add.

**(b) Phantom Videos rows (P2) — coordinated code+DB, do together:**
The orphan scan inserts a duplicate ~15s "ghost" row for the in-progress segment. Fixing this
means (i) excluding the currently-recording file from the orphan scan **and/or** (ii) making the
completed-segment insert upsert on `(ke,mid,time)`. **Do NOT add `UNIQUE(Videos.ke,mid,time)`
without first changing the insert to upsert** — the current plain INSERT would then ERROR on the
second insert and could break segment recording. Cleanup of existing phantoms:
```sql
SELECT ke,mid,time,COUNT(*) c FROM Videos GROUP BY ke,mid,time HAVING c>1;  -- review, keep the larger/real row
```

**(c) Videos query index (P1, D4) — safe, but do in a window (locks a large table):**
```sql
ALTER TABLE Videos ADD INDEX videos_ke_mid_time (ke,mid,time);   -- eliminates the timeline filesort
```

**(d) utf8mb4 (P2):** convert charset if 4-byte camera names (emoji/rare CJK) are needed.

---

## 8. Still open in PRODUCTION_READINESS.md (hardware / soak / sign-off — cannot be done on the bench)
Ceiling licensing (§0) · 24h+ soak & 150-camera load stages (M) · real-camera pilot · RAID/power/
NAS-yank/UPS chaos drills (N) · R670 BIOS/RAID/PSU/network & /dev/shm on real HW (B) · restore
rehearsal & RTO (P) · visual UI regression (Q) · all "decision recorded / accepted by ___ /
client sign-off" items (E,K,R,S).

## 9. Second-pass code fixes (also applied — activate on the same restart)
`engines`+`.nvmrc`+runtime Node-20 assertion (B1) · ffmpeg-missing → fatal exit (B2) · CDN
phone-home gated behind P2P (K7) · X-Forwarded-For only trusted with `config.trustProxy` +
**exact** IP-pin match (K8) · stale purge-lock now clears across the whole purge band (C4a) ·
ONVIF scan range cap (5000 targets) with controller cleanup (H4).

## 10. Genuinely deferred — need a running instance to validate (do NOT blind-apply)
These touch delicate socket/DB/session paths; a wrong change destabilizes the running system,
and none can be runtime-tested without the restart:
- **DB reconnect retry on the callback path** (D7) — the `knexQuery` callback path is used by many
  callers; only the Promise path retries today.
- **Substream leaks** (I3) — spawn-without-viewer (needs a post-spawn no-viewer teardown timer) and
  disconnect-routing (removing the early `return` naively **deletes the shared user session** when a
  video-tile socket closes — must guard user-deletion to the main control socket only).
- **Blank-stream diagnosability** (I5) — per-frame logging would flood; add a *one-shot* state-change
  log or use this triage: is ffmpeg alive → is the substream spawned (`toggleSubstream?action=status`)
  → is `mp4frag[channel]` present → is the tile's video socket connected.
- **monitor-status persistence** (O3, new `MonitorStatus` table), **per-IP brute-force throttle** (K6),
  **usedSpace vs statfs periodic reconcile** (C8).

## 11. Decisions (yours) still open
DST: set `"useUTC": true` **or** schedule a restart at each DST change (F7) · stall-watchdog `cutoff`
(F5, shorter = less loss, more files) · salted password hashing (re-hashes existing users).
