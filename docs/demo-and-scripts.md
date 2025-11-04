# Demo & Scripts

This page gives you the fastest way to run the demo and a compact overview of useful scripts. For deeper configuration and troubleshooting, follow the links instead of repeated details.

## Quick commands

- Demo (full Backstage app):
  - `npm run demo`
- Demo (frontend-only):
  - `npm run demo:front`
- Reset demo state:
  - `npm run demo -- --reset` (see `docs/troubleshooting.md` for when to use)
- End-to-end tests (Playwright):
  - `npm run e2e`
- Quality pass (lint + typecheck + tests):
  - `npm run verify`

### First-time setup (once)

```bash
npm ci
corepack enable
```

## Running the demo

- Full app: starts a temporary Backstage app in `tmp/` with this plugin pre-wired at `/rulehub` (see commands above).
- Frontend-only: runs the UI without the backend (see commands above). If you want a quiet console, start the backend separately (see `docs/troubleshooting.md`).

Ports:

- Default port is 3000. You can override with `PORT` (or `DEMO_PORT`) in your environment or `.env`:

  ```bash
  PORT=3001
  ```

  Prefer the exact URL printed by the dev server, then append `/rulehub`.

Configuration and runtime overrides:

- App config keys and examples: see `docs/BACKSTAGE_CONFIG_EXAMPLE.yaml` and `docs/configuration-minimal.md`.
- Runtime query/env overrides (e.g., `?index=`, `?repoBase=`, `RULEHUB_*`): see `docs/DETAILED_GUIDE.md#runtime-overrides-demo--frontend-only` and `docs/DETAILED_GUIDE.md#configuration-app-config`.

Real data preview:

- If you use the charts index, prefer a CDN URL as shown in `docs/BACKSTAGE_CONFIG_EXAMPLE.yaml`. Copying files into `tmp/` is optional.

## E2E

See `docs/testing.md#end%E2%80%91to%E2%80%91end-tests-playwright` for commands and details.

## Scripts overview

- Build: `npm run build`, `npm run build:watch` — builds production bundles into `dist/`. You usually don’t need this for `npm run demo` (it builds automatically), but it’s useful to verify production output locally, and it’s required for `npm run size` and `npm run api:check`.
- Quality: `npm run lint`, `npm run typecheck`, `npm test`, `npm run verify` (coverage notes in `docs/testing.md`)
- Size & API surface: `npm run size` (see `docs/bundle-size-budgets.md`), `npm run api:check` (API report in `api-report/`)
- Demo preview: use `npm run demo` (full app) or `npm run demo:front` (frontend-only) to inspect the UI quickly.

## See also

- Full guide and examples: `docs/DETAILED_GUIDE.md`
- Troubleshooting: `docs/troubleshooting.md`
- Config examples: `docs/BACKSTAGE_CONFIG_EXAMPLE.yaml`, `docs/configuration-minimal.md`
