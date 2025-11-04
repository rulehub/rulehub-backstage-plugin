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

describe('RulehubPage empty state', () => {
	it('shows empty state when no packages returned', async () => {
		const { RulehubPage } = await import('../src/routes');
		mockGetIndex.mockResolvedValue([]);
		render(<RulehubPage />);
		expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
	});
});
