import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderRulehubContentFixture } from '../utils/renderRulehubContentFixture';

const renderDefault = () => renderRulehubContentFixture();

describe('RulehubContent links', () => {
  it('renders Name link with correct href for first row', async () => {
    renderDefault();
    const nameLink = await screen.findByRole('link', { name: 'Open CIS Kubernetes Benchmark' });
    expect(nameLink).toBeInTheDocument();
    expect((nameLink as HTMLAnchorElement).getAttribute('href')).toBe(
      'https://github.com/rulehub/rulehub/tree/HEAD/policies/cis/k8s',
    );
  });

  it('renders ID link with correct href for first row', async () => {
    renderDefault();
    const idLink = await screen.findByRole('link', { name: 'Open cis.k8s' });
    expect(idLink).toBeInTheDocument();
    expect((idLink as HTMLAnchorElement).getAttribute('href')).toBe(
      'https://github.com/rulehub/rulehub/tree/HEAD/policies/cis/k8s',
    );
  });
});
