// @ts-nocheck
import { test, expect } from '@playwright/test';

test('shows error then recovers on Retry', async ({ page }) => {
  let first = true;
  await page.route('**/plugin-index/index.json', async route => {
    if (first) {
      first = false;
      return route.fulfill({ status: 500, body: 'boom' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        packages: [
          { id: 't1', name: 'T1', standard: 'x', version: '1.0.0', coverage: ['A'] },
        ],
      }),
    });
  });

  await page.goto('/rulehub');
  const errorPanel = page.getByTestId('error');
  await expect(errorPanel).toBeVisible();
  // Re-trigger fetch by reloading the page (acts as a retry)
  await page.reload();
  await expect(page.getByRole('heading', { name: /rulehub/i })).toBeVisible();
  await expect(page.getByRole('cell', { name: 't1', exact: true })).toBeVisible();
});
