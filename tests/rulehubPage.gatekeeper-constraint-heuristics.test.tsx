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

describe('Gatekeeper constraint placeholder heuristics', () => {
  beforeEach(() => {
    mockGetIndex.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('links Gatekeeper for <domain>.constraint.placeholder', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'betting.constraint.placeholder',
        name: 'Betting — Constraint',
        standard: 'N/A',
        version: '0.0.0',
        coverage: ['policy'],
      },
    ]);

    render(<RulehubPage />);

    const gatekeeper = await screen.findByRole('link', { name: /open gatekeeper/i });
    expect(gatekeeper).toBeInTheDocument();
    expect(gatekeeper.getAttribute('href') || '').toContain(
      '/files/gatekeeper/betting-constraint.yaml',
    );
    // Kyverno should not be present
    expect(screen.queryByRole('link', { name: /open kyverno/i })).not.toBeInTheDocument();
  });

  it('links Gatekeeper templates for <domain>.constraint.template.placeholder', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'betting.constraint.template.placeholder',
        name: 'Betting — Constraint',
        standard: 'N/A',
        version: '0.0.0',
        coverage: ['policy'],
      },
    ]);

    render(<RulehubPage />);

    const gatekeeper = await screen.findByRole('link', { name: /open gatekeeper/i });
    expect(gatekeeper).toBeInTheDocument();
    expect(gatekeeper.getAttribute('href') || '').toContain(
      '/files/gatekeeper-templates/betting-constraint-template.yaml',
    );
    // Kyverno should not be present
    expect(screen.queryByRole('link', { name: /open kyverno/i })).not.toBeInTheDocument();
  });

  it('links Gatekeeper template for <domain>.<name>.template even without engine paths', async () => {
    const { RulehubPage } = await import('../src/routes');

    mockGetIndex.mockResolvedValue([
      {
        id: 'ban.hostnetwork.template',
        name: 'Ban — Hostnetwork',
        standard: 'N/A',
        version: '0.0.0',
        coverage: ['policy'],
        // no paths -> ensures we do not depend on detection
      },
    ]);

    render(<RulehubPage />);

    const gatekeeper = await screen.findByRole('link', { name: /open gatekeeper/i });
    expect(gatekeeper).toBeInTheDocument();
    expect(gatekeeper.getAttribute('href') || '').toContain(
      '/files/gatekeeper-templates/ban-hostnetwork-template.yaml',
    );
  });
});
