# Public Web App

Cloudflare Pages public frontend for the editorial blog experience.

## Run

- Set `VITE_API_BASE_URL` before starting the app. In local development the app falls back to `http://127.0.0.1:8787`, but deployed environments must set the variable explicitly.
- `pnpm --filter @donggeuri/web dev`
- `pnpm --filter @donggeuri/web build`

## Deployment Notes

- This app owns only the public routes.
- `VITE_ADMIN_APP_URL` is optional and is only used for the external admin link.
- Point `VITE_API_BASE_URL` at the Worker deployment, not at the Pages app itself.
