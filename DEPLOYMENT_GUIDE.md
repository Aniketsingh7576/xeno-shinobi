# LIMCO VMS — Deployment Guide

A step-by-step guide to installing the camera recording system on the client's server.
Follow the steps in order. Each step tells you **what you are doing**, **why**, the
**exact commands**, and **how to check it worked**.

---

## What you are building

A server that:
1. Connects to the security cameras over the network.
2. Records them 24 hours a day onto the NAS (the storage box).
3. Lets staff watch live video and play back old recordings in a web browser.

Three machines are involved:

```
   CAMERAS  ──────►   SERVER (Dell R670)  ──────►   NAS (storage box)
                       runs the software              keeps the video files
                              │
                              ▼
                     STAFF open a web browser
                     and watch at  http://<server-ip>:8080
```

---

## Words used in this guide

| Word | What it means |
|---|---|
| **NAS** | The storage box that holds all the recorded video. |
| **Mount** | Connecting the NAS to the server so it appears as a folder (`/mnt/nas`). |
| **Service** | The software running in the background, started automatically by the server. |
| **Terminal** | The black window where you type commands. |
| **sudo** | Put in front of a command when it needs administrator rights. It will ask for your password. |
| **ONVIF** | A common language cameras speak, so the software can find them automatically. |
| **Monitor** | One camera as set up inside the software. |
| **Licence** | Paid permission from Shinobi to use more than 15 cameras. |

---

## 3 things that will break it

Please read these. They cause most problems.

**1. The NAS needs a small marker file.**
The software will **refuse to start** unless a file called `.nas-online` exists inside
`/mnt/nas`.
*Why:* if the NAS gets disconnected, the folder `/mnt/nas` still looks normal and
writable — but it is now on the server's own disk. Without this check, the software
would quietly record onto the server's disk, fill it up, and you would lose the video.
The marker file lives **on the NAS itself**, so if the NAS is missing the file is
missing, and the software stops instead of recording to the wrong place.
👉 You create this file in **Step 3**.

**2. Do not add more than 15 cameras yet.**
The software allows only 15 cameras until the Shinobi licence is bought and activated.
If you add a 16th, it will **not** show an error — the camera simply never records.
👉 Licence is **Step 13**.

**3. Start the software one way only.**
Always start it with `sudo systemctl start limco-vms`.
Never type `node camera.js` yourself while it is already running. If two copies run at
once they fight each other and recording stops, with no clear error message.

---

## The plan

| Where | Step | What you do | Time |
|---|---|---|---|
| At the office | 1 | Pack and check things before leaving | — |
| On the server | 2 | Install the basic software the system needs | 20 min |
| On the server | 3 | Copy our application onto the server | 10 min |
| On the server | 4 | **Connect the NAS** (most important) | 20 min |
| On the server | 5 | Set up the database | 10 min |
| On the server | 6 | Enter our settings | 10 min |
| On the server | 7 | Turn the system on (as a service) | 15 min |
| On the server | 8 | Check it started correctly | 5 min |
| In the browser | 9 | Create the login account | 5 min |
| In the browser | 10 | Add the cameras | varies |
| In the browser | 11 | Set each camera to record | varies |
| In the browser | 12 | Set how long video is kept | 5 min |
| In the browser | 13 | Activate the licence (when the key arrives) | 10 min |
| Both | 14 | Final checks before you leave | 20 min |

Total for the server part: about 1.5 to 2 hours. **Do the steps in order.**

---

# STEP 1 — Before you leave the office

**Take with you:**
- [ ] The application (USB stick or the git repository)
- [ ] Camera list: IP address, username and password for each camera
- [ ] NAS details: its IP address, the shared folder name, and its username/password
- [ ] The superadmin login for our software (email and password)
- [ ] The server's IP address and network details

**Check with the client first:**
- [ ] Is the NAS installed, powered on, and is a shared folder created on it?
- [ ] Does the server have internet access? (Needed once, to activate the licence.)
- [ ] Do the cameras have **fixed** IP addresses? If a camera's IP changes later, the
      software treats it as a brand new camera and adds it twice.
- [ ] Will you have administrator (sudo) access on the server?

---

# STEP 2 — Install the basic software

**What you are doing:** installing the free programs our application needs.

Open a terminal on the server and run:

```bash
sudo apt update
sudo apt install -y ffmpeg mariadb-server nfs-common git curl
```

- `ffmpeg` — handles the video
- `mariadb-server` — the database
- `nfs-common` — lets the server connect to the NAS

**Now install Node.js version 20** (this runs our application):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Check it worked** — this must say `v20` something:
```bash
node -v
```
```bash
which node
```
👉 **Write down what `which node` prints.** You need it in Step 7. It is usually
`/usr/bin/node`.

**Set the correct time zone.** Recordings are named by the clock time, so a wrong clock
means you cannot find footage by time later.
```bash
sudo timedatectl set-timezone Asia/Kolkata
timedatectl
```
Look for **"System clock synchronized: yes"**.

**Give the system more capacity** (needed when many cameras run at once):
```bash
echo 'fs.inotify.max_user_watches=262144'  | sudo tee /etc/sysctl.d/60-limco.conf
echo 'fs.inotify.max_user_instances=512'  | sudo tee -a /etc/sysctl.d/60-limco.conf
sudo sysctl --system
echo 'tmpfs /dev/shm tmpfs defaults,size=8G 0 0' | sudo tee -a /etc/fstab
sudo mount -o remount /dev/shm
```

---

# STEP 3 — Copy our application onto the server

**What you are doing:** putting our code on the server and installing its parts.

```bash
sudo mkdir -p /opt/limco
sudo chown $USER:$USER /opt/limco
```

Now copy the folder from your USB stick into `/opt/limco/`, so you end up with
`/opt/limco/xeno-shinobi`. Then:

```bash
cd /opt/limco/xeno-shinobi
npm install
```

**Check one important fix is present.** This must print **2 or more**:
```bash
grep -c "lastError &&" node_modules/shinobi-onvif/lib/modules/device.js
```
If it prints `0`, run `npx patch-package` and check again. (This fix stops the camera
search from freezing.)

---

# STEP 4 — Connect the NAS ⚠️ most important step

**What you are doing:** making the NAS appear on the server as the folder `/mnt/nas`,
so recordings are saved there and not on the server's own disk.

### 4a. See what the NAS is sharing
```bash
showmount -e <NAS_IP>
```
Replace `<NAS_IP>` with the NAS's IP address. It will list the shared folder path.

### 4b. Connect it (test first)
```bash
sudo mkdir -p /mnt/nas
sudo mount -t nfs <NAS_IP>:/<shared/folder> /mnt/nas
df -h /mnt/nas
```
`df -h /mnt/nas` must show the **NAS's size** (for example 100 TB). If it shows the
server's own disk size, the connection did not work — stop and fix this before going on.

### 4c. Make it reconnect automatically after a restart
```bash
echo '<NAS_IP>:/<shared/folder>  /mnt/nas  nfs  defaults,_netdev  0  0' | sudo tee -a /etc/fstab
sudo mount -a
df -h /mnt/nas
```

> **If the NAS only supports Windows sharing (SMB) instead of NFS**, use this instead:
> ```bash
> sudo apt install -y cifs-utils
> sudo mkdir -p /mnt/nas /etc/limco
> printf 'username=<user>\npassword=<pass>\n' | sudo tee /etc/limco/nas.cred
> sudo chmod 600 /etc/limco/nas.cred
> echo '//<NAS_IP>/<share> /mnt/nas cifs credentials=/etc/limco/nas.cred,uid=0,gid=0,_netdev,file_mode=0664,dir_mode=0775 0 0' | sudo tee -a /etc/fstab
> sudo mount -a && df -h /mnt/nas
> ```

### 4d. Check you can write to it
```bash
touch /mnt/nas/testfile && rm /mnt/nas/testfile && echo "WRITING WORKS"
```

### 4e. ⚠️ Create the marker file — the software will not start without it
```bash
echo "nas-ok" | sudo tee /mnt/nas/.nas-online
ls -l /mnt/nas/.nas-online
```
This is the safety check explained at the top of this guide. **Do not skip it.**

---

# STEP 5 — Set up the database

**What you are doing:** creating the database where camera settings and the list of
recordings are stored. (The video files themselves go on the NAS.)

```bash
sudo systemctl enable --now mariadb
sudo mysql
```

You are now inside the database. Type these lines, replacing `<PASSWORD>` with a
password you choose (write it down — you need it in Step 6):

```sql
CREATE DATABASE IF NOT EXISTS ccio;
CREATE USER IF NOT EXISTS 'majesticflame'@'127.0.0.1' IDENTIFIED BY '<PASSWORD>';
GRANT ALL PRIVILEGES ON ccio.* TO 'majesticflame'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

You do not need to create any tables — the software creates them by itself the first
time it starts.

---

# STEP 6 — Enter our settings

**What you are doing:** telling the software where the NAS is and how to reach the
database.

```bash
nano /opt/limco/xeno-shinobi/backend/conf.json
```

Make the file look like this. Replace the two `<...>` parts:

```json
{
  "port": 8080,
  "ip": "<SERVER_IP_ADDRESS>",
  "videosDir": "/mnt/nas",
  "requireStorageMount": true,
  "databasePoolMax": 30,
  "aiServicesEnabled": false,
  "addStorage": [],
  "passwordType": "sha256",
  "db": {
    "host": "127.0.0.1",
    "user": "majesticflame",
    "password": "<PASSWORD_FROM_STEP_5>",
    "database": "ccio",
    "port": 3306
  },
  "cron": {},
  "pluginKeys": {}
}
```

Save with `Ctrl+O`, then `Enter`, then `Ctrl+X`.

What these mean:
- `ip` — the server's own IP. Without it, the system is reachable from every network.
- `videosDir` — where recordings go. This is the NAS.
- `addStorage` — must stay empty `[]`, otherwise video can end up on the server's disk.
- `aiServicesEnabled` — keep `false`. This hides the AI/Detections screens we are not using.

**Set the superadmin password.** First create the scrambled version of your password:
```bash
printf '%s' 'YourNewPassword' | sha256sum
```
Copy the long code it prints, then open the file:
```bash
nano /opt/limco/xeno-shinobi/backend/super.json
```
Put that long code as the `"pass"` value, and change `"mail"` from the default
`admin@shinobi.video` to your own email. Save and close.

---

# STEP 7 — Turn the system on

**What you are doing:** setting the software up as a *service*, so it starts on its own
whenever the server is powered on.

```bash
sudo cp /opt/limco/xeno-shinobi/deploy/limco-vms.service /etc/systemd/system/
sudo nano /etc/systemd/system/limco-vms.service
```

Change two lines:
- `WorkingDirectory=` → `/opt/limco/xeno-shinobi/backend`
- `ExecStart=` → the path you wrote down in Step 2, then a space and `camera.js`.
  For example: `ExecStart=/usr/bin/node camera.js`

Save and close, then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now limco-vms
```

**Now set up three helpers:**

Stop the log file growing until the disk is full:
```bash
sudo cp /opt/limco/xeno-shinobi/deploy/logrotate-limco-vms /etc/logrotate.d/limco-vms
```

Make the two helper scripts runnable:
```bash
sudo chmod +x /opt/limco/xeno-shinobi/deploy/liveness-check.sh
sudo chmod +x /opt/limco/xeno-shinobi/deploy/db-backup.sh
```

Allow only the office network to reach the system:
```bash
sudo ufw allow from <OFFICE_NETWORK>/24 to any port 8080 proto tcp
sudo ufw enable
```

---

# STEP 8 — Check it started correctly

```bash
systemctl status limco-vms
```
You want to see **active (running)** in green.

```bash
sudo tail -30 /var/log/limco-vms.log
```
Look for the line **"LIMCO is ready."**

**If it did not start**, the log will tell you exactly why:

| Message in the log | What is wrong | Go back to |
|---|---|---|
| `storage sentinel not found` | The NAS is not connected, or the marker file is missing | Step 4 |
| `requires Node.js >= 20` | Wrong Node.js version | Step 2 |
| `No FFmpeg found` | ffmpeg is not installed | Step 2 |
| `conf.json exists but is not valid JSON` | A typo in the settings file | Step 6 |

---

## How to start and stop the system (day to day)

```bash
sudo systemctl start   limco-vms      # start
sudo systemctl stop    limco-vms      # stop
sudo systemctl restart limco-vms      # restart after changing settings
sudo systemctl status  limco-vms      # is it running?
sudo tail -f /var/log/limco-vms.log   # watch what it is doing (Ctrl+C to exit)
```

**You normally never start it by hand.** It starts automatically when the server is
switched on, and restarts itself if it ever crashes.

**When do you need to restart it?**

| You changed | Restart needed? |
|---|---|
| `conf.json` or `super.json` | **Yes** |
| Camera settings in the web page | No |
| How long recordings are kept | No |

---

# STEP 9 — Create the login account

**Important:** the system starts with **no user accounts**. You cannot log in until you
create one here. This is the step people miss.

1. In a browser, go to: `http://<SERVER_IP>:8080/super`
2. Log in using the email and password you set in Step 6.
3. Click the **Accounts** tab.
4. Add a new account:
   - **Email** — the login for staff, e.g. `operator@client.com`
   - **Password** — choose a strong one
5. Save.
6. Log out, then go to `http://<SERVER_IP>:8080` and log in with this new account.

**Write down the Group Key.** Each account has a short code (like `XIS27BnImp`) used in
the folder names on the NAS:
```bash
mysql -u majesticflame -p ccio -e "SELECT ke, mail FROM Users;"
```

---

# STEP 10 — Add the cameras

**What you are doing:** letting the software find the cameras on the network and add
them automatically.

⚠️ **Add no more than 15 cameras** until the licence is activated.

1. Log in at `http://<SERVER_IP>:8080`.
2. In the left menu, open **ONVIF Device Manager**.
3. Fill in:
   - **IP range** — e.g. `192.168.1.1-192.168.1.254`
   - **Ports** — `80,8000,8080`
   - **Username / Password** — the camera login
4. Click **Scan**. Found cameras appear with a picture.
5. Add the ones you want.

**If a camera is not found:**
- Check you can reach it: `ping <camera_ip>`
- Try ports `8899`, `2020` or `5000`
- Double-check the camera username and password
- Some cameras lock themselves after several wrong password attempts — wait and retry

---

# STEP 11 — Set each camera to record

**What you are doing:** telling each camera how to record. **A camera does not record
until you do this.**

Open each camera's settings and set:

| Setting | Value | Why |
|---|---|---|
| **Mode** | **Record** | Any other mode means **nothing is saved** |
| Main stream | **H.264** | Browsers cannot play H.265 video |
| Video codec | **copy** | Saves the video as-is, so the server stays fast |
| Stream type | **useSubstream** | Live viewing uses the smaller stream |
| Substream address | the camera's sub-stream link | Must be filled in |
| Keep recordings for | **90 days** (or as agreed) | |

**To do many cameras at once**, use these pages in the left menu:
- **ONVIF Bulk Config** — changes settings **inside the cameras** (e.g. switch to H.264).
  **Try it on 2 or 3 cameras first.**
- **Bulk Monitor Settings** — changes settings **in our software** for many cameras.
  Each camera restarts as it is saved, so do this before staff start using the system.

> ⚠️ These cameras allow only about **2 connections at a time**. One is used for
> recording, one for live viewing. That is why the same camera must not be added twice.

---

# STEP 12 — Set how long recordings are kept

Go to **Account Settings** in the left menu and set:

- **Number of Days to keep Videos** — for example `90`
- **Max Storage Amount (MB)** — the NAS size **minus about 15%**

Both limits apply. Whichever is reached first wins. If the storage number is too small,
old video is deleted early, even though you asked for 90 days.

**How much space you need** (1080p video, recording all day):

| Cameras | 30 days | 90 days |
|---|---|---|
| 15 | about 10 TB | about 29 TB |
| 150 | about 97 TB | about 292 TB |

---

# STEP 13 — Activate the licence (allows more than 15 cameras)

1. Buy the licence at **licenses.shinobi.video**, or email **support@shinobi.systems**
   (a 150-camera licence is roughly $1,480 per year, or about $4,400 once).
2. Go to `http://<SERVER_IP>:8080/super` and log in.
3. Find **Activate** and paste the licence key. *(The server needs internet for this.)*
4. Restart: `sudo systemctl restart limco-vms`
5. **Check the limit actually changed.** In the left menu open **Storage & Retention**
   and look at "Maximum cameras". It must now say **150**, not 15.
6. Only now add the remaining cameras.

---

# STEP 14 — Final checks before you leave

**The server**
- [ ] `df -h /mnt/nas` shows the NAS, and `/mnt/nas/.nas-online` exists
- [ ] `systemctl status limco-vms` shows **active (running)**
- [ ] Restart the whole server and confirm everything comes back on its own

**The recordings** (the most important test)
- [ ] Video files are appearing on the NAS:
      `ls -l /mnt/nas/<GROUP_KEY>/<CAMERA_ID>/`
- [ ] Wait 30 seconds and check a file is **growing**
- [ ] One recording process per camera:
      `ps -C ffmpeg -o args | grep -c ch01`

**In the browser**
- [ ] Every camera shows live video
- [ ] You can play back an old recording
- [ ] You can **export a clip** and it plays on a normal computer

**Handover**
- [ ] Show the client how to find footage by date and time
- [ ] Show them how to export a clip
- [ ] Give them the login details
- [ ] Tell them clearly: **video is protected against a disk failing, but it is not
      backed up somewhere else.** Fire or theft would lose it.

---

# Common problems

| What you see | Why | What to do |
|---|---|---|
| Service will not start | NAS not connected / marker file missing | Step 4 |
| Cannot log in at `:8080` | No account created yet | Step 9 |
| Cameras after the 15th never appear | Licence limit | Step 13 |
| Camera added but nothing recorded | Camera is not in **Record** mode | Step 11 |
| Live video is blank | Camera is sending H.265, or substream not set | Step 11 |
| "Stream Not Found" | Camera added twice, or too many connections | Remove the duplicate |
| Old video disappearing too early | Storage limit set too low | Step 12 |
| Recording stopped for no reason | Someone started a second copy by hand | Step 8 |

**Useful commands**
```bash
sudo systemctl restart limco-vms          # restart everything
sudo tail -f /var/log/limco-vms.log       # watch the log
ps -C node -o pid,args | grep camera.js   # must show only ONE line
df -h /mnt/nas                            # is the NAS still connected?
```

---

# Questions you may be asked

**Can we run this in Docker instead?**
Not for this installation. Everything here — the NAS safety check, automatic start-up,
log handling, backups — was built and tested for this setup. Docker would need all of it
rebuilt and retested. It can be looked at later, calmly, not on installation day.

**Do we have to start it every morning?**
No. It starts by itself when the server is switched on.

**Can we watch all 150 cameras on one big screen?**
Not from a normal web browser — a browser cannot show that many live videos smoothly.
Large video walls use a separate hardware decoder box. Our system handles the recording,
searching and clip exporting.

**Can we change how long video is kept?**
Yes, any time, in Account Settings. No restart needed.

**Is the video backed up?**
No. The NAS protects against one disk failing. It does not protect against fire, theft,
or the whole NAS failing. Say this to the client clearly.

---

# Known limits

- **15 cameras** until the licence is activated.
- **H.264 only.** These cameras record 1080p in H.264. Their 5MP mode uses H.265, which
  browsers cannot play.
- **About 2 connections per camera** — one for recording, one for live viewing.
- **Video is not backed up off-site.**
- A large live video wall needs a hardware decoder, not a browser.

**Other documents in this folder:**
- `DEPLOY_STEPS.md` — the technical fix list
- `BENCH_AUDIT_RESULTS.md` — the full testing results
- `PRODUCTION_READINESS.md` — the complete pre-launch checklist
