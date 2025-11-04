#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const [appPkg, pkgName, rel] = process.argv.slice(2);
if (!appPkg || !pkgName || !rel) {
  console.error('[link] patch-app-dep: missing args');
  process.exit(2);
}
const json = JSON.parse(readFileSync(appPkg, 'utf8'));
json.dependencies = json.dependencies || {};
const want = `portal:${rel}`.replace(/\\/g, '/');
if (json.dependencies[pkgName] !== want) {
  json.dependencies[pkgName] = want;
  writeFileSync(appPkg, JSON.stringify(json, null, 2) + '\n');
  console.log('[link] dependency added');
} else {
  console.log('[link] dependency already present');
}
