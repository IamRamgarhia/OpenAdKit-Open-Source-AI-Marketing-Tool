#!/usr/bin/env bash
# OpenAdKit start (macOS / Linux) — visible-log launcher.
# Starts the sidecar (control panel + sync), which auto-starts the web app,
# then opens the web app in your browser. Ctrl+C stops everything.
#   bash scripts/start.sh

set -e
# Always run from the repo root, wherever this script is invoked from.
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies..."
  npm install --no-audit --no-fund
fi
if [ ! -f .next/standalone/server.js ]; then
  echo "Building OpenAdKit (one time, about a minute)..."
  npm run build
fi

# Ports: launcher env → .env.local → resolver (asks the OS for free ports).
read_env() {
  if [ -f .env.local ]; then
    grep -E "^$1=" .env.local | tail -1 | cut -d= -f2 | tr -d '[:space:]'
  fi
}
SYNC_PORT="${OPENADKIT_SYNC_PORT:-${ADFORGE_SYNC_PORT:-}}"
WEB_PORT="${PORT:-}"
[ -z "$SYNC_PORT" ] && SYNC_PORT="$(read_env OPENADKIT_SYNC_PORT)"
[ -z "$SYNC_PORT" ] && SYNC_PORT="$(read_env ADFORGE_SYNC_PORT)"
[ -z "$WEB_PORT" ] && WEB_PORT="$(read_env PORT)"
if [ -z "$SYNC_PORT" ] || [ -z "$WEB_PORT" ]; then
  node scripts/resolve-ports.cjs >/dev/null
  SYNC_PORT="$(read_env OPENADKIT_SYNC_PORT)"
  [ -z "$SYNC_PORT" ] && SYNC_PORT="$(read_env ADFORGE_SYNC_PORT)"
  WEB_PORT="$(read_env PORT)"
fi

echo
echo "=================================================="
echo " Starting OpenAdKit"
echo "=================================================="
echo "  Web app:        http://127.0.0.1:$WEB_PORT/"
echo "  Control panel:  http://127.0.0.1:$SYNC_PORT/"
echo "  Press Ctrl+C to shut down."
echo

open_url() {
  if [ "${OPENADKIT_NO_BROWSER:-}" = "1" ]; then echo "[openadkit] ready: $1"; return; fi
  if   command -v open     >/dev/null 2>&1; then open "$1"            # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
  elif command -v wslview  >/dev/null 2>&1; then wslview "$1"
  else echo "(open this URL manually: $1)"; fi
}

# Open the web app once it answers; fall back to the control panel.
(
  for _ in $(seq 1 120); do
    if curl -sf -o /dev/null --max-time 1 "http://127.0.0.1:$WEB_PORT/"; then
      open_url "http://127.0.0.1:$WEB_PORT/"; exit 0
    fi
    sleep 0.5
  done
  echo "[openadkit] web app didn't respond within 60s — opening the control panel"
  open_url "http://127.0.0.1:$SYNC_PORT/"
) &

# Sidecar in the foreground; it stops the web app on Ctrl+C / SIGTERM.
OPENADKIT_SYNC_PORT="$SYNC_PORT" ADFORGE_SYNC_PORT="$SYNC_PORT" PORT="$WEB_PORT" exec node scripts/local-sync.cjs
