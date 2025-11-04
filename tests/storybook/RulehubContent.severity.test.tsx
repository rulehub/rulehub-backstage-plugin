import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

const renderDefault = () => renderRulehubContentFixture();

describe('RulehubContent severity badge', () => {
  it('shows severity badge for ISO row with correct label', async () => {
    renderDefault();
    // Filter to ISO to ensure the first row is the ISO item with severity
    const stdSelect = await screen.findByLabelText('Standard filter');
    (stdSelect as HTMLSelectElement).value = 'ISO';
    stdSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const badge = await screen.findByTestId('severity-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('medium');
    expect(badge).toHaveAttribute('title', 'Severity: medium');
  });
});
