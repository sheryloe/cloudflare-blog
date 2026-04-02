# Environment Variables

## Local development files

- `apps/api/.dev.vars`
- `apps/web/.env`
- `apps/admin/.env`

Use the matching `*.example` files or run `pwsh ./scripts/setup-local-dev.ps1`.

## API Worker (`apps/api/.dev.vars`)

- `PUBLIC_APP_ORIGIN`
- `ADMIN_APP_ORIGIN`
- `R2_PUBLIC_BASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `JWT_SECRET`

## Public Web (`apps/web/.env`)

- `VITE_API_BASE_URL`
- `VITE_ADMIN_APP_URL`
- `VITE_GA_MEASUREMENT_ID` (optional)
- `VITE_GISCUS_REPO` (optional)
- `VITE_GISCUS_REPO_ID` (optional)
- `VITE_GISCUS_CATEGORY` (optional)
- `VITE_GISCUS_CATEGORY_ID` (optional)
- `VITE_GISCUS_MAPPING` (optional, default: `pathname`)
- `VITE_GISCUS_THEME` (optional, default: `light`)

## Admin App (`apps/admin/.env`)

- `VITE_API_BASE_URL`
- `VITE_PUBLIC_APP_URL`

## Template Note

- Search Console / Naver verification meta and custom domains are intentionally not baked into the public template.
- Put those values in your private deployment repo or deployment-specific build configuration.
