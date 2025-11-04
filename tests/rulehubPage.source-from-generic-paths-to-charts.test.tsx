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

describe('Source link from generic policies path maps to charts layout', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('Gatekeeper generic path policies/.../policy.rego -> files/gatekeeper/<domain>-<name>-constraint.yaml', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'fintech.three_ds_required',
        name: '3DS Required',
        standard: 'PSD2',
        version: '1.0',
        // No kyverno/gatekeeper explicit fields; only a generic core repo path
        paths: [
          { path: 'policies/fintech/three_ds_required/policy.rego', exists: true },
        ],
      },
    ]);

    const indexUrl = 'https://rulehub.github.io/rulehub/plugin-index/index.json';

    render(<RulehubPage indexUrl={indexUrl} />);

    const source = await screen.findByTestId('source-links');
    const links = within(source).getAllByTestId('link');
    // Expect only Gatekeeper link rendered and pointing to charts files/gatekeeper/**
    expect(links.length).toBe(1);
    const href = links[0].getAttribute('data-href') || '';
    expect(href).toBe(
  'https://github.com/rulehub/rulehub-charts/tree/HEAD/files/gatekeeper/fintech-three_ds_required-constraint.yaml',
    );
  });
});
