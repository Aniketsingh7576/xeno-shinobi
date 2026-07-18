# Standalone Rollout Plan (grow-as-you-go, RAID-level durability)

**Goal:** move to the industry standalone pattern (per [`06-Architecture-Decision`](06-Architecture-Decision.md))
in a way that **works for one server now and scales to many later with no rework**.

**Durability bar (chosen):** survive a **drive** failing — RAID 6 + backups + watchdogs.
N+1 whole-server failover is **designed-for-later**, not built now.

> Verified against the code: `childNodes` is unset in `conf.json`, so the app **already
> defaults to standalone** (`config.js:62-70`: `enabled=false`). So "moving" is mostly
> *deploying correctly* + a few safeguards — not a code migration.

---

## The shape we're building toward

```
Phase 1 (now):        [ Server A ] ── NAS vol A        ← one standalone box, operators log in directly
Phase 2 (2nd deal):   [ Server A ][ Server B ] ── NAS  + thin Directory (one login, unified view)
Phase 3 (scale):      [ A ][ B ][ C ]... + Directory + federation/object-storage
```

Every server is **self-sufficient**: own cameras, own DB, own storage. Nothing is shared, so
nothing funnels. The directory (Phase 2) only holds *who-owns-what* — it never touches video.

---

## Phase 0 — One required code safeguard (do first, small)

**NAS mount-health check.** *Verified risk:* if a NAS mount goes stale but the folder still
exists, the app `fs.mkdirSync`'s the path and writes footage to the **local disk underneath**,
where it becomes orphaned (`folders.js:42-60`). Before trusting NAS storage, add a check that
the recording path is actually the mounted NAS (e.g. a sentinel file that must exist on the
NAS volume, or a mountpoint check) — refuse to start recording to a path that fails it.
*Effort: a few hours. This is the ONLY new code the RAID-level rollout requires.*

*(Deferred, not now: N+1 failover, the directory service — Phase 1/2.)*

---

## Phase 1 — Stand up ONE standalone server (the first deployment)

### Step 1 — Provision the server (native Linux recommended)
- Ubuntu Server LTS. Install: Node.js 20, FFmpeg, MariaDB, git (see `04-Glossary` if any
  term is unfamiliar; `SERVER_REQUIREMENTS_150_CAMERAS.md` for sizing).
- Run the VMS as a **systemd service** with `Restart=always` (process watchdog).

### Step 2 — NAS storage (RAID 6)
- On the NAS: create **RAID 6** + a **hot spare**; make a volume/share for this server.
- On the server: mount it, e.g. `/mnt/nas-a`. Put the **sentinel file** for the Phase-0
  mount-health check on the NAS volume.
- Size it: `cameras × ~4 Mbps × retention_days` + ~20% headroom (see `03-Data-Flow` /
  requirements doc for the math).

### Step 3 — VMS config (`backend/conf.json`) — the exact keys
```jsonc
{
  "databaseType": "mysql",                 // MariaDB — real DB server, not SQLite, for scale
  "db": { "host": "localhost", "user": "...", "password": "...", "database": "ccio", "port": 3306 },
  "videosDir": "/mnt/nas-a/videos",        // <-- recordings go to the NAS volume
  // leave childNodes UNSET  -> standalone by default (config.js:62-70). Do NOT enable it.
  // Optional extra storage targets:
  // "addStorage": [{ "name": "second", "path": "/mnt/nas-a/videos2" }]
}
```
**Critical config rule (verified failure if wrong):** the per-group storage **size limit must
be smaller than the physical NAS volume**. If the purge limit is set higher than the disk, the
disk fills to 100% before purge triggers and **recording stops + loses data**
(`videos.js:175` purge is size-limit-gated). Set the limit with headroom below volume size.

### Step 4 — Durability config (RAID-level bar)
- **Cameras in `copy` mode** (default) — never re-encode at scale.
- **MariaDB durability**: default engine config is crash-safe; add **scheduled off-box
  backups** of the DB + a **tested restore drill**.
- **NTP** enabled (so timelines are correct now and stay correct when a 2nd server joins).
- **Disk-space monitoring/alerting** (catch "disk 90% full" before it's 100%).
- **Liveness watchdog**: alert if recording files stop growing (the app has a stall-restart
  internally; add external monitoring on top).

### Step 5 — Validate before going live
Use the load-test harness (`load-test/`): simulate the target camera count, run
`watch-load.sh`, confirm the pass/fail gates in `LOAD_TEST_PLAN.md` — especially **ffmpeg
process count == camera count** (no leaks) and **gap-free segments** over 30+ minutes.

**Operators (Phase 1):** log in directly to this server's UI. No directory needed for one box.

---

## Phase 2 — Add a second server + the thin directory

When a bigger deal needs more than one server:

### Add server B
- Repeat Phase 1 for a second box + its own NAS volume. It owns a **different** set of
  cameras (its own `conf.json` monitors). Zero interaction with server A — no funnel.

### Build the directory service (the real new work, from `05-Scaling-Architecture` §5)
A small new service — three workstreams:
1. **Node registry** — list of each server's URL + which cameras it owns.
2. **Federated auth (SSO)** — one login across servers (shared JWT/OIDC the servers trust).
3. **Unified view + routing** — cross-server search (scatter-gather, merge; needs the NTP
   from Phase 1), and **deep-link/thin-proxy live view on demand** to the owning server —
   never proxy the whole fleet's video through the directory.

**Directory redundancy:** run two instances; if it's down, recording continues on every
server and operators can still reach each server directly (footage is never at risk from a
directory outage — only the unified view is).

---

## Phase 3 — Scale to thousands (later, same codebase)

Add more standalone servers; extend the directory with **federation** (a tree of directories)
and **object storage** (S3-style) so no single disk is a sink. No rewrite of the recording
core. Revisit **N+1 failover** here if a client's contract requires "recording survives a
whole host dying."

---

## What we are NOT doing (deliberately)

- ❌ **Not enabling / hardening the master-child cluster** — its catastrophes are inherent to
  the funnel design (see `06`). We turn it *off*, we don't fix it.
- ❌ **Not building N+1 failover now** — the chosen durability bar is drive-level (RAID). A
  whole server dying stops its cameras until fixed; that's accepted for now and designed so
  N+1 can be added in Phase 3 without rework.

---

## Readiness checklist (what gates each step)

| Item | Type | Blocks... | Status |
|------|------|-----------|--------|
| Camera count + retention numbers | decision | NAS sizing | plan for growth; size per deal |
| NAS with RAID 6 + hot spare | hardware | Phase 1 storage | procuring |
| NAS mount-health check | **code (small)** | trusting NAS | **do first (Phase 0)** |
| systemd service + watchdog | config | going live | standard setup |
| Storage size-limit < volume | config | avoid disk-full data loss | **must verify per box** |
| MariaDB backups + NTP + monitoring | config/ops | durability bar | standard setup |
| Load-test validation | test | sign-off | harness ready |
| Directory service | build | multi-server one-pane | Phase 2 only (not a Phase-1 blocker) |

---

## One-paragraph summary

You can proceed. The software is already standalone by default, so Phase 1 is **deploy one
server correctly** (native Linux + systemd, NAS on RAID 6, `videosDir` → the NAS mount,
storage-limit below volume size, MariaDB + backups + NTP + monitoring), validate with the
load-test harness, and operators use the server directly. The **only new code** the RAID-level
bar needs is the small **NAS mount-health check** (Phase 0). Multiple servers and the thin
**directory** come in Phase 2 when a deal needs them, and everything is designed so adding
servers, a directory, or N+1 failover later requires **no rework** of the recording core.
