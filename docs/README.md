# VMS — System Design Documentation

Complete system design for the LIMCO VMS (xeno-shinobi platform), **traced from the actual
code** and independently verified. Read in this order:

| Doc | What's in it |
|-----|--------------|
| [**01 — High-Level Design (HLD)**](01-HLD-High-Level-Design.md) | The big picture: what the system is, the subsystems, the two most important flows (recording + AI seam), the scale model, the tech stack, cross-cutting concerns. **Start here.** |
| [**02 — Low-Level Design (LLD)**](02-LLD-Low-Level-Design.md) | Per-subsystem deep dive: key functions (with file:line), algorithms, data-flow tables, interfaces, and scale risks. One section per subsystem, each with a diagram. |
| [**03 — Data Flow & API Reference**](03-Data-Flow-and-APIs.md) | The system-wide data-flow diagram, the internal IPC pipe map, the database schema, the full ~130-route HTTP API catalog, the Socket.IO surface, and the pluggable-AI contract. |
| [**04 — Glossary (0 → 100)**](04-Glossary.md) | Plain-language definitions of every term, protocol, and concept — RTSP, FFmpeg, ONVIF, codecs, copy mode, processes, database, API, scaling, AI terms — each tied to how it's used in *this* project. **Read this if any term above is unfamiliar.** |
| [**05 — Scaling Architecture**](05-Scaling-Architecture.md) | How to fix the master bottleneck: why the cluster can't be patched, how Milestone/Genetec/Nx actually scale, why standalone servers + a thin directory is the answer (config-only in this codebase), a phased plan, and the required high-availability/durability caveats. |
| [**system-design.html**](system-design.html) | **Visual, self-contained web page** version of this documentation (open it in any browser). Version-controlled and travels with the repo. Diagrams render via mermaid when online; offline, the diagram source stays readable. A hosted preview may also exist on claude.ai, but **this file is the source of truth** — edit it here and it updates on the next `git push`. |

## Related documents (repo root)

- [`../VMS_PLATFORM_ARCHITECTURE_PLAN.md`](../VMS_PLATFORM_ARCHITECTURE_PLAN.md) — the
  product plan: generic VMS + pluggable AI services + Super Admin control layer.
- [`../SERVER_REQUIREMENTS_150_CAMERAS.md`](../SERVER_REQUIREMENTS_150_CAMERAS.md) —
  hardware sizing for a 150-camera deployment.
- [`../load-test/LOAD_TEST_PLAN.md`](../load-test/LOAD_TEST_PLAN.md) — how to validate the
  camera count with the camera-simulator harness (staged 40→80→150→beyond).

## The 8 subsystems at a glance

1. **Recording pipeline** — 24/7 gapless segmented recording (the priority feature)
2. **Per-camera process model** — one detached FFmpeg process per camera + stdio pipe map
3. **Live streaming** — HLS / MP4(mp4frag) / MJPEG / FLV, on-demand substream lifecycle
4. **Camera discovery + ONVIF + PTZ** — find, onboard, and control cameras
5. **Event / AI integration** — the pluggable-AI seam (`/motion` → record + live alert)
6. **Database + schema** — portable knex schema, row-level multi-tenancy
7. **Web server + API + auth** — HTTP/WS front door, session vs API-key auth
8. **Multi-node cluster** — master/child camera distribution for horizontal scale

> **Diagrams** are Mermaid and render natively on GitHub. A shareable visual version of
> this documentation is also available as a hosted page (see the team for the link).

## How these docs were produced

Eight parallel agents each traced one subsystem from the real source (183 tool calls,
~660K tokens of analysis), then an independent verification pass fact-checked the critical
data flows against code — which caught and corrected real inaccuracies (e.g. orphaned
recordings are inserted with DB `status:1`, not `2`). The corrected facts are what appear
in these documents.
