#!/usr/bin/env bash
set -euo pipefail

# Link the local @rulehub/rulehub-backstage-plugin into the scaffolded Backstage app under tmp/.
# Idempotent: re-runs safely.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$ROOT_DIR/tmp"
APP_PKG="$TMP_DIR/packages/app/package.json"
PKG_NAME="@rulehub/rulehub-backstage-plugin"
REL="../../.." # relative from tmp/packages/app to repo root

log(){ printf '\033[1;34m[link]\033[0m %s\n' "$*"; }
err(){ printf '\033[1;31m[err]\033[0m %s\n' "$*"; }

DETACH_NM=false
if [[ ${1:-} == "--detach-plugin-node-modules" ]]; then
  DETACH_NM=true
fi

[[ -f "$TMP_DIR/backstage.json" ]] || { err "Backstage app not found (run dev-setup-backstage.sh first)"; exit 1; }

if [[ ! -f "$APP_PKG" ]]; then err "App package.json not found: $APP_PKG"; exit 1; fi

# Patch dependency (use node script instead of heredoc for robustness under npm)
node "$ROOT_DIR/scripts/patch-app-dep.mjs" "$APP_PKG" "$PKG_NAME" "$REL"

# Install dependencies only if the linked plugin isn't present yet to avoid long no-op installs
if [[ -d "$TMP_DIR/packages/app/node_modules/@rulehub/rulehub-backstage-plugin" ]]; then
  log "linked package present in node_modules — skipping install"
else
  log "installing deps in tmp via Corepack/Yarn (first run can take a few minutes)"
  (cd "$TMP_DIR" && corepack enable && corepack yarn install && log "install complete")
fi

# Optionally detach plugin node_modules to avoid duplicate Backstage/React during dev run
if $DETACH_NM; then
  if [[ -d "$ROOT_DIR/node_modules" ]]; then
    STASH_DIR="$ROOT_DIR/.node_modules.react-detach"
    mkdir -p "$STASH_DIR"
    # Detach React to prevent duplicate React instances
    for PKG in react react-dom; do
      if [[ -d "$ROOT_DIR/node_modules/$PKG" ]]; then
        if [[ -d "$STASH_DIR/$PKG" ]]; then
          rm -rf "$ROOT_DIR/node_modules/$PKG"
          log "removed $PKG from plugin node_modules (already stashed)"
        else
          mv "$ROOT_DIR/node_modules/$PKG" "$STASH_DIR/$PKG"
          log "detached $PKG from plugin node_modules -> .node_modules.react-detach/$PKG"
        fi
      fi
    done
    # Detach Backstage core libs so bundler resolves them from the app workspace
    for PKG in @backstage/core-components @backstage/core-plugin-api; do
      PKG_DIR="$ROOT_DIR/node_modules/$PKG"
      STASH_PKG_DIR="$STASH_DIR/$PKG"
      if [[ -d "$PKG_DIR" ]]; then
        mkdir -p "$(dirname "$STASH_PKG_DIR")"
        if [[ -d "$STASH_PKG_DIR" ]]; then
          rm -rf "$PKG_DIR"
          log "removed $PKG from plugin node_modules (already stashed)"
        else
          mv "$PKG_DIR" "$STASH_PKG_DIR"
          log "detached $PKG from plugin node_modules -> .node_modules.react-detach/$PKG"
        fi
      fi
    done
  else
    log "no plugin node_modules to detach"
  fi
fi

# Ensure rulehub config & sample index
CFG="$TMP_DIR/app-config.local.yaml"
touch "$CFG"
grep -q '^rulehub:' "$CFG" || { echo -e "rulehub:\n  indexUrl: https://rulehub.github.io/rulehub/plugin-index/index.json" >> "$CFG"; log "config rulehub.indexUrl added"; }
mkdir -p "$TMP_DIR/packages/app/public/plugin-index"
IDX="$TMP_DIR/packages/app/public/plugin-index/index.json"
[[ -f "$IDX" ]] || { echo '{"packages":[]}' > "$IDX"; log "seed index.json created"; }

# Patch App.tsx import and FlatRoutes Route via Node for robustness
APP_TSX="$TMP_DIR/packages/app/src/App.tsx"
if [[ -f "$APP_TSX" ]]; then
  node "$ROOT_DIR/scripts/patch-app-tsx.mjs" "$APP_TSX"
else
  log "WARNING: App.tsx not found; skipping route injection"
fi

log "Done. Start dev server: (cd tmp && corepack yarn start) then open http://localhost:3000/rulehub"
if $DETACH_NM; then
  log "NOTE: selected plugin node_modules were stashed to .node_modules.react-detach. Restore later with: rsync -a .node_modules.react-detach/ node_modules/"
fi