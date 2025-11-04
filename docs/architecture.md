# Architecture Overview

This plugin is a lightweight, read-only policy catalog for Backstage.

This document provides a short, high-level overview of the `rulehub-backstage-plugin` architecture so contributors and integrators can quickly understand the main parts and their responsibilities.

## Data Flow

- Source: a static JSON index (default: official hosted URL `https://rulehub.github.io/rulehub-charts/plugin-index/index.json`).
- Fetch: `RulehubClient.getIndex(url, signal)` performs a fetch with AbortController support.
- Validation: AJV validates the response against `plugin-index.schema.json` (supports legacy `items` array).
- Normalization: entries are normalized to the `Pack` shape with safe defaults.
- Caching: 5-minute in-memory TTL cache keyed by URL to avoid refetches between navigations.

## Core components

- RulehubPage (UI): React page component that renders the policy catalog using Backstage core components (Table, Progress, EmptyState). Responsible for presentation and user interactions (retry, filtering, pagination).
- RulehubClient (data layer): Small fetch wrapper with AbortController support, AJV-based validation against `plugin-index.schema.json`, and an in-memory TTL cache (5 minutes). Exposes clear error types via `RulehubError`.
- Schema (`plugin-index.schema.json`): AJV schema that defines the expected JSON index structure (root `packages` array). Used by `RulehubClient` for runtime validation of remote/static indexes.
- Tests: Jest + Testing Library cover UI states (loading, error, empty, retry) and client behaviours (abort, caching, validation). Coverage thresholds are enforced in CI.

## UI

- Single routable page (`RulehubPage`) renders a Backstage `Table`.
- Loading: spinner displayed (data-testid=`loading`).
- Error: `WarningPanel` with retry button (data-testid=`error`).
- Empty: explicit empty state (data-testid=`empty-state`).
- Coverage badges: simple inline chips from the `coverage` array.

## Configuration

- `rulehub.indexUrl` (optional) overrides the default hosted URL.
- If you self-host the index, set `rulehub.indexUrl` to your URL.

## Error Handling

- Errors are wrapped in `RulehubError` with codes in `ERROR_CODES` (HTTP, schema invalid, aborted, unknown).
- Aborts are handled to avoid setting state after unmount.

## Performance

- Minimal render overhead; simple table with memoized data fetch logic.
- 5-minute TTL balances freshness vs network calls; can be adjusted if requirements change.

## Design choices

- Minimal runtime: The plugin ships as a TypeScript -> CommonJS package suitable to be consumed by Backstage apps without additional bundling.
- No backend required: The plugin reads a static `index.json` file (configurable via `rulehub.indexUrl`) which can be served as a static asset or proxied through a backend.
- Stability over feature bloat: Keep API surface small. If new public exports are added in future, consider adopting API Extractor.

## Extensibility notes

- Cache invalidation: Currently a 5m TTL; if you need instant refresh, the `RulehubClient` can be extended with a `clearCache()` method and wired into a dev-only button.
- UI components: If the plugin grows UI primitives for reuse, extend the existing fixture-driven Jest harness or add lightweight demo views in Backstage.

## Security

- No secrets are stored. Any externally fetched index should be hosted on trusted static hosting and optionally proxied through the Backstage backend.

## Testing

- Jest + Testing Library with coverage thresholds (branches 60, fn 70, lines 80, stmts 80).
- Tests cover validation, aborts, retries, cache behavior, and UI states.

---

For operational details and examples see `docs/DETAILED_GUIDE.md` and the tests in `tests/`.
