import { defineConfig, devices } from '@playwright/test';

const shouldStartServer = !process.env.PLAYWRIGHT_NO_SERVER;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 0,
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'demo',
      use: { baseURL: process.env.PLAYWRIGHT_URL ?? 'http://localhost:3000' },
    },
  ],
  webServer: shouldStartServer
    ? [
        {
          command:
            'bash -lc "cd .. && PRE_BUILT=1 node scripts/demo-real.mjs --frontend-only"',
          port: 3000,
          reuseExistingServer: true,
          // First run can be slow (scaffolding + install); allow ample time
          timeout: 600_000,
          env: {
            RULEHUB_REPO_BASE_URL: 'https://github.com/rulehub/rulehub-charts/tree/main/',
            PORT: '3000',
            PLAYWRIGHT_URL: 'http://localhost:3000',
          },
        },
      ]
    : [],
});
