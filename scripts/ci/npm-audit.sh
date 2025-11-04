#!/usr/bin/env bash
set -euo pipefail

# Run npm audit for production deps and emit summary to stdout; write full JSON to audit.json
# Usage: scripts/ci/npm-audit.sh

if [[ ! -f package-lock.json ]]; then
  npm install --package-lock-only --ignore-scripts --no-audit >/dev/null 2>&1 || true
fi

npm audit --omit=dev --json > audit.json || true

if command -v jq >/dev/null 2>&1; then
  echo "Vulnerability summary:" && jq '.metadata.vulnerabilities' audit.json
else
  echo "jq not found; raw audit.json available"
fi

high_or_critical=$(node -e "const fs=require('fs');try{const j=JSON.parse(fs.readFileSync('audit.json','utf8'));const m=j.metadata?.vulnerabilities||{};const n=(m.high||0)+(m.critical||0);process.stdout.write(String(n));}catch(e){process.stdout.write('');}")

# When running in GitHub Actions, expose output; when running under act, set a file if possible
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "high_or_critical=${high_or_critical}" >> "$GITHUB_OUTPUT"
else
  echo "high_or_critical=${high_or_critical}" > .audit.out
fi
