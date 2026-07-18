#!/usr/bin/env node
/*
 * Generate N monitor definitions pointing at the simulated cameras, for bulk import
 * into the VMS. Emits JSON on stdout.
 *
 * Usage:
 *   node gen-monitors.js <N> [groupKey] [simHost] [mode]
 *     N        number of cameras (required)
 *     groupKey the VMS group key to attach monitors to (default: LOADTEST)
 *     simHost  host serving the simulated RTSP (default: 127.0.0.1)
 *     mode     'record' (24/7 recording, default) or 'start' (watch only)
 *
 *   node gen-monitors.js 150 xNCwfUSYnk 192.168.1.50 record > monitors-150.json
 *
 * The output matches Shinobi's monitor shape closely enough to import via the
 * configureMonitor API or to adapt into a SQL insert. Recording stays in COPY mode
 * (vcodec=copy) — the correct, scalable setting we validated.
 */
'use strict';

const N = parseInt(process.argv[2], 10);
const GROUP = process.argv[3] || 'LOADTEST';
const HOST = process.argv[4] || '127.0.0.1';
const MODE = process.argv[5] || 'record';
const RTSP_PORT = 8554;

if (!N || N < 1) {
  process.stderr.write('usage: node gen-monitors.js <N> [groupKey] [simHost] [mode]\n');
  process.exit(1);
}

// zero-padded id so ordering is stable in the UI
function pad(n, w) { return String(n).padStart(w, '0'); }

const monitors = [];
for (let i = 1; i <= N; i++) {
  const mid = 'LT' + pad(i, 5);
  monitors.push({
    ke: GROUP,
    mid: mid,
    name: 'LoadTest Cam ' + pad(i, 4),
    type: 'h264',
    protocol: 'rtsp',
    host: HOST,
    port: RTSP_PORT,
    path: '/cam' + i,
    ext: 'mp4',
    fps: 15,
    mode: MODE,                        // 'record' = 24/7 recording
    details: {
      // ---- input ----
      auto_host: `rtsp://${HOST}:${RTSP_PORT}/cam${i}`,
      rtsp_transport: 'tcp',
      // ---- recording: COPY mode (no re-encode) — the scalable default ----
      vcodec: 'copy',
      acodec: 'no',
      cutoff: '15',                    // 15-min segments
      detector: '0',
      // ---- live stream: mp4frag/low-latency, copy ----
      stream_type: 'mp4',
      stream_vcodec: 'copy',
      stream_flv_type: 'http',
      // keep everything else default
      dir: ''
    }
  });
}

process.stdout.write(JSON.stringify({
  note: 'VMS load-test monitors — simulated cameras, copy-mode recording',
  group: GROUP,
  count: N,
  simHost: HOST,
  generatedForRtsp: `rtsp://${HOST}:${RTSP_PORT}/cam1 .. cam${N}`,
  monitors: monitors
}, null, 2) + '\n');
