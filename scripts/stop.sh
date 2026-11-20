#!/usr/bin/env bash
# OpenAdKit stop (macOS / Linux). Asks the sidecar to shut down cleanly
# (it stops the web app first), then frees the ports if anything is left.
#   bash scripts/stop.sh

cd "$(dirname "$0")/.."
echo "Stopping OpenAdKit..."

read_env() {
  if [ -f .env.local ]; then
    grep -E "^$1=" .env.local | tail -1 | cut -d= -f2 | tr -d '[:space:]'
  fi
}
WEB_PORT="$(read_env PORT)"
SYNC_PORT="$(read_env OPENADKIT_SYNC_PORT)"
[ -z "$SYNC_PORT" ] && SYNC_PORT="$(read_env ADFORGE_SYNC_PORT)"

if [ -z "$WEB_PORT$SYNC_PORT" ]; then
  echo "No .env.local found — OpenAdKit has not been started from this folder."
  exit 0
fi

if [ -n "$SYNC_PORT" ]; then
  if curl -sf -X POST --max-time 2 "http://127.0.0.1:$SYNC_PORT/quit" >/dev/null 2>&1; then
    sleep 2
  fi
fi

kill_port() {
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null || true)
  elif command -v fuser >/dev/null 2>&1; then
    pids=$(fuser -n tcp "$1" 2>/dev/null || true)
  fi
  for p in $pids; do
    echo "Stopping PID $p (port $1)"
    kill "$p" 2>/dev/null || true
  done
}
[ -n "$WEB_PORT" ] && kill_port "$WEB_PORT"
[ -n "$SYNC_PORT" ] && kill_port "$SYNC_PORT"
echo "Done."
