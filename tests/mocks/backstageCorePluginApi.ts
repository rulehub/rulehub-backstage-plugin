/**
 * Backstage core-plugin-api mock (test-only).
 *
 * Why: the real @backstage/core-plugin-api may ship ESM-only modules which Jest (CJS) cannot
 * import without extra config. We provide minimal stubs consumed by the code under test.
 *
 * Upgrade notes (Backstage may change):
 * - createRouteRef options shape can evolve; we pass through options for tests.
 * - configApiRef/useApi contract may change. We only implement getOptionalString used by code.
 *
 * Minimal exported surface: { createRouteRef, configApiRef, useApi }
 * See tests/setupTests.ts for jest.mock wiring.
 */

export const createRouteRef = (options: any) => options;
export const configApiRef = { id: 'config' } as const;
export const useApi = () => ({
  getOptionalString: (_key: string) => (globalThis as any).__rulehubIndexUrl ?? undefined,
});

export default { createRouteRef, configApiRef, useApi };
