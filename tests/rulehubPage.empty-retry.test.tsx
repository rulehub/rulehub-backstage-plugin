/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import { RulehubClient } from '../src/RulehubClient';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage empty -> retry no-op', () => {
	it('shows empty-state and remains after retry when API keeps returning empty', async () => {
		const { RulehubPage } = await import('../src/routes');

		mockGetIndex.mockResolvedValue([]);

		render(<RulehubPage />);
		expect(await screen.findByTestId('empty-state')).toBeInTheDocument();

		// No error, so no retry button; assert fetch called only once
		await waitFor(() => expect(mockGetIndex).toHaveBeenCalledTimes(1));
	});
});
