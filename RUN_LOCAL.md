# Running LIMCO VMS locally (no Docker)

Native dev/run setup for this box (Ubuntu 22.04). Two services: **MariaDB** and the
**`camera.js`** Node backend. `camera.js` runs cron internally as a worker thread —
do **not** start `cron.js` separately.

Environment that was set up:
- Node **20** via nvm (user-local; system node 12 untouched)
- MariaDB **10.6** — database `ccio`, user `majesticflame`@`127.0.0.1` (empty password)
- FFmpeg 4.4.2 (system)
- Config: `backend/conf.json`, `backend/super.json`

---

## 1. Database — MariaDB (system service)

```bash
sudo systemctl status mariadb        # check state
sudo systemctl start mariadb         # start if not running
sudo systemctl enable mariadb        # (optional) auto-start on boot
```

Verify the VMS DB user can connect:
```bash
mysql -h 127.0.0.1 -u majesticflame ccio -e "SELECT 1;"
```

---

## 2. VMS backend — camera.js (Node 20)

Must load nvm first so Node 20 is active (system node is still 12).

**Foreground (logs stream to the terminal; Ctrl+C stops):**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
cd /home/brain/xeno-shinobi/backend
node camera.js
```

**Background (detached, logs to file):**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
cd /home/brain/xeno-shinobi/backend
node camera.js > /tmp/shinobi-camera.log 2>&1 &
tail -f /tmp/shinobi-camera.log      # watch logs
```

**Or use the helper script** (from repo root):
```bash
./run.sh
```

---

## 3. Access

- Super / admin panel: http://localhost:8080/super
  (credentials are in `backend/super.json`, which is gitignored — create operator accounts here)
- Main login:          http://localhost:8080/

---

## Stop / restart

```bash
pkill -f "node camera.js"            # stop the backend
```
MariaDB keeps running as a system service; stop with `sudo systemctl stop mariadb`
only if you want the DB down too.

---

## Notes
- "This Install of Shinobi is NOT Activated" in the log is the open-source license
  nag — not an error, safe to ignore.
- The DB schema (Users, Monitors, Videos, Events, Alarms, ...) is auto-created by
  `camera.js` on first start. Nothing to import manually.
- Recordings write under `backend/videos/` and `backend/videos2/` (per `conf.json`).
