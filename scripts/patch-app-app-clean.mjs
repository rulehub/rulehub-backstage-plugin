#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: patch-app-app-clean.mjs <path-to-App.tsx>');
  process.exit(1);
}

const p = resolve(process.cwd(), file);
let src = readFileSync(p, 'utf8');

// Remove SignalsDisplay import member from core-components named import
src = src.replace(
  /^(import\s+\{[^}]*?)\b,?\s*SignalsDisplay\s*(\}[^\n]*from\s+'@backstage\/core-components';\s*)$/m,
  (_m, p1, p2) => `${p1}${p2}`,
);

// Remove SignalsDisplay JSX line
src = src.replace(/\n\s*<SignalsDisplay\s*\/?>\s*\n/m, '\n');

// Remove NotificationsPage import
src = src.replace(
  /^import\s+\{\s*NotificationsPage\s*\}\s+from\s+'@backstage\/plugin-notifications';\s*\n/m,
  '',
);

// Remove Notifications route
src = src.replace(/\n\s*<Route\s+path="\/notifications"[\s\S]*?\/?>\s*\n/m, '\n');

writeFileSync(p, src);
console.log('[patch] App.tsx cleaned (SignalsDisplay, Notifications removed)');