# Short example (integration)

Minimal route registration to mount the plugin page in your Backstage app:

```tsx
// packages/app/src/App.tsx (excerpt)
import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { FlatRoutes } from '@backstage/core-app-api';
import { Progress } from '@backstage/core-components';

const RulehubPage = lazy(() =>
  import('@rulehub/rulehub-backstage-plugin').then((m) => ({
    default: (m as any).RulehubPage || (m as any).RulehubComponent,
  })),
);

// add a single route to expose the catalog
<FlatRoutes>
  <Route
    path="/rulehub"
    element={
      <Suspense fallback={<Progress />}>
        <RulehubPage />
      </Suspense>
    }
  />
</FlatRoutes>;
```
