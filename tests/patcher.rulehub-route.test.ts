import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// This test verifies that the patch script used by the demo injects
// the Rulehub route and a root redirect into a typical App.tsx layout.

describe('patch-app-tsx-rulehub-page.mjs', () => {
  it('injects /rulehub route and root redirect', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rulehub-patch-'));
    const appPath = join(dir, 'App.tsx');

    const sampleApp = `
import React from 'react';
import { FlatRoutes } from '@backstage/core-app-api';
import { Route } from 'react-router-dom';

export const App = () => (
  <FlatRoutes>
    <Route path="/" element={<div>Home</div>} />
  </FlatRoutes>
);
`;

    writeFileSync(appPath, sampleApp);

    const res = spawnSync('node', [
      join(process.cwd(), 'scripts/patch-app-tsx-rulehub-page.mjs'),
      appPath,
    ], { encoding: 'utf8' });

    expect(res.status).toBe(0);

    const out = readFileSync(appPath, 'utf8');
    expect(out).toMatch(/import\s+\{\s*RulehubPage\s*\}\s+from\s+'@rulehub\/rulehub-backstage-plugin';/);
    expect(out).toContain('<Route path="/rulehub" element={<RulehubPage />} />');
    // Redirect may include additional query params (e.g., sourceBase). Accept any variant that includes the index param.
    expect(out).toMatch(
      new RegExp(
        String.raw`<Route path="/" element={<Navigate to="/rulehub\?index=https://rulehub\.github\.io/(rulehub|rulehub-charts)/plugin-index/index\.json(?:&[^"]*)?" replace />} />`,
      ),
    );
  });
});
