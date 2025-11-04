#!/usr/bin/env sh
set -eu

# Runs Renovate in dry-run mode using the local platform and writes outputs to dist/
# Expects the Renovate CLI to be available in PATH (e.g., via container image).

LOG_LEVEL=${LOG_LEVEL:-info}
RENOVATE_DRY_RUN=${RENOVATE_DRY_RUN:-lookup}
GITHUB_WORKSPACE=${GITHUB_WORKSPACE:-/github/workspace}
GITHUB_ACTOR=${GITHUB_ACTOR:-}

# Ensure we operate from the workspace dir so Renovate local platform picks CWD
cd "${GITHUB_WORKSPACE}"

mkdir -p dist

cat > dist/renovate.local.json <<'JSON'
{
  "extends": ["config:recommended"],
  "dependencyDashboard": false,
  "prHourlyLimit": 0
}
JSON

if [ "${GITHUB_ACTOR}" = "nektos/act" ]; then
  MANAGERS="github-actions,npm"
else
  MANAGERS="github-actions,npm"
fi

echo "Using managers: ${MANAGERS}"

TOUT=""
if command -v timeout >/dev/null 2>&1; then
  TOUT="timeout -k 10 300s"
  echo "Using timeout wrapper: ${TOUT}"
fi

# Renovate (platform=local) expects a git repository; init a temporary one if absent
if [ ! -d .git ]; then
  echo "Initializing temporary git repository for Renovate local platform"
  git -c init.defaultBranch=main init -q
  git add -A >/dev/null 2>&1 || true
  git -c user.email="act@example.com" -c user.name="act" commit -qm "init snapshot for renovate dry-run" || true
fi

# Provide config via default filename to maximize CLI compatibility across versions
cp dist/renovate.local.json renovate.json

# Ensure Renovate can discover the config when using git file listing
git add renovate.json >/dev/null 2>&1 || true
git -c user.email="act@example.com" -c user.name="act" commit -qm "add renovate.json for renovate dry-run" || true

# Print effective config for debug
renovate \
  --platform=local \
  --require-config=true \
  --enabled-managers="${MANAGERS}" \
  --print-config > dist/renovate.print-config.json || true

# Dry-run; capture logs compatibly across Renovate versions (no --log-file in v41)
# Do not fail the job on Renovate non-zero exit
${TOUT} renovate \
  --platform=local \
  --require-config=true \
  --dry-run="${RENOVATE_DRY_RUN}" \
  --enabled-managers="${MANAGERS}" \
  > dist/renovate.log 2>&1 || true

echo "Renovate dry-run completed. See attached log." > dist/renovate-summary.txt
