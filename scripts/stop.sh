#!/usr/bin/env bash
# AdForge stop — kills the Next dev server + local-sync sidecar.
# Run: bash stop.sh

cd "$(dirname "$0")"

echo "Stopping AdForge..."

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

kill_port 3005
kill_port 3006

echo "Done."
