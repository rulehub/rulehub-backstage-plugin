import React from 'react';
import { Link } from '@backstage/core-components';
import { useI18n } from './i18n';

export const RulehubFooter = (): React.ReactElement => {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }} data-testid="footer-links">
      {/* Line 1: © YEAR RuleHub • desc • GitHub: RuleHub • Plugin */}
      <div style={{ marginBottom: 4, marginLeft: 6 }}>
        © {year} RuleHub {'•'} <span>{t('footer.rulehub.desc')}</span> {'•'} <span>GitHub: </span>
        <Link to="https://github.com/rulehub" aria-label="RuleHub" title="RuleHub">
          RuleHub
        </Link>{' '}
        {'•'}{' '}
        <Link
          to="https://github.com/rulehub/rulehub-backstage-plugin"
          aria-label="RuleHub Plugin"
          title={t('footer.githubPlugin')}
        >
          {t('footer.githubPlugin')}
        </Link>
      </div>

      {/* Line 2: See also CostScope • Plugin • CostScope desc */}
      <div style={{ marginLeft: 6 }}>
        <span>See also </span>
        <Link to="https://github.com/costscope" aria-label="CostScope" title="CostScope">
          CostScope
        </Link>{' '}
        {'•'}{' '}
        <Link
          to="https://github.com/costscope/costscope-backstage-plugin"
          aria-label="CostScope Plugin"
          title={t('footer.githubPlugin')}
        >
          {t('footer.githubPlugin')}
        </Link>{' '}
        {'•'} <span>{t('footer.costscope.desc')}</span>
      </div>
    </footer>
  );
};
