# Troubleshooting

- Runtime symptoms (canonical)

| Symptom         | Cause                                      | Fix                                      |
| --------------- | ------------------------------------------ | ---------------------------------------- |
| 404 index URL   | Index not reachable at configured URL      | Fix hosting or update `rulehub.indexUrl` |
| Empty list      | Malformed JSON (missing `packages`)        | Ensure root object has `packages` array  |
| CORS errors     | Served from different origin without proxy | Use Backstage proxy or enable CORS       |
| Type errors     | Version mismatch React/Backstage           | Align with peer dependency ranges        |
| Wrong base path | App served under prefix                    | Set `rulehub.indexUrl` explicitly        |

- Config visibility warning: If you see
  `Failed to read configuration value at 'rulehub.indexUrl' as it is not visible`,
  the Backstage dev server likely needs to reload config schemas. Stop the dev server and run a clean demo reset so the app re-aggregates schemas:

  ```bash
  npm run demo -- --reset
  ```

  Optionally verify the frontend sees your config with:

  ```bash
  cd tmp && corepack enable && corepack yarn backstage-cli config:print --frontend | grep -A3 "rulehub:"
  ```

- Backend-related console noise (401/WS errors): These are safe to ignore in frontend-only mode. To quiet them, start the demo backend in another terminal:

  ```bash
  cd tmp && corepack enable && corepack yarn workspace backend start
  ```

  Or disable specific backend features in `tmp/app-config.local.yaml` (for example, signals are already disabled by default).

## Notes

- The `tmp/` app is ignored by git and can be safely removed; it won’t affect your existing Backstage apps.
- First run may take a few minutes while dependencies are installed (Corepack + Yarn 4).
- The demo backend ships with a development-only secret (`dev-backend-secret`) configured in `tmp/app-config.local.yaml`. Override it by exporting `BACKEND_SECRET` before starting the app if you need a different value.
- Both flows use your host React/Backstage versions to avoid duplicate React issues.
