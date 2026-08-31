# LIMCO VMS — Site Deployment Guide

**Target:** Dell PowerEdge R670 + NAS · Pilot: **≤15 cameras** · Full rollout: 150 (needs licence)
**Companion docs:** `DEPLOY_STEPS.md` (fix list) · `BENCH_AUDIT_RESULTS.md` (audit) · `PRODUCTION_READINESS.md` (full checklist)

> **Read this first — three rules that will bite you**
> 1. **The NAS sentinel file is mandatory.** The VMS now **refuses to start** unless `/mnt/nas/.nas-online` exists and is readable. This is deliberate (it stops footage being silently written to the OS disk). **Create it — see Phase 3.**
> 2. **Do not exceed 15 cameras** until the Shinobi licence is activated. Cameras past the ceiling **silently never load** — no error.
> 3. **Never run `node camera.js` by hand** while the systemd service is running. Two instances fight over the port and the cameras' RTSP connection limit, and recording dies silently.

---

# PART A — Before you leave

## A1. Commit the work (important)
A large amount of hardening is uncommitted. Earlier work was lost exactly this way.
```bash
cd /home/brain/xeno-shinobi
git add -A
git commit -m "vms: pilot hardening, AI-agnostic UI, branding, dashboard fixes"
```

## A2. Take with you
- [ ] This repo (git clone or USB copy) — including `patches/` and `deploy/`
- [ ] **Node 20** installer/tarball (in case the server has no internet)
- [ ] MariaDB + FFmpeg packages (if the server is offline)
- [ ] Camera credentials list (IP, user, password per camera)
- [ ] NAS details: IP, share path, protocol (NFS/SMB), credentials
- [ ] Superadmin login (email `admin@shinobi.video`, password you set — **keep out of the repo**)
- [ ] Network plan: server IP, camera VLAN/subnet, operator subnet

## A3. Confirm with the client before travelling
- [ ] Server has **internet** at least once (needed for Shinobi licence activation)
- [ ] NAS is racked, powered, and its share is created
- [ ] Camera IPs are **static or DHCP-reserved** (a camera that changes IP is re-added as a duplicate)
- [ ] You have physical/SSH access with **sudo**

---

# PART B — Server bring-up (Phase 1–6)

## Phase 1 — OS prerequisites

```bash
sudo apt update
sudo apt install -y ffmpeg mariadb-server nfs-common git curl
ffmpeg -version | head -1            # confirm ffmpeg present
ffmpeg -codecs | grep -E 'h264|hevc' # both decoders must exist
```

**Install Node 20 system-wide** (do NOT rely on a user's nvm path — the unit needs a stable path):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # must print v20.x
which node   # note this path — used in the systemd unit
```

**Raise system limits** (150 cameras ≈ 300 processes):
```bash
echo 'fs.inotify.max_user_watches=262144'  | sudo tee /etc/sysctl.d/60-limco.conf
echo 'fs.inotify.max_user_instances=512'  | sudo tee -a /etc/sysctl.d/60-limco.conf
sudo sysctl --system
```

**Size /dev/shm** (live stream segments are written to RAM). For 150 cameras allow ~8–16 GB:
```bash
echo 'tmpfs /dev/shm tmpfs defaults,size=8G 0 0' | sudo tee -a /etc/fstab
sudo mount -o remount /dev/shm
df -h /dev/shm
```

---

## Phase 2 — Deploy the application

```bash
sudo mkdir -p /opt/limco
sudo chown $USER:$USER /opt/limco
git clone <your-repo> /opt/limco/xeno-shinobi     # or copy from USB
cd /opt/limco/xeno-shinobi
npm install                                        # MUST run postinstall (patch-package)
```

**Verify the ONVIF crash patch applied** (a `--ignore-scripts` install silently skips it):
```bash
grep -c "lastError &&" node_modules/shinobi-onvif/lib/modules/device.js
# must print 2 or more. If 0: npx patch-package
```

> Paths below assume `/opt/limco/xeno-shinobi`. If you keep the existing
> `/home/brain/xeno-shinobi`, substitute it everywhere (including the systemd unit).

---

## Phase 3 — NAS connection ⚠️ most important phase

### 3a. Mount the NAS

**Option A — NFS (recommended for Linux):**
```bash
# discover the export
showmount -e <NAS_IP>

sudo mkdir -p /mnt/nas
# TEST the mount first
sudo mount -t nfs <NAS_IP>:/<share/path> /mnt/nas
df -h /mnt/nas          # confirm size = the NAS, not the OS disk
```
Make it permanent — **`_netdev` and `hard` are required**:
```bash
echo '<NAS_IP>:/<share/path>  /mnt/nas  nfs  defaults,_netdev  0  0' | sudo tee -a /etc/fstab
sudo mount -a && df -h /mnt/nas
```
> Use `hard` (the default), **never `soft`** — a `soft` mount returns I/O errors on a blip and corrupts in-flight recordings.

**Option B — SMB/CIFS** (if the NAS only offers SMB):
```bash
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/nas /etc/limco
printf 'username=<user>\npassword=<pass>\n' | sudo tee /etc/limco/nas.cred
sudo chmod 600 /etc/limco/nas.cred
echo '//<NAS_IP>/<share> /mnt/nas cifs credentials=/etc/limco/nas.cred,uid=0,gid=0,_netdev,file_mode=0664,dir_mode=0775 0 0' | sudo tee -a /etc/fstab
sudo mount -a && df -h /mnt/nas
```

### 3b. Verify it is a REAL mount (not the OS disk)
```bash
stat -c '%d %n' /mnt/nas /mnt /          # /mnt/nas device id MUST differ from /
mount | grep /mnt/nas                     # confirm nfs/cifs + _netdev
touch /mnt/nas/_writetest && rm /mnt/nas/_writetest && echo "WRITABLE OK"
```

### 3c. ⚠️ Create the sentinel file — the app will NOT start without it
```bash
echo "nas-ok" | sudo tee /mnt/nas/.nas-online
ls -l /mnt/nas/.nas-online
```
**Why:** an unmounted NAS leaves an empty `/mnt/nas` directory on the OS disk that looks writable, so the VMS would silently record to the system drive and fill it. The sentinel lives *on the NAS*, so if the NAS is missing the file is missing and the VMS refuses to start instead of losing footage.
*(Local-storage installs only: set `"requireStorageMount": false` in `conf.json`.)*

---

## Phase 4 — Database

```bash
sudo systemctl enable --now mariadb
sudo mysql
```
```sql
CREATE DATABASE IF NOT EXISTS ccio;
CREATE USER IF NOT EXISTS 'majesticflame'@'127.0.0.1' IDENTIFIED BY '<STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON ccio.* TO 'majesticflame'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```
> Use a **real password** in production and put it in `conf.json` → `db.password`.
> The schema is created automatically in code on first boot — no `.sql` import needed.

**Apply the two performance/integrity migrations** (after first boot creates the tables):
```sql
ALTER TABLE Monitors ADD UNIQUE KEY monitors_ke_mid_unique (ke,mid);
ALTER TABLE Videos   ADD INDEX videos_ke_mid_time (ke,mid,time);
```

---

## Phase 5 — Configure the app

Edit `backend/conf.json`:
```json
{
  "port": 8080,
  "ip": "<SERVER_LAN_IP>",
  "videosDir": "/mnt/nas",
  "requireStorageMount": true,
  "databasePoolMax": 30,
  "aiServicesEnabled": false,
  "addStorage": [],
  "db": { "host":"127.0.0.1", "user":"majesticflame", "password":"<DB_PASSWORD>", "database":"ccio", "port":3306 }
}
```
Key points:
- **`ip`** — bind to the LAN IP. Left unset the server listens on **all interfaces**.
- **`videosDir`** — the NAS mount.
- **`addStorage: []`** — must stay empty, or footage can land on the OS disk.
- **`aiServicesEnabled: false`** — keeps all AI/Detections UI hidden.

**Superadmin credentials** — `backend/super.json` (email + SHA-256 password hash). To set a password:
```bash
printf '%s' 'YOUR_PASSWORD' | sha256sum       # put the hash in super.json "pass"
```
Change the default email `admin@shinobi.video` too.

---

## Phase 6 — Service + operations

**Install the service** (edit `ExecStart` to your system Node path from Phase 1, and `WorkingDirectory`):
```bash
sudo cp deploy/limco-vms.service /etc/systemd/system/
sudo nano /etc/systemd/system/limco-vms.service    # set ExecStart + WorkingDirectory
sudo systemctl daemon-reload
sudo systemctl enable --now limco-vms
systemctl status limco-vms
```
The unit already includes `RequiresMountsFor=/mnt/nas` (won't start without the NAS), `StartLimitIntervalSec=0` (keeps retrying after a slow boot) and `LimitNOFILE=65535`.

**Log rotation** (without this `/var` fills and takes the server down):
```bash
sudo cp deploy/logrotate-limco-vms /etc/logrotate.d/limco-vms
sudo logrotate --debug /etc/logrotate.d/limco-vms
```

**Recording-liveness alert** (runs outside the VMS, so it catches a dead app):
```bash
sudo chmod +x /opt/limco/xeno-shinobi/deploy/liveness-check.sh
sudo crontab -e
# */5 * * * * ALERT_EMAIL=ops@yourco.com KE=<GROUP_KEY> /opt/limco/xeno-shinobi/deploy/liveness-check.sh >> /var/log/limco-liveness.log 2>&1
```

**Nightly off-box backup:**
```bash
sudo chmod +x /opt/limco/xeno-shinobi/deploy/db-backup.sh
sudo crontab -e
# 30 2 * * * DEST=/mnt/backup/limco /opt/limco/xeno-shinobi/deploy/db-backup.sh >> /var/log/limco-backup.log 2>&1
```

**Firewall:**
```bash
sudo ufw allow from <OPERATOR_SUBNET> to any port 8080 proto tcp
sudo ufw enable && sudo ufw status
```

---

# PART C — First boot verification

```bash
systemctl is-active limco-vms                       # active
ps -C node -o pid,args | grep camera.js             # EXACTLY ONE instance
sudo tail -30 /var/log/limco-vms.log                # look for "LIMCO is ready."
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/   # 200
```
**If it refuses to start, check the log for these (all intentional, fail-fast):**
| Message | Meaning | Fix |
|---|---|---|
| `storage sentinel not found` | NAS not mounted/sentinel missing | Phase 3c |
| `requires Node.js >= 20` | wrong Node | Phase 1 |
| `No FFmpeg found` | ffmpeg missing | Phase 1 |
| `conf.json exists but is not valid JSON` | bad config edit | restore `conf.json.bak` |

Then open `http://<SERVER_IP>:8080` and log in.

---

# PART D — Camera onboarding via ONVIF

## D1. Pre-checks
- Cameras powered, on the network, reachable: `ping <camera_ip>`
- Camera IPs **static or DHCP-reserved**
- Standardise camera **username/password** across the fleet where possible
- ⚠️ **Do not exceed 15 cameras** until licensed

## D2. Scan for cameras
1. Log into the VMS → sidebar → **ONVIF Device Manager** (scanner page)
2. Enter:
   - **IP range** — e.g. `192.168.1.1-192.168.1.254` (a range typo is rejected: max 5000 targets)
   - **Ports** — `80,8000,8080` (most cameras use 80)
   - **Username / Password** — the camera credentials
3. **Scan**. Found cameras appear with a snapshot + stream URL.
4. Add them (individually or **Add All**).

> De-duplication now keys on **host:port:path**, so two cameras behind one IP on
> different ports are both onboarded correctly.

**If a camera is not found:** verify it's ONVIF-enabled, try ports `8899/2020/5000`, confirm credentials, and check it isn't locked out from failed attempts.

## D3. Set each camera correctly (the architecture)
**Record the MAIN stream, view the SUB stream.**

| Setting | Value | Why |
|---|---|---|
| **Mode** | **Record** | `start` = watch-only = **nothing is saved** |
| Main stream codec | **H.264** | Browsers cannot play H.265 — playback/export would fail |
| Recording input | main (e.g. `/ch01.264`) | full quality to disk |
| Stream type | `useSubstream` | live view uses the light sub-stream |
| Substream input | sub URL (e.g. `/ch01_sub.264`) | **must be set**, or live view falls back to main |
| Video codec | **copy** | no transcode — this is what makes 150 cameras possible |
| Retention | **90 days** (or as contracted) | |
| Snapshot | on, **640×360 @ 1fps** | dashboard previews stay cheap |

**Bulk tools (use them, don't do 150 by hand):**
- **ONVIF Bulk Config** — set camera-side encoder (H.264, resolution, bitrate) across a range. **Test on 2–3 cameras first.**
- **Bulk Monitor Settings** — apply mode/retention/stream type to many monitors at once. Each save **restarts that monitor**, so run it in a maintenance window.

⚠️ **Camera connection limit:** these cameras allow only ~2 concurrent RTSP connections.
`record main (1) + live sub (1) = 2` — **no headroom**. Duplicate monitors or extra viewers pulling directly from the camera will break streams.

## D4. Verify recording actually works
```bash
ls -l /mnt/nas/<GROUP_KEY>/<MONITOR_ID>/     # .mp4 segments appearing
mysql -u majesticflame -p ccio -e "SELECT mid, COUNT(*), MAX(end) FROM Videos GROUP BY mid;"
ps -C ffmpeg -o args | grep -c ch01          # one recording process per camera
```
Watch a file grow over ~30 s. Then in the UI: open a camera, confirm live view, play a recording, and **export a clip**.

---

# PART E — Storage sizing & retention

Set in **Account Settings**:
- **Number of Days to keep Videos** → contracted retention (e.g. 90)
- **Max Storage Amount (MB)** → **NAS usable size minus ~15%**

> Both limits apply — whichever is hit first wins. A quota that is too small silently
> shortens retention. **The quota must be below the physical volume size**, or the disk
> fills to 100% before purging triggers and recording stops.

**Sizing reference — 1080p H.264, 24/7:**
| Bitrate | Per camera/day | 15 cams × 90 d | 150 cams × 90 d |
|---|---|---|---|
| 2 Mbps | 21.6 GB | ~29 TB | ~292 TB |
| 4 Mbps | 43.2 GB | ~58 TB | ~583 TB |

Add ~20% headroom + RAID parity when specifying the array.

---

# PART F — Licence activation (raises 15 → 150)

1. Purchase from **licenses.shinobi.video** (150-camera: ~$1,480/yr or ~$4,400 lifetime) or activate an existing entitlement — **support@shinobi.systems**.
2. Log into the **superadmin panel**: `http://<SERVER_IP>:8080/super`
3. **Activate Key** → paste the licence key (needs internet to reach the licence server).
4. `sudo systemctl restart limco-vms`
5. **Verify the ceiling actually moved** — it must report 150, not 15:
   - Sidebar → **Storage & Retention** → "Maximum cameras", or `/super` → System Info
6. Only now add cameras beyond 15.

**Ask Shinobi before buying:** does activation require internet *periodically* or once? Is there an **offline/air-gapped** activation? What happens to a subscription that can't phone home? How do you move the licence if the server is replaced?

---

# PART G — Final go-live checklist

**Infrastructure**
- [ ] NAS mounted, in `/etc/fstab`, survives reboot · sentinel `.nas-online` present
- [ ] `/mnt/nas` is a real separate volume (not the OS disk)
- [ ] MariaDB running, `ccio` created, strong password in `conf.json`
- [ ] Node 20 system-wide; systemd `ExecStart` uses a stable path
- [ ] `/dev/shm` sized; inotify limits raised; `LimitNOFILE` in the unit
- [ ] Firewall restricts 8080 to the operator subnet; `ip` set in `conf.json`

**Application**
- [ ] Service enabled + auto-starts; single instance; clean log
- [ ] Superadmin password + email changed from defaults
- [ ] Retention days + Max Storage Amount set to real values
- [ ] `addStorage` empty; `aiServicesEnabled: false`
- [ ] Both DB migrations applied

**Cameras**
- [ ] All onboarded (**≤15 until licensed**), one monitor row each
- [ ] Every camera: **Record** mode, **H.264**, **copy**, substream set
- [ ] Files landing on the NAS; `Videos` rows present; live view works; clip export works

**Operations**
- [ ] logrotate installed · liveness cron alerting · nightly backup running
- [ ] **Restore rehearsal done** (a backup never restored is not a backup)
- [ ] Reboot test: server power-cycled → everything returns with no manual steps

---

# PART H — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Service won't start | sentinel missing / NAS not mounted | `mount -a`, recreate `.nas-online` |
| Cameras beyond ~15 never appear | licence ceiling | activate licence (Part F) |
| Recording not happening | monitor in **watch-only** | set mode to **Record** |
| Live view blank | H.265 main, or substream input unset | set H.264 / set substream URL |
| "Stream Not Found" | camera RTSP connection limit exceeded | remove duplicate monitors, kill stale ffmpeg |
| Footage disappearing early | Max Storage Amount too small | raise quota to NAS size − 15% |
| Recording stopped after a UI save | two `camera.js` instances | `ps -C node`; run only via systemd |
| `/var` full | logrotate not installed | Phase 6 |
| Playback/export fails | recorded in H.265 | record H.264 |

**Useful commands**
```bash
sudo systemctl restart limco-vms
sudo tail -f /var/log/limco-vms.log
ps -C node -o pid,args | grep camera.js       # must be ONE
ps -C ffmpeg -o args | grep -c ch01           # one per camera
df -h /mnt/nas /dev/shm /
mysql -u majesticflame -p ccio -e "SELECT mid,mode FROM Monitors;"
```

---

# PART I — Known limits & deferred work

**Hard limits**
- **Camera ceiling 15** until licensed — the single blocker for 150.
- **Browser-based live view**: a browser cannot smoothly decode ~80+ tiles. A large video wall needs a **hardware decoder (NVD)** or one display machine per few tiles. Shinobi handles recording/management/export.
- **~2 RTSP connections per camera** — record main + view sub uses both.
- **H.264 only** (these cameras cap H.264 at 1080p; 5MP is H.265-only and won't play in a browser).
- **Footage is not backed up** — RAID protects a drive failure, not fire/theft/array loss. Get this acknowledged in writing.

**Deferred (safe to do after the pilot)** — see `DEPLOY_STEPS.md` §10:
DB reconnect retry on the callback path · substream spawn/disconnect leak guards · blank-stream diagnostics · monitor-status history table · per-IP brute-force throttle · `usedSpace`/`statfs` reconcile · HTTPS · salted password hashing · global `Theme.isDark` light/dark mismatch (currently patched per-page).

**Not yet validated (needs the real site)** — see `PRODUCTION_READINESS.md`:
24-hour gap-free soak · 150-camera load stages · RAID-pull / power-cut / NAS-yank drills · restore rehearsal · multi-day retention proof.
