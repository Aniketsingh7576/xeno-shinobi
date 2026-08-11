#!/usr/bin/env bash
# Launch the LIMCO VMS backend (camera.js) with Node 20 via nvm.
# MariaDB must already be running:  sudo systemctl start mariadb
set -e

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

# Ensure DB is reachable before starting
if ! mysql -h 127.0.0.1 -u majesticflame ccio -e "SELECT 1;" >/dev/null 2>&1; then
  echo "!! Cannot reach MariaDB (ccio / majesticflame). Start it first:"
  echo "   sudo systemctl start mariadb"
  exit 1
fi

cd "$(dirname "$0")/backend"
echo "Node: $(node -v)  |  starting camera.js ...  (Ctrl+C to stop)"
echo "Access: http://localhost:8080/super  (credentials: backend/super.json)"
exec node camera.js
