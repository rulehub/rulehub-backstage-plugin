# Testing

This page centralizes everything about tests: unit tests (Jest), end‑to‑end (Playwright), coverage, and a few helpful switches.

## Quick start

- Unit tests (with coverage thresholds): `npm run test:ci`
- Fast local run (no coverage thresholds): `npm run test:dev` (sets `SKIP_COVERAGE=1`)
- End‑to‑end (Playwright): `npm run e2e`
- Full quality pass (lint + typecheck + unit tests): `npm run verify`

## Unit tests (Jest + Testing Library)

- Commands:
  - `npm test` — standard run
  - `npm run test:dev` — same, but disables coverage thresholds via `SKIP_COVERAGE=1`
  - `npm run test:ci` — enables coverage thresholds (CI parity)
- Coverage output: `coverage/` (text summary, `lcov.info`, and HTML report at `coverage/lcov-report/index.html`)
- Thresholds (enforced when not skipping coverage):
  - branches: 60
  - functions: 70
  - lines: 80
  - statements: 80

Tip: Use `npm run verify` to run lint, typecheck, and unit tests in one go.

## End‑to‑end tests (Playwright)

- Default run: `npm run e2e`
- Variants:
  - Headed mode: `npm run e2e:headed`
  - Reuse existing demo server: `npm run e2e:reuse` (set when a demo app is already running)
  - Smoke subset: `npm run e2e:smoke` (or `:reuse` variant)
- What happens:
  - The script launches the demo app in frontend‑only mode (via `scripts/demo-real.mjs --frontend-only`) and runs tests from `e2e/tests/*` against `http://localhost:3000`.
  - First run may download Playwright browsers.
- Config: `e2e/playwright.config.ts`

Troubleshooting: see `docs/troubleshooting.md` for port conflicts, backend noise, and demo reset tips.

## Policy/Compliance coverage

This repository is a frontend plugin; policy-as-code (e.g., Gatekeeper/Kyverno Rego) coverage may live in the charts or policy repos. If you track compliance coverage here, summarize it in this section.

- Policy Test Coverage (Gatekeeper Rego)

  Policies with tests: 0/0 (0.0%)

## Cache testing

`RulehubClient.instance.setCacheTTL(ms)` lets you adjust the in‑memory cache TTL (default 5 minutes). Use `0` in unit tests to disable caching and validate refetch behavior.

## Related topics

- Bundle budgets and size checks: `docs/bundle-size-budgets.md` (see `npm run size`)
- Minimal configuration and overrides that can affect tests/demo: `docs/configuration-minimal.md`, `docs/DETAILED_GUIDE.md`
