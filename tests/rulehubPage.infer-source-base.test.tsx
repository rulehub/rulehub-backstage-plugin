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

describe('RulehubPage sourceBaseUrl inference from indexUrl', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    // Clear query params and window location between tests
    window.history.replaceState({}, '', '/');
  });

  it('infers charts base from jsDelivr index URL ref', async () => {
    const { RulehubPage } = await import('../src/routes');

    // Provide index row with engine-specific relative paths
    mockGetIndex.mockResolvedValue([
      {
        id: 'k8s.example',
        name: 'Example',
        standard: 'K8S',
        version: '1.0',
        kyvernoPath: 'files/kyverno/policies/k8s/example/policy.yaml',
        gatekeeperPath: 'files/gatekeeper/templates/example/template.yaml',
      },
    ]);

    const indexUrl =
      'https://cdn.jsdelivr.net/gh/rulehub/rulehub-charts@v0.1.0/plugin-index/index.json';

    render(<RulehubPage indexUrl={indexUrl} />);

    const source = await screen.findByTestId('source-links');
    const links = within(source).getAllByTestId('link');
    for (const a of links) {
      const href = a.getAttribute('data-href') || '';
      expect(href.startsWith('https://github.com/rulehub/rulehub-charts/tree/v0.1.0/')).toBe(true);
    }
  });

  it('infers charts base from raw.githubusercontent index URL branch', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'k8s.example',
        name: 'Example',
        standard: 'K8S',
        version: '1.0',
        kyvernoPath: 'files/kyverno/policies/k8s/example/policy.yaml',
      },
    ]);

    const indexUrl =
      'https://raw.githubusercontent.com/acme/forked-charts/feature-x/plugin-index/index.json';

    render(<RulehubPage indexUrl={indexUrl} />);

    const source = await screen.findByTestId('source-links');
    const links = within(source).getAllByTestId('link');
    for (const a of links) {
      const href = a.getAttribute('data-href') || '';
      expect(href.startsWith('https://github.com/acme/forked-charts/tree/feature-x/')).toBe(true);
    }
  });

  it('falls back to default charts base when URL mentions rulehub-charts without ref', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'k8s.example',
        name: 'Example',
        standard: 'K8S',
        version: '1.0',
        gatekeeperPath: 'files/gatekeeper/templates/example/template.yaml',
      },
    ]);

    const indexUrl = 'https://example.com/assets/rulehub-charts/plugin-index/index.json';

    render(<RulehubPage indexUrl={indexUrl} />);

    const source = await screen.findByTestId('source-links');
    const links = within(source).getAllByTestId('link');
    for (const a of links) {
      const href = a.getAttribute('data-href') || '';
  expect(href.startsWith('https://github.com/rulehub/rulehub-charts/tree/HEAD/')).toBe(true);
    }
  });
});
