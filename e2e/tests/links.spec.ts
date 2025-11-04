import { test, expect } from '@playwright/test';

// Ensures repo links (ID/Name columns) and Source engine links point to rulehub-charts base
// This assumes RULEHUB_REPO_BASE_URL is set by the Playwright webServer env in playwright.config.ts

test('ID/Name and Source links use charts repo base (query override)', async ({ page }) => {
  const repoBase = encodeURIComponent('https://github.com/rulehub/rulehub-charts/tree/main/');
  await page.goto(`/rulehub?repoBase=${repoBase}`);
  await expect(page.getByRole('heading', { name: /rulehub/i })).toBeVisible();

  // Take first row with a Repo link (Name column) and assert href
  const firstNameLink = page.locator('table tbody tr td:nth-child(2) a').first();
  await expect(firstNameLink).toBeVisible();
  const nameHref = await firstNameLink.getAttribute('href');
  expect(nameHref).toBeTruthy();
  expect(nameHref!).toMatch(/^https:\/\/github.com\/rulehub\/rulehub-charts\/tree\/main\//);

  // Find a row with Source links and assert each engine link uses charts base
  const sourceCell = page.getByTestId('source-links').first();
  await expect(sourceCell).toBeVisible();
  const links = sourceCell.locator('a');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href');
    expect(href).toBeTruthy();
    expect(href!).toMatch(/^https:\/\/github.com\/rulehub\/rulehub-charts\/tree\/main\//);
  }
});
