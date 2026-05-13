#!/usr/bin/env bash
# AdForge desktop launcher (macOS / Linux).
#
# Double-click this file in Finder / your file manager. macOS opens .command
# files in Terminal automatically; on Linux, mark it executable and either
# associate it with your terminal or just run it from the file manager.
#
# First run does setup automatically: npm install, write default .env.local,
# create a Desktop shortcut. Subsequent runs just open the launcher.

set -e
cd "$(dirname "$0")"

# 1. Sanity: Node installed?
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "[ERROR] Node.js is not installed."
  echo "  Install Node 20+ from https://nodejs.org/en/download then run AdForge again."
  echo
  read -p "Press enter to exit…" _
  exit 1
fi

# 2. npm install on first run
if [ ! -d node_modules ]; then
  echo
  echo "=================================================="
  echo " First run · installing dependencies"
  echo "=================================================="
  echo " This takes 1-3 minutes. You will only see this once."
  echo
  npm install --no-audit --no-fund
fi

# 3. Default .env.local (ports can be changed later in the launcher's Settings card)
if [ ! -f .env.local ]; then
  cat > .env.local <<EOF
# AdForge configuration (default ports - change in launcher Settings if needed)
PORT=3005
ADFORGE_SYNC_PORT=3006
EOF
fi

# 4. Desktop shortcut on first run (only if missing)
if [ -d "$HOME/Desktop" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    if [ ! -e "$HOME/Desktop/AdForge.command" ]; then
      cp -f AdForge.command "$HOME/Desktop/AdForge.command" 2>/dev/null && \
        chmod +x "$HOME/Desktop/AdForge.command" 2>/dev/null && \
        echo "  -> Created Desktop shortcut: ~/Desktop/AdForge.command"
    fi
  else
    if [ ! -e "$HOME/Desktop/AdForge.desktop" ]; then
      cat > "$HOME/Desktop/AdForge.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=AdForge
Comment=Local AI ad operations cockpit
Exec=bash $(pwd)/AdForge.command
Terminal=true
Categories=Office;Development;
DESK
      chmod +x "$HOME/Desktop/AdForge.desktop" 2>/dev/null
      echo "  -> Created Desktop shortcut: ~/Desktop/AdForge.desktop"
    fi
  fi
fi

mkdir -p data

# 5. If a stale sidecar is already running on the configured port, ask it to
# quit before we hand off to start.sh. Otherwise we'd start a second sidecar
# that fights for the port and loses, leaving the stale one in place.
SYNC_PORT="${ADFORGE_SYNC_PORT:-3006}"
if [ -f .env.local ]; then
  SP=$(grep -E '^ADFORGE_SYNC_PORT=' .env.local | head -1 | cut -d= -f2 | tr -d '\r')
  [ -n "$SP" ] && SYNC_PORT="$SP"
fi
if command -v curl >/dev/null 2>&1; then
  CAPS=$(curl -fsS --max-time 2 "http://127.0.0.1:${SYNC_PORT}/health" 2>/dev/null | tr -d '\r\n')
  if [ -n "$CAPS" ]; then
    if echo "$CAPS" | grep -q '"ingest"'; then
      echo "Sidecar already running on :${SYNC_PORT} (current version). Opening browser..."
      if command -v open >/dev/null 2>&1; then open "http://127.0.0.1:${SYNC_PORT}/" &
      elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:${SYNC_PORT}/" &
      fi
      exit 0
    else
      echo "Stale sidecar detected on :${SYNC_PORT} — asking it to quit before starting a fresh one..."
      curl -fsS -X POST --max-time 3 "http://127.0.0.1:${SYNC_PORT}/quit" >/dev/null 2>&1 || true
      sleep 1
    fi
  fi
fi

# 6. Hand off to the launcher sidecar (visible log, Ctrl+C exits)
exec bash scripts/start.sh
