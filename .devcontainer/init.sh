#!/usr/bin/env bash
set -euo pipefail

corepack enable >/dev/null 2>&1 || true
npm --version

# Install deps if node_modules missing
if [ ! -d node_modules ]; then
  npm ci || npm install
fi

# Print quick tips
cat <<'EOF'
Dev container ready.
Useful scripts:
  - npm run typecheck
  - npm test
  - npm run build
  - npm run demo
EOF
