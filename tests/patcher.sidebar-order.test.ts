import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('patch-app-sidebar.mjs placement', () => {
  it('inserts RuleHub after Create item', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rulehub-sidebar-order-'));
    const rootPath = join(dir, 'Root.tsx');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', version: '0.0.0' }));

    const sampleRoot = `
import React from 'react';
import { Sidebar, SidebarItem } from '@backstage/core-components';

export const Root = () => (
  <Sidebar>
    <SidebarItem to="/home" text="Home" />
    <SidebarItem to="/create" text="Create" />
    <SidebarItem to="/apis" text="APIs" />
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
    const order = [
      '<SidebarItem to="/home" text="Home" />',
      '<SidebarItem to="/create" text="Create" />',
      // Accept the RuleHub item with or without query params
      'to="/rulehub',
      '<SidebarItem to="/apis" text="APIs" />',
    ];
    let lastIdx = -1;
    for (const token of order) {
      const idx = out.indexOf(token);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });
});
