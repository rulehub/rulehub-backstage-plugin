import { RulehubContent, type RulehubContentProps } from '../../src/routes';
import { RulehubClient } from '../../src/RulehubClient';
import type { Pack } from '../../src/types';

const REPO_BASE_URL = 'https://rulehub.github.io/rulehub/plugin-index/index.json';
const SOURCE_BASE_URL = 'https://rulehub.github.io/rulehub-charts/plugin-index/index.json';

export const rulehubFixtureRows: Pack[] = [
  {
    id: 'cis.k8s',
    name: 'CIS Kubernetes Benchmark',
    standard: 'CIS',
    version: '1.0.0',
    jurisdiction: 'GLOBAL',
    coverage: ['control-1', 'control-2'],
  } as Pack,
  {
    id: 'iso.27001',
    name: 'ISO 27001 Core',
    standard: 'ISO',
    version: '2022',
    jurisdiction: '',
    coverage: [],
    severity: 'medium' as any,
    industry: ['fintech'] as any,
  } as Pack,
];

class FixtureRulehubClient implements Pick<RulehubClient, 'getIndex'> {
  async getIndex(_url: string, signal?: AbortSignal): Promise<Pack[]> {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }
    return Promise.resolve(rulehubFixtureRows);
  }
}

const fixtureClient: RulehubClient = new (FixtureRulehubClient as any)() as RulehubClient;

const baseProps: RulehubContentProps = {
  indexUrl: 'fixture://mock',
  repoBaseUrl: REPO_BASE_URL,
  sourceBaseUrl: SOURCE_BASE_URL,
  client: fixtureClient,
  bootstrapRows: rulehubFixtureRows,
  disableInitialFetch: true,
  hideFiltersWhileLoading: false,
};

export const buildRulehubContentProps = (
  overrides: Partial<RulehubContentProps> = {},
): RulehubContentProps => ({
  ...baseProps,
  ...overrides,
});

export const fixtureRulehubClient = fixtureClient;
export const fixtureRulehubComponent = RulehubContent;
