# Rulehub Plugin – Detailed Guide

This document collects all extended information moved out of the root `README.md` to keep the main page concise.

## Contents

- [Compatibility Matrix](#compatibility-matrix)
- [Full Installation & Integration](#full-installation--integration)
- [Local Testing in a Backstage App](#local-testing-in-a-backstage-app)
- [Menu Registration](#menu-registration)
- [Configuration (app-config)](#configuration-app-config)
- [Source links base (charts)](#source-links-base-charts)
- [Serving the Index File](#serving-the-index-file)
- [Generating index.json](#generating-indexjson)
- [Expected JSON Format](#expected-json-format)
- [Troubleshooting](#troubleshooting)
- [Cut & Paste / Extraction](#cut--paste--extraction)
- [Automated Installation Script](#automated-installation-script)

## Compatibility Matrix

| Plugin Version | React (peer) | React (tested) | Backstage (peer)                                    | Backstage (tested)     |
| -------------- | ------------ | -------------- | --------------------------------------------------- | ---------------------- |
| 0.1.x          | >= 18 < 19   | 18.2.0         | core-plugin-api >=1.9 <2; core-components >=0.13 <1 | 1.30+ (representative) |

Notes:

- Other versions within ranges usually work. Open an issue/PR with confirmations.
- Backstage application version effectively maps to the versions of the frontend packages.

## Full Installation & Integration

Requirements:

- Node.js >= 20
- React 18.x (peer)
- Backstage core plugin APIs compatible with Backstage v1.x

1. Install dependency in Backstage app:

   ```bash
   npm install @rulehub/rulehub-backstage-plugin
   # or yarn add / pnpm add
   ```

2. Add route:

   ```tsx
   // packages/app/src/App.tsx
   import React from 'react';
   import { Route } from 'react-router-dom';
   import { FlatRoutes } from '@backstage/core-app-api';
   import { RulehubPage } from '@rulehub/rulehub-backstage-plugin';

   export const App = () => (
     <FlatRoutes>
       <Route path="/rulehub" element={<RulehubPage />} />
     </FlatRoutes>
   );
   ```

3. The plugin uses the official hosted index by default. You can use either of the hosted JSON endpoints:

- Recommended (charts): https://rulehub.github.io/rulehub-charts/plugin-index/index.json
- Alternate (core): https://rulehub.github.io/rulehub/plugin-index/index.json

You can also point it to your own hosted URL via `rulehub.indexUrl` if needed.

4. Optional `app-config.local.yaml` override:

```yaml
rulehub:
  # Optional: serve a self-hosted index from your Backstage app/backend
  indexUrl: /api/rulehub/index.json
```

5. Start Backstage and open `/rulehub`.

## Local Testing in a Backstage App

### Temporary App via create-app

```bash
npx @backstage/create-app@latest
cd my-backstage-app
```

Build & pack plugin (in plugin repo):

```bash
npm run build
npm pack
```

Install tarball into the Backstage app and register the route (as above). Create `packages/app/public/plugin-index/index.json` with sample data:

```json
{
  "packages": [
    {
      "id": "example.policy",
      "name": "Example Policy",
      "standard": "TEST",
      "version": "1.0",
      "coverage": ["TEST 1.0 Item 1 — Sample"]
    }
  ]
}
```

Start dev server (`yarn dev`) and visit `/rulehub`.

### Monorepo Workspace

Place the plugin folder as a workspace, add dependency reference, run the same route + index steps.

### Fast Inner Loop

- `npm run build` after source edits if consuming the compiled output.
- With workspaces hot reload often suffices.

## Menu Registration

Add a sidebar item:

```tsx
// packages/app/src/components/Root/Root.tsx
import { SidebarItem } from '@backstage/core-components';
<SidebarItem to="/rulehub" text="RuleHub" />;
```

## Configuration (app-config)

Default index URL: `https://rulehub.github.io/rulehub-charts/plugin-index/index.json` (recommended). Equivalent host: `https://rulehub.github.io/rulehub/plugin-index/index.json`.

You can override it to a local static asset (no network/CORS) such as `/plugin-index/index.json` if you prefer to serve the index from your Backstage app. Example override:

```yaml
rulehub:
  indexUrl: /api/rulehub/index.json
  links:
    # Base for repository links (ID/Name columns)
    # You can use GitHub Pages index.json URLs here; the plugin will normalize them
    # to the correct GitHub tree bases for actual links.
    repoBaseUrl: https://rulehub.github.io/rulehub/plugin-index/index.json
    # Optional: base for engine-specific sources in the "Source" column.
    # Recommended when your index.json comes from rulehub-charts and contains
    # kyvernoPath/gatekeeperPath relative to the charts repository.
    sourceBaseUrl: https://rulehub.github.io/rulehub-charts/plugin-index/index.json
```

Useful when proxying or serving from backend.

### Runtime overrides (demo / frontend-only)

- Query params:
  - `index`: `/rulehub?index=/plugin-index/index.json`
  - `repoBase`: `/rulehub?repoBase=https://rulehub.github.io/rulehub/plugin-index/index.json`
  - `sourceBase`: `/rulehub?sourceBase=https://rulehub.github.io/rulehub-charts/plugin-index/index.json`
- Env vars (affect demo scripts and may be read at runtime in dev):
  - `RULEHUB_INDEX_URL`
  - `RULEHUB_REPO_BASE_URL`
  - `RULEHUB_SOURCE_BASE_URL`

### Linking fields in the index

If your index entries include linking fields, the plugin will prefer them automatically:

- `repoUrl`: full URL to the rule/package in the repository.
- `repoPath`: a repo-relative path joined with `links.repoBaseUrl`.

This avoids maintaining per-ID mappings in Backstage config while keeping links deterministic.

### Engine-specific links (optional)

When present in entries, the following render in a dedicated "Source" column as Kyverno and/or Gatekeeper links:

- `kyvernoUrl` / `kyvernoPath`
- `gatekeeperUrl` / `gatekeeperPath`

If only `repoUrl`/`repoPath` is present, the ID/Name columns remain clickable as before.

### Per-ID mappings (optional)

For exceptional cases where IDs don’t map cleanly to repository paths, you can provide explicit mappings in Backstage config:

```yaml
rulehub:
  links:
    perId:
      cis-1: policies/k8s/cis-1
      iso-27001: https://github.com/rulehub/rulehub/tree/main/policies/iso/iso-27001
    # Alternate (string) form if your config system cannot pass objects (parsed as JSON at runtime):
    perIdJson: '{"cis-1":"policies/cis/1","iso-27001":"https://github.com/rulehub/rulehub/tree/main/policies/iso/iso-27001"}'
```

## Source links base (charts)

When consuming `dist/index.json` generated by `rulehub-charts`, many entries include
`kyvernoPath` / `gatekeeperPath` relative to the charts repository. To ensure the
"Source" column links directly into the charts repo, set:

```yaml
rulehub:
  links:
    # You can use GitHub Pages index.json here; the plugin normalizes to GitHub tree for actual links.
    sourceBaseUrl: https://rulehub.github.io/rulehub-charts/plugin-index/index.json
```

If omitted, the plugin will first try to auto-detect a charts repository base
from the `indexUrl` and environment:

- jsDelivr CDN (e.g. `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/.../plugin-index/index.json`)
- raw.githubusercontent.com (e.g. `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/.../plugin-index/index.json`)
- GitHub Pages for charts repos (e.g. `https://<owner>.github.io/<repo>/plugin-index/index.json` where `<repo>` contains `charts`)
- Special case: when using the official RuleHub site `https://rulehub.github.io/rulehub-charts/plugin-index/index.json`,
  the plugin normalizes Source links to the charts repository on GitHub while Name/ID continue to link to the core repo.

If none of the above applies, it falls back to `repoBaseUrl` for Source links.

Additionally, when a catalog entry doesn’t provide explicit engine paths but the engine can be
inferred from its generic `paths`, the UI will construct a best‑effort link into the charts repo
using the entry’s `id`:

- Kyverno: `files/kyverno/<domain>-<name>-policy.yaml`
- Gatekeeper: `files/gatekeeper/<domain>-<name>-constraint.yaml`

This heuristic reduces 404s when charts follow the canonical flat layout. If a particular file
doesn’t exist in the charts repository, the link may still return 404 — in that case, add
`kyvernoPath` / `gatekeeperPath` to the index entry or publish the missing artifact in charts.

## Filters

The catalog page includes lightweight client-side filters above the table:

- Standard (select)
- Jurisdiction (select)

Filter state is reflected in the URL as query parameters (`standard`, `jurisdiction`), so you can share filtered views like:

```text
/rulehub?standard=GDPR&jurisdiction=EU
```

### Debugging links and bases

Append `?debug=1` to the URL (e.g. `/rulehub?debug=1`) to display a small debug block showing the currently effective repository base. This helps verify that deep links resolve to the expected repository tree.

## Serving the Index File

### Option A: Static Asset (Recommended)

Create `packages/app/public/plugin-index/index.json`. It becomes reachable at `/plugin-index/index.json`.

### Option B: Backend Endpoint

Express example:

```ts
import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';

export async function createPolicyCatalogRouter() {
  const router = Router();
  router.get('/api/rulehub/index.json', async (_req, res) => {
    const file = path.resolve(process.cwd(), 'plugin-index/index.json');
    const content = await fs.readFile(file, 'utf-8');
    res.type('application/json').send(content);
  });
  return router;
}
```

Mount in backend bootstrap and (optionally) adjust `rulehub.indexUrl` if using a different path.

## Generating index.json

Create an `index.json` with your policy metadata (packages array and fields used by the plugin). Then either:

- copy it into the Backstage app at `packages/app/public/plugin-index/index.json` (served at `/plugin-index/index.json`), or
- serve it from a backend route like `/api/rulehub/index.json` and point `rulehub.indexUrl` there.

If you have an external generator, adapt its output to match the expected JSON shape below.

## Expected JSON Format

```json
{
  "packages": [
    {
      "id": "gdpr.data_minimization",
      "name": "Data minimization",
      "standard": "GDPR",
      "version": "2016/679",
      "coverage": ["GDPR 2016/679 Art.5(1)(c) — Data minimization"]
    }
  ]
}
```

Optional fields may be omitted if unknown.

## Troubleshooting

See `troubleshooting.md` for runtime and demo environment issues.

## Cut & Paste / Extraction

The plugin directory is self-contained: copy it to a new repo, run `npm install`, `npm run build`, `npm test`, then publish. No cross-repo imports are required.

---

For contributor workflow and dev container details, see `CONTRIBUTING.md`.

### Automated install (JavaScript CLI)

Use the Node-based installer exposed as a binary after installing the package (or via npx) to inject route, sample index and config.

Examples (run inside your Backstage app root):

```bash
npx rulehub-install
# or if already added as dependency
pnpm dlx @rulehub/rulehub-backstage-plugin install
# or via package.json script
npm run install:in-app
```

What it does:

1. Installs the dependency if not listed.
2. Creates `packages/app/public/plugin-index/index.json` sample if missing.
3. Inserts route into `packages/app/src/App.tsx` if absent.
4. Appends a `rulehub:` block with `indexUrl` to `app-config.local.yaml` if missing.

Idempotent: repeated runs will not duplicate imports, routes or config.
