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

describe('Ignore core-style engine paths when source base is charts', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('gatekeeperPath=policies/.../policy.rego is ignored; falls back to charts filename mapping', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'fintech.aml_adverse_media_screening',
        name: 'AML Adverse Media Screening',
        standard: 'AML',
        version: '1.0',
        // Core-style engine path that should NOT be joined to charts base
        gatekeeperPath: 'policies/fintech/aml_adverse_media_screening/policy.rego',
        // Generic paths allow engine detection (policy.rego => Gatekeeper)
        paths: [
          { path: 'policies/fintech/aml_adverse_media_screening/policy.rego', exists: true },
        ],
      },
    ]);

    const indexUrl = 'https://rulehub.github.io/rulehub/plugin-index/index.json';

    render(<RulehubPage indexUrl={indexUrl} />);

    const source = await screen.findByTestId('source-links');
    const links = within(source).getAllByTestId('link');
    expect(links.length).toBe(1);
    const href = links[0].getAttribute('data-href') || '';
    expect(href).toBe(
  'https://github.com/rulehub/rulehub-charts/tree/HEAD/files/gatekeeper/fintech-aml_adverse_media_screening-constraint.yaml',
    );
  });
});
