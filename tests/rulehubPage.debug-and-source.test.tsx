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

describe('RulehubPage debug and source links', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    // Ensure debug flag is enabled via query param
    const url = new URL('http://localhost/?debug=1');
    // jsdom allows overriding location via defineProperty
    Object.defineProperty(window, 'location', {
      value: {
        href: url.toString(),
        search: url.search,
      },
      writable: true,
    } as any);
  });

  it('renders repo base in debug mode and source links from paths', async () => {
    const { RulehubPage } = await import('../src/routes');
    // Row with kyverno path derived from paths and no explicit engine urls
    mockGetIndex.mockResolvedValue([
      {
        id: 'std.alpha',
        name: 'Alpha',
        standard: 'NIST',
        version: '1.0.0',
        coverage: ['policy'],
        paths: [
          { path: 'addons/kyverno/policies/std/alpha/policy.yaml', exists: true },
          // include '/constraints/' segment to trigger Gatekeeper link detection
          { path: '/constraints/some.yaml', exists: true },
        ],
      },
    ]);

    render(<RulehubPage />);

  // Debug section should appear with both repo and source bases
  expect(await screen.findByTestId('repo-base')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open repo base/i })).toBeInTheDocument();
  expect(await screen.findByTestId('source-base')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open source base/i })).toBeInTheDocument();

    // Source links should render both engines from derived paths
    const source = await screen.findByTestId('source-links');
    expect(source).toBeInTheDocument();
    // At least one of Kyverno or Gatekeeper should render; with provided paths both should appear
    expect(screen.getByRole('link', { name: /open kyverno/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open gatekeeper/i })).toBeInTheDocument();
  });
});
