/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import { RulehubPage } from '../src/routes';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient to control returned data
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage with malformed data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters out undefined rows and does not crash the table rendering', async () => {
    // Simulate mixed array with an undefined entry that could come from a bad normalization
    mockGetIndex.mockResolvedValueOnce([
      { id: 'ok', name: 'OK', standard: 'X', version: '1', jurisdiction: 'J', coverage: [] },
      undefined,
    ]);

    render(<RulehubPage />);

    // Should render the table title and not throw
    await waitFor(() => expect(screen.getByTestId('table-title')).toBeVisible());

    // The undefined row should be dropped; data should include only the valid item
    const data = screen.getByTestId('table-data').textContent || '';
    expect(data).toContain('ok');
    expect(data).not.toMatch(/null|undefined\]/);
  });
});
