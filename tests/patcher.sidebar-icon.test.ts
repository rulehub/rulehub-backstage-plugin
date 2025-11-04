import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('patch-app-sidebar.mjs', () => {
  it('injects SidebarItem with LibraryBooks icon and adds icon import', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rulehub-sidebar-'));
    const rootPath = join(dir, 'Root.tsx');
    // Simulate an app package.json that has @mui/icons-material installed
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'app',
      version: '0.0.0',
      dependencies: { '@mui/icons-material': '^5.15.0' }
    }, null, 2));

    const sampleRoot = `
import React from 'react';
import { Sidebar } from '@backstage/core-components';

export const Root = () => (
  <Sidebar>
  </Sidebar>
);
`;

    writeFileSync(rootPath, sampleRoot);

    const res = spawnSync('node', [
      join(process.cwd(), 'scripts/patch-app-sidebar.mjs'),
      rootPath,
    ], { encoding: 'utf8' });

    expect(res.status).toBe(0);

    const out = readFileSync(rootPath, 'utf8');
    expect(out).toMatch(/import\s+LibraryBooks\s+from\s+'@mui\/icons-material\/LibraryBooks';/);
    expect(out).toMatch(/<SidebarItem[^>]*icon=\{LibraryBooks\}[^>]*\/>/);
  });
});
