// @ts-nocheck
import { test, expect } from '@playwright/test';

test('standard filter filters rows', async ({ page }) => {
  await page.route(/.*\/dist\/index\.json.*/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        packages: [
          { id: 'cis-1', name: 'CIS Benchmarks', standard: 'CIS', version: '1.0.0' },
          { id: 'iso-core', name: 'ISO 27001 Core', standard: 'ISO', version: '2022' },
        ],
      }),
    });
  });

  await page.goto(`/rulehub`);
  // Wait for the main data table (first MUI table)
  const dataTable = page.locator('table.MuiTable-root').first();
  await expect(dataTable).toBeVisible();
  // Ensure mocked rows are rendered
  await expect(page.getByText('CIS Benchmarks')).toBeVisible();
  await expect(page.getByText('ISO 27001 Core')).toBeVisible();
  // Use the built-in Standard filter select rendered by the plugin
  const standardSelect = page.getByLabel('Standard filter');
  await expect(standardSelect).toBeVisible();
  await standardSelect.selectOption('ISO');
  await expect(page.getByText('ISO 27001 Core')).toBeVisible();
  await expect(page.getByText('CIS Benchmarks')).toHaveCount(0);
});
