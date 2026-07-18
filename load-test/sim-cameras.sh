#!/usr/bin/env bash
# Simulate N virtual cameras: start MediaMTX, then N ffmpeg publishers looping seed.mp4,
# each published as rtsp://<host>:8554/camK. Staggered start mimics real fleet bring-up.
# Ctrl-C tears everything down cleanly.
#
# Usage: bash sim-cameras.sh <N> [seed.mp4] [stagger_ms]
set -euo pipefail

N="${1:?usage: sim-cameras.sh <N> [seed.mp4] [stagger_ms]}"
SEED="${2:-seed.mp4}"
STAGGER_MS="${3:-250}"     # ms between camera starts (avoid a thundering herd)
HERE="$(cd "$(dirname "$0")" && pwd)"
RTSP_PORT=8554

[ -f "$HERE/$SEED" ] || { echo "Seed clip '$SEED' not found. Run: bash make-seed.sh"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not on PATH"; exit 1; }

# locate mediamtx (PATH or this folder)
MEDIAMTX="$(command -v mediamtx || true)"
[ -z "$MEDIAMTX" ] && [ -x "$HERE/mediamtx" ] && MEDIAMTX="$HERE/mediamtx"
[ -z "$MEDIAMTX" ] && [ -x "$HERE/mediamtx.exe" ] && MEDIAMTX="$HERE/mediamtx.exe"
[ -z "$MEDIAMTX" ] && { echo "mediamtx not found. Download the binary from https://github.com/bluenviron/mediamtx/releases into $HERE"; exit 1; }

PIDS=()
cleanup() {
  echo ""
  echo "Stopping ${#PIDS[@]} processes..."
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM EXIT

echo "Starting MediaMTX (RTSP :$RTSP_PORT)..."
"$MEDIAMTX" "$HERE/mediamtx.yml" >"$HERE/mediamtx.log" 2>&1 &
PIDS+=($!)
sleep 2   # let the server bind

echo "Publishing $N virtual cameras (stagger ${STAGGER_MS}ms). Ctrl-C to stop."
for i in $(seq 1 "$N"); do
  # -re = real-time pace; -stream_loop -1 = loop forever; -c copy = no re-encode (cheap publisher);
  # publish over TCP to match the VMS's rtsp_transport.
  ffmpeg -nostdin -loglevel error -re -stream_loop -1 -i "$HERE/$SEED" \
         -c copy -f rtsp -rtsp_transport tcp \
         "rtsp://127.0.0.1:${RTSP_PORT}/cam${i}" >>"$HERE/publishers.log" 2>&1 &
  PIDS+=($!)
  if (( i % 10 == 0 )); then echo "  ...$i cameras publishing"; fi
  # sleep STAGGER_MS milliseconds (portable)
  sleep "$(awk "BEGIN{print ${STAGGER_MS}/1000}")"
done

echo ""
echo "All $N virtual cameras are publishing at rtsp://<this-host>:${RTSP_PORT}/cam1 .. cam${N}"
echo "Register these as monitors in the VMS (see gen-monitors.js)."
echo "Logs: mediamtx.log, publishers.log. Press Ctrl-C to stop everything."
wait
