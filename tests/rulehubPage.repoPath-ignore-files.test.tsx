import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };
(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage repoPath handling ignores charts files/ paths', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('does not use repoPath starting with files/ for Name/ID links', async () => {
    mockGetIndex.mockResolvedValue([
      {
        id: 'k8s.example',
        name: 'Example',
        standard: 'K8S',
        version: '1.0',
        // charts-relative path which should be ignored for repo links
        repoPath: 'files/kyverno/policies/k8s/example/policy.yaml',
      },
    ]);

    const { RulehubPage } = await import('../src/routes');
    render(<RulehubPage />);

    await screen.findByTestId('table-title');
    const firstRow = await screen.findByTestId('table-first-row-rendered');
    const links = within(firstRow).getAllByTestId('link');
    const hrefs = links.map((l: Element) => (l as HTMLElement).getAttribute('data-href'));
    // Heuristic should produce core repo path, not files/ path
    expect(
      hrefs.some(
        (h) => h === 'https://github.com/rulehub/rulehub/tree/HEAD/policies/k8s/example',
      ),
    ).toBe(true);
  });
});
