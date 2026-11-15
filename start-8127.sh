#!/usr/bin/env bash
# start-8127.sh — launch the static game server detached, nohup, survives session exit.
set -u
cd /home/ubuntu/relay-fps-entry || exit 1

# replace any existing listener on 8127
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8127/tcp 2>/dev/null
fi

nohup node serve.ts --port 8127 >> /home/ubuntu/relay-fps-entry/serve-8127.log 2>&1 &
pid=$!
disown "$pid" 2>/dev/null || true
echo "$pid" > /home/ubuntu/relay-fps-entry/serve-8127.pid
echo "started pid $pid"
