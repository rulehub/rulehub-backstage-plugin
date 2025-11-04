/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RulehubFooter } from '../src/RulehubFooter';
import { I18nProvider } from '../src/i18n';

describe('RulehubFooter', () => {
  it('renders current year and links with descriptions', () => {
    const year = 2025;
    const RealDate = Date;
    // Freeze Date to ensure deterministic year check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).Date = class extends RealDate {
      constructor() {
        super();
        return new RealDate(year, 0, 1) as any;
      }
      static now() {
        return new RealDate(year, 0, 1).getTime();
      }
      static UTC = RealDate.UTC;
      static parse = RealDate.parse;
    } as unknown as DateConstructor;

    render(
      <I18nProvider>
        <RulehubFooter />
      </I18nProvider>,
    );

    expect(screen.getByTestId('footer-links')).toHaveTextContent(`© ${year} RuleHub`);
    // GitHub org link
    expect(screen.getByRole('link', { name: 'RuleHub' })).toHaveAttribute(
      'href',
      'https://github.com/rulehub',
    );
    // Plugin link
    expect(screen.getByRole('link', { name: 'RuleHub Plugin' })).toHaveAttribute(
      'href',
      'https://github.com/rulehub/rulehub-backstage-plugin',
    );
    // Descriptions from i18n
    expect(screen.getByTestId('footer-links')).toHaveTextContent(
      'Open Guardrails for ML & LLM Systems',
    );
    // CostScope description can evolve; assert a stable prefix
    expect(screen.getByTestId('footer-links')).toHaveTextContent(/CostScope is an open FinOps/i);
    // Cross-link plugin URL present
    expect(screen.getByRole('link', { name: 'CostScope Plugin' })).toHaveAttribute(
      'href',
      'https://github.com/costscope/costscope-backstage-plugin',
    );

    // restore Date
    (global as any).Date = RealDate;
  });
});
