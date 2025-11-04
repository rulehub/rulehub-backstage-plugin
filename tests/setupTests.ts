/**
 * Global Jest test setup
 *
 * Purpose
 * - Provide lightweight mocks for Backstage libs to avoid pulling heavy UI deps (Material UI, material-table)
 *   and ESM-only modules into the Jest (CJS) environment.
 * - Centralize all Backstage-related stubs so future Backstage upgrades require changes in one place.
 *
 * Where to change on Backstage upgrade
 * - @backstage/core-components → Table/Progress/WarningPanel/Button:
 *   If Backstage refactors Table (e.g., material-table → MUI DataGrid) or alters props,
 *   update tests/mocks/backstageCoreComponents.ts accordingly. Keep the minimal surface that tests need.
 * - @backstage/core-plugin-api → createRouteRef/configApiRef/useApi:
 *   If the shape or usage changes, update tests/mocks/backstageCorePluginApi.ts to match.
 *
 * Notes
 * - We keep mock implementations tiny and deterministic with data-testid hooks so tests assert behavior
 *   without coupling to 3rd-party widget internals.
 */
import '@testing-library/jest-dom';
import React from 'react';

// Optional: declare a test-only global used by the configApi mock for clarity/TS hints
declare global {
  // When set in tests, configApi.getOptionalString('rulehub.indexUrl') returns this value
  // See tests/mocks/backstageCorePluginApi.ts
  // eslint-disable-next-line no-var
  var __rulehubIndexUrl: string | undefined;
}

// Mock @backstage/core-components (material-table / MUI avoided)
// NOTE on upgrades: If Backstage migrates Table or other components, update tests/mocks/backstageCoreComponents.ts
jest.mock('@backstage/core-components', () => {
  // require to get transpiled JS; default because the mock file uses ESM default export
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('./mocks/backstageCoreComponents').default;
  return mod;
});

// Mock @backstage/core-plugin-api (ESM-only in some versions)
// NOTE on upgrades: If createRouteRef/configApiRef/useApi contracts change, adjust tests/mocks/backstageCorePluginApi.ts
jest.mock('@backstage/core-plugin-api', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('./mocks/backstageCorePluginApi');
  return mod;
});

// Mock @backstage/core-app-api (ESM in Node); provide a minimal ApiProvider for UI tests
jest.mock('@backstage/core-app-api', () => {
  // Provide a tiny ApiProvider that just renders children; avoids ESM deps in Jest
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return {
    ApiProvider: (props: any) => React.createElement(React.Fragment, null, props.children),
  };
});

// Silence a specific, expected warning from routes when tests intentionally feed invalid JSON
// to `rulehub.links.perIdJson` to verify fallback behavior. Keep other warnings intact.
const originalWarn = globalThis.console.warn;
beforeAll(() => {
  jest.spyOn(globalThis.console, 'warn').mockImplementation((...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes('[RuleHub] Invalid rulehub.links.perIdJson')) {
      return;
    }
    // pass through other warnings
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    originalWarn.apply(globalThis.console, args as any);
  });
});

afterAll(() => {
  (globalThis.console.warn as any).mockRestore?.();
});
