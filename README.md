# Trajecta

This repository is configured to deploy automatically to **GitHub Pages**.

## GitHub Pages deployment

1. Push to the `main` branch.
2. GitHub Actions runs `.github/workflows/deploy-pages.yml`.
3. The workflow builds the Vite app with `pnpm build:pages`.
4. The output from `dist/public` is deployed to Pages.

### Notes

- Client-side routing is supported using the included SPA fallback scripts in `index.html` and `404.html`.
- A `.nojekyll` file is included in `client/public` so static assets with underscores work correctly on Pages.
- Root-level `index.html` and `404.html` are included to redirect GitHub Pages branch-based hosting to `/docs`, so you do not land on the README page.
- On `*.github.io`, auth calls are disabled and the UI shows a clear demo-mode message so the app does not error due to missing backend APIs.
