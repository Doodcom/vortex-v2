#!/usr/bin/env bash
# Installs the Vortex polkit rule so chained pkexec maintenance actions
# ask for your password once (kept ~5 min) instead of once per command.
set -euo pipefail

RULE_SRC="$(cd "$(dirname "$0")/.." && pwd)/resources/polkit/49-vortex.rules"
RULE_DST="/etc/polkit-1/rules.d/49-vortex.rules"

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

install -m 0644 -o root -g root "$RULE_SRC" "$RULE_DST"
echo "Installed $RULE_DST"
echo "polkit picks up rules.d changes automatically — no restart needed."
