# VMS — Glossary (0 → 100)

Plain-language definitions of every term, protocol, and concept in this VMS, tied to how
each is used **in this project specifically**. Read top to bottom — the layers build on
each other. Companion to [`01-HLD`](01-HLD-High-Level-Design.md) /
[`02-LLD`](02-LLD-Low-Level-Design.md) / [`03-Data-Flow-and-APIs`](03-Data-Flow-and-APIs.md).

> **If you only learn a few**, jump to [The 12 that matter most](#the-12-that-matter-most).

---

## Layer 1 — Camera & video basics

| Term | Plain meaning | In this VMS |
|------|---------------|-------------|
| **RTSP** | The "live video pipe" protocol. An `rtsp://...` address is a camera's live feed URL. | The VMS *pulls* each camera's feed over RTSP. |
| **H.264 / H.265** | Video **compression formats**. Cameras squeeze video into these to fit over a network. H.265 ≈ half the size of H.264 for the same quality. | Recorded **as-is** (copy mode), not re-compressed. |
| **Codec** | "Coder-decoder" — the method used to compress/decompress video. | `copy` = don't re-code, pass through. |
| **Bitrate** | Data per second (e.g. 4 Mbps). Higher = better quality but bigger files + more bandwidth. | A 2 MP camera ≈ 4 Mbps. Drives storage + network math. |
| **Main stream / sub stream** | Cameras output two feeds: a big high-res "main" (for recording detail) and a small low-res "sub" (for viewing many at once). | The wall grid uses the **sub** stream — that's why it stays smooth. |
| **FPS** (frames/sec) | How many images per second. | CCTV runs 12–15 fps (smooth enough, saves storage vs. 30). |
| **Resolution / MP** | Image size. "2 MP" ≈ 1920×1080 (Full HD). | More MP = sharper but bigger files. |

---

## Layer 2 — How video reaches the browser (the `stream_type` setting)

| Term | Plain meaning | Trade-off |
|------|---------------|-----------|
| **HLS** | Chops live video into small file chunks the browser downloads. | Reliable but **laggy** (several seconds behind). The old default that caused the original lag. |
| **MP4 / mp4frag / MSE** | Streams video continuously through the browser's built-in video engine (**MSE** = Media Source Extensions). | **Low latency.** |
| **MJPEG** | Sends video as a rapid sequence of full JPEG images. | Low delay but **heavy** (each frame is a whole picture). |
| **FLV** | Older Flash-style streaming container. | Medium latency; legacy. |
| **WebSocket** | An always-open two-way browser↔server connection (unlike normal requests that open/close each time). | Used for live **push** — instant alerts, status, dashboard updates without refresh. |

---

## Layer 3 — Storage & recording

| Term | Plain meaning | In this VMS |
|------|---------------|-------------|
| **Segment / segmenting** | Recording is chopped into fixed-length pieces, not one giant file. | 15-minute `.mp4` segments. A crash loses ≤ 15 min, not everything. |
| **Orphan / orphaned video** | A recorded file on disk that's missing from the database index. | An orphan-recovery scan finds these and re-adds them, so no footage is silently lost. |
| **Remux** | Repackaging video into a different container **without re-compressing**. | This is what "copy mode" does. |
| **Retention** | How many days of footage are kept before old recordings auto-delete. | Drives storage size (30 days × 150 cameras ≈ 130 TB). |
| **RAID** | Combining multiple drives with redundancy so one drive dying loses **no** footage. | Required for 24/7 recording. (Hardware.) |

---

## Layer 4 — System architecture

| Term | Plain meaning | In this VMS |
|------|---------------|-------------|
| **Node.js** | The platform the backend runs on (JavaScript on the server). Its main logic is **single-threaded** (one "brain"). | Why spreading camera work into separate processes matters. |
| **Process** | An independent running program with its own memory. If one crashes, others survive. | **One FFmpeg process per camera** — the core isolation design. |
| **Thread** | A smaller unit of work inside a process. | The code's "camera thread" actually means the per-camera child process. |
| **Spawn** | To launch a new process. | The VMS "spawns" an FFmpeg process for each camera. |
| **Detached process** | A child process that keeps running on its own, not force-killed when the parent restarts. | Each camera's process is detached. |
| **Daemon / service** | A program that runs continuously in the background. | The VMS itself; on Linux run as a `systemd` service so it auto-starts/restarts. |
| **stdio / pipe** | The channels a parent uses to talk to a child process. | Numbered pipes carry different things from each camera's FFmpeg (pipe 8 = finished recording names, pipe 1 = live video). |
| **Event loop** | Node.js's mechanism for juggling many tasks on one thread. | When "the master is the bottleneck at thousands," it's the event loop getting overwhelmed. |

---

## Layer 5 — Data & the backend

| Term | Plain meaning | In this VMS |
|------|---------------|-------------|
| **Database (DB)** | Where everything that *isn't* video is stored: cameras, users, the *index* of recordings, events. | Video files live on disk; the DB is the **catalog**. |
| **SQL** | The language for talking to the database. | "Give me Camera 5's recordings from yesterday." |
| **SQLite vs. MySQL/MariaDB** | SQLite = a simple single-file DB (small setups). MySQL/MariaDB = a real DB server (for scale). | This install runs **MariaDB**. |
| **knex** | A helper that writes DB queries in JavaScript and switches DB engines without rewriting. | The VMS's query layer. |
| **Schema** | The DB structure — which tables exist and their columns. | Monitors, Videos, Events, Users, API, Files… (see [`03`](03-Data-Flow-and-APIs.md#3-database-schema)). |
| **Migration** | A script that updates the DB structure on upgrade without losing data. | `database/migrate/*.js`. |
| **Multi-tenancy** | One system serving multiple separate customers, keeping data isolated. | Done via a **group key** (`ke`) tagged on every record. |

---

## Layer 6 — Web & security

| Term | Plain meaning | In this VMS |
|------|---------------|-------------|
| **API** | The set of "commands" the VMS exposes over the web. | ~130 of them. The browser **and** the AI service talk to the VMS through its API. |
| **Endpoint / route** | One specific API command (one URL the server answers). | e.g. `/videos/...`, `/motion/...`. |
| **Express** | The web-server library handling those routes. | The HTTP front door. |
| **Socket.IO** | The library for live WebSocket push. | Alerts, status, stream signaling. |
| **Authentication (auth)** | Proving who you are. | Two kinds: a **session** (you logged in) or an **API key** (a secret for programs). |
| **API key** | A long secret string letting a program access the VMS without a human login. | The AI server uses one to post detections. |
| **Session** | Your logged-in state, tied to your browser (and IP in this VMS). | |
| **Reverse proxy** | A server (e.g. Nginx) in front of the VMS handling HTTPS, load, security. | Common in production; not required. |

---

## Layer 7 — Scaling & operations

| Term | Plain meaning | In this VMS |
|------|---------------|-------------|
| **Copy mode** | Recording **without re-encoding** — just moving data. | **THE key term.** Keeps CPU tiny; the whole scale story depends on it. |
| **Transcoding / re-encoding** | Re-compressing video (e.g. to change resolution). | Expensive — 10–20× the CPU. **Avoid at scale.** |
| **Hardware acceleration (GPU / NVENC / VAAPI)** | Using a graphics card to encode video fast. | The VMS doesn't need this (copy mode). Only the **AI** service needs a GPU. |
| **Master / child node** | The clustering model: a **master** coordinates; **child** nodes do the heavy camera work. | How you scale past one machine toward thousands. |
| **Horizontal scaling** | Adding **more servers** for more load (vs. **vertical** = one bigger server). | This VMS's path to thousands is horizontal. |
| **Load balancing** | Spreading work evenly across nodes. | The cluster auto-assigns each camera to the least-busy node. |
| **High availability (HA)** | No single point of failure (if the master dies, another takes over). | **Not yet** — the phase-2 gap for true thousands. |
| **Bottleneck** | The one part that limits everything else. | At massive scale, the **master** (its disk + DB + network) is the ceiling. |
| **Docker / container** | Packaging the whole app + dependencies into one portable bundle. | Used for dev; **native Linux** recommended for the production server. |

---

## Layer 8 — AI / detection

| Term | Plain meaning | In this VMS |
|------|---------------|-------------|
| **Inference** | Running an AI model to get a result ("is there fire in this frame?"). | Each check the AI service does. |
| **Model / weights** | The AI's trained "brain." The **weights** file (`.pt`) is the learned knowledge. | Swap the weights → different detection. Runs on the external GPU box. |
| **YOLO** | A fast object-detection AI ("You Only Look Once"). | What the fire/person detection uses. |
| **Detection / event** | When the AI finds something (fire, a line crossing). | Reported to the VMS via `/motion`. |
| **`reason`** | The **label** on a detection ("Fire", "Crowd", "PPE_NoHelmet"). | The VMS treats it as an **opaque tag** — this is what makes AI pluggable. |
| **Confidence** | How sure the AI is (0–100%). | "Fire at 92% confidence." |
| **Bounding box** | The rectangle the AI draws around what it detected. | |
| **False positive** | The AI cries wolf (says "fire" when there's none). | The fire model had these on orange office objects — a known tuning issue. |

---

## The 12 that matter most

The terms that come up constantly in *this* project:

1. **RTSP** — the camera's video pipe
2. **FFmpeg** — the engine that records + streams
3. **Copy mode** — records without re-encoding → the reason it scales
4. **ONVIF** — auto-find + control cameras *(see below)*
5. **Process per camera** — isolation, so one failure ≠ total failure
6. **Segment** — 15-min recording chunks
7. **Database / schema** — the catalog of cameras + recordings
8. **API / endpoint** — how the browser and AI talk to the VMS
9. **`/motion`** — the one API the AI uses to report detections
10. **Master / child node** — how you scale past one server
11. **Bottleneck (the master)** — the ceiling for thousands
12. **Retention** — days of footage kept = your storage cost

---

## The three core concepts, expanded

### FFmpeg — the video engine
A free command-line program that does everything with video (Netflix, YouTube, VLC use it
too). This VMS is a smart **manager that runs many copies of FFmpeg** — one per camera.
Each FFmpeg connects to a camera and splits the feed into outputs: **record to disk**,
**stream to browser**, **snapshot thumbnail**, **frames for AI**. In **copy mode** it copies
the camera's video exactly (like photocopying vs. retyping) — nearly free, which is why one
server handles 150 cameras.

### ONVIF — the universal camera language
A standard that lets cameras from **different brands speak the same language** (like USB for
security cameras). Three jobs: **(1) Discovery** — the VMS asks the network "any cameras
there?" and auto-finds them; **(2) Details** — asks each camera "what streams/RTSP URLs do
you have?" so setup needs no manual typing; **(3) PTZ control** — sends "pan left / zoom in
/ go to preset 3" to cameras that physically move. *RTSP carries the video; ONVIF carries
the commands and questions.*

### One detached process per camera — the isolation design
The VMS does **not** run 150 cameras in one big program. Each camera gets its **own separate
FFmpeg process**. If Camera 47 glitches and crashes, only *that* process dies — the VMS
restarts just that one and **the other 149 keep recording**. Like a restaurant with 150
cooks at their own stations vs. one cook on a single stove: one burnt hand doesn't lose all
150 dishes. (The orphaned-process leak fixed during hardening was exactly here — the manager
wasn't always shutting down the old crashed process before restarting.)
