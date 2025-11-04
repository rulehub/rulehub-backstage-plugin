/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { RulehubClient } from '../src/RulehubClient';
import { RulehubError, ERROR_CODES } from '../src/errors';

// Mock RulehubClient
jest.mock('../src/RulehubClient');
const mockGetIndex = jest.fn();
const mockInstance = { getIndex: mockGetIndex };

(RulehubClient as any).instance = mockInstance;
(RulehubClient as any).getIndex = mockGetIndex;

describe('RulehubPage retry logic', () => {
	it('retries fetch after error when clicking Retry', async () => {
		const { RulehubPage } = await import('../src/routes');

		mockGetIndex
			.mockRejectedValueOnce(new RulehubError(ERROR_CODES.INDEX_HTTP_ERROR, 'HTTP 500'))
			.mockResolvedValueOnce([]);

		render(<RulehubPage />);

		// Error first
		const error = await screen.findByTestId('error');
		expect(error).toBeInTheDocument();

		// Click retry via user-event to properly wrap updates in act
		await userEvent.click(screen.getByRole('button', { name: /retry/i }));

		await waitFor(() => expect(mockGetIndex).toHaveBeenCalledTimes(2));
	});
});
