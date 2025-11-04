# Contributing Guide

Thank you for your interest in contributing to `@rulehub/rulehub-backstage-plugin`.
This document explains how to set up the environment, make changes, keep quality high, and submit a good pull request.

## Table of Contents

- [Development Environment](#development-environment)
- [Dev Container (VS Code)](#dev-container-vs-code)
- [Branching & Commits](#branching--commits)
- [Install & Build](#install--build)
- [Running Tests](#running-tests)
- [Linting & Formatting](#linting--formatting)
- [Type Checking](#type-checking)
- [Verification Shortcut](#verification-shortcut)
- [Adding / Modifying Tests](#adding--modifying-tests)
- [Project Structure](#project-structure)
- [Coding Style](#coding-style)
- [Adding Dependencies](#adding-dependencies)
- [Publishing (Maintainers)](#publishing-maintainers)
- [Pull Request Checklist](#pull-request-checklist)
- [Reporting Issues](#reporting-issues)

## Development Environment

- Node.js >= 18 (the devcontainer already satisfies this).
- Use `npm ci` for a clean, reproducible install.
- Editor: VS Code recommended (flat ESLint config + TypeScript integration).

## Dev Container (VS Code)

The repository includes a ready-to-use development container under `.devcontainer/`.

Included setup:

- Base image: `mcr.microsoft.com/devcontainers/javascript-node:1-20-bullseye` with Node 20.
- `postCreateCommand`: runs `npm ci` for a clean install.
- `postStartCommand`: executes `.devcontainer/init.sh` (verifies deps, prints helper tips).
- Extensions preinstalled: ESLint, Prettier, Jest, TypeScript Nightly, Docker.
- Host npm cache mounted (`$HOME/.npm`) for faster installs.

How to use:

1. Install the "Dev Containers" extension in VS Code.
2. Open the project folder → Command Palette → "Dev Containers: Reopen in Container".
3. Wait until dependency installation and the init script finish (you'll see `Dev container ready.`).

Everyday commands inside the container:

```bash
npm run verify      # lint + typecheck + tests
npm test            # run Jest suite
npm run build       # produce dist/
npm run lint:fix    # autofix lint issues
```

Add a dependency:

```bash
npm install <package>
# or dev-only
npm install -D <package>
```

Debug a specific Jest test interactively:

```bash
node --inspect-brk ./node_modules/jest/bin/jest.js -t "pattern"
```

Then attach VS Code debugger (Node: Attach). Place breakpoints in source or tests.

If `node_modules` becomes inconsistent:

```bash
rm -rf node_modules package-lock.json
npm ci
```

Container rebuild after changing Dockerfile or devcontainer.json:
Command Palette → "Dev Containers: Rebuild Container".

Performance tips:

- Jest already runs `--runInBand` to reduce memory peaks.
- Cache mount speeds up repeated `npm ci`.

Troubleshooting:

- ESLint/TypeScript mismatch: rebuild the container.
- Slow installs: ensure the npm cache mount is active (see `devcontainer.json`).
- Permission issues: the container uses user `node`; avoid `sudo` unless adding OS packages in Dockerfile.

## Branching & Commits

- Create feature branches off `main`.
- Keep commits focused and logically grouped.
- Use clear, imperative commit messages (e.g. `Add loading state skeleton`).
- Rebase (preferred) or merge `main` before finalizing your PR to keep history clean.

## Install & Build

```bash
npm ci
npm run build
```

Build output goes to `dist/` (JS + type declarations). Do not commit build artefacts unless publishing.

## Running Tests

```bash
npm test
```

Notes:

- Jest runs in-band for stability in constrained environments.
- For a single file: `npx jest tests/rulehubPage.smoke.test.tsx`
- For a test name pattern: `npx jest -t "empty state"`
- Coverage: `npx jest --coverage`.

## Linting & Formatting

```bash
npm run lint        # ESLint (errors & warnings)
npm run lint:fix    # Auto-fix where possible
npm run format:check
npm run format      # Prettier write
```

ESLint config: `eslint.config.mjs` (flat config). Prettier enforces consistent formatting.

## Type Checking

```bash
npm run typecheck
```

No output means success. Fix all reported issues before submitting.

## Verification Shortcut

One command to run the common quality gates:

```bash
npm run verify
```

Equivalent to lint + typecheck + test (without coverage).

## Adding / Modifying Tests

- Test filenames live in `tests/` and end with `.test.tsx`.
- Use React Testing Library idioms: prefer user-visible queries (e.g. `getByRole`, `getByText`).
- Avoid relying on implementation details (DOM structure, class names) when possible.
- Cover edge states: loading, empty, retry/error, data present.

## Project Structure

```
src/
  index.ts        # Public exports (barrel)
  plugin.tsx      # Plugin entry / component wiring
  routes.tsx      # Page component(s)
  types.ts        # Shared TypeScript types
tests/
  ...             # Jest + React Testing Library specs
```

`media/` contains static assets (e.g. demo SVG). `dist/` is build output (ignored in VCS).

## Coding Style

- Prefer functional components & hooks.
- Keep components small; extract helpers if logic grows.
- Narrow TypeScript types; avoid `any`.
- Use explicit imports (no wildcard `* as` unless necessary).
- Maintain zero lint errors; treat warnings as debt to be removed.

## Adding Dependencies

- Try to minimize new runtime deps (keep plugin lightweight).
- Dev-only tooling belongs in `devDependencies`.
- When adding a runtime dependency also evaluate its tree size & license.
- Update README if user-facing installation steps change.

## Publishing (Maintainers)

1. Ensure `npm run verify` passes cleanly.
2. Increment version in `package.json` following semver.
3. Run `npm run build`.
4. (Optional) `npm pack` to inspect the tarball; ensure only `dist/` & `media/` (and necessary metadata) are included.
5. `npm publish --access public` (handled automatically via `prepublishOnly` script building first).
6. Tag the release & update `CHANGELOG.md`.

## Pull Request Checklist

- [ ] Feature / fix clearly described in PR body.
- [ ] `npm run verify` passes (lint, types, tests).
- [ ] Added / updated tests for new or changed behavior.
- [ ] README updated if user-facing behavior or setup changed.
- [ ] No unrelated formatting churn.
- [ ] Version bump (maintainers only, if publishing immediately).

## Reporting Issues

Open a GitHub issue with:

- Clear description & expected behavior.
- Steps to reproduce (or test case).
- Environment: Node version, Backstage app version(s), React version.
- Any relevant logs or stack traces.

Thanks for contributing!
