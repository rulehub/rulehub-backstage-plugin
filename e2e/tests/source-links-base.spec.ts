import { test, expect } from '@playwright/test';

// Navigate with repoBase override via query to ensure deterministic base

test('source engine links honor repoBase query override', async ({ page }) => {
  const repoBase = encodeURIComponent('https://github.com/rulehub/rulehub-charts/tree/main/');
  await page.goto(`/rulehub?repoBase=${repoBase}`);
  await expect(page.getByRole('heading', { name: /rulehub/i })).toBeVisible();

  const source = page.getByTestId('source-links').first();
  await expect(source).toBeVisible();
  const links = source.locator('a');
  const n = await links.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const href = await links.nth(i).getAttribute('href');
    expect(href).toBeTruthy();
    expect(href!).toMatch(/^https:\/\/github.com\/rulehub\/rulehub-charts\/tree\/main\//);
  }
});
