import { test, expect } from '@playwright/test';

test('RuleHub table renders and shows rows', async ({ page }) => {
  await page.goto('/rulehub');
  await expect(page.getByRole('heading', { name: /rulehub/i })).toBeVisible();
  // Expect at least one data row
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible();
  // Expect columns Standard/Version/Jurisdiction headings present
  await expect(page.getByRole('columnheader', { name: 'Standard' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Version' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Jurisdiction' })).toBeVisible();
});
