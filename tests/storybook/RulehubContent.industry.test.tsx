import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

const renderDefault = () => renderRulehubContentFixture();

describe('RulehubContent industry filter', () => {
  it('shows FinTech option and filters to ISO row', async () => {
    renderDefault();

    // Industry filter should include FinTech (from 'fintech' in mock industry)
    const indSelect = await screen.findByLabelText('Industry filter');
    const finOpt = within(indSelect).getByRole('option', { name: 'FinTech' });
    expect(finOpt).toBeInTheDocument();

    // Select FinTech (value is the raw key 'fintech')
    (indSelect as HTMLSelectElement).value = 'fintech';
    indSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // The filtered first row should be ISO 27001 Core (only row with industry)
    const firstRow = await screen.findByTestId('table-first-row-rendered');
    expect(firstRow).toHaveTextContent('ISO 27001 Core');
  });
});
