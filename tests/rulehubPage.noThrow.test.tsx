/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { RulehubPage } from '../src/routes';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient to avoid network
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage no-throw smoke', () => {
  beforeEach(() => {
    mockGetIndex.mockResolvedValue([]);
  });

  it('does not throw on render with mocked Backstage API', async () => {
    expect(() => render(<RulehubPage />)).not.toThrow();
    await waitFor(() => expect(true).toBe(true));
  });
});
