# Server Hardware Requirements — 150 Camera Deployment

**Software:** LIMCO VMS (xeno-shinobi platform)
**Scope:** 150 × 2 MP IP cameras, continuous 24×7 recording + live dashboard
**Date:** 2026-06-23

---

## 1. Executive Summary

The LIMCO VMS records video in **copy (remux) mode** by default — it writes each
camera's native H.264/H.265 stream straight to disk **without re-encoding**. This is
the industry-standard way to run CCTV at scale and means a **single server** comfortably
handles 150 cameras.

> **The bottleneck for a 150-camera system is disk throughput and network bandwidth —
> NOT the CPU.** The specification below is sized accordingly.

---

## 2. Recommended Server Specification

| Component | Recommended | Minimum | Notes |
|-----------|-------------|---------|-------|
| **CPU** | 16-core / 32-thread server class — Intel Xeon Silver 4416+ / Gold 5416S, or AMD EPYC 7313P / 7443P | 16-core Ryzen 9 7950X | Sized for ~150 copy-mode streams + dashboard sub-streams + FFmpeg overhead |
| **RAM** | 64 GB | 32 GB | Node.js + many FFmpeg processes + OS disk cache |
| **OS / Database disk** | 500 GB NVMe SSD | 250 GB SSD | OS + VMS database must be on SSD, separate from recordings |
| **Recording storage** | 100 TB usable (10 × 10 TB enterprise HDD) on RAID 5/6 or ZFS | RAID required | Surveillance/enterprise-rated 24×7 drives (Seagate Enterprise per BOQ) |
| **Network (NIC)** | 10 Gbps | Dual 1 Gbps (bonded) | ~600 Mbps sustained inbound; single 1 GbE is too close to the ceiling |
| **GPU** | Optional — required **only** if running LIMCO fire detection (CUDA, e.g. RTX 3050+) | None for VMS | The VMS itself needs no GPU in copy mode |
| **Power** | Dual PSU + UPS | UPS | 24×7 uptime, graceful shutdown on power loss |

---

## 3. Why CPU Is Not the Bottleneck

The VMS defaults to `copy` mode for recording, live stream, and sub-stream.
In copy mode the CPU only moves video packets from camera → disk — it does **not**
decode or re-encode them. Per-camera CPU cost is therefore very low.

> ⚠️ **Critical configuration rule:** Cameras must stay in **copy mode**.
> If cameras are switched to re-encode (`libx264`), CPU cost rises ~10–20× per camera
> and 150 cameras would require a server cluster. Do not enable re-encoding at scale.

The only modest CPU cost comes from the dashboard sub-streams. The dashboard is already
tuned for this:
- **Home tiles** — tiny 426×240 snapshots (1 fps)
- **Live grid / fullscreen / recording** — 720p sub-stream
- **No 4K anywhere** — recording uses the sub-stream (standard CCTV practice)

---

## 4. The Real Bottlenecks — Sizing Math

Assumptions: 150 × 2 MP cameras @ ~4 Mbps per stream.

| Resource | Load | Implication |
|----------|------|-------------|
| **Network inbound** | 150 × 4 Mbps ≈ **600 Mbps sustained** | Requires 10 GbE (or bonded 1 GbE). A single 1 GbE link is unsafe. |
| **Disk write throughput** | ≈ **75 MB/s sustained, 24/7** | Requires RAID + enterprise-grade HDDs for write endurance + redundancy. |
| **Storage capacity** | 100 TB usable (per BOQ) | Retention period depends on bitrate; 100 TB is the BOQ allocation. |

If the build under-performs, the disk array or NIC will saturate first — not the CPU.

---

## 5. Storage Notes

- **Separate OS/database from recordings.** OS + VMS database on NVMe SSD; recordings on
  the HDD array. Mixing them causes database stalls under heavy write load.
- **Use RAID 5/6 or ZFS** for redundancy — a single failed drive must not lose footage.
- **Use surveillance/enterprise HDDs** (the Seagate Enterprise drives in the BOQ are
  correct). Desktop drives are not rated for continuous write workloads.

---

## 6. Validation Recommendation (Important)

The 150-camera figure is correct industry sizing for copy-mode streams on this platform.
Before final sign-off for a guaranteed 150-camera deployment, a **staged load test** is
recommended:

1. Bring up ~40 cameras — confirm CPU, FFmpeg process count, DB, and disk write are stable.
2. Scale to ~80 cameras — re-confirm.
3. Scale to 150 cameras — confirm under full load.

The hardware will not be the surprise; per-camera process management and database load
under full count are what a load test validates.

---

## 7. Summary Statement

> For 150 cameras: a 16-core Xeon/EPYC server, 64 GB RAM, 10 GbE network, and a 100 TB
> RAID HDD array (already in the BOQ), plus an NVMe SSD for OS and database. CPU is
> comfortable because the software records in **copy mode** (no re-encoding). The real
> cost drivers are **disk throughput and network bandwidth**, not CPU. A GPU is required
> only if fire detection is also deployed.
