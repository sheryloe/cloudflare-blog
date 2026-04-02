# Public Web App

Cloudflare Pages public frontend for the editorial blog experience.

## Run

- Copy `apps/web/.env.example` to `apps/web/.env`, or run `pwsh ./scripts/setup-local-dev.ps1` from the repo root.
- Set `VITE_API_BASE_URL` before starting the app. In local development the app falls back to `http://127.0.0.1:8787`, but deployed environments must set the variable explicitly.
- `pnpm --filter @cloudflare-blog/web dev`
- `pnpm --filter @cloudflare-blog/web build`

## Deployment Notes

- This app owns only the public routes.
- `VITE_ADMIN_APP_URL` is optional and is only used for the external admin link.
- `VITE_GA_MEASUREMENT_ID` is optional and enables GA4 when set.
- giscus comments are optional and only render on post detail routes when all giscus env vars are configured.
- Point `VITE_API_BASE_URL` at the Worker deployment, not at the Pages app itself.
- RSS/feed/sitemap XML are served by the Worker, and the public app links to those Worker endpoints.
