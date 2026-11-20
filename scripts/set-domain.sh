#!/usr/bin/env bash
# OpenAdKit — add or remove the  openadkit.local  hosts entry.
# Needs sudo.
#
# Usage:
#   sudo bash scripts/set-domain.sh           # adds the entry
#   sudo bash scripts/set-domain.sh remove    # removes the entry

set -e

HOSTS="/etc/hosts"
ENTRY="127.0.0.1   openadkit.local   # OpenAdKit local"
ACTION="${1:-add}"

if [ "$EUID" -ne 0 ]; then
  echo
  echo "[ERROR] This script needs root to edit $HOSTS."
  echo "Run again with sudo:"
  echo "   sudo bash scripts/set-domain.sh $1"
  echo
  exit 1
fi

if [ "$ACTION" = "remove" ]; then
  if grep -q "openadkit.local" "$HOSTS"; then
    cp "$HOSTS" "$HOSTS.bak"
    sed -i.bak '/openadkit\.local/d' "$HOSTS" 2>/dev/null || sed -i '' '/openadkit\.local/d' "$HOSTS"
    echo
    echo "Removed openadkit.local from $HOSTS (backup: $HOSTS.bak)"
    echo
  else
    echo
    echo "openadkit.local is not in $HOSTS. Nothing to do."
    echo
  fi
  exit 0
fi

# Add path
if grep -q "openadkit.local" "$HOSTS"; then
  echo
  echo "openadkit.local is ALREADY in $HOSTS. Nothing to do."
  echo
  exit 0
fi

echo "" >> "$HOSTS"
echo "$ENTRY" >> "$HOSTS"

echo
echo "Added:  $ENTRY"
echo
echo "Now run OpenAdKit on port 80 to use  http://openadkit.local/"
echo "Edit .env.local and set  PORT=80,  then run  sudo bash scripts/start.sh"
echo
echo "Or keep your current port and use  http://openadkit.local:<your-port>/"
echo
