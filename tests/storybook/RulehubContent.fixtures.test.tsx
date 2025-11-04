import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

it('Fixture renders mock packages deterministically', async () => {
  renderRulehubContentFixture();
  expect(await screen.findByText('CIS Kubernetes Benchmark')).toBeInTheDocument();
});
