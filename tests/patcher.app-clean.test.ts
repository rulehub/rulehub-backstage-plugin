import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('patch-app-app-clean.mjs', () => {
  it('removes SignalsDisplay and NotificationsPage', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rulehub-app-clean-'));
    const appPath = join(dir, 'App.tsx');
    const sample = `
import { AlertDisplay, OAuthRequestDialog, SidebarItem, SignalsDisplay } from '@backstage/core-components';
import { NotificationsPage } from '@backstage/plugin-notifications';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { Route } from 'react-router-dom';

export default function App() {
  return (
    <>
      <AlertDisplay />
      <OAuthRequestDialog />
      <SignalsDisplay />
      <AppRouter>
        <FlatRoutes>
          <Route path="/notifications" element={<NotificationsPage />} />
        </FlatRoutes>
      </AppRouter>
    </>
  );
}
`;
    writeFileSync(appPath, sample);
    const res = spawnSync('node', [join(process.cwd(), 'scripts/patch-app-app-clean.mjs'), appPath], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    const out = readFileSync(appPath, 'utf8');
    expect(out).not.toMatch(/SignalsDisplay/);
    expect(out).not.toMatch(/NotificationsPage/);
    expect(out).not.toMatch(/path="\/notifications"/);
  });
});
