import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex } as any;
(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage filter normalization ("All" -> no filter)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // preload URL with query params that might appear from saved links or test harness controls
    window.history.replaceState({}, '', '/?standard=All&jurisdiction=All&industry=All');
  });

  it('treats "All" query values as empty filters', async () => {
    mockGetIndex.mockResolvedValue([
      { id: 'cis.k8s', name: 'CIS K8s', standard: 'CIS', version: '1.0.0', coverage: [] },
      { id: 'iso.27001', name: 'ISO 27001', standard: 'ISO', version: '2022', coverage: [] },
    ]);

    const { RulehubPage } = await import('../src/routes');
    render(<RulehubPage />);

    await screen.findByTestId('table-title');

    const dataDiv = await screen.findByTestId('table-data');
    const rows = JSON.parse(dataDiv.textContent || '[]');
    // Should not be filtered down to 0 because "All" must be treated as no filter
    expect(rows).toHaveLength(2);
  });
});
