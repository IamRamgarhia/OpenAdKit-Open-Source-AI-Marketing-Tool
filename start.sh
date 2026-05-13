#!/usr/bin/env bash
# AdForge start — opens the launcher control panel in your browser.
# From the launcher you click "Start AdForge" and watch progress.

set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "node_modules missing. Running install first..."
  bash install.sh
fi

mkdir -p data

SYNC_PORT=3006
if [ -f .env.local ]; then
  SP=$(grep -E '^ADFORGE_SYNC_PORT=' .env.local | head -1 | cut -d= -f2)
  [ -n "$SP" ] && SYNC_PORT="$SP"
fi

echo
echo "=================================================="
echo " Opening AdForge launcher..."
echo "=================================================="
echo
echo "  Launcher (control panel): http://127.0.0.1:$SYNC_PORT/"
echo
echo "  In the launcher, click 'Start AdForge' to launch the web app."
echo "  Press Ctrl+C in this window or run  bash stop.sh  to shut down."
echo

# Cross-platform "open URL in default browser"
open_url() {
  local url="$1"
  if   command -v open       >/dev/null 2>&1; then open "$url" &       # macOS
  elif command -v xdg-open   >/dev/null 2>&1; then xdg-open "$url" &   # Linux
  elif command -v wslview    >/dev/null 2>&1; then wslview "$url" &    # WSL
  else echo "(open this URL manually: $url)"; fi
}

# Open the launcher in the user's browser after a short delay
( sleep 1.5 && open_url "http://127.0.0.1:$SYNC_PORT/" ) &

# Run the sidecar in the foreground (it serves the launcher + manages Next)
trap 'echo; echo "Stopping AdForge..."; exit 0' INT TERM
ADFORGE_SYNC_PORT="$SYNC_PORT" node scripts/local-sync.cjs
