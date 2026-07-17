# LIMCO VMS — Base Platform + Pluggable AI Detection Architecture

**Status:** Planning draft v1 (for discussion — not final)
**Date:** 2026-07-14
**Context:** Reusable base VMS product + per-client AI detection modules.
This client: ~100 × 2MP cameras — line crossing, person counting (in/out),
PPE (gloves/shoes/helmet), crowd detection. **No fire** for this client.

> Legend: ✅ decided · ⚠️ open / needs decision · 🔁 reuse from fire project

---

## 1. Guiding Principle (✅ decided)

**One base VMS for every client. AI detection is fully independent and pluggable —
wired in per camera, per client.**

- The **base VMS (Shinobi fork)** is *identical* across all clients. It is never
  modified to add a detection type.
- **AI detections** live in a **separate service**. Each client enables whichever
  detections it bought.
- The two connect through a **tiny, fixed contract** (see §3). The VMS has zero AI
  code; the AI service has zero VMS internals.

This is how commercial VMS products (Milestone, Genetec) separate "core VMS" from
"analytics." It is the correct model for reuse.

---

## 2. The Two Worlds

```
┌─────────────────────────────────────┐        ┌──────────────────────────────────────┐
│         BASE VMS (Shinobi)           │        │      AI DETECTION SERVICE            │
│    ── SAME for every client ──       │        │   ── enabled per client/camera ──    │
│                                      │        │                                      │
│  • 24/7 recording (copy mode, CPU)   │        │  • Person detection (base model)     │
│  • live streaming (on-demand)        │◄──event─│  • Line crossing / in-out counting  │
│  • playback / clip / share           │        │  • Crowd / dwell-time (zone logic)   │
│  • users, cameras, alerts UI         │─frames─►│  • PPE: helmet / gloves / shoes      │
│  • camera list + RTSP URLs           │  (RTSP) │  • (fire — other clients only)       │
└─────────────────────────────────────┘        └──────────────────────────────────────┘
        the product you sell                       the "brains", swapped per client
```

- **Base VMS** = 1 server, CPU only, `copy` mode. No GPU. (Verified: records without
  re-encoding → low CPU → this is what makes ~150 cams/server viable.)
- **AI service** = GPU box (Python). Reads RTSP frames, runs enabled detections,
  posts events back to the VMS.

---

## 3. The Contract Between Them (✅ decided — already proven)

Only two touchpoints. Both verified working in the fire project.

1. **VMS → AI (frames):** the AI worker opens the camera's **RTSP** stream (the same
   URL the VMS already stores) and grabs frames. The VMS does nothing special.

2. **AI → VMS (events):** on a confirmed detection, the AI service calls the VMS
   **`/motion` HTTP route**:
   ```
   GET /<API_KEY>/motion/<GROUP_KEY>/<MONITOR_ID>?plug=cameraAI&name=<evt>&reason=<Type>&confidence=<0-100>
   ```
   The VMS records the clip + shows the alert live. **`reason` is just a label**
   ("PPE_NoHelmet", "Crowd", "LineCross_In") — the VMS never needs to understand it.
   🔁 This is `shinobi_sink.py`, reused as-is.

> Because the contract is this thin, adding/removing a detection type **never touches
> the VMS**. That is the whole point.

---

## 4. AI Service Design (efficient, still modular)

**One worker per camera, grab the frame ONCE, run that camera's enabled modules on it.**
(Avoids pulling each RTSP stream multiple times.)

```
Camera N frame ──grab once every ~1-2s──►  [person model]  → counting / crowd / line logic
                                           [PPE model]      → helmet / glove / shoe logic
                                                            → events POSTed to VMS /motion
```

- ✅ **Periodic sampling** (~1 frame / 1–2s), NOT continuous 25fps tracking.
  This is the single biggest cost saver — decided with client scope in mind.
- Detection modules are **independent code units** sharing only the frame grab.
- Per-camera config decides which modules run + their zones/lines.

### 4.1 What we reuse from the fire project (🔁)

| Fire file | Reuse | Note |
|---|---|---|
| `run.py` (per-camera threaded RTSP loop, buffer-drain, reconnect, confirm-hits, cooldown) | ✅ ~as-is | The hard plumbing. Dial `check_interval` 0.5s → ~1.5s for this workload. |
| `shinobi_sink.py` (`/motion` sender) | ✅ as-is | Detection-agnostic already. |
| `cameras.json` (per-camera + defaults) | ✅ extend | Add `detections: [...]` + zone/line coords per camera. |
| `detector.py` (single fire model) | 🔁 replace | Becomes a **pluggable detector registry** running each camera's enabled modules. |

**~70% of the AI service already exists as reusable code.** New work = detector
interface + the models/logic below.

---

## 5. Per-Detection Approach & Model Advice

| Detection | How | Model | Effort |
|---|---|---|---|
| **Person detection** (base for 3 of 4) | Detect people per frame | ✅ **Off-the-shelf YOLO (COCO person)** | Low — most reliable task in CV |
| **Line crossing** | Logic: person box-center crosses a defined line between samples | person model + our logic | Low–Med |
| **Person counting (in/out)** (✅ client wants in/out, not occupancy) | Line-crossing tally with direction → cumulative in/out | person model + our logic | Low–Med |
| **Crowd detection** (≥3 in a zone for a duration) | Logic: count person-centers in a zone, held over N consecutive samples → alert | person model + zone/dwell logic | Med |
| **PPE — helmet** | Detect person → check helmet | decent open models exist | Med |
| **PPE — gloves / shoes** | ⚠️ **the hard part** — small, occluded, varied | open models weak; **expect site-specific fine-tuning** | **High** |

### Honest headline
- **3 of 4 detections = one person model + logic we write.** Cheap, reliable, no training.
- **PPE is the real work.** Helmet is okay off-the-shelf; **gloves & shoes will likely
  need training on site images** for acceptable accuracy. ⚠️ **Set this expectation with
  the client now** — same lesson as the fire model's office false-positives.

---

## 6. Hardware Sizing (⚠️ rough — refine once PPE camera count is known)

**Base VMS server (per existing 150-cam sizing doc):** 16-core CPU, 64 GB RAM, 10 GbE,
RAID storage. **No GPU.** ~100 cams is comfortably within one server.

**AI GPU box (periodic sampling):**
- ~100 cams × 1 frame / 1.5s ≈ **~65 frames/sec** to process.
- Person model @1280px ≈ 15–30 ms/frame on a strong GPU → ~30–65 fps per GPU.
- **Person-only detections (counting/crowd/line): ~1 strong GPU may cover ~100 cams.**
- **PPE adds a 2nd model pass → roughly halves throughput.** So either:
  - a **2nd GPU**, or
  - run **PPE only on cameras that need it** (per-camera config makes this natural).
- **Ballpark: 1–2 GPUs** (e.g. RTX 4090 / A5000-class) for the AI side of 100 cams.

⚠️ **Firm numbers require a short benchmark** on the real model + resolution (the fire
project's own benchmarks: grab ≈20 ms, infer 1280 ≈68 ms — measure the new models).

---

## 7. Per-Camera / Per-Client Configuration (✅ decided: per-camera)

One config file per client drives everything. Example shape:

```jsonc
{
  "shinobi_url": "http://vms-server:8080",
  "defaults": { "check_interval": 1.5, "confirm_hits": 2, "cooldown": 30 },
  "cameras": [
    {
      "name": "Gate-A", "rtsp": "rtsp://...", 
      "group_key": "...", "monitor_id": "...", "api_key": "...",
      "detections": [
        { "type": "line_crossing", "line": [[x1,y1],[x2,y2]], "count": true },
        { "type": "ppe", "require": ["helmet","gloves","shoes"] }
      ]
    },
    {
      "name": "Hall-1", "rtsp": "rtsp://...", "...": "...",
      "detections": [
        { "type": "crowd", "zone": [[..]], "min_people": 3, "hold_seconds": 20 }
      ]
    }
  ]
}
```

- Different client = different config + different enabled modules. **VMS unchanged.**

---

## 8. Build Roadmap (proposed)

**Phase 0 — Base VMS hardening (shared across ALL clients, do once):**
- Fix streaming lag + the confirmed stale/duplicate-FFmpeg-process bug.
- Security/dependency updates; retarget Node 20.
- Confirm playback + clip-cut timeline glue; build clip **share** (only missing piece).
- Load-test 40 → 80 → 100 cameras.

**Phase 1 — AI service framework (shared skeleton):**
- Generalize `detector.py` → pluggable detector registry (🔁 reuse run.py/sink).
- Extend `cameras.json` schema (per-camera `detections` + zones/lines).
- Wire person model + line-crossing + in/out counting + crowd/dwell logic.

**Phase 2 — PPE (the heavy item):**
- Helmet off-the-shelf first; collect site images; fine-tune gloves/shoes.
- Benchmark GPU throughput → finalize 1 vs 2 GPU.

**Phase 3 — This client rollout:**
- Config for the 100 cameras (which detections/zones per camera).
- Integration test → tune thresholds → sign-off.

---

## 9. Open Questions (⚠️ to resolve with client / internally)

1. **PPE accuracy bar & training data** — who supplies site images; what's acceptable
   miss/false-alarm rate? (Gloves/shoes are the risk.)
2. **How many of the 100 cameras need PPE** vs. only counting/crowd? (Drives GPU count.)
3. **Alert delivery** — just VMS dashboard, or also email/notification/dashboard KPIs?
4. **Crowd params** — exact "3 people / duration / zone size" per site.
5. **Counting reset** — daily reset? per-shift? where are tallies shown?
6. **Deployment** — VMS + AI on one box or two? (Recommend two: VMS=CPU, AI=GPU.)

---

## 10. One-Line Summary

> Build the VMS **once** (CPU, copy-mode, hardened) as the reusable product. Build the
> AI as an **independent, per-camera-configurable service** (reusing ~70% of the fire
> project's proven skeleton). 3 of 4 detections are a person model + logic; **PPE
> gloves/shoes is the real effort and needs site training.** Wire them together only
> through the thin `/motion` contract — so every future client is "same VMS + a
> different detection config."
```
