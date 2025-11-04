import React from 'react';
import { render } from '@testing-library/react';
import { screen, within, fireEvent } from '@testing-library/dom';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };
(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage links and filters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // clear query params between tests
    window.history.replaceState({}, '', '/');
  });

  it('renders ID/Name as links to repo path derived from id', async () => {
    mockGetIndex.mockResolvedValue([
      {
        id: 'gdpr.data_minimization',
        name: 'Data minimization',
        standard: 'GDPR',
        version: '2016/679',
        jurisdiction: 'EU',
        coverage: ['Art.5(1)(c)'],
      },
    ]);

    const { RulehubPage } = await import('../src/routes');
    render(<RulehubPage />);

    // Wait until table rendered
    await screen.findByTestId('table-title');

    const columns = await screen.findByTestId('table-columns');
    expect(columns).toBeInTheDocument();

    // Our mock renders the first row cell of each column via render() into table-rendered-cells
    const rendered = await screen.findByTestId('table-rendered-cells');
    expect(rendered).toBeInTheDocument();

    // Also verify actual link with computed href exists
    const firstRow = await screen.findByTestId('table-first-row-rendered');
    const links = within(firstRow).getAllByTestId('link');
    const hrefs = links.map((l: Element) => (l as HTMLElement).getAttribute('data-href'));
    expect(
      hrefs.some(
        (h) => h === 'https://github.com/rulehub/rulehub/tree/HEAD/policies/gdpr/data_minimization',
      ),
    ).toBe(true);
  });

  it('uses repoPath from the index when present (joined with repoBaseUrl)', async () => {
    mockGetIndex.mockResolvedValue([
      {
        id: 'cis-1',
        name: 'CIS Requirement 1',
        standard: 'CIS',
        version: '1.0',
        jurisdiction: 'GLOBAL',
        coverage: [],
        repoPath: 'policies/cis/1',
      },
    ]);

    const { RulehubPage } = await import('../src/routes');
    render(<RulehubPage />);

    await screen.findByTestId('table-title');
    const firstRow = await screen.findByTestId('table-first-row-rendered');
    const links = within(firstRow).getAllByTestId('link');
    const hrefs = links.map((l: Element) => (l as HTMLElement).getAttribute('data-href'));
    expect(hrefs).toEqual(
      expect.arrayContaining(['https://github.com/rulehub/rulehub/tree/HEAD/policies/cis/1']),
    );
  });

  it('uses repoUrl from the index when present (full URL)', async () => {
    mockGetIndex.mockResolvedValue([
      {
        id: 'iso-27001',
        name: 'ISO 27001',
        standard: 'ISO',
        version: '2022',
        repoUrl: 'https://github.com/rulehub/rulehub/tree/main/policies/iso/iso-27001',
      },
    ]);

    const { RulehubPage } = await import('../src/routes');
    render(<RulehubPage />);

    await screen.findByTestId('table-title');
    const firstRow = await screen.findByTestId('table-first-row-rendered');
    const links = within(firstRow).getAllByTestId('link');
    const hrefs = links.map((l: Element) => (l as HTMLElement).getAttribute('data-href'));
    // When repoUrl is explicitly provided in the index, it is used as-is
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'https://github.com/rulehub/rulehub/tree/main/policies/iso/iso-27001',
      ]),
    );
  });

  it('applies filters: standard and jurisdiction', async () => {
    mockGetIndex.mockResolvedValue([
      {
        id: 'gdpr.data_minimization',
        name: 'A',
        standard: 'GDPR',
        version: 'x',
        jurisdiction: 'EU',
        coverage: ['Art.5'],
      },
      {
        id: 'pci.pan_storage',
        name: 'B',
        standard: 'PCI',
        version: '4.0',
        jurisdiction: 'US',
        coverage: ['1.2'],
      },
    ]);

    const { RulehubPage } = await import('../src/routes');
    render(<RulehubPage />);
    await screen.findByTestId('table-title');

    // Select Standard = GDPR
    const stdSelect = screen.getByLabelText('Standard filter') as HTMLSelectElement;
    fireEvent.change(stdSelect, { target: { value: 'GDPR' } });

    // Select Jurisdiction = EU
    const jurSelect = screen.getByLabelText('Jurisdiction filter') as HTMLSelectElement;
    fireEvent.change(jurSelect, { target: { value: 'EU' } });

    // Our mock surfaces data as JSON in table-data; with standard=GDPR and jurisdiction=EU expect only package A
    const dataDiv = await screen.findByTestId('table-data');
    const json = dataDiv.textContent || '[]';
    const rows = JSON.parse(json);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('gdpr.data_minimization');
  });
});
