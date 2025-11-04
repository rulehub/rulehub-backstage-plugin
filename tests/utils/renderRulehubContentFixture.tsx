import React from 'react';
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RulehubContent, type RulehubContentProps } from '../../src/routes';
import { buildRulehubContentProps } from '../fixtures/rulehubContentFixture';

export type RenderFixtureOptions = {
  props?: Partial<RulehubContentProps>;
};

export type RenderFixtureResult = RenderResult & {
  props: RulehubContentProps;
};

export const renderRulehubContentFixture = (
  options: RenderFixtureOptions = {},
): RenderFixtureResult => {
  const props = buildRulehubContentProps(options.props);
  const rendered = render(
    <MemoryRouter>
      <RulehubContent {...props} />
    </MemoryRouter>,
  );

  return Object.assign(rendered, { props });
};
