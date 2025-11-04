#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDocument, stringify } from 'yaml';

const root = resolve(process.cwd());
const tmpDir = resolve(root, 'tmp');
const wantReset = process.argv.includes('--reset');
const wantFrontendOnly = process.argv.includes('--frontend-only');
const keepUi = process.argv.includes('--keep-ui');
// Best-effort .env loader (no external deps)
// Loads variables from .env, then .env.local (the latter overrides the former),
// without overwriting any variables that are already set in the environment.
function loadDotEnvIfPresent() {
  const files = ['.env', '.env.local'];
  for (const fname of files) {
    const p = resolve(root, fname);
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        // Strip surrounding quotes if present
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
    } catch {}
  }
}

loadDotEnvIfPresent();

// Read raw PORT from .env files to allow overriding any ambient PORT provided by the host
function readPortFromDotEnvFiles() {
  const files = ['.env.local', '.env']; // local overrides base
  for (const fname of files) {
    const p = resolve(root, fname);
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        if (key !== 'PORT') continue;
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (val) return val;
      }
    } catch {}
  }
  return undefined;
}

// Optional env overrides for RuleHub demo (can be provided via real env or .env files)
const envIndexUrl = process.env.RULEHUB_INDEX_URL; // e.g. https://rulehub.github.io/rulehub-charts/plugin-index/index.json
const envRepoBase = process.env.RULEHUB_REPO_BASE_URL; // e.g. http://localhost:8081/
const envSourceBase = process.env.RULEHUB_SOURCE_BASE_URL; // e.g. https://github.com/rulehub/rulehub-charts/tree/main/
const envIndexFile = process.env.RULEHUB_INDEX_FILE; // e.g. /path/to/rulehub-charts/dist/index.json
const envSourceAbsFallback = process.env.RULEHUB_SOURCE_ABS_FALLBACK; // '1'|'true' to enable Source absolute URL fallback
// Compute desired dev server port (priority: DEMO_PORT env > .env/.env.local PORT > ambient PORT)
const filePort = readPortFromDotEnvFiles();
const envPort = process.env.DEMO_PORT || filePort || process.env.PORT; // Optional override for frontend dev server port
// Auto-detected charts index path (sibling repo)
const autoChartsIndexPath = resolve(root, '..', 'rulehub-charts', 'dist', 'index.json');

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeValues = (existing, incoming) => {
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const result = { ...existing };
    for (const [key, val] of Object.entries(incoming)) {
      result[key] = mergeValues(result[key], val);
    }
    return result;
  }
  return incoming;
};

const nodeToJS = (node) => {
  if (!node) return undefined;
  if (typeof node.toJS === 'function') {
    return node.toJS();
  }
  if ('value' in node) {
    return node.value;
  }
  return undefined;
};

function run(cmd, args, options = {}) {
  const { allowFail = false, ...opts } = options;
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0 && !allowFail) process.exit(res.status ?? 1);
  return res;
}

// 0) Scaffold demo Backstage app in tmp/ (optionally reset when --reset flag is provided)
const setupCmd = `scripts/dev-setup-backstage.sh --app-name rulehub-demo --skip-install${wantReset ? ' --reset' : ''}`;
run('bash', ['-lc', setupCmd], { cwd: root });

// 1) Build + pack plugin
// Allow skipping the build if the caller already built (e.g., via npm pre-demo)
const skipBuild = process.env.PRE_BUILT === '1';
if (skipBuild) {
  console.log('[demo] Skipping build (PRE_BUILT=1)');
} else {
  run('npm', ['run', 'build'], { cwd: root });
}
run('npm', ['pack', '--pack-destination', root], { cwd: root });
// Derive tarball name from package.json to avoid hardcoding version
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const tarballName = `rulehub-rulehub-backstage-plugin-${pkg.version}.tgz`;
const tarball = resolve(root, tarballName);
// Ensure tmp exists before copy; place tarball under a timestamped vendor path to bust Yarn cache
mkdirSync(tmpDir, { recursive: true });
const stamp = String(Date.now());
const vendorDir = resolve(tmpDir, 'vendor', stamp);
mkdirSync(vendorDir, { recursive: true });
const vendoredTarball = resolve(vendorDir, tarballName);
copyFileSync(tarball, vendoredTarball);

// 2) Patch app dependency to file: tarball
run('node', [
  resolve(root, 'scripts/patch-app-dep-file.mjs'),
  resolve(tmpDir, 'packages/app/package.json'),
  '@rulehub/rulehub-backstage-plugin',
  // Use unique relative path so Yarn resolves a fresh file dep each run
  `../../vendor/${stamp}/${tarballName}`,
]);

// 3) Install deps in tmp: try full install first (needed for backend native deps). On failure, fall back to frontend-only mode.
// 3a) Ensure a Backstage-compatible Yarn version and linker to avoid Yarn 4/PnP peer issues.
// Backstage templates typically pin Yarn 3 with node-modules linker; in some environments Corepack defaults to Yarn 4.
// Pinning here keeps the demo stable regardless of global defaults.
try {
  run(
    'bash',
    [
      '-lc',
      'cd tmp && corepack enable && corepack yarn set version 3.6.1 && corepack yarn config set nodeLinker node-modules',
    ],
    { allowFail: true },
  );
} catch {}
let frontendOnly = false;
const fullInstall = run('bash', ['-lc', 'cd tmp && corepack enable && corepack yarn install'], {
  allowFail: true,
});
if (fullInstall.status !== 0) {
  console.warn(
    '[demo] Full install failed (likely native backend deps). Falling back to frontend-only demo.',
  );
  frontendOnly = true;
  // Install without running scripts/builds so the app workspace can still serve the frontend
  run('bash', [
    '-lc',
    'cd tmp && corepack enable && YARN_ENABLE_SCRIPTS=0 corepack yarn install --mode=skip-build',
  ]);
}

// 4) Patch App.tsx to use RulehubPage (reads config) and configure SignInPage
// In full mode, pass --no-query-index to rely on configApi; in frontend-only, keep query param.
const appTsxPath = resolve(tmpDir, 'packages/app/src/App.tsx');
if (wantFrontendOnly) {
  run('node', [resolve(root, 'scripts/patch-app-tsx-rulehub-page.mjs'), appTsxPath, '--no-auth']);
} else {
  run('node', [
    resolve(root, 'scripts/patch-app-tsx-rulehub-page.mjs'),
    appTsxPath,
    '--no-auth',
    '--no-query-index',
  ]);
}

// 4b) Patch Root.tsx to add SidebarItem link to RuleHub in the left menu (best-effort)
const rootTsx = resolve(tmpDir, 'packages/app/src/components/Root/Root.tsx');
try {
  run('node', [resolve(root, 'scripts/patch-app-sidebar.mjs'), rootTsx], { allowFail: true });
} catch {}

// 4b.1) Remove Notifications and MyGroups from Root.tsx by default to reduce noise (opt-out with --keep-ui)
if (!keepUi) {
  try {
    run('node', [resolve(root, 'scripts/patch-app-root-clean.mjs'), rootTsx], { allowFail: true });
  } catch {}
}

// 4c) Reduce console noise by removing SignalsDisplay and Notifications from App.tsx (opt-out with --keep-ui)
if (!keepUi) {
  try {
    run('node', [resolve(root, 'scripts/patch-app-app-clean.mjs'), appTsxPath], {
      allowFail: true,
    });
  } catch {}
}

// 5) Ensure config + sample index (idempotent)
const cfg = resolve(tmpDir, 'app-config.local.yaml');
if (!existsSync(cfg)) writeFileSync(cfg, '');
const rawCfg = readFileSync(cfg, 'utf8');
const leadingMatch = rawCfg.match(/^(?:[ \t]*#.*\n|\s*\n)*/);
const leadingBlock = leadingMatch ? leadingMatch[0] : '';
const contentWithoutLeading = rawCfg.slice(leadingBlock.length);
let parsedCfg = {};
if (contentWithoutLeading.trim()) {
  try {
    const doc = parseDocument(contentWithoutLeading, { uniqueKeys: false });
    if (Array.isArray(doc.contents?.items)) {
      parsedCfg = {};
      for (const pair of doc.contents.items) {
        const key = nodeToJS(pair.key);
        if (typeof key === 'undefined') continue;
        const value = nodeToJS(pair.value);
        if (Object.prototype.hasOwnProperty.call(parsedCfg, key)) {
          parsedCfg[key] = mergeValues(parsedCfg[key], value);
        } else {
          parsedCfg[key] = value;
        }
      }
    } else {
      parsedCfg = doc.toJS() ?? {};
    }
  } catch (error) {
    console.warn('Failed to parse app-config.local.yaml, regenerating demo config from scratch.');
    parsedCfg = {};
  }
}
if (typeof parsedCfg !== 'object' || Array.isArray(parsedCfg) || parsedCfg === null) {
  parsedCfg = {};
}
// Configure rulehub.* with env overrides when provided
const rhCfg =
  parsedCfg.rulehub && typeof parsedCfg.rulehub === 'object' && !Array.isArray(parsedCfg.rulehub)
    ? parsedCfg.rulehub
    : {};
// Prefer a local, always-available index served from the app when possible; otherwise use remote hosted index
// 1) If RULEHUB_INDEX_FILE is provided, we will copy it to /dist/index.json and point the plugin there.
// 2) If a sibling rulehub-charts/dist/index.json is detected, copy it and point to /dist/index.json.
// 3) Else, use env RULEHUB_INDEX_URL, existing config, or the official hosted charts index.
rhCfg.indexUrl = envIndexUrl || rhCfg.indexUrl || 'https://rulehub.github.io/rulehub-charts/plugin-index/index.json';
// Prefer env override; otherwise set sensible demo defaults so charts links work out-of-the-box
// - Always set repoBaseUrl to core repo (unless env overrides)
// - Always set sourceBaseUrl to charts repo (unless env overrides)
// - If we auto-detected a local charts index, this stays compatible
const wantChartsBase = !envRepoBase && existsSync(autoChartsIndexPath);
const existingLinks =
  typeof rhCfg.links === 'object' && rhCfg.links && !Array.isArray(rhCfg.links) ? rhCfg.links : {};
// Determine sourceAbsFallback demo default: allow env override, else default true if not present
const parsedSourceAbsFallback =
  typeof envSourceAbsFallback !== 'undefined'
    ? /^(1|true|yes)$/i.test(String(envSourceAbsFallback))
    : typeof existingLinks.sourceAbsFallback !== 'undefined'
      ? Boolean(existingLinks.sourceAbsFallback)
      : true;
rhCfg.links = {
  ...existingLinks,
  repoBaseUrl:
    envRepoBase || existingLinks.repoBaseUrl || 'https://github.com/rulehub/rulehub/tree/main/',
  sourceBaseUrl:
    envSourceBase ||
    existingLinks.sourceBaseUrl ||
    'https://github.com/rulehub/rulehub-charts/tree/main/',
  sourceAbsFallback: parsedSourceAbsFallback,
};
parsedCfg.rulehub = rhCfg;
// If a PORT is provided, override the app.baseUrl to match so the dev server binds accordingly
if (envPort) {
  const appCfg =
    parsedCfg.app && typeof parsedCfg.app === 'object' && !Array.isArray(parsedCfg.app)
      ? parsedCfg.app
      : {};
  appCfg.baseUrl = `http://localhost:${envPort}`;
  parsedCfg.app = appCfg;
}
// Ensure guest auth provider is available to avoid 401s in demo
const authCfg =
  parsedCfg.auth && typeof parsedCfg.auth === 'object' && !Array.isArray(parsedCfg.auth)
    ? parsedCfg.auth
    : {};
const providersCfg =
  authCfg.providers && typeof authCfg.providers === 'object' && !Array.isArray(authCfg.providers)
    ? authCfg.providers
    : {};
providersCfg.guest = providersCfg.guest || {};
authCfg.providers = providersCfg;
parsedCfg.auth = authCfg;
const backendCfg = parsedCfg.backend;
const normalizedBackend =
  backendCfg && typeof backendCfg === 'object' && !Array.isArray(backendCfg) ? backendCfg : {};
const pluginsCfg = normalizedBackend.plugins;
const normalizedPlugins =
  pluginsCfg && typeof pluginsCfg === 'object' && !Array.isArray(pluginsCfg) ? pluginsCfg : {};
const normalizedSignals =
  normalizedPlugins.signals &&
  typeof normalizedPlugins.signals === 'object' &&
  !Array.isArray(normalizedPlugins.signals)
    ? normalizedPlugins.signals
    : {};
normalizedPlugins.signals = { ...normalizedSignals, enabled: false };
normalizedBackend.plugins = normalizedPlugins;
// If PORT is provided, also adjust backend.cors.origin to allow the frontend origin
if (envPort) {
  const corsCfg =
    normalizedBackend.cors &&
    typeof normalizedBackend.cors === 'object' &&
    !Array.isArray(normalizedBackend.cors)
      ? normalizedBackend.cors
      : {};
  corsCfg.origin = `http://localhost:${envPort}`;
  normalizedBackend.cors = corsCfg;
}
parsedCfg.backend = normalizedBackend;
const renderedYaml = stringify(parsedCfg, { indent: 2 }).trimEnd();
const finalCfg = `${leadingBlock}${renderedYaml}\n`;
writeFileSync(cfg, finalCfg);
const pubDist = resolve(tmpDir, 'packages/app/public/dist');
mkdirSync(pubDist, { recursive: true });
const targetIndex = resolve(pubDist, 'index.json');
// Prefer explicit env override, then auto-detect sibling repo rulehub-charts/dist/index.json
if (envIndexFile && existsSync(envIndexFile)) {
  console.log(`[demo] Using RULEHUB_INDEX_FILE: ${envIndexFile}`);
  copyFileSync(envIndexFile, targetIndex);
  // Ensure plugin points at the copied local index for reliability
  rhCfg.indexUrl = '/dist/index.json';
} else if (existsSync(autoChartsIndexPath)) {
  console.log(`[demo] Auto-detected charts index: ${autoChartsIndexPath}`);
  copyFileSync(autoChartsIndexPath, targetIndex);
  // Prefer local index to avoid network flakiness
  rhCfg.indexUrl = '/dist/index.json';
} else {
  writeFileSync(
    targetIndex,
    JSON.stringify(
      {
        packages: [
          {
            id: 'cis-1',
            name: 'CIS Kubernetes Benchmark',
            standard: 'CIS',
            version: '1.0.0',
            jurisdiction: 'GLOBAL',
            coverage: ['control-1', 'control-2'],
          },
          {
            id: 'iso-27001',
            name: 'ISO 27001 Core',
            standard: 'ISO',
            version: '2022',
            jurisdiction: '',
            coverage: [],
          },
        ],
      },
      null,
      2,
    ),
  );
}

// Also write a small debug config mirror under /dist so you can inspect it via the frontend dev server
try {
  writeFileSync(
    resolve(pubDist, 'rulehub-config.json'),
    JSON.stringify({ rulehub: rhCfg }, null, 2),
  );
} catch {}

// 6) Start dev server (use Backstage defaults: frontend 3000, backend 7007)
console.log('[demo] Starting Backstage demo app...');
if (envPort) {
  console.log(
    `[demo] Requested PORT=${envPort} (the dev server may still choose a different port; prefer what it prints)`,
  );
}
console.log(
  `[demo] Once compiled, open the printed dev server URL and append /rulehub (typically http://localhost:${envPort || '3000'}/rulehub)`,
);
console.log('[demo] Configured rulehub.indexUrl =', rhCfg.indexUrl);
if (rhCfg?.links?.repoBaseUrl) {
  console.log('[demo] Configured rulehub.links.repoBaseUrl =', rhCfg.links.repoBaseUrl);
}
if (rhCfg?.links?.sourceBaseUrl) {
  console.log('[demo] Configured rulehub.links.sourceBaseUrl =', rhCfg.links.sourceBaseUrl);
}
if (typeof rhCfg?.links?.sourceAbsFallback !== 'undefined') {
  console.log('[demo] Configured rulehub.links.sourceAbsFallback =', rhCfg.links.sourceAbsFallback);
}
if (frontendOnly || wantFrontendOnly) {
  console.log(
    '[demo] Running in FRONTEND-ONLY mode (backend build skipped). You may see http://localhost:7007 console errors.',
  );
  console.log(
    '[demo] Note: The /api/app/config endpoint is served by the Backstage backend and will not be available in frontend-only mode.',
  );
  console.log('[demo] For quick inspection, the demo also writes /dist/rulehub-config.json');
  console.log('[demo] You can try to build and start backend later:');
  console.log(
    '[demo]   cd tmp && corepack enable && corepack yarn install && corepack yarn workspace backend start',
  );
  const startCmd = envPort
    ? `cd tmp && PORT=${envPort} corepack yarn workspace app start -- --port ${envPort}`
    : 'cd tmp && corepack yarn workspace app start';
  let res = run('bash', ['-lc', startCmd], { allowFail: true });
  if (res.status !== 0 && envPort) {
    // Fallback: some backstage-cli versions of `package start` don't support --port; rely on PORT only
    const fallbackCmd = `cd tmp && PORT=${envPort} corepack yarn workspace app start`;
    res = run('bash', ['-lc', fallbackCmd]);
  }
} else {
  console.log('[demo] Starting both frontend and backend (repo start)...');
  // repo start launches both, but the frontend port can still be hinted via PORT and --port on app
  const repoStartCmd = envPort
    ? `cd tmp && PORT=${envPort} corepack yarn start`
    : 'cd tmp && corepack yarn start';
  const res = run('bash', ['-lc', repoStartCmd], { allowFail: true });
  if (res.status !== 0) {
    console.warn('[demo] repo start failed; starting frontend-only workspace as fallback');
    const fallbackStartCmd = envPort
      ? `cd tmp && PORT=${envPort} corepack yarn workspace app start -- --port ${envPort}`
      : 'cd tmp && corepack yarn workspace app start';
    let res2 = run('bash', ['-lc', fallbackStartCmd], { allowFail: true });
    if (res2.status !== 0 && envPort) {
      const fallbackCmd2 = `cd tmp && PORT=${envPort} corepack yarn workspace app start`;
      run('bash', ['-lc', fallbackCmd2]);
    }
  }
}
