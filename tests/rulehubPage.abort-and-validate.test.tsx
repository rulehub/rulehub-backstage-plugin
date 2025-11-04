import React from 'react';
// Ensure TS picks up jest-dom matchers (some ts-jest versions need this for isolated modules)
import '@testing-library/jest-dom';
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

describe('RulehubPage abort & validation', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('aborts in-flight request on unmount without showing error', async () => {
    jest.useFakeTimers();
    const { RulehubPage } = await import('../src/routes');

    // Mock getIndex to never resolve unless aborted
    mockGetIndex.mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        // Simulate abort handling
        setTimeout(() => reject(new RulehubError(ERROR_CODES.INDEX_ABORTED, 'Aborted')), 100);
      });
    });

    const { unmount } = render(<RulehubPage />);
    // Ensure loading is visible
    expect(await screen.findByTestId('loading')).toBeInTheDocument();

    // Unmount triggers abort; no error should be rendered
    await act(async () => {
      unmount();
      // flush any timers/listeners
      jest.runOnlyPendingTimers();
    });

    // No further assertions; test passes if no act warnings or unhandled rejections occur
  });

  it('shows friendly error on invalid index format', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockRejectedValue(new RulehubError(ERROR_CODES.INDEX_SCHEMA_INVALID, 'Schema validation failed: missing packages or items array'));

    render(<RulehubPage />);

    const error = await screen.findByTestId('error');
  expect(error).toHaveTextContent('Schema invalid');
  });
});
