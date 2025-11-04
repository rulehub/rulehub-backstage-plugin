import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('patch-app-root-clean.mjs', () => {
  it('removes NotificationsSidebarItem and MyGroupsSidebarItem', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rulehub-root-clean-'));
    const rootPath = join(dir, 'Root.tsx');
    const sample = `
import { Sidebar, SidebarDivider } from '@backstage/core-components';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { MyGroupsSidebarItem } from '@backstage/plugin-org';
import GroupIcon from '@material-ui/icons/People';

export const Root = () => (
  <Sidebar>
    <SidebarDivider />
    <MyGroupsSidebarItem singularTitle="My Group" pluralTitle="My Groups" icon={GroupIcon} />
    <SidebarDivider />
    <NotificationsSidebarItem />
    <SidebarDivider />
  </Sidebar>
);
`;
    writeFileSync(rootPath, sample);
    const res = spawnSync('node', [join(process.cwd(), 'scripts/patch-app-root-clean.mjs'), rootPath], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    const out = readFileSync(rootPath, 'utf8');
    expect(out).not.toMatch(/NotificationsSidebarItem/);
    expect(out).not.toMatch(/MyGroupsSidebarItem/);
    expect(out).not.toMatch(/@backstage\/plugin-notifications/);
    expect(out).not.toMatch(/@backstage\/plugin-org/);
    expect(out).not.toMatch(/@material-ui\/icons\/People/);
  });
});
