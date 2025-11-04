import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

test('Default fixture renders under MemoryRouter wrapper', async () => {
  renderRulehubContentFixture();
  expect(await screen.findByText('CIS Kubernetes Benchmark')).toBeInTheDocument();
});
