import { test, expect } from '@playwright/test';

test('auto sign-in and redirect to /rulehub (with optional query)', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/rulehub(\?.*)?$/);
  await expect(page.getByRole('heading', { name: /rulehub/i })).toBeVisible();
});
