import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Verifies that the sidebar patch script injects the RuleHub SidebarItem

describe('patch-app-sidebar.mjs', () => {
  it('injects SidebarItem to /rulehub into <Sidebar>', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rulehub-sidebar-'));
    const rootPath = join(dir, 'Root.tsx');

    const sampleRoot = `
import React from 'react';
import { Sidebar } from '@backstage/core-components';

export const Root = () => (
  <Sidebar>
    {/* existing items */}
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
    expect(out).toMatch(/import\s+\{[^}]*SidebarItem[^}]*\}\s+from\s+'@backstage\/core-components';/);
    // Accept with or without icon depending on detected MUI icons availability
    // Accept optional query string (e.g., ?sourceBase=...)
    expect(
      /<SidebarItem[^>]*to=\"\/rulehub(?:\?[^\"]*)?\"[^>]*text=\"RuleHub\"[^>]*\/>/.test(out)
    ).toBe(true);
  });
});
