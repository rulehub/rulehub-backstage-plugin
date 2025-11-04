# Install & optional automation

## Install into your Backstage app

```bash
npm install @rulehub/rulehub-backstage-plugin
```

Then add a route as shown in:

- `docs/short-example-integration.md` (lazy route)
- `docs/DETAILED_GUIDE.md#full-installation--integration` (full example)

## Optional: assisted wiring (patch your app)

This repo ships a helper script that can patch a Backstage app for you by adding the route, sidebar item, and seeding a demo index:

```bash
npm run install:in-app
```

You’ll be prompted for your app path and a few options. Prefer reviewing changes in git before committing.

## Local demo (no changes to your app)

If you just want to try the plugin quickly without touching your app, see `demo-and-scripts.md` for commands and details.
