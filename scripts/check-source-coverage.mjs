#!/usr/bin/env node
/*
  Compare RuleHub core plugin index IDs to charts index engine paths.
  - Fetch CORE_URL (plugin index) and CHARTS_URL (charts plugin index)
  - Report total IDs from core
  - Among those IDs, report how many have kyvernoPath / gatekeeperPath present in charts
  Usage:
    node scripts/check-source-coverage.mjs [--core <url>] [--charts <url>] [--csv-missing]
  Env:
    CORE_URL, CHARTS_URL
*/

const DEFAULT_CORE = 'https://rulehub.github.io/rulehub/plugin-index/index.json';
const DEFAULT_CHARTS = 'https://rulehub.github.io/rulehub-charts/plugin-index/index.json';

const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  if (i !== -1 && i + 1 < args.length) return args[i + 1];
  return undefined;
}
const CORE_URL = process.env.CORE_URL || getArg('--core') || DEFAULT_CORE;
const CHARTS_URL = process.env.CHARTS_URL || getArg('--charts') || DEFAULT_CHARTS;
const CSV_MISSING = args.includes('--csv-missing');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function summarizeCore(core) {
  const pkgs = Array.isArray(core?.packages) ? core.packages : [];
  const ids = pkgs.map(p => p.id).filter(Boolean);
  return { total: ids.length, ids };
}

function summarizeCharts(charts, idSet) {
  const pkgs = Array.isArray(charts?.packages) ? charts.packages : [];
  const byId = new Map();
  for (const p of pkgs) if (p?.id) byId.set(p.id, p);

  let kyv = 0, gk = 0, both = 0, none = 0;
  const missingKyverno = [];
  const missingGatekeeper = [];

  for (const id of idSet) {
    const e = byId.get(id);
    const hasK = !!(e && typeof e.kyvernoPath === 'string' && e.kyvernoPath.length > 0);
    const hasG = !!(e && typeof e.gatekeeperPath === 'string' && e.gatekeeperPath.length > 0);
    if (hasK) kyv++; else missingKyverno.push(id);
    if (hasG) gk++; else missingGatekeeper.push(id);
    if (hasK && hasG) both++; else if (!hasK && !hasG) none++;
  }

  return { kyvernoPath: kyv, gatekeeperPath: gk, both, none, missingKyverno, missingGatekeeper };
}

function printCsvMissing(missingKyverno, missingGatekeeper) {
  const header = 'id,kyvernoPath,gatekeeperPath';
  const all = new Set([...missingKyverno, ...missingGatekeeper]);
  console.log(header);
  for (const id of [...all].sort()) {
    const mk = missingKyverno.includes(id) ? 'missing' : 'present';
    const mg = missingGatekeeper.includes(id) ? 'missing' : 'present';
    console.log(`${id},${mk},${mg}`);
  }
}

(async () => {
  try {
    const core = await fetchJson(CORE_URL);
    const coreSum = summarizeCore(core);
    const idSet = new Set(coreSum.ids);

    let chartsSum;
    try {
      const charts = await fetchJson(CHARTS_URL);
      chartsSum = summarizeCharts(charts, idSet);
    } catch (e) {
      chartsSum = { error: String(e.message || e), kyvernoPath: 0, gatekeeperPath: 0, both: 0, none: coreSum.total, missingKyverno: coreSum.ids, missingGatekeeper: coreSum.ids };
    }

    const result = {
      coreUrl: CORE_URL,
      chartsUrl: CHARTS_URL,
      ids: coreSum.total,
      charts: { kyvernoPath: chartsSum.kyvernoPath, gatekeeperPath: chartsSum.gatekeeperPath, both: chartsSum.both, none: chartsSum.none, error: chartsSum.error || undefined }
    };

    console.log(JSON.stringify(result, null, 2));

    if (CSV_MISSING && !chartsSum.error) {
      printCsvMissing(chartsSum.missingKyverno, chartsSum.missingGatekeeper);
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err?.message || err);
    process.exit(1);
  }
})();
