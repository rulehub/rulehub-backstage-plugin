import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

const renderDefault = () => renderRulehubContentFixture();

describe('RulehubContent Default story – table smoke', () => {
  it('renders the RuleHub table with seeded rows and no loading/error', async () => {
    renderDefault();

    // No loading spinner or error panel
    expect(screen.queryByTestId('loading')).toBeNull();
    expect(screen.queryByTestId('error')).toBeNull();

    // Filters should be visible by default for the story
    expect(await screen.findByTestId('filters')).toBeInTheDocument();

    // Table title is shown (use specific test id to avoid footer link collision)
    expect(await screen.findByTestId('table-title')).toHaveTextContent('RuleHub');

    // Our Table mock only renders real cells for the FIRST row, but exposes all rows via table-data JSON
    const dataEl = await screen.findByTestId('table-data');
    const rows = JSON.parse(dataEl.textContent || '[]');
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.map((r: any) => r.name)).toEqual(
      expect.arrayContaining(['CIS Kubernetes Benchmark', 'ISO 27001 Core']),
    );

    // The first row should be rendered with anchors for Name/ID (from the mock)
    const firstRow = await screen.findByTestId('table-first-row-rendered');
    expect(within(firstRow).getByText('CIS Kubernetes Benchmark')).toBeInTheDocument();

    // The "Charts Source" column should render something; for the first row it's a Non‑K8s badge
    expect(await screen.findByTestId('source-fallback')).toBeInTheDocument();
  });
});
