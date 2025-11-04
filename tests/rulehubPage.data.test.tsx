import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { RulehubPage } from '../src/routes';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage data rendering', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders first row with core fields and without coverage chips', async () => {
    mockGetIndex.mockResolvedValue([
      {
        id: 'gdpr.data_minimization',
        name: 'Data minimization',
        standard: 'GDPR',
        version: '2016/679',
        jurisdiction: 'EU',
        coverage: ['Art.5(1)(c)', 'Art.6'],
      },
    ]);

    render(<RulehubPage />);

    // Wait until loading disappears and table is rendered
    const cells = await screen.findByTestId('table-rendered-cells', {}, { timeout: 10000 });
    // Our simple Table mock concatenates rendered cell strings; assert core fields are present
    expect(cells.textContent).toContain('Data minimization');
    expect(cells.textContent).toContain('gdpr.data_minimization');
    expect(cells.textContent).toContain('GDPR');
    expect(cells.textContent).toContain('2016/679');
    expect(cells.textContent).toContain('EU');
    // Coverage UI removed: ensure coverage items are not rendered
    expect(cells.textContent).not.toContain('Art.5(1)(c)');
    expect(cells.textContent).not.toContain('Art.6');
  }, 10000);

  it('renders em dash for empty jurisdiction and no coverage items', async () => {
    mockGetIndex.mockResolvedValue([
      {
        id: 'foo',
        name: 'No coverage',
        standard: 'X',
        version: '1',
        jurisdiction: undefined,
        coverage: [],
      },
    ]);

    render(<RulehubPage />);

    const cells = await screen.findByTestId('table-rendered-cells');
    // Jurisdiction fallback to em dash
    expect(cells.textContent).toContain('—');
    // Ensure no coverage artifacts appear
    expect(cells.textContent).not.toContain('Art.');
  });

  it('uses custom indexUrl from config when provided', async () => {
    (globalThis as any).__rulehubIndexUrl = '/custom/index.json';

    mockGetIndex.mockResolvedValue([]);

    render(<RulehubPage />);

    await screen.findByTestId('table-title');
    await Promise.resolve();
    expect(mockGetIndex).toHaveBeenCalledWith(
      '/custom/index.json',
      expect.any(Object), // AbortSignal
    );

    delete (globalThis as any).__rulehubIndexUrl;
  });
});
