# Dev Container (VS Code)

If you open this repo in a VS Code Dev Container, the container no longer performs heavy installs automatically. Run setup commands manually inside the container terminal:

```bash
# inside the container shell
corepack enable
npm ci

# optional: quick quality pass (lint + typecheck + tests)
npm run verify

# optional: build the package (produces production bundles in dist/, useful before size/API checks or when consuming the package outside the repo)
npm run build
```

Notes:

- The previous automatic steps (npm ci, init script) were removed from `.devcontainer/devcontainer.json` to speed up container startup and give you control over when to install dependencies.
- If you still need the custom initialization logic, you can invoke it manually:

  ```bash
  bash .devcontainer/init.sh
  ```

  This script is optional and not required for typical development flows.
