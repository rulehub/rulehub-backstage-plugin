# Localization overrides

You can override user‑facing messages by wrapping the page with `I18nProvider` and passing custom `messages`:

```tsx
import { I18nProvider, RulehubPage } from '@rulehub/rulehub-backstage-plugin';

const customMessages = { 'table.empty': 'No packages found. Try adjusting filters.' };

<I18nProvider messages={customMessages}>
  <RulehubPage />
</I18nProvider>;
```
