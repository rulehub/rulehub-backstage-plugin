import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

test('RulehubContent Default story shows mock packages', async () => {
  renderRulehubContentFixture();
  expect(await screen.findByText('CIS Kubernetes Benchmark')).toBeInTheDocument();
});
