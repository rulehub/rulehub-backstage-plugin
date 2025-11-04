#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function log(msg) {
  process.stdout.write(`[health] ${msg}\n`);
}
function fail(msg) {
  process.stderr.write(`\x1b[31m[health]\x1b[0m ${msg}\n`);
  process.exit(1);
}

const ROOT = process.cwd();
const TMP = resolve(ROOT, 'tmp');
const SKIP_TMP = process.env.HEALTH_SKIP_TMP === '1';

// 1) Plugin root must not have local React installs
const hasLocalReact =
  existsSync(resolve(ROOT, 'node_modules/react')) ||
  existsSync(resolve(ROOT, 'node_modules/react-dom'));
if (hasLocalReact) {
  if (process.env.HEALTH_ALLOW_LOCAL === '1') {
    log('Local react/react-dom detected but HEALTH_ALLOW_LOCAL=1 set; continuing.');
  } else {
    fail(
      'Plugin has local react/react-dom installed. Remove them to avoid duplicate React at runtime.',
    );
  }
} else {
  log('No local react/react-dom in plugin root.');
}

// 2) In tmp workspace, ensure a single version is resolved by yarn why
if (SKIP_TMP) {
  log('HEALTH_SKIP_TMP=1 set; skipping yarn why checks.');
  process.exit(0);
}
if (!existsSync(TMP)) {
  log(
    'tmp/ not found; skipping yarn why check. Run scripts/dev-setup-backstage.mjs then re-run this health check.',
  );
  process.exit(0);
}

function countWhy(name) {
  const cmd = `cd '${TMP}' && corepack yarn why ${name}`;
  const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const lines = out.split(/\r?\n/);
  const matches = lines.filter((l) => /react(-dom)?@npm:/i.test(l));
  // Unique version tags (e.g., react@npm:18.3.1)
  const versions = new Set(
    matches.map((l) => (l.match(/react(?:-dom)?@npm:([^\s]+)/i) || [])[1]).filter(Boolean),
  );
  return { lines: matches, versions: Array.from(versions) };
}

try {
  const react = countWhy('react');
  const reactDom = countWhy('react-dom');
  if (react.versions.length !== 1) {
    fail(`Multiple react versions resolved in tmp: ${react.versions.join(', ') || 'none found'}`);
  }
  if (reactDom.versions.length !== 1) {
    fail(
      `Multiple react-dom versions resolved in tmp: ${reactDom.versions.join(', ') || 'none found'}`,
    );
  }
  log(`Single React detected (react ${react.versions[0]}, react-dom ${reactDom.versions[0]}).`);
  // Also check core Backstage libs that participate in context
  const pkgs = [
    '@backstage/core-plugin-api',
    '@backstage/core-app-api',
    '@backstage/core-components',
  ];
  for (const p of pkgs) {
    const cmd = `cd '${TMP}' && corepack yarn why ${p}`;
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    const versions = Array.from(
      new Set(
        out
          .split(/\r?\n/)
          .map((l) => (l.match(/@backstage\/[a-z-]+@npm:([^\s]+)/i) || [])[1])
          .filter(Boolean),
      ),
    );
    if (versions.length !== 1) {
      fail(`Multiple versions of ${p} resolved in tmp: ${versions.join(', ') || 'none found'}`);
    }
    log(`Single ${p} detected: ${versions[0]}`);
  }
} catch (e) {
  fail(
    `Failed to run yarn why checks. Ensure corepack is enabled and tmp workspace installed. Error: ${e.message}`,
  );
}

log('React singleton health check passed.');
