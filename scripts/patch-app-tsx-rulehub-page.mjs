#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
const noAuth = process.argv.includes('--no-auth') || process.env.RULEHUB_DEMO_NO_AUTH === '1';
// Control whether to inject query ?index=<official index> in the root redirect.
// Default: true (safer for frontend-only); pass --no-query-index to disable in full runs.
const useQueryIndex = process.argv.includes('--no-query-index') ? false : true;
if (!file) {
  console.error('[link] patch-app-tsx-rulehub-page: missing file arg');
  process.exit(2);
}
let src = readFileSync(file, 'utf8');

// Cleanup: remove any previously injected raw SidebarItem JSX that could break TSX
// Pattern inserted by earlier versions:
// // TODO: Sidebar closing tag not found, appended Rulehub SidebarItem below
// <SidebarItem to=\"/rulehub\" ... /> (or with normal quotes)
src = src.replace(
  /\n\/\/ TODO: Sidebar closing tag not found, appended Rulehub SidebarItem below\n<SidebarItem[^\n]*\n/g,
  '\n// TODO: Sidebar closing tag not found; add SidebarItem inside your <Sidebar> block (see comments below)\n',
);

// Ensure import
if (!src.includes("from '@rulehub/rulehub-backstage-plugin'")) {
  const lines = src.split(/\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
  }
  const importLine = "import { RulehubPage } from '@rulehub/rulehub-backstage-plugin';";
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
  } else {
    lines.unshift(importLine, '');
  }
  src = lines.join('\n');
}

// Ensure Navigate import for redirect
if (!/\bNavigate\b/.test(src)) {
  src = src.replace(
    /from ['"]react-router-dom['"];?/,
    (m) => `${m}\nimport { Navigate } from 'react-router-dom';`,
  );
}

// Ensure Route
if (!src.includes('path="/rulehub"') && !src.includes('path="/rulehub"')) {
  const routeLine = '    <Route path="/rulehub" element={<RulehubPage />} />';
  const flatOpen = src.indexOf('<FlatRoutes>');
  if (flatOpen !== -1) {
    const insertPos = flatOpen + '<FlatRoutes>'.length;
    src = src.slice(0, insertPos) + '\n' + routeLine + src.slice(insertPos);
  } else {
    src += '\n\n// TODO: FlatRoutes not found, appended Rulehub route below\n' + routeLine + '\n';
  }
}

// Ensure redirect from root to /rulehub; optionally add query params to set index and source base
// Using explicit query params avoids relying on backend config in frontend-only demo mode
const desiredRedirect = useQueryIndex
  ? '    <Route path="/" element={<Navigate to="/rulehub?index=https://rulehub.github.io/rulehub-charts/plugin-index/index.json&sourceBase=https%3A%2F%2Fgithub.com%2Frulehub%2Frulehub-charts%2Ftree%2Fmain%2F" replace />} />'
  : '    <Route path="/" element={<Navigate to="/rulehub" replace />} />';
const hasDesired = src.includes(desiredRedirect);
const hasAnyRedirect = /<Route\s+path=\"\/\"\s+element=\{<Navigate\s+to=\"\/rulehub(?:\?[^\"]*)?\"\s+replace\s*\/\>}\s*\/>/.test(
  src,
);
if (!hasDesired) {
  const flatOpen = src.indexOf('<FlatRoutes>');
  if (flatOpen !== -1) {
    const insertPos = flatOpen + '<FlatRoutes>'.length;
    if (hasAnyRedirect) {
      // Replace existing variant with desired
      src = src.replace(
        /<Route\s+path=\"\/\"\s+element=\{<Navigate\s+to=\"\/rulehub(?:\?index=[^\"]*)?\"\s+replace\s*\/>\}\s*\/>/,
        desiredRedirect,
      );
    } else {
      src = src.slice(0, insertPos) + '\n' + desiredRedirect + src.slice(insertPos);
    }
  } else {
    src +=
      '\n\n// TODO: FlatRoutes not found, appended Rulehub redirect below\n' + desiredRedirect + '\n';
  }
}

// Handle SignInPage injection or removal
if (noAuth) {
  // Remove any SignInPage override to fully disable auth in demo
  // 1) Remove SignInPage from the core-components named import, but keep other imports on the same line
  src = src.replace(
    /(import\s*\{)([^}]*)(\}\s*from\s*['"]@backstage\/core-components['"].*;?)/,
    (m, p1, names, p3) => {
      const filtered = names
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !/^SignInPage\b/.test(s))
        .join(', ');
      return filtered ? `${p1} ${filtered} ${p3}` : '';
    },
  );
  // 2) Remove SignInPage property in components block
  src = src.replace(
    /(components\s*:\s*\{[\s\S]*?)(\s*SignInPage\s*:\s*[^,]*,?)([\s\S]*?\})/,
    (m, p1, _sig, p3) => {
      // Remove potential trailing comma before closing brace
      let left = p1.replace(/,\s*$/, '');
      return left + p3;
    },
  );
} else {
  // Ensure SignInPage is configured for automatic guest sign-in to avoid blocking the demo
  // Use legacy-compatible prop provider="guest" with auto for widest Backstage version support
  if (!src.includes("from '@backstage/core-components'")) {
    // No core-components import at all: add SignInPage
    const lines = src.split(/\n/);
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i])) lastImport = i;
    }
    const importLines = ["import { SignInPage } from '@backstage/core-components';"];
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, ...importLines);
    } else {
      lines.unshift(...importLines, '');
    }
    src = lines.join('\n');
  } else {
    // Ensure SignInPage named import exists
    if (
      !/import\s+\{[^}]*\bSignInPage\b[^}]*\}\s+from\s+['"]@backstage\/core-components['"]/.test(
        src,
      )
    ) {
      src = src.replace(
        /from ['"]@backstage\/core-components['"];?/,
        (m) => `${m}\nimport { SignInPage } from '@backstage/core-components';`,
      );
    }
  }

  // Try to find createApp({ ... }) and ensure components.SignInPage uses auto sign-in.
  if (/createApp\s*\(\s*\{/.test(src)) {
    // If components block exists
    if (/components\s*:\s*\{[\s\S]*?\}/.test(src)) {
      if (!/components\s*:\s*\{[\s\S]*?SignInPage\s*:/.test(src)) {
        // Insert SignInPage using legacy-compatible provider prop
        src = src.replace(
          /components\s*:\s*\{/,
          (match) =>
            `${match}\n    SignInPage: props => <SignInPage {...props} auto provider=\"guest\" />,`,
        );
      } else {
        // Normalize existing SignInPage to provider="guest" form
        src = src.replace(/SignInPage\s*:\s*[^,]*,/, () => {
          return 'SignInPage: props => <SignInPage {...props} auto provider="guest" />,';
        });
      }
    } else {
      // No components block; inject one right after createApp({
      src = src.replace(
        /createApp\s*\(\s*\{/,
        (m) =>
          `${m}\n  components: { SignInPage: props => <SignInPage {...props} auto provider=\"guest\" /> },`,
      );
    }
  }
}

// Ensure core-components named import includes AlertDisplay and OAuthRequestDialog
if (/\bAlertDisplay\b|\bOAuthRequestDialog\b/.test(src)) {
  if (/import\s*\{[^}]*\}\s*from\s*['"]@backstage\/core-components['"]/.test(src)) {
    src = src.replace(
      /(import\s*\{)([^}]*)(\}\s*from\s*['"]@backstage\/core-components['"].*;?)/,
      (m, p1, names, p3) => {
        const set = new Set(
          names
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
        set.add('AlertDisplay');
        set.add('OAuthRequestDialog');
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
    const importLine =
      "import { AlertDisplay, OAuthRequestDialog } from '@backstage/core-components';";
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
    } else {
      lines.unshift(importLine, '');
    }
    src = lines.join('\n');
  }
}

// Ensure SidebarItem import from core-components exists (for left menu entry)
if (/import\s*\{[^}]*\}\s*from\s*['"]@backstage\/core-components['"]/.test(src)) {
  src = src.replace(
    /(import\s*\{)([^}]*)(\}\s*from\s*['"]@backstage\/core-components['"].*;?)/,
    (m, p1, names, p3) => {
      const set = new Set(
        names
          .split(',')
          .map((s) => s.trim())
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

// Discover nearest package.json to decide which Material Icons package to use (MUI v5 or v4)
function findNearestPackageJson(start) {
  let dir = path.dirname(start);
  for (let i = 0; i < 6; i++) {
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
  iconIdentifier = null;
}

// Inject SidebarItem into <Sidebar> for left menu, if not already present. Prefer placing after "Create".
if (!/\<SidebarItem[^>]*to=\"\/rulehub\"/.test(src)) {
  const sidebarOpenIdx = src.indexOf('<Sidebar');
  if (sidebarOpenIdx !== -1) {
    // Find position of the first closing tag matching </Sidebar>
    const sidebarCloseIdx = src.indexOf('</Sidebar>', sidebarOpenIdx);
    if (sidebarCloseIdx !== -1) {
      const insertion = iconIdentifier
        ? `\n    <SidebarItem to=\"/rulehub\" icon={${iconIdentifier}} text=\"RuleHub\" />`
        : `\n    <SidebarItem to=\"/rulehub\" text=\"RuleHub\" />`;

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
        src = src.slice(0, sidebarCloseIdx) + insertion + src.slice(sidebarCloseIdx);
      }
    } else {
      // No closing tag found; add commented hint only (avoid injecting raw JSX into TSX)
      src += iconIdentifier
        ? '\n\n// TODO: Sidebar closing tag not found; add this inside your <Sidebar> block:\n//   <SidebarItem to="/rulehub" icon={LibraryBooks} text="RuleHub" />\n'
        : '\n\n// TODO: Sidebar closing tag not found; add this inside your <Sidebar> block:\n//   <SidebarItem to="/rulehub" text="RuleHub" />\n';
    }
  } else {
    // No Sidebar detected; append a note and a minimal inline link as a fallback
    src += iconIdentifier
      ? '\n\n// TODO: Sidebar not found; you can add RuleHub to the left nav:\n// import { SidebarItem } from \'@backstage/core-components\';\n// import LibraryBooks from \'@mui/icons-material/LibraryBooks\';\n// ... inside <Sidebar> ...\n//   <SidebarItem to=\\"/rulehub\\" icon={LibraryBooks} text=\\"RuleHub\\" />\n'
      : '\n\n// TODO: Sidebar not found; you can add RuleHub to the left nav:\n// import { SidebarItem } from \'@backstage/core-components\';\n// ... inside <Sidebar> ...\n//   <SidebarItem to=\\"/rulehub\\" text=\\"RuleHub\\" />\n';
  }
}

writeFileSync(file, src);
console.log('[link] App.tsx patched to use RulehubPage (import/route)');
