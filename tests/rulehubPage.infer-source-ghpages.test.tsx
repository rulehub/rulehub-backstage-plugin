/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };
(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage sourceBaseUrl inference from GitHub Pages indexUrl', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('infers charts base for GH Pages host and defaults to main', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'k8s.alpha',
        name: 'Alpha',
        standard: 'K8S',
        version: '1.0',
        kyvernoPath: 'files/kyverno/policies/k8s/alpha/policy.yaml',
      },
    ]);

    const indexUrl = 'https://rulehub.github.io/rulehub-charts/plugin-index/index.json';

    render(<RulehubPage indexUrl={indexUrl} />);

    const source = await screen.findByTestId('source-links');
    const links = within(source).getAllByTestId('link');
    for (const a of links) {
      const href = a.getAttribute('data-href') || '';
  expect(href.startsWith('https://github.com/rulehub/rulehub-charts/tree/HEAD/')).toBe(true);
    }
  });
});
