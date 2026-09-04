#!/bin/bash
if [ -e "INSTALL/installed.txt" ]; then
    echo "Starting Shinobi"
    pm2 start backend/camera.js --name camera --cwd backend
    pm2 save
    #pm2 start cron.js
    pm2 list
fi
if [ ! -e "INSTALL/installed.txt" ]; then
    chmod +x INSTALL/now.sh&&INSTALL/now.sh
fi
