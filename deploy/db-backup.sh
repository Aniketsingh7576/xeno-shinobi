#!/usr/bin/env bash
# Off-box database + config backup for LIMCO VMS. Run nightly from cron.
# Uses --single-transaction so it does NOT lock the DB or load whole tables into
# memory (unlike the super-panel export, which would OOM on a 150-camera Videos
# table). Recordings are NOT backed up here — they are protected by RAID only.
#
# Config via env: DB_USER DB_NAME DEST KEEP_DAYS
# IMPORTANT: point DEST at an OFF-box location (another host / different array),
# not the same disk you are protecting against.
set -uo pipefail

DB_USER="${DB_USER:-majesticflame}"
DB_NAME="${DB_NAME:-ccio}"
DEST="${DEST:-/mnt/nas/db-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
CONF_DIR="${CONF_DIR:-/home/brain/xeno-shinobi/backend}"

mkdir -p "$DEST" || { echo "cannot create $DEST"; exit 1; }
STAMP=$(date +%Y-%m-%dT%H-%M-%S)

# Database
if ! mysqldump -u "$DB_USER" --single-transaction --routines --triggers "$DB_NAME" | gzip > "${DEST}/${DB_NAME}-${STAMP}.sql.gz"; then
    echo "mysqldump FAILED"; exit 1
fi

# Config (both carry credentials, both are gitignored)
for f in conf.json super.json; do
    [ -f "${CONF_DIR}/${f}" ] && cp -a "${CONF_DIR}/${f}" "${DEST}/${f}-${STAMP}" || true
done

# Prune old
find "$DEST" -name "${DB_NAME}-*.sql.gz" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
find "$DEST" -name 'conf.json-*'  -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
find "$DEST" -name 'super.json-*' -mtime +${KEEP_DAYS} -delete 2>/dev/null || true

echo "backup complete: ${DEST}/${DB_NAME}-${STAMP}.sql.gz"
