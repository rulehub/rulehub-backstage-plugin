#!/usr/bin/env bash
set -euo pipefail

# Backstage scaffold helper (install only, no start, no plugin link)
# Creates or refreshes a clean Backstage app in tmp/
# Usage: ./scripts/dev-setup-backstage.sh [--reset] [--app-name NAME] [--skip-install]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$ROOT_DIR/tmp"
APP_NAME="backstage"
RESET=0
SKIP_INSTALL=0

while [[ $# -gt 0 ]]; do case $1 in
  --reset) RESET=1; shift;;
  --app-name) APP_NAME=$2; shift 2;;
  --skip-install) SKIP_INSTALL=1; shift;;
  -h|--help) echo "Usage: $0 [--reset] [--app-name NAME]"; exit 0;;
  *) echo "Unknown arg $1"; exit 2;;
esac; done

log(){ printf '\033[1;34m[dev]\033[0m %s\n' "$*"; }
err(){ printf '\033[1;31m[err]\033[0m %s\n' "$*"; }

need(){ command -v "$1" >/dev/null 2>&1 || { err "Missing $1"; exit 1; }; }
for c in node npm npx yarn; do need "$c"; done

log "root=$ROOT_DIR tmp=$TMP_DIR appName=$APP_NAME reset=$RESET skipInstall=$SKIP_INSTALL"

if [[ $RESET -eq 1 ]]; then
  log "--reset: removing tmp"
  rm -rf "$TMP_DIR"
fi

if [[ ! -f $TMP_DIR/backstage.json ]]; then
  log "Scaffolding Backstage app"
  rm -rf "$TMP_DIR"; mkdir -p "$TMP_DIR"
  echo "$APP_NAME" | npx --yes @backstage/create-app@latest --skip-install --path "$TMP_DIR" >/dev/null 2>&1
  if [[ $SKIP_INSTALL -eq 0 ]]; then
    (cd "$TMP_DIR" && yarn install)
  else
    log "--skip-install set; skipping initial yarn install"
  fi
  log "Scaffold complete"
else
  log "Already exists (no action). Use --reset to recreate."
fi

log "Done (install only)."
