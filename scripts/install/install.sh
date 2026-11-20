#!/usr/bin/env bash
# OpenAdKit one-line installer for macOS / Linux / WSL
# Usage from any terminal:
#   curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/scripts/install/install.sh | bash
#
# Does everything in one go:
#   1. Checks for Node.js 20.9+ and git (prints the install command if missing)
#   2. Clones OpenAdKit into ~/OpenAdKit (or pulls if present)
#   3. Runs npm install + a production build
#   4. Launches OpenAdKit (ports are picked automatically)

set -e

REPO="https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool.git"
BRANCH="main"
TARGET="${OPENADKIT_DIR:-${ADFORGE_DIR:-$HOME/OpenAdKit}}"

c_cyan="\033[36m"; c_green="\033[32m"; c_yellow="\033[33m"; c_red="\033[31m"; c_reset="\033[0m"
step()  { printf "\n${c_cyan}==> %s${c_reset}\n" "$1"; }
ok()    { printf "${c_green}OK  %s${c_reset}\n" "$1"; }
warn()  { printf "${c_yellow}!!  %s${c_reset}\n" "$1"; }
err()   { printf "${c_red}ERR %s${c_reset}\n" "$1"; }

echo
echo "=================================================="
echo " OpenAdKit installer - by Dicecodes"
echo "=================================================="

# --- Detect OS for install hints ---
OS="$(uname -s)"
hint_install_node=""
hint_install_git=""
case "$OS" in
    Darwin)
        hint_install_node="brew install node"
        hint_install_git="brew install git"
        ;;
    Linux)
        if   command -v apt-get >/dev/null 2>&1; then
            hint_install_node="sudo apt-get update && sudo apt-get install -y nodejs npm"
            hint_install_git="sudo apt-get install -y git"
        elif command -v dnf >/dev/null 2>&1; then
            hint_install_node="sudo dnf install -y nodejs npm"
            hint_install_git="sudo dnf install -y git"
        elif command -v pacman >/dev/null 2>&1; then
            hint_install_node="sudo pacman -S nodejs npm"
            hint_install_git="sudo pacman -S git"
        else
            hint_install_node="(use your distro's package manager, or https://nodejs.org, to install Node 22 LTS)"
            hint_install_git="(use your distro's package manager to install git)"
        fi
        ;;
    *)
        hint_install_node="install Node 22 LTS from https://nodejs.org/en/download"
        hint_install_git="install git from https://git-scm.com/downloads"
        ;;
esac

# --- Step 1: Node ---
step "Checking for Node.js"
if ! command -v node >/dev/null 2>&1; then
    err "Node.js not found."
    echo "  Install it with:  $hint_install_node"
    echo "  Then re-run this installer."
    exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=9)?0:1)'; then
    err "Node $(node --version) is too old. OpenAdKit needs Node 20.9 or newer (22 LTS recommended)."
    echo "  Update with:  $hint_install_node"
    exit 1
fi
ok "Node $(node --version)"

# --- Step 2: Git ---
step "Checking for git"
if ! command -v git >/dev/null 2>&1; then
    err "git not found."
    echo "  Install it with:  $hint_install_git"
    echo "  Then re-run this installer."
    exit 1
fi
ok "$(git --version)"

# --- Step 3: Clone ---
step "Fetching OpenAdKit into $TARGET"
if [ -d "$TARGET/.git" ]; then
    echo "Existing checkout found. Pulling latest..."
    (cd "$TARGET" && git pull --ff-only) || warn "git pull failed; continuing with existing files."
elif [ -d "$TARGET" ]; then
    warn "$TARGET exists and is not a git repo. Using folder as-is."
else
    git clone --depth=1 --branch "$BRANCH" "$REPO" "$TARGET"
fi
cd "$TARGET"
ok "Source ready at $TARGET"

# --- Step 4: npm install ---
step "Installing dependencies (first run can take a few minutes)"
npm install --no-audit --no-fund
ok "Dependencies installed"

step "Building the production app (about a minute)"
npm run build
ok "Build complete"

# Ports are chosen on first launch by scripts/resolve-ports.cjs (it asks the OS
# for a free pair and merges them into .env.local, keeping any other keys).
mkdir -p data
chmod +x OpenAdKit.command scripts/*.sh 2>/dev/null || true

echo
echo "=================================================="
printf "${c_green} Install complete - launching OpenAdKit...${c_reset}
"
echo "=================================================="
echo
echo "  Next time, run:  bash $TARGET/OpenAdKit.command"
echo "  (on a Mac you can double-click OpenAdKit.command in Finder)"
echo "  Stop with Ctrl+C here, or:  bash $TARGET/scripts/stop.sh"
echo
exec bash OpenAdKit.command
