import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import { RulehubContent } from '../src/routes';
import type { Pack } from '../src/types';

class MockClient {
  async getIndex(_url: string, _signal?: AbortSignal): Promise<Pack[]> {
    return [];
  }
}

describe('RulehubContent (standalone)', () => {
  it('does not throw on render without Backstage providers', async () => {
    expect(() => render(<RulehubContent client={new MockClient() as any} indexUrl="/test.json" />)).not.toThrow();
    // allow initial state updates to flush
    await waitFor(() => expect(true).toBe(true));
  });

  it('renders without Backstage providers and shows empty state', async () => {
    render(<RulehubContent client={new MockClient() as any} indexUrl="/test.json" />);

    // Initially shows loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Then shows empty state after mocked client resolves
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
  });
});
