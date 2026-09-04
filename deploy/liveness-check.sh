#!/usr/bin/env bash
# External recording-liveness check for LIMCO VMS.
# Run from cron (e.g. every 5 minutes). Because it runs OUTSIDE the VMS process,
# it catches a hung/dead camera.js that an in-app indicator never could.
#
# It alerts when: (a) the web port is down, or (b) any record-mode camera has no
# fresh Videos row within STALE_MIN minutes (~2 x 15-min segment + slack).
#
# Config via env (override in the cron line):
#   DB_USER DB_NAME KE STALE_MIN PORT ALERT_EMAIL
set -uo pipefail

DB_USER="${DB_USER:-majesticflame}"
DB_NAME="${DB_NAME:-ccio}"
KE="${KE:-XIS27BnImp}"
STALE_MIN="${STALE_MIN:-35}"
PORT="${PORT:-8080}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

alert(){
    local msg="$1"
    logger -t limco-liveness "$msg" 2>/dev/null || true
    echo "[LIMCO-ALERT $(date '+%F %T')] $msg"
    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        printf '%s\n' "$msg" | mail -s "LIMCO VMS alert" "$ALERT_EMAIL" || true
    fi
}

# 1) Is the web/API port answering? (camera.js alive)
if ! curl -s -m 5 -o /dev/null "http://127.0.0.1:${PORT}/"; then
    alert "VMS web port ${PORT} is DOWN — camera.js may be dead."
fi

# 2) Any record-mode camera with stale/missing footage?
STALE=$(mysql -u "$DB_USER" "$DB_NAME" -N -e "
    SELECT CONCAT(m.mid,'  ',m.name,'  ',
                  TIMESTAMPDIFF(MINUTE, COALESCE(MAX(v.end),'2000-01-01'), NOW()),'m')
    FROM Monitors m
    LEFT JOIN Videos v ON v.ke=m.ke AND v.mid=m.mid
    WHERE m.ke='${KE}' AND m.mode='record'
    GROUP BY m.mid
    HAVING TIMESTAMPDIFF(MINUTE, COALESCE(MAX(v.end),'2000-01-01'), NOW()) > ${STALE_MIN};
" 2>/dev/null)
RC=$?

if [ $RC -ne 0 ]; then
    alert "liveness-check: cannot query database (${DB_NAME})."
elif [ -n "$STALE" ]; then
    alert "Cameras with NO fresh recording (> ${STALE_MIN} min):"$'\n'"${STALE}"
fi

exit 0
