#!/usr/bin/env node
/**
 * JS installer for @rulehub/rulehub-backstage-plugin
 * Usage (after adding dependency):
 *   npx @rulehub/rulehub-backstage-plugin install
 * or inside Backstage app root (auto-detect when invoked directly):
 *   node scripts/install-in-backstage.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const PKG_NAME = '@rulehub/rulehub-backstage-plugin';
const APP_SRC = 'packages/app/src';
const APP_FILE = path.join(APP_SRC, 'App.tsx');
const CONFIG_FILE = 'app-config.local.yaml';
const PUBLIC_INDEX = 'packages/app/public/plugin-index/index.json';

function log(msg) { console.log(`[rulehub][INFO] ${msg}`); }
function warn(msg) { console.warn(`[rulehub][WARN] ${msg}`); }
function fail(msg) { console.error(`[rulehub][ERROR] ${msg}`); process.exit(1); }

function ensureInAppRoot() {
  if (!existsSync('package.json')) fail('Run from Backstage app root (package.json missing).');
  if (!existsSync(APP_FILE)) fail(`Cannot find ${APP_FILE}`);
}

function detectPkgManager() {
  if (existsSync('yarn.lock')) return 'yarn';
  if (existsSync('pnpm-lock.yaml')) return 'pnpm';
  return 'npm';
}

function installDependency() {
  try {
    const pkgJson = JSON.parse(readFileSync('package.json','utf8'));
    const hasDep = (pkgJson.dependencies && pkgJson.dependencies[PKG_NAME]) || (pkgJson.devDependencies && pkgJson.devDependencies[PKG_NAME]);
    if (hasDep) { log('Dependency already declared. Skipping install.'); return; }
  } catch { /* ignore */ }
  const pm = detectPkgManager();
  log(`Installing ${PKG_NAME} using ${pm}...`);
  const cmd = pm === 'yarn' ? 'yarn' : pm;
  const args = pm === 'yarn' ? ['add', PKG_NAME] : pm === 'pnpm' ? ['add', PKG_NAME] : ['install', PKG_NAME];
  const { status } = spawnSync(cmd, args, { stdio: 'inherit' });
  if (status !== 0) fail('Package install failed');
}

function ensureIndex() {
  if (existsSync(PUBLIC_INDEX)) { log('Index JSON already exists.'); return; }
  mkdirSync(path.dirname(PUBLIC_INDEX), { recursive: true });
  const sample = {
    packages: [
      {
        id: 'example.policy',
        name: 'Example Policy',
        standard: 'TEST',
        version: '1.0',
        coverage: ['TEST 1.0 Item 1 — Sample coverage'],
      },
    ],
  };
  writeFileSync(PUBLIC_INDEX, JSON.stringify(sample, null, 2) + '\n');
  log('Created sample index JSON.');
}

function patchApp() {
  const src = readFileSync(APP_FILE, 'utf8');
  if (/Rulehub(Page|Lazy|Component)/.test(src)) { log('App.tsx already references Rulehub; skipping route injection.'); return; }
  let out = src;
  const wantsLazy = /FlatRoutes/.test(src); // prefer lazy for modern layout
  if (wantsLazy) {
    // Ensure react lazy/Suspense imports
    if (!/lazy,\s*Suspense/.test(out)) {
      out = out.replace(/from 'react';?/, m => `${m}\nimport { lazy, Suspense } from 'react';`);
    }
    if (!/Progress/.test(out)) {
      out = out.replace(/from ['"]@backstage\/core-components['"];?/, m => `${m}\nimport { Progress } from '@backstage/core-components';`);
    }
    // Inject lazy definition near top (after first imports block)
    if (!/RulehubLazy/.test(out)) {
      out = out.replace(/(import[^;]+;\s*\n)(?!import)/, `$1\n// Rulehub lazy route injected by installer\nconst RulehubLazy = lazy(() =>\n  import('${PKG_NAME}').then(m => ({\n    default: m.RulehubPage || m.RulehubComponent,\n  })),\n);\n\n`);
    }
    // Insert route
    out = out.replace(/<FlatRoutes>/, '<FlatRoutes>\n    <Route path="/rulehub" element={<Suspense fallback={<Progress />}><RulehubLazy /></Suspense>} />');
    log('Inserted lazy Rulehub route.');
  } else if (/<Routes>/.test(src)) {
    out = out.replace(/from ['"]react-router-dom['"];?/, m => `${m}\nimport { RulehubPage } from '${PKG_NAME}';`);
    out = out.replace(/<Routes>/, '<Routes>\n    <Route path="/rulehub"> <RulehubPage /> </Route>');
    log('Inserted legacy route (non-lazy).');
  } else {
    warn('Could not detect routing pattern; no route injected.');
  }
  if (out !== src) writeFileSync(APP_FILE, out);
}

function patchConfig() {
  let existing = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, 'utf8') : '';
  if (/\brulehub:\s*\n/.test(existing)) { log('Config already has rulehub section.'); return; }
  const block = `\n# Added by rulehub installer\nrulehub:\n  indexUrl: https://rulehub.github.io/rulehub/plugin-index/index.json\n`;
  if (existing) {
    existing += block;
  } else {
  existing = `# Created by rulehub installer\nrulehub:\n  indexUrl: https://rulehub.github.io/rulehub/plugin-index/index.json\n`;
  }
  writeFileSync(CONFIG_FILE, existing);
  log('Appended rulehub config section.');
}

function main() {
  ensureInAppRoot();
  installDependency();
  ensureIndex();
  patchApp();
  patchConfig();
  log('Done. Start Backstage and open /rulehub');
  log('Add <SidebarItem to="/rulehub" text="RuleHub" /> to your sidebar if desired.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
