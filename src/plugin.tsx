import { createPlugin, createRoutableExtension } from '@backstage/core-plugin-api';
import { routeRef } from './routes';

/**
 * RuleHub Backstage plugin instance.
 * @public
 */
export const rulehubPlugin = createPlugin({
  id: 'rulehub',
  routes: { root: routeRef },
});

/**
 * Routable extension for mounting the RuleHub page under the plugin route.
 * @public
 */
export const RulehubPage = rulehubPlugin.provide(
  createRoutableExtension({
    name: 'RulehubPage',
    component: () => import('./routes').then((m) => m.RulehubPage),
    mountPoint: routeRef,
  }),
);
