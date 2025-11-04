#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: patch-app-root-clean.mjs <path-to-Root.tsx>');
  process.exit(1);
}

const p = resolve(process.cwd(), file);
let src = readFileSync(p, 'utf8');

// Remove NotificationsSidebarItem import
src = src.replace(
  /^import\s+\{\s*NotificationsSidebarItem\s*\}\s+from\s+'@backstage\/plugin-notifications';\s*\n/m,
  '',
);

// Remove NotificationsSidebarItem usage and adjacent divider
src = src.replace(/\n\s*<NotificationsSidebarItem\s*\/?>\s*\n/m, '\n');
// Leave one SidebarDivider intact if multiple were present; naive cleanup already reduces duplicates

// Remove MyGroupsSidebarItem import and GroupIcon import
src = src.replace(/^import\s+\{\s*MyGroupsSidebarItem\s*\}\s+from\s+'@backstage\/plugin-org';\s*\n/m, '');
src = src.replace(/^import\s+GroupIcon\s+from\s+'@material-ui\/icons\/People';\s*\n/m, '');

// Remove MyGroupsSidebarItem JSX block
src = src.replace(/\n\s*<MyGroupsSidebarItem[\s\S]*?\/?>\s*\n/m, '\n');

writeFileSync(p, src);
console.log('[patch] Root.tsx cleaned (Notifications and MyGroups removed)');