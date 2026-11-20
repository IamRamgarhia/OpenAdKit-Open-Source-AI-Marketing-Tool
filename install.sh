#!/usr/bin/env bash
# OpenAdKit installer for macOS and Linux — prebuilt, no git, no npm, no build.
#
#   curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/install.sh | bash
#
# Uninstall (keeps your data):
#   curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/install.sh | bash -s -- --uninstall
#
# What it does:
#   1. Uses your Node.js if it is 20.9 or newer; otherwise downloads Node
#      v24 LTS from nodejs.org into the app folder (no sudo, nothing global),
#      checked against nodejs.org's SHA-256 list.
#   2. Downloads the latest OpenAdKit release and checks it against the
#      release's SHA256SUMS.txt.
#   3. macOS: creates ~/Applications/OpenAdKit.app (Launchpad / Spotlight).
#      Linux: adds an app-menu entry and the `openadkit` command.
#   4. Starts OpenAdKit and opens it in your browser.
#
# Your clients, history and settings live in your browser profile and in
# ~/Library/Application Support/OpenAdKit (macOS) or ~/.config/openadkit
# (Linux). Updating or uninstalling never touches them.
#
# Works with the bash 3.2 that ships with macOS.

set -eu

REPO="IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool"
RELEASE_URL="${OPENADKIT_RELEASE_URL:-https://github.com/$REPO/releases/latest/download}"
NODE_VERSION="v24.22.3"
NODE_MIN_MAJOR=20
NODE_MIN_MINOR=9

c_cyan=""; c_green=""; c_yellow=""; c_red=""; c_reset=""
if [ -t 1 ]; then
  c_cyan="$(printf '\033[36m')"; c_green="$(printf '\033[32m')"; c_yellow="$(printf '\033[33m')"
  c_red="$(printf '\033[31m')"; c_reset="$(printf '\033[0m')"
fi
step() { printf "\n%s==> %s%s\n" "$c_cyan" "$1" "$c_reset"; }
ok()   { printf "%s ok %s%s\n" "$c_green" "$1" "$c_reset"; }
warn() { printf "%s !! %s%s\n" "$c_yellow" "$1" "$c_reset"; }
die()  { printf "%sERR %s%s\n" "$c_red" "$1" "$c_reset" >&2; exit 1; }

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin)
    PLATFORM="darwin"
    APP_HOME="$HOME/Library/Application Support/OpenAdKit/runtime"
    ;;
  Linux)
    PLATFORM="linux"
    APP_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/openadkit"
    ;;
  *) die "This installer supports macOS and Linux. On Windows, download OpenAdKit-Windows-Setup.exe from https://github.com/$REPO/releases/latest" ;;
esac
case "$ARCH" in
  arm64|aarch64) NODE_ARCH="arm64" ;;
  x86_64|amd64)  NODE_ARCH="x64" ;;
  *) die "Unsupported CPU: $ARCH (need x86_64 or arm64)." ;;
esac
MAC_APP="$HOME/Applications/OpenAdKit.app"
LINUX_DESKTOP="${XDG_DATA_HOME:-$HOME/.local/share}/applications/openadkit.desktop"
LINUX_BIN="$HOME/.local/bin/openadkit"

sha256_of() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else sha256sum "$1" | awk '{print $1}'; fi
}

stop_running() {
  if [ -x "$APP_HOME/openadkit" ]; then "$APP_HOME/openadkit" stop >/dev/null 2>&1 || true; fi
}

# ---------------------------------------------------------------- uninstall
if [ "${1:-}" = "--uninstall" ]; then
  step "Uninstalling OpenAdKit"
  stop_running
  # Remove the Claude Desktop MCP entry (if any) while node + the script still exist.
  for n in "$APP_HOME/node/bin/node" "$(command -v node 2>/dev/null || true)"; do
    if [ -n "$n" ] && [ -x "$n" ] && [ -f "$APP_HOME/app/scripts/register-mcp.cjs" ]; then
      "$n" "$APP_HOME/app/scripts/register-mcp.cjs" --remove >/dev/null 2>&1 || true
      break
    fi
  done
  rm -rf "$APP_HOME" "$MAC_APP" "$LINUX_DESKTOP" "$LINUX_BIN"
  ok "Removed the program. Your data was left in place."
  exit 0
fi

printf "\n==================================================\n OpenAdKit installer — by DiceCodes\n==================================================\n"

command -v curl >/dev/null 2>&1 || die "curl is required."
command -v tar  >/dev/null 2>&1 || die "tar is required."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------- Node.js
step "Checking Node.js"
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  if node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>$NODE_MIN_MAJOR||(a===$NODE_MIN_MAJOR&&b>=$NODE_MIN_MINOR)?0:1)" 2>/dev/null; then
    NODE_BIN="$(command -v node)"
    ok "Using your Node $(node --version) ($NODE_BIN)"
  else
    warn "Your Node $(node --version) is older than $NODE_MIN_MAJOR.$NODE_MIN_MINOR — OpenAdKit will use its own copy."
  fi
fi
if [ -z "$NODE_BIN" ]; then
  NODE_DIR_NAME="node-$NODE_VERSION-$PLATFORM-$NODE_ARCH"
  if [ -x "$APP_HOME/node/bin/node" ] && [ "$("$APP_HOME/node/bin/node" --version 2>/dev/null)" = "$NODE_VERSION" ]; then
    ok "Node $NODE_VERSION already installed for OpenAdKit"
  else
    echo "    downloading Node $NODE_VERSION ($PLATFORM-$NODE_ARCH) from nodejs.org"
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$NODE_DIR_NAME.tar.gz" -o "$TMP/node.tar.gz" \
      || die "Could not download Node.js. Check your internet connection."
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TMP/node-sums.txt" \
      || die "Could not download Node.js checksums."
    want="$(grep " $NODE_DIR_NAME.tar.gz\$" "$TMP/node-sums.txt" | awk '{print $1}')"
    got="$(sha256_of "$TMP/node.tar.gz")"
    [ -n "$want" ] && [ "$want" = "$got" ] || die "Node.js download failed its SHA-256 check (got $got). Nothing was installed."
    mkdir -p "$TMP/node-x"
    tar -xzf "$TMP/node.tar.gz" -C "$TMP/node-x"
    rm -rf "$APP_HOME/node.new"
    mkdir -p "$APP_HOME"
    mv "$TMP/node-x/$NODE_DIR_NAME" "$APP_HOME/node.new"
    rm -rf "$APP_HOME/node"
    mv "$APP_HOME/node.new" "$APP_HOME/node"
    ok "Node $NODE_VERSION installed for OpenAdKit (SHA-256 verified)"
  fi
  NODE_BIN="$APP_HOME/node/bin/node"
fi

# ---------------------------------------------------------------- app
step "Downloading OpenAdKit"
curl -fsSL "$RELEASE_URL/OpenAdKit-app.tar.gz" -o "$TMP/app.tar.gz" \
  || die "Could not download OpenAdKit from $RELEASE_URL"
curl -fsSL "$RELEASE_URL/SHA256SUMS.txt" -o "$TMP/sums.txt" \
  || die "Could not download the release checksums."
want="$(grep " \*\{0,1\}OpenAdKit-app.tar.gz\$" "$TMP/sums.txt" | awk '{print $1}')"
got="$(sha256_of "$TMP/app.tar.gz")"
[ -n "$want" ] && [ "$want" = "$got" ] || die "OpenAdKit download failed its SHA-256 check (got $got). Nothing was installed."
ok "Release verified (SHA-256 $got)"

mkdir -p "$TMP/app"
tar -xzf "$TMP/app.tar.gz" -C "$TMP/app"
[ -f "$TMP/app/server.js" ] && [ -f "$TMP/app/scripts/local-sync.cjs" ] || die "The release archive is incomplete."
VERSION="$("$NODE_BIN" -p "require('$TMP/app/payload.json').version" 2>/dev/null || echo unknown)"

stop_running
mkdir -p "$APP_HOME"
rm -rf "$APP_HOME/app.old"
[ -d "$APP_HOME/app" ] && mv "$APP_HOME/app" "$APP_HOME/app.old"
mv "$TMP/app" "$APP_HOME/app"
rm -rf "$APP_HOME/app.old"
ok "OpenAdKit $VERSION installed to $APP_HOME"

# ---------------------------------------------------------------- launcher
# Stable ports matter: the browser keeps your keys and clients per origin
# (host + port), so the same ports are reused on every launch.
cat > "$APP_HOME/openadkit" <<LAUNCHER
#!/usr/bin/env bash
# OpenAdKit launcher. Usage: openadkit [start|stop|status]
set -eu
APP_HOME="$APP_HOME"
NODE_BIN="$NODE_BIN"
LAUNCHER
cat >> "$APP_HOME/openadkit" <<'LAUNCHER'
PORTS_FILE="$APP_HOME/ports"
LOG="$APP_HOME/server.log"

read_ports() {
  WEB=""; SYNC=""
  if [ -f "$PORTS_FILE" ]; then
    WEB="$(cut -d, -f1 "$PORTS_FILE")"; SYNC="$(cut -d, -f2 "$PORTS_FILE")"
  fi
}
is_up() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$1/$2"; }

pick_ports() {
  "$NODE_BIN" -e '
    const net = require("net");
    const free = (p) => new Promise((r) => { const s = net.createServer(); s.once("error", () => r(false)); s.listen(p, "127.0.0.1", () => s.close(() => r(true))); });
    (async () => {
      const [w, s] = (process.argv[1] || "").split(",").map(Number);
      if (w && s && await free(w) && await free(s)) { console.log(w + "," + s); return; }
      for (let p = 41573; p < 49990; p += 2) if (await free(p) && await free(p + 1)) { console.log(p + "," + (p + 1)); return; }
      process.exit(1);
    })();' "$(cat "$PORTS_FILE" 2>/dev/null || true)" > "$PORTS_FILE.tmp" && mv "$PORTS_FILE.tmp" "$PORTS_FILE"
  read_ports
}

open_url() {
  if [ "${OPENADKIT_NO_BROWSER:-}" = "1" ]; then echo "OpenAdKit: $1"; return; fi
  if command -v open >/dev/null 2>&1; then open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
  else echo "Open $1 in your browser."; fi
}

cmd="${1:-start}"
read_ports
case "$cmd" in
  stop)
    if [ -n "$SYNC" ]; then curl -s -X POST --max-time 3 "http://127.0.0.1:$SYNC/quit" >/dev/null 2>&1 || true; fi
    echo "OpenAdKit stopped."
    ;;
  status)
    if [ -n "$WEB" ] && is_up "$WEB" ""; then echo "running: http://127.0.0.1:$WEB/"; else echo "not running"; exit 1; fi
    ;;
  start)
    if [ -n "$WEB" ] && [ -n "$SYNC" ] && is_up "$SYNC" health && is_up "$WEB" ""; then
      open_url "http://127.0.0.1:$WEB/"; exit 0
    fi
    pick_ports
    cd "$APP_HOME/app"
    OPENADKIT_SYNC_PORT="$SYNC" PORT="$WEB" OPENADKIT_PACKAGED=unix NODE_ENV=production \
      nohup "$NODE_BIN" scripts/local-sync.cjs >"$LOG" 2>&1 &
    i=0
    while [ $i -lt 120 ]; do
      if is_up "$WEB" ""; then open_url "http://127.0.0.1:$WEB/"; exit 0; fi
      sleep 0.5; i=$((i + 1))
    done
    echo "OpenAdKit did not start within 60 seconds. Log: $LOG" >&2
    exit 1
    ;;
  *) echo "usage: openadkit [start|stop|status]" >&2; exit 2 ;;
esac
LAUNCHER
chmod +x "$APP_HOME/openadkit"

# ---------------------------------------------------------------- shortcuts
if [ "$PLATFORM" = "darwin" ]; then
  step "Creating OpenAdKit.app"
  rm -rf "$MAC_APP"
  mkdir -p "$MAC_APP/Contents/MacOS" "$MAC_APP/Contents/Resources"
  cat > "$MAC_APP/Contents/MacOS/OpenAdKit" <<EOF
#!/bin/bash
exec "$APP_HOME/openadkit" start
EOF
  chmod +x "$MAC_APP/Contents/MacOS/OpenAdKit"
  ICON_LINE=""
  if command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
    ICONSET="$TMP/OpenAdKit.iconset"; mkdir -p "$ICONSET"
    for s in 16 32 128 256 512; do
      sips -z $s $s "$APP_HOME/app/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null 2>&1 || true
      d=$((s * 2)); [ $d -le 512 ] && sips -z $d $d "$APP_HOME/app/icon.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null 2>&1 || true
    done
    if iconutil -c icns "$ICONSET" -o "$MAC_APP/Contents/Resources/OpenAdKit.icns" >/dev/null 2>&1; then
      ICON_LINE="<key>CFBundleIconFile</key><string>OpenAdKit</string>"
    fi
  fi
  cat > "$MAC_APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>OpenAdKit</string>
  <key>CFBundleDisplayName</key><string>OpenAdKit</string>
  <key>CFBundleIdentifier</key><string>com.dicecodes.openadkit</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>OpenAdKit</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  $ICON_LINE
</dict></plist>
EOF
  # Files fetched by curl carry no quarantine flag, but clear it anyway and
  # ad-hoc sign the bundle so Gatekeeper treats it as a local app.
  xattr -dr com.apple.quarantine "$MAC_APP" "$APP_HOME" 2>/dev/null || true
  codesign --force --deep -s - "$MAC_APP" >/dev/null 2>&1 || true
  ok "$MAC_APP (find it in Launchpad or Spotlight)"
else
  step "Adding OpenAdKit to your app menu"
  mkdir -p "$(dirname "$LINUX_DESKTOP")" "$(dirname "$LINUX_BIN")"
  ln -sf "$APP_HOME/openadkit" "$LINUX_BIN"
  cat > "$LINUX_DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=OpenAdKit
Comment=Open source AI marketing tool
Exec="$APP_HOME/openadkit" start
Icon=$APP_HOME/app/icon.png
Terminal=false
Categories=Office;Development;
EOF
  ok "App menu entry + '$LINUX_BIN' (run: openadkit, openadkit stop)"
  case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) warn "$HOME/.local/bin is not on your PATH; use $APP_HOME/openadkit directly." ;; esac
fi

# ---------------------------------------------------------------- Claude Desktop (MCP)
MCP_SCRIPT="$APP_HOME/app/mcp/openadkit-mcp.mjs"
if [ -f "$MCP_SCRIPT" ]; then
  if "$NODE_BIN" "$APP_HOME/app/scripts/register-mcp.cjs" --detect >/dev/null 2>&1; then
    answer="${OPENADKIT_CONNECT_CLAUDE:-}"
    if [ -z "$answer" ] && [ -e /dev/tty ]; then
      printf "\nClaude Desktop is installed. Connect OpenAdKit to it (adds the OpenAdKit MCP server)? [Y/n] "
      read -r answer </dev/tty || answer="n"
      [ -z "$answer" ] && answer="y"
    fi
    case "$answer" in
      y|Y|yes|YES|1)
        "$NODE_BIN" "$APP_HOME/app/scripts/register-mcp.cjs" --node "$NODE_BIN" --script "$MCP_SCRIPT" || warn "Could not update Claude Desktop's config."
        ;;
      *) echo "    Skipped. Connect later with: \"$NODE_BIN\" \"$APP_HOME/app/scripts/register-mcp.cjs\"" ;;
    esac
  fi
fi

# ---------------------------------------------------------------- start
step "Starting OpenAdKit"
"$APP_HOME/openadkit" start
printf "\n%sOpenAdKit %s is installed.%s\n" "$c_green" "$VERSION" "$c_reset"
if [ "$PLATFORM" = "darwin" ]; then
  echo "  Open it any time from Launchpad / Spotlight: OpenAdKit"
else
  echo "  Open it any time from your app menu, or run: openadkit"
fi
echo "  Stop it:     \"$APP_HOME/openadkit\" stop"
if [ -f "$MCP_SCRIPT" ]; then
  echo "  MCP server:  \"$NODE_BIN\" \"$MCP_SCRIPT\"   (Claude Code: claude mcp add openadkit -- \"$NODE_BIN\" \"$MCP_SCRIPT\")"
fi
echo "  Update:      run this installer again"
echo "  Uninstall:   curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- --uninstall"
