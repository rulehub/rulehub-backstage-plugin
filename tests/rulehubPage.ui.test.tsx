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

describe('RulehubPage UI components presence', () => {
	it('renders Progress during loading via data-testid wrapper', async () => {
		const { RulehubPage } = await import('../src/routes');
		mockGetIndex.mockResolvedValue([]);
		render(<RulehubPage />);
		expect(screen.getByTestId('loading')).toBeInTheDocument();
		// Wait for the next settled state to avoid act warnings from async updates
		await screen.findByTestId('table-title');
	});
});
