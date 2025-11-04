#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [appPkg, pkgName, fileRel] = process.argv.slice(2);
if (!appPkg || !pkgName || !fileRel) {
  console.error('[link] patch-app-dep-file: missing args');
  process.exit(2);
}
// Validate that the referenced file exists relative to the app package.json
try {
  const appDir = dirname(appPkg);
  const relPath = fileRel.startsWith('file:') ? fileRel.slice(5) : fileRel;
  const absPath = resolve(appDir, relPath);
  if (!existsSync(absPath)) {
    console.error('[link] patch-app-dep-file: target not found:', absPath);
    process.exit(2);
  }
} catch (e) {
  console.error('[link] patch-app-dep-file: validation failed', e instanceof Error ? e.message : e);
  process.exit(2);
}
const json = JSON.parse(readFileSync(appPkg, 'utf8'));
json.dependencies = json.dependencies || {};
const want = `file:${fileRel}`.replace(/\\/g, '/');
if (json.dependencies[pkgName] !== want) {
  json.dependencies[pkgName] = want;
  writeFileSync(appPkg, JSON.stringify(json, null, 2) + '\n');
  console.log('[link] dependency set to file:', want);
} else {
  console.log('[link] dependency already set to file');
}
