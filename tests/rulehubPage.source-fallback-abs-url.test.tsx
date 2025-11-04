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

describe('Source links: optional absolute URL fallback when charts path unavailable', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('returns absolute engine URL when only core-style paths exist and fallback enabled', async () => {
    const { RulehubPage } = await import('../src/routes');

    const absUrl =
      'https://github.com/rulehub/rulehub/blob/main/policies/fintech/aml_adverse_media_screening/policy.rego';

    mockGetIndex.mockResolvedValue([
      {
        id: 'fintech.aml_adverse_media_screening',
        name: 'Adverse media screening',
        standard: 'AML',
        version: '1.0',
        // Engine array has only core-style path + absolute URL; no charts-relative path
        gatekeeper: [
          { path: 'policies/fintech/aml_adverse_media_screening/policy.rego', url: absUrl },
        ],
      },
    ]);

    const indexUrl = 'https://rulehub.github.io/rulehub/plugin-index/index.json';

    render(<RulehubPage indexUrl={indexUrl} sourceAbsFallback={true} />);

    const source = await screen.findByTestId('source-links');
    const links = within(source).getAllByTestId('link');
    expect(links.length).toBe(1);
    const href = links[0].getAttribute('data-href') || '';
    expect(href).toBe(absUrl);
  });
});
