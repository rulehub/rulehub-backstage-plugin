/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };
(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage perIdJson invalid JSON handling', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    // Provide a minimal row so the table renders
    mockGetIndex.mockResolvedValue([
      { id: 'std.item', name: 'Item', standard: 'STD', version: '1.0.0' },
    ]);
  });

  it('ignores invalid perIdJson from query string without crashing', async () => {
    const { RulehubPage } = await import('../src/routes');

    // Set invalid JSON in perIdJson query param; setupTests suppresses the expected warning
    const url = new URL('http://localhost/?perIdJson=%7Binvalid');
    Object.defineProperty(window, 'location', {
      value: {
        href: url.toString(),
        search: url.search,
      },
      writable: true,
    } as any);

    render(<RulehubPage />);

    // Table title should render, indicating a successful render path
    expect(await screen.findByTestId('table-title')).toHaveTextContent('RuleHub');
  });
});
