# Donggeuri Cloudflare Blog

Cloudflare-only blog platform workspace based on the architecture docs in `docs/`.

## Architecture

- Cloudflare Pages for the public site and the admin app
- Cloudflare Workers for the JSON API
- Cloudflare D1 for blog metadata and post content
- Cloudflare R2 for media assets

## Workspace Layout

- `apps/web`: Cloudflare Pages frontend for the public blog
- `apps/admin`: Cloudflare Pages frontend for the admin workspace
- `apps/api`: Cloudflare Worker API with D1 and R2 bindings
- `packages/shared`: shared types used by the web app and the worker

## Quick Start

1. Copy `.env.example` into your local environment tooling as needed.
2. Install dependencies with `pnpm install`.
3. Run the API with `pnpm dev:api`.
4. Run the public app with `pnpm dev:web`.
5. Run the admin app with `pnpm dev:admin`.

## Worker API

Implemented routes based on `docs/worker_api.md`:

- `GET /api/public/posts`
- `GET /api/public/posts/:slug`
- `GET /api/public/categories`
- `GET /api/public/categories/:slug/posts`
- `GET /api/public/tags/:slug/posts`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/posts`
- `GET /api/admin/posts/:id`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `GET /api/admin/media`
- `POST /api/admin/media`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `GET /api/admin/tags`
- `POST /api/admin/tags`
- `PUT /api/admin/tags/:id`
- `DELETE /api/admin/tags/:id`

## App Environment

- `apps/web` can optionally use `VITE_ADMIN_APP_URL`
- `apps/admin` can optionally use `VITE_PUBLIC_APP_URL`
- both frontend apps can use `VITE_API_BASE_URL`
