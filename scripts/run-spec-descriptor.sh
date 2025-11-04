#!/usr/bin/env bash
set -euo pipefail
# shim to run spec:descriptor using yarn if available, otherwise node
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if command -v yarn >/dev/null 2>&1; then
  echo "running: yarn spec:descriptor"
  yarn spec:descriptor
else
  echo "yarn not found — running node ./scripts/spec-descriptor-check.js"
  node ./scripts/spec-descriptor-check.js
fi
