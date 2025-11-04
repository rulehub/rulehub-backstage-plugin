import { test, expect } from '@playwright/test';

// NOTE: Coverage filter was removed from the UI; keeping this file for history but skipping the test.
test.skip('Coverage filter was removed; skip legacy test', async ({ page }) => {
  await page.goto('/rulehub');

  // Ensure table present
  await expect(page.getByRole('heading', { name: /rulehub/i })).toBeVisible();
  const rows = page.locator('table tbody tr');
  const initialCount = await rows.count();
  expect(initialCount).toBeGreaterThan(0);

  // Type a common coverage token (policy)
  // Legacy: would have filled coverage filter here

  // After filtering, there should be <= initial number of rows
  await expect(rows.first()).toBeVisible();
  const filteredCount = await rows.count();
  expect(filteredCount).toBeLessThanOrEqual(initialCount);

  // Click Reset and verify row count returns to initial
  await page.getByRole('button', { name: /reset/i }).click();
  await expect(rows.first()).toBeVisible();
  const resetCount = await rows.count();
  expect(resetCount).toBeGreaterThanOrEqual(filteredCount);
});
