/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { RulehubPage } from '../src/routes';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient to avoid network
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage smoke', () => {
  beforeEach(() => {
    mockGetIndex.mockResolvedValue([]);
  });

  it('renders title and empty data without crashing', async () => {
    render(<RulehubPage />);
    expect(await screen.findByTestId('table-title')).toHaveTextContent('RuleHub');
    // Footer should render when not loading/error
    expect(await screen.findByTestId('footer-links')).toBeInTheDocument();
  });
});
