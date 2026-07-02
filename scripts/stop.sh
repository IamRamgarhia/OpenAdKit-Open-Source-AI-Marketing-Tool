#!/usr/bin/env bash
# OpenAdKit stop — kills the Next dev server + local-sync sidecar.
# Run: bash stop.sh

cd "$(dirname "$0")"

echo "Stopping OpenAdKit..."

# Kill PID we saved on start
if [ -f .ados-sync.pid ]; then
  PID=$(cat .ados-sync.pid)
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
  fi
  rm -f .ados-sync.pid
fi

# Belt-and-suspenders: kill anything bound to our ports
kill_port() {
  local port=$1
  local pids
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti tcp:$port 2>/dev/null || true)
  elif command -v fuser >/dev/null 2>&1; then
    pids=$(fuser -n tcp $port 2>/dev/null | awk '{print $1}' || true)
  fi
  for p in $pids; do
    echo "Killing PID $p (port $port)"
    kill -9 "$p" 2>/dev/null || true
  done
}

# Read the ACTUAL ports from .env.local — the launcher/resolver writes these
# and they are NOT 3005/3006 on most installs. (Audit finding.)
if [ -f .env.local ]; then
  WEB_PORT=$(grep -E '^PORT=' .env.local | tail -1 | cut -d= -f2 | tr -d '[:space:]')
  SYNC_PORT=$(grep -E '^ADFORGE_SYNC_PORT=' .env.local | tail -1 | cut -d= -f2 | tr -d '[:space:]')
  [ -n "$WEB_PORT" ] && kill_port "$WEB_PORT"
  [ -n "$SYNC_PORT" ] && kill_port "$SYNC_PORT"
else
  echo "No .env.local found — nothing to stop (run the launcher first)."
fi

echo "Done."
