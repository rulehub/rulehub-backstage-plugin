import React from 'react';
import { render, act } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { RulehubClient } from '../src/RulehubClient';
import { RulehubError, ERROR_CODES } from '../src/errors';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage error cases', () => {
  afterEach(() => { jest.resetAllMocks(); });

  it('shows HTTP error status', async () => {
    const { RulehubPage } = await import('../src/routes');
    mockGetIndex.mockRejectedValue(new RulehubError(ERROR_CODES.INDEX_HTTP_ERROR, 'HTTP 500: Internal Server Error'));
    render(<RulehubPage />);
    const err = await screen.findByTestId('error');
    expect(err.textContent).toContain('HTTP error: HTTP 500');
  });

  it('shows network error', async () => {
    const { RulehubPage } = await import('../src/routes');
    mockGetIndex.mockRejectedValue(new RulehubError(ERROR_CODES.INDEX_HTTP_ERROR, 'Network error: fetch failed'));
    render(<RulehubPage />);
    const err = await screen.findByTestId('error');
    expect(err.textContent).toContain('HTTP error: Network error');
  });

  it('retry button triggers refetch', async () => {
    const { RulehubPage } = await import('../src/routes');
    mockGetIndex
      .mockRejectedValueOnce(new RulehubError(ERROR_CODES.INDEX_HTTP_ERROR, 'HTTP 500'))
      .mockResolvedValueOnce([]);
    render(<RulehubPage />);
    const err = await screen.findByTestId('error');
    const btn = err.querySelector('button');
    expect(btn).toBeTruthy();
    await act(async () => { btn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await screen.findByTestId('table-title');
    expect(mockGetIndex).toHaveBeenCalledTimes(2);
  });

  it('schema validation error detail appears', async () => {
    const { RulehubPage } = await import('../src/routes');
    mockGetIndex.mockRejectedValue(new RulehubError(ERROR_CODES.INDEX_SCHEMA_INVALID, 'Schema validation failed: /packages/0 must have required property \'id\''));
    render(<RulehubPage />);
    const err = await screen.findByTestId('error');
    expect(err.textContent).toMatch(/Schema validation failed/);
  });
});
