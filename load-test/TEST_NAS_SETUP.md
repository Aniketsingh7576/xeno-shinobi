# Test NAS Setup — Ubuntu box as an NFS share

Turn a spare Ubuntu 22 PC (1 TB SSD) into a **test NAS** so we can validate the VMS's
network-storage integration: mounting, the mount-health check, recording to a network
share, and NAS-drop behavior — **before** buying the real production NAS.

> **What this proves:** the plumbing (mount → record → health-check → drop handling) works.
> **What it does NOT prove:** RAID/redundancy (one SSD), or performance at scale (small box +
> WiFi). Those are separate. For the real deployment the NAS is **wired ethernet, RAID 6** —
> never WiFi. WiFi is fine only for this functional test.

Two machines:
- **NAS box** — the Ubuntu PC with the 1 TB SSD (shares a folder).
- **VMS machine** — where the VMS runs (mounts that folder, records to it).

---

## Step 1 — On the NAS box: find its IP + install NFS

```bash
# note this IP — the VMS machine connects to it (e.g. 192.168.1.50)
hostname -I

# install the NFS server
sudo apt update
sudo apt install -y nfs-kernel-server

# create the shared folder that will hold recordings
sudo mkdir -p /srv/nas/videos
sudo chown nobody:nogroup /srv/nas/videos
sudo chmod 777 /srv/nas/videos

# SENTINEL FILE for the health check — proves the real NAS is mounted (not a stale/empty mount)
echo "nas-ok" | sudo tee /srv/nas/videos/.nas-online > /dev/null
```

Export the share (replace `192.168.1.0/24` with your network range if different):
```bash
echo '/srv/nas/videos 192.168.1.0/24(rw,sync,no_subtree_check,no_root_squash)' | sudo tee -a /etc/exports
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
sudo systemctl enable nfs-kernel-server
```

Verify it's shared:
```bash
sudo exportfs -v      # should list /srv/nas/videos
```

---

## Step 2 — On the VMS machine: mount the share

```bash
# install the NFS client
sudo apt install -y nfs-common

# make a mount point
sudo mkdir -p /mnt/nas

# mount it (use the NAS box IP from Step 1)
sudo mount -t nfs 192.168.1.50:/srv/nas/videos /mnt/nas

# confirm — you should see the sentinel file we created on the NAS
ls -la /mnt/nas          # expect .nas-online to be listed
```

Make it auto-mount on boot (add to `/etc/fstab`):
```bash
echo '192.168.1.50:/srv/nas/videos  /mnt/nas  nfs  defaults,_netdev  0  0' | sudo tee -a /etc/fstab
```

---

## Step 3 — Point the VMS at the NAS

In the VMS config (`backend/conf.json`):
```jsonc
{
  "videosDir": "/mnt/nas/videos"    // recordings now write to the test NAS
}
```
Restart the VMS. Add a camera (or use a simulated one from `sim-cameras.sh`) in **record**
mode. Watch recordings appear on the NAS box under `/srv/nas/videos`.

---

## Step 4 — Test the failure cases (the whole point)

Once the mount-health check is built (see below), test these on purpose:

**a) NAS drops mid-recording** — on the NAS box:
```bash
sudo systemctl stop nfs-kernel-server    # simulate NAS going offline
```
Watch the VMS: recording writes should fail; the mount-health check should detect the mount
is gone and refuse to keep writing to the wrong place. Bring it back:
```bash
sudo systemctl start nfs-kernel-server
```

**b) Stale mount / wrong disk** — the dangerous case the health check guards against. Unmount
without the VMS knowing, so `/mnt/nas` becomes a plain local folder:
```bash
sudo umount -l /mnt/nas          # lazy unmount — /mnt/nas now points at LOCAL disk
ls -la /mnt/nas                  # .nas-online is GONE -> health check must catch this
```
Without the check, the VMS would happily write footage to the local disk under `/mnt/nas`
(orphaned). With the check, it refuses. Re-mount:
```bash
sudo mount -t nfs 192.168.1.50:/srv/nas/videos /mnt/nas
```

---

## Step 5 — The mount-health check (the one code item)

The check, in plain terms: **before recording, confirm `/mnt/nas/videos/.nas-online` exists.**
If it doesn't, the NAS is not really mounted — refuse to record there (don't silently write to
local disk). This is the Phase-0 safeguard from `../docs/07-Standalone-Rollout-Plan.md`.
(Built as a small addition to the VMS storage startup path.)

---

## Important reminders

- **WiFi is for testing only.** Real NAS = wired ethernet (10 GbE), RAID 6. Don't judge
  performance from this test.
- **Don't run the heavy load test through this box.** A 1 TB SSD over WiFi can't absorb many
  cameras — you'd measure the test box's limit, not the VMS's. Load-test to **fast local
  disk** instead (see `LOAD_TEST_PLAN.md`); use this NAS only for the functional storage test
  with a few cameras.
- **1 TB fills fast** — a few cameras for a day or two. Fine for functional testing.
