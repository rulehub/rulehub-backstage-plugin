// @ts-nocheck
import { test, expect } from '@playwright/test';

// Simulate empty index by intercepting the index.json request for this page only.
test('shows empty state when index has no packages', async ({ page }) => {
  await page.route('**/plugin-index/index.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ packages: [] }),
    });
  });

  await page.goto('/rulehub');
  await expect(page.getByTestId('empty-state')).toBeVisible();
});
