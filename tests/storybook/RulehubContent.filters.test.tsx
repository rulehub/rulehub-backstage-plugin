import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

const renderDefault = () => renderRulehubContentFixture();

it('shows both standards in filter options and filters to ISO', async () => {
  renderDefault();
  // Options appear after component loads and builds distinct lists
  const stdSelect = await screen.findByLabelText('Standard filter');
  const optCis = within(stdSelect).getByRole('option', { name: 'CIS' });
  const optIso = within(stdSelect).getByRole('option', { name: 'ISO' });
  expect(optCis).toBeInTheDocument();
  expect(optIso).toBeInTheDocument();

  // Filter to ISO
  (stdSelect as HTMLSelectElement).value = 'ISO';
  stdSelect.dispatchEvent(new Event('change', { bubbles: true }));

  // First row should now be the ISO package (table mock renders first row details)
  const firstRow = await screen.findByTestId('table-first-row-rendered');
  expect(firstRow).toHaveTextContent('ISO 27001 Core');
});

it('reset button clears filters', async () => {
  renderDefault();
  const stdSelect = await screen.findByLabelText('Standard filter');
  (stdSelect as HTMLSelectElement).value = 'ISO';
  stdSelect.dispatchEvent(new Event('change', { bubbles: true }));

  // Click reset
  const resetBtn = screen.getByRole('button', { name: 'Reset' });
  resetBtn.click();

  // Back to first row CIS
  const firstRow = await screen.findByTestId('table-first-row-rendered');
  expect(firstRow).toHaveTextContent('CIS Kubernetes Benchmark');
});
