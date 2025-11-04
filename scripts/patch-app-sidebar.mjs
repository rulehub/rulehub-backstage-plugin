#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('[link] patch-app-sidebar: missing file arg');
  process.exit(2);
}

let src = readFileSync(file, 'utf8');

// Discover nearest package.json to decide which Material Icons package to use (MUI v5 or v4)
function findNearestPackageJson(start) {
  let dir = path.dirname(start);
  for (let i = 0; i < 6; i++) { // climb up to 6 levels max
    const candidate = path.join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf8'));
      } catch {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
const nearestPkg = findNearestPackageJson(file);
const deps = nearestPkg?.dependencies || {};
const devDeps = nearestPkg?.devDependencies || {};
const hasMuiV5Icons = Boolean(deps['@mui/icons-material'] || devDeps['@mui/icons-material']);
const hasMuiV4Icons = Boolean(deps['@material-ui/icons'] || devDeps['@material-ui/icons']);

// Ensure SidebarItem import from core-components exists
if (/import\s*\{[^}]*\}\s*from\s*['"]@backstage\/core-components['"]/.test(src)) {
  src = src.replace(
    /(import\s*\{)([^}]*)(\}\s*from\s*['"]@backstage\/core-components['"].*;?)/,
    (m, p1, names, p3) => {
      const set = new Set(
        names
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      );
      set.add('SidebarItem');
      const joined = Array.from(set).join(', ');
      return `${p1} ${joined} ${p3}`;
    },
  );
} else {
  // Insert a fresh import near other imports
  const lines = src.split(/\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
  }
  const importLine = "import { SidebarItem } from '@backstage/core-components';";
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
  } else {
    lines.unshift(importLine, '');
  }
  src = lines.join('\n');
}

// Ensure icon import based on detected MUI version. Use default import from concrete module path for robustness.
let iconIdentifier = null;
if (hasMuiV5Icons) {
  const lines = src.split(/\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
  }
  const importLine = "import LibraryBooks from '@mui/icons-material/LibraryBooks';";
  if (!src.includes(importLine)) {
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
    } else {
      lines.unshift(importLine, '');
    }
  }
  src = lines.join('\n');
  iconIdentifier = 'LibraryBooks';
} else if (hasMuiV4Icons) {
  const lines = src.split(/\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
  }
  const importLine = "import LibraryBooks from '@material-ui/icons/LibraryBooks';";
  if (!src.includes(importLine)) {
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
    } else {
      lines.unshift(importLine, '');
    }
  }
  src = lines.join('\n');
  iconIdentifier = 'LibraryBooks';
} else {
  // No icons package detected; skip icon to avoid runtime errors
  iconIdentifier = null;
}

// Inject SidebarItem into <Sidebar>, preferably right after the "Create" item
if (!/\<SidebarItem[^>]*to=\"\/rulehub\"/.test(src)) {
  const sidebarOpenIdx = src.indexOf('<Sidebar');
  if (sidebarOpenIdx !== -1) {
    const sidebarCloseIdx = src.indexOf('</Sidebar>', sidebarOpenIdx);
    if (sidebarCloseIdx !== -1) {
      const insertion = iconIdentifier
        ? `\n    <SidebarItem to="/rulehub?sourceBase=https%3A%2F%2Fgithub.com%2Frulehub%2Frulehub-charts%2Ftree%2Fmain%2F" icon={${iconIdentifier}} text="RuleHub" />`
        : `\n    <SidebarItem to="/rulehub?sourceBase=https%3A%2F%2Fgithub.com%2Frulehub%2Frulehub-charts%2Ftree%2Fmain%2F" text="RuleHub" />`;

      // Try to place after a Create item when present
      const sidebarBlock = src.slice(sidebarOpenIdx, sidebarCloseIdx);
      const createRegexes = [
        /<SidebarItem[\s\S]*?text\s*=\s*["']Create(?:\.\.\.)?["'][^>]*\/>/,
        /<SidebarItem[\s\S]*?to\s*=\s*["'][^"']*create[^"']*["'][^>]*\/>/i,
      ];
      let insertPos = -1;
      for (const re of createRegexes) {
        const m = sidebarBlock.match(re);
        if (m && typeof m.index === 'number') {
          insertPos = sidebarOpenIdx + m.index + m[0].length;
          break;
        }
      }
      if (insertPos !== -1) {
        src = src.slice(0, insertPos) + insertion + src.slice(insertPos);
      } else {
        // Default: append just before </Sidebar>
        src = src.slice(0, sidebarCloseIdx) + insertion + src.slice(sidebarCloseIdx);
      }
    } else {
      src += iconIdentifier
        ? "\n\n// TODO: Sidebar closing tag not found, appended Rulehub SidebarItem below\n<SidebarItem to=\"/rulehub?sourceBase=https%3A%2F%2Fgithub.com%2Frulehub%2Frulehub-charts%2Ftree%2Fmain%2F\" icon={LibraryBooks} text=\"RuleHub\" />\n"
        : "\n\n// TODO: Sidebar closing tag not found, appended Rulehub SidebarItem below\n<SidebarItem to=\"/rulehub?sourceBase=https%3A%2F%2Fgithub.com%2Frulehub%2Frulehub-charts%2Ftree%2Fmain%2F\" text=\"RuleHub\" />\n";
    }
  } else {
    src += iconIdentifier
      ? "\n\n// TODO: Sidebar not found; you can add RuleHub to the left nav:\n// import { SidebarItem } from '@backstage/core-components';\n// import LibraryBooks from '@mui/icons-material/LibraryBooks';\n// ... inside <Sidebar> ...\n//   <SidebarItem to=\"/rulehub?sourceBase=https%3A%2F%2Fgithub.com%2Frulehub%2Frulehub-charts%2Ftree%2Fmain%2F\" icon={LibraryBooks} text=\"RuleHub\" />\n"
      : "\n\n// TODO: Sidebar not found; you can add RuleHub to the left nav:\n// import { SidebarItem } from '@backstage/core-components';\n// ... inside <Sidebar> ...\n//   <SidebarItem to=\"/rulehub?sourceBase=https%3A%2F%2Fgithub.com%2Frulehub%2Frulehub-charts%2Ftree%2Fmain%2F\" text=\"RuleHub\" />\n";
  }
}

writeFileSync(file, src);
console.log('[link] Root.tsx patched to add Rulehub SidebarItem');
