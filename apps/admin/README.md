# Admin App

Cloudflare Pages admin frontend for authentication, content operations, media uploads, and taxonomy management.

## Run

- Set `VITE_API_BASE_URL` before starting the app. In local development the app falls back to `http://127.0.0.1:8787`, but deployed environments must set the variable explicitly.
- `pnpm --filter @donggeuri/admin dev`
- `pnpm --filter @donggeuri/admin build`

## Deployment Notes

- This app owns only the admin routes and session-aware UI.
- `VITE_PUBLIC_APP_URL` is optional and is only used for links back to the public site.
- Admin sessions assume the Worker lives on the same eTLD+1 as the admin app.
