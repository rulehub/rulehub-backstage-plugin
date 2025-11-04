/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };
(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

const packs = [
  {
    id: 'r1',
    name: 'Rule One',
    standard: 'NIST',
    version: '1.0.0',
    jurisdiction: 'US',
    coverage: ['policy', 'tests'],
  },
];

describe('RulehubPage basic a11y hints', () => {
  it('renders title and footer links with accessible labels', async () => {
    const { RulehubPage } = await import('../src/routes');
    mockGetIndex.mockResolvedValue(packs);

    render(<RulehubPage />);

    // Table title should be available by test id from component pattern
    expect(await screen.findByTestId('table-title')).toBeInTheDocument();

    // Footer links should be present and have aria-labels
    const footer = await screen.findByTestId('footer-links');
    expect(footer).toBeInTheDocument();

    // Check presence of links by role and label
    expect(screen.getByRole('link', { name: /rulehub plugin/i })).toBeInTheDocument();
    // Narrow to the org link (avoid matching "RuleHub Plugin")
    expect(screen.getByRole('link', { name: /^rulehub$/i })).toBeInTheDocument();
    // "Request Customisation" link removed per updated footer copy
    // No assertions on coverage values: Coverage column/filter removed from UI
  });
});
