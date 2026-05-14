#!/usr/bin/env bash
# AdForge desktop launcher (macOS / Linux).
#
# Same behavior as AdForge.bat: detects port conflicts with other AdForge
# installs (or unrelated processes) and auto-shifts to a free port pair.
# First run installs deps + writes default .env.local + creates Desktop
# shortcut. Subsequent runs just open the launcher.

set -e
cd "$(dirname "$0")"

# 1. Sanity: Node installed?
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "[ERROR] Node.js is not installed."
  echo "  Install Node 20+ from https://nodejs.org/en/download then run AdForge again."
  echo
  read -p "Press enter to exit…" _ || true
  exit 1
fi

# 2. npm install on first run
if [ ! -d node_modules ]; then
  echo
  echo "=================================================="
  echo " First run · installing dependencies"
  echo "=================================================="
  npm install --no-audit --no-fund
fi

# 3. Default .env.local (resolve-ports.cjs may shift these later if conflicts)
if [ ! -f .env.local ]; then
  cat > .env.local <<EOF
# AdForge configuration (default - resolve-ports.cjs may shift if conflicts)
PORT=3005
ADFORGE_SYNC_PORT=3006
EOF
fi

mkdir -p data

# 4. Desktop shortcut on first run
if [ -d "$HOME/Desktop" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    if [ ! -e "$HOME/Desktop/AdForge.command" ]; then
      cp -f AdForge.command "$HOME/Desktop/AdForge.command" 2>/dev/null && \
        chmod +x "$HOME/Desktop/AdForge.command" 2>/dev/null
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
    fi
  fi
fi

# 5. Resolve ports (multi-install conflict detection)
echo "Checking for port conflicts..."
RESOLVED=$(node scripts/resolve-ports.cjs 2>/dev/null)
ACTION=$(echo "$RESOLVED" | grep -oE 'ACTION=[a-z_]+' | head -1 | cut -d= -f2)
SYNC_PORT=$(echo "$RESOLVED" | grep -oE 'SYNC=[0-9]+' | head -1 | cut -d= -f2)
WEB_PORT=$(echo "$RESOLVED" | grep -oE 'PORT=[0-9]+' | head -1 | cut -d= -f2)

if [ -z "$ACTION" ]; then
  echo "[ERROR] Port resolver failed to run. Falling back to defaults."
  ACTION="start"
  SYNC_PORT="${SYNC_PORT:-3006}"
  WEB_PORT="${WEB_PORT:-3005}"
fi

if [ "$ACTION" = "error" ]; then
  REASON=$(echo "$RESOLVED" | grep -oE 'REASON=[^ ]+' | head -1 | cut -d= -f2)
  echo "[ERROR] Port resolver: $REASON"
  read -p "Press enter to exit…" _ || true
  exit 1
fi

if [ "$ACTION" = "reuse" ]; then
  echo "Sidecar already running on :$SYNC_PORT for this install. Opening browser..."
  if command -v open >/dev/null 2>&1; then open "http://127.0.0.1:$SYNC_PORT/" &
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:$SYNC_PORT/" &
  fi
  exit 0
fi

if [ "$ACTION" = "restart_stale" ]; then
  echo "Stale sidecar on :$SYNC_PORT — asking it to quit before starting fresh..."
  curl -fsS -X POST --max-time 3 "http://127.0.0.1:$SYNC_PORT/quit" >/dev/null 2>&1 || true
  # Poll until the port frees. sleep 1 is not enough on macOS with open file
  # handles; the new sidecar would otherwise fail to bind. (Audit finding #41.)
  DEADLINE=$(( $(date +%s) + 10 ))
  while [ $(date +%s) -lt $DEADLINE ]; do
    # nc -z returns 0 if port is OPEN. We want it CLOSED (free).
    if ! nc -z 127.0.0.1 "$SYNC_PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 0.3
  done
fi

if [ "$ACTION" = "shifted" ]; then
  echo
  echo " Default ports were taken by another AdForge install or process."
  echo " This install will use:  web=$WEB_PORT  sync=$SYNC_PORT"
  echo " Saved to .env.local so future launches reuse these."
  echo
fi

# 6. Hand off to the sidecar (visible log, Ctrl+C exits)
export ADFORGE_SYNC_PORT="$SYNC_PORT"
export PORT="$WEB_PORT"
exec bash scripts/start.sh
