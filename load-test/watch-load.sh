#!/usr/bin/env bash
# Sample the VMS under load every INTERVAL seconds: ffmpeg process count, CPU, RAM,
# and (if the container is named) container stats + disk write rate. Prints a CSV-ish
# line per sample so you can eyeball stability or paste into a sheet.
#
# Usage: bash watch-load.sh [interval_sec] [container_name] [expected_cams]
#   defaults: interval=5, container=Shinobi, expected_cams=(unset)
set -uo pipefail

INTERVAL="${1:-5}"
CONTAINER="${2:-Shinobi}"
EXPECTED="${3:-}"

echo "time,ffmpeg_procs,node_procs,host_cpu%,host_mem_used,container_cpu%,container_mem,notes"

sample() {
  local ts ffc nodec ccpu cmem note=""
  ts="$(date +%H:%M:%S)"

  # ffmpeg / node process counts — prefer inside the container if it exists
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
    ffc="$(docker exec "$CONTAINER" sh -c "ps -e 2>/dev/null | grep -c ffmpeg" 2>/dev/null || echo '?')"
    nodec="$(docker exec "$CONTAINER" sh -c "ps -e 2>/dev/null | grep -c node" 2>/dev/null || echo '?')"
    local stats
    stats="$(docker stats "$CONTAINER" --no-stream --format '{{.CPUPerc}};{{.MemUsage}}' 2>/dev/null || echo '?;?')"
    ccpu="${stats%%;*}"
    cmem="${stats##*;}"
  else
    ffc="$(ps -e 2>/dev/null | grep -c ffmpeg || echo '?')"
    nodec="$(ps -e 2>/dev/null | grep -c node || echo '?')"
    ccpu="n/a"; cmem="n/a"
    note="no container '$CONTAINER'"
  fi

  # host cpu/mem (best-effort, cross-platform-ish)
  local hcpu hmem
  hcpu="$(ps -A -o %cpu 2>/dev/null | awk '{s+=$1} END {printf "%.0f", s}' || echo '?')"
  hmem="$(free -h 2>/dev/null | awk '/Mem:/{print $3}' || echo 'n/a')"

  # leak check: ffmpeg count should track expected camera count (± a few for snapshots)
  if [ -n "$EXPECTED" ] && [ "$ffc" != "?" ]; then
    if [ "$ffc" -gt "$(( EXPECTED * 2 ))" ]; then note="${note} LEAK? ffmpeg>2x cams"; fi
  fi

  echo "${ts},${ffc},${nodec},${hcpu},${hmem},${ccpu},${cmem},${note}"
}

echo "Sampling every ${INTERVAL}s (container: ${CONTAINER}${EXPECTED:+, expecting ~$EXPECTED cams}). Ctrl-C to stop."
while true; do
  sample
  sleep "$INTERVAL"
done
