/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex } as any;
(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('Gatekeeper template heuristic (three-part ID)', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    // Ensure clean URL without debug
    window.history.replaceState({}, '', '/');
  });

  it('renders Gatekeeper link for <domain>.<name>.template when templates are detected', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'ban.hostnetwork.template',
        name: 'Ban — Hostnetwork',
        standard: 'N/A',
        version: '0.0.0',
        coverage: ['policy'],
        // Generic paths containing '/templates/' should enable Gatekeeper detection
        paths: [{ path: 'some/path/templates/hostnetwork_template.yaml', exists: true }],
      },
    ]);

    render(<RulehubPage />);

    const source = await screen.findByTestId('source-links');
    expect(source).toBeInTheDocument();

    // Kyverno should likely be absent
    expect(screen.queryByRole('link', { name: /open kyverno/i })).not.toBeInTheDocument();

    // Gatekeeper link should be present and target gatekeeper-templates location
    const gatekeeper = await screen.findByRole('link', { name: /open gatekeeper/i });
    expect(gatekeeper).toBeInTheDocument();
    const href = gatekeeper.getAttribute('href') || '';
    expect(href).toContain('/files/gatekeeper-templates/ban-hostnetwork-template.yaml');
  });
});
