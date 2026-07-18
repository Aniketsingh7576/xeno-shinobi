# Architecture Decision: Should We Move to the Industry Pattern?

**Question:** Should we move from the current master/child cluster to the industry
standalone+directory pattern — or is the current code fine if it won't cause a code or
scalability failure?

**Method:** an exhaustive adversarial analysis — 14 chaos-engineering agents (2 architectures
× 7 failure dimensions) hunted every failure/scale case against the real code, then a
verification pass confirmed or **downgraded** every catastrophic/severe claim. 28 agents,
1.7M tokens. Only *verified* findings appear below; 6 overstated claims were caught and
demoted to moderate during verification (rigor, not hype).

---

## Decision: **YES — move to the standalone pattern. But not because the current code will
crash tomorrow — because the current architecture has a structural, verified, single point
of failure that stops ALL recording, and no hardware or NAS can fix it.**

---

## The evidence — verified severity counts

| | Catastrophic | Severe | Moderate | Minor |
|---|---|---|---|---|
| **Current cluster** | 19 | 32 | 24 | 4 |
| **Industry standalone** | 9 | 9 (≈20 pre-verify) | 22 | 7 |

But the **count** isn't the real story — the **kind** of failure is.

---

## Why the current cluster is disqualifying for a "recording is sacred" product

Three **verified-catastrophic** findings, all confirmed against the code, all with the same
shape: **one machine failing stops recording across the ENTIRE fleet.**

### 1. Master dies → 100% recording outage (CONFIRMED catastrophic)
The instant the master dies (power, hardware, kernel panic, OOM, even a reboot), **every
child tears down all its FFmpeg processes** — `onDisconnectFromMasterNode →
destroyAllMonitorProcesses()` (`childUtils.js:71-86`). Recording does not continue locally,
does not buffer, does not fail over. **A single master power-loss = total recording outage
on every camera.** Verified: "the children deliberately self-terminate all capture."

### 2. Even a network *blip* to the master → that child kills all its recording (CONFIRMED catastrophic)
A transient network hiccup, a GC pause, or a master restart triggers the same
`destroyAllMonitorProcesses` on the affected child. **Recording stops for every camera on
that child for the whole outage + restart time**, and the open segment is lost. A momentary
glitch causes real footage loss.

### 3. Master dies mid file-transfer → silent, unrecoverable data loss (CONFIRMED catastrophic)
Completed segments are streamed child→master with a fire-and-forget transfer (hard-coded 2s
delay, no checksum, no retry, no resume — `childUtils.js:104-129`). If the master dies during
transfer, the file half-lands on the master with **no database row** — invisible,
unpurgeable, lost. Verified: "silent, cluster-wide, unrecoverable loss of centralized
recordings."

### Plus verified-severe structural problems
- **Child dies → sequential failover** at 2s+1s *per camera* — a 50-camera node's last camera
  waits ~150s to restart (`childNode/utils.js:83-111`). Minutes-long recording gaps.
- **Single shared DB pool (max 10 connections for the whole fleet)** — all child queries
  funnel through the master (`sql.js:8-9`, `childNode.js:160-174`). A SPOF and a scale wall.
- **No camera-ownership lock** — the same camera can be started on two nodes, both recording,
  both relaying — corruption risk.

**These are the cluster's *design*, not patchable bugs.** You cannot NAS or hardware your way
out of "the master is a single point of failure that kills all recording."

---

## What the standalone pattern's failures look like (fundamentally different)

Standalone's catastrophic cases — verified — are **almost all storage/config problems, and
every one is contained to a single server**, not fleet-wide:

| Standalone failure (verified) | Blast radius | Nature |
|---|---|---|
| Disk full / storage-limit misconfigured > NAS size | **one node's cameras** | config — fixable + monitorable |
| NAS unreachable mid-recording (no local buffer) | one node's cameras | operational — mitigate with buffer/edge |
| Stale NAS mount → footage written to wrong disk | one node | **needs a small mount-health check (code)** |
| Node dies (hardware) | **only its cameras** — others record on | the N+1 failover gap (optional) |
| Local disk fills (holds DB/stream) → clips recorded but unindexed | one node | config + monitoring |
| RAID6 triple-disk failure | one node's stored footage | hardware — RAID6 is the mitigation |

**The decisive contrast:**
- Cluster's worst = **global + structural** (one machine → total outage; can't be fixed).
- Standalone's worst = **local + operational** (fix the config, monitor the disk, spec the
  NAS; blast radius is one server).

Standalone's failures are **the normal price of running any VMS** — the same list Milestone or
Genetec operators manage. The cluster's failures are a self-inflicted single point of failure.

---

## The honest catch — standalone is not free; it demands these (verified)

Moving to standalone does **not** magically make recording bulletproof. These become
**requirements**, and the analysis flagged each:

1. **NAS reliability + a local fallback buffer** — a NAS drop currently means recording stops
   with no buffer (verified severe). Mitigate: reliable NAS networking, a small local spool,
   or edge (camera SD) recording.
2. **A mount-health check before recording** — the one genuinely new bit of *code* worth
   adding, so a stale NAS mount never silently writes to the wrong disk.
3. **Per-node DB crash-safety + off-box backups** — each node owns its DB now.
4. **Correct storage-limit config** (purge limit < physical volume) + disk monitoring — the
   full-disk cases are config/monitoring, not architecture.
5. **RAID 6** on the NAS (not RAID 5) + hot spare.
6. **N+1 failover (optional, Level-2)** — the ONE thing standalone doesn't give: a whole node
   dying stops its cameras until fixed. Add a standby recorder only if the client requires
   "recording survives a host dying."
7. **NTP time-sync + the directory's own redundancy.**

None of these require touching the recording/DB/FFmpeg core. Most are config + hardware +
monitoring. Only the mount-health check and (optional) N+1 failover are code.

---

## Head-to-head, the one table that decides it

| Failure | Current cluster | Standalone + NAS |
|---|---|---|
| **Coordinator/master dies** | ❌ **ALL recording stops** (catastrophic, verified) | ✅ recording continues; only unified view lost |
| **Network blip to coordinator** | ❌ child kills all its recording (catastrophic) | ✅ no effect on recording |
| **One node dies** | ⚠️ slow serial failover, minute-long gaps | ⚠️ its cameras stop (add N+1 to fix) — **but nothing else affected** |
| **Blast radius of any one failure** | ❌ **whole fleet** | ✅ **one server** |
| **DB scale ceiling** | ❌ single pool, max 10, all fleet | ✅ per-node, no shared ceiling |
| **Camera double-ownership** | ❌ possible, corruption | ✅ each node owns fixed cameras |
| **Mid-transfer data loss** | ❌ silent, unrecoverable | ✅ no transfer — file stays local |
| **New code-failure risk from moving** | — | ✅ **none** — standalone is the DEFAULT code path, not new code |

---

## The clinching point about "will moving cause a code failure?"

**No.** Standalone (`childNodes.enabled=false`) is the **default, already-running code path** —
the same one a single Shinobi box uses today. Moving to it *removes* the cluster code from the
execution path entirely (the SQL proxy, the file relay, the view proxy, the failover loop —
all the code the catastrophic findings live in stops running). **You are not adding risky new
code; you are switching off the riskiest code you have.** The only new code is the small
NAS-mount-health check.

---

## Final answer

**Move to standalone.** The current cluster is not "fine but unscalable" — it is **actively
dangerous for the one thing that matters most (recording)**, with three verified catastrophic,
fleet-wide, single-point-of-failure cases that no hardware fixes. Standalone trades those away
for **localized, operational risks** that are the normal cost of any VMS and are addressed by
the NAS + correct config + a few small safeguards — and it does so by turning *off* your
riskiest code, not writing new risky code.

**Do NOT** keep hardening the cluster: its catastrophes are inherent to the funnel design, not
bugs. **Do** plan the standalone rollout with the seven requirements above, treating the
NAS-mount-health check and (if the client needs it) N+1 failover as the only real code work.
