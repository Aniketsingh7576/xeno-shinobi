#!/usr/bin/env bash
# Generate a synthetic H.264 seed clip approximating a 2 MP camera at ~4 Mbps.
# The simulated cameras loop this, so its bitrate/resolution drives the load numbers.
set -euo pipefail

OUT="${1:-seed.mp4}"
DUR="${2:-60}"          # seconds
RES="${3:-1920x1080}"   # 2 MP
BR="${4:-4000k}"        # ~4 Mbps, typical 2MP CCTV
FPS="${5:-15}"          # CCTV commonly 12-15 fps

echo "Generating ${OUT}: ${RES} @ ${FPS}fps ~${BR}, ${DUR}s (H.264)"

# testsrc2 = moving pattern + timestamp so you can eyeball latency in the VMS.
ffmpeg -y -f lavfi -i "testsrc2=size=${RES}:rate=${FPS}" \
       -f lavfi -i "sine=frequency=440:sample_rate=48000" \
       -t "${DUR}" \
       -c:v libx264 -profile:v main -preset veryfast -tune zerolatency \
       -b:v "${BR}" -maxrate "${BR}" -bufsize "$(( ${BR%k} * 2 ))k" \
       -g "$(( FPS * 2 ))" -keyint_min "${FPS}" \
       -pix_fmt yuv420p \
       -c:a aac -b:a 64k -ac 1 \
       -movflags +faststart \
       "${OUT}"

echo "Done. Seed clip: ${OUT}"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,avg_frame_rate,bit_rate -of default=noprint_wrappers=1 "${OUT}" 2>/dev/null || true
