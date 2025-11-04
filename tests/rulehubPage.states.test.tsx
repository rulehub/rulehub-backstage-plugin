import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import { RulehubPage } from '../src/routes';
import { RulehubClient } from '../src/RulehubClient';
import { RulehubError, ERROR_CODES } from '../src/errors';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage states', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows loading state first', async () => {
    mockGetIndex.mockResolvedValue([]);

    render(<RulehubPage />);

    // loading immediately visible
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    // footer must be hidden while loading
    expect(screen.queryByTestId('footer-links')).not.toBeInTheDocument();

    // then disappears after fetch
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
  });

  it('renders error state if fetch fails', async () => {
    mockGetIndex.mockRejectedValue(new RulehubError(ERROR_CODES.INDEX_HTTP_ERROR, 'HTTP 500'));

    render(<RulehubPage />);

    const error = await screen.findByTestId('error');
    expect(error).toHaveTextContent('Failed to load index:');
    expect(error).toHaveTextContent('HTTP 500');
    // footer must be hidden in error state
    expect(screen.queryByTestId('footer-links')).not.toBeInTheDocument();
  });
});
