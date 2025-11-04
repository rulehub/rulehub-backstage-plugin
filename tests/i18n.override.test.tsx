/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { I18nProvider, useI18n, Messages } from '../src/i18n';

const Probe = ({ k }: { k: string }) => {
  const { t } = useI18n();
  return <span data-testid={`t-${k}`}>{t(k)}</span>;
};

describe('I18nProvider overrides and fallbacks', () => {
  it('merges defaults with overrides and falls back to key for unknowns', async () => {
    const overrides: Messages = {
      'footer.githubPlugin': 'Repo',
    };

    render(
      <I18nProvider messages={overrides}>
        <>
          <Probe k="footer.githubPlugin" />
          <Probe k="footer.author" />
          <Probe k="__unknown__" />
        </>
      </I18nProvider>,
    );

    // Overridden key should use provided value
    expect(screen.getByTestId('t-footer.githubPlugin')).toHaveTextContent('Repo');
  // Non-overridden key should come from defaults (English messages.json)
  expect(screen.getByTestId('t-footer.author')).toHaveTextContent('RuleHub');
    // Unknown key should return the key itself
    expect(screen.getByTestId('t-__unknown__')).toHaveTextContent('__unknown__');
  });
});
