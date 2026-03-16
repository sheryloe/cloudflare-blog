# API Worker

Cloudflare Worker API for public content delivery and admin operations.

## Run

- `pnpm --filter @donggeuri/api dev`
- `pnpm --filter @donggeuri/api build`

## Required Variables

- `PUBLIC_APP_ORIGIN`
- `ADMIN_APP_ORIGIN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `JWT_SECRET`
- `R2_PUBLIC_BASE_URL`

## Security Notes

- CORS is allowlist-based and does not reflect arbitrary request origins.
- Public routes allow the public and admin frontend origins.
- Admin routes allow only the admin frontend origin.
- Admin sessions use a same-site cookie and are intended for deployments under the same eTLD+1.
