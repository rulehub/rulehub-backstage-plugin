#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('[link] patch-app-tsx: missing file arg');
  process.exit(2);
}
let src = readFileSync(file, 'utf8');

if (!src.includes("from '@rulehub/rulehub-backstage-plugin'")) {
  const lines = src.split(/\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
  }
  const importLine = "import { RulehubContent } from '@rulehub/rulehub-backstage-plugin';";
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
  } else {
    lines.unshift(importLine, '');
  }
  src = lines.join('\n');
}

if (!src.includes('path="/rulehub"') && !src.includes('path=\"/rulehub\"')) {
  const routeLine = '    <Route path="/rulehub" element={<RulehubContent indexUrl="https://rulehub.github.io/rulehub-charts/plugin-index/index.json" />} />';
  const flatOpen = src.indexOf('<FlatRoutes>');
  if (flatOpen !== -1) {
    const insertPos = flatOpen + '<FlatRoutes>'.length;
    src = src.slice(0, insertPos) + '\n' + routeLine + src.slice(insertPos);
  } else {
    src += "\n\n// TODO: FlatRoutes not found, appended Rulehub route below\n" + routeLine + "\n";
  }
}

writeFileSync(file, src);
console.log('[link] App.tsx patched (import/route)');
