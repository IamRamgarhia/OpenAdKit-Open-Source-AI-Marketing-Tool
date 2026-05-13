#!/usr/bin/env bash
# AdForge desktop launcher (macOS / Linux).
#
# Double-click this file in Finder / your file manager to launch the AdForge
# launcher control panel in your default browser. macOS opens .command files
# in Terminal automatically; on Linux, mark it executable (it already is) and
# associate it with your terminal or just run it from the file manager.
#
# This is the Mac/Linux equivalent of AdForge.hta on Windows. Browsers on
# these platforms can't spawn processes from a local HTML file (sandbox), so
# a shell script with a clear filename serves the same purpose: one click,
# server up, browser opens.

set -e
cd "$(dirname "$0")"
exec bash scripts/start.sh
