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
2. Set `PUBLIC_APP_ORIGIN`, `ADMIN_APP_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `JWT_SECRET` for the Worker.
3. Set `VITE_API_BASE_URL` for both frontend apps.
4. Install dependencies with `pnpm install`.
5. Run the API with `pnpm dev:api`.
6. Run the public app with `pnpm dev:web`.
7. Run the admin app with `pnpm dev:admin`.

## Security And Deployment Assumptions

- `apps/web`, `apps/admin`, and `apps/api` are separate deployment units.
- Admin sessions use an HTTP-only cookie with `SameSite=Lax`.
- The supported production model is same-site deployment under the same eTLD+1:
  `blog.example.com`, `admin.example.com`, and `api.example.com`.
- `pages.dev` and `workers.dev` on unrelated hostnames are not an officially supported admin session setup.
- `VITE_API_BASE_URL` is required in practice for both frontend apps. The only implicit fallback is local development against `http://127.0.0.1:8787`.
- Worker CORS is allowlist-based and uses `PUBLIC_APP_ORIGIN` and `ADMIN_APP_ORIGIN`.

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

- `apps/web` should set `VITE_API_BASE_URL` and can optionally set `VITE_ADMIN_APP_URL`
- `apps/admin` should set `VITE_API_BASE_URL` and can optionally set `VITE_PUBLIC_APP_URL`
- `apps/api` should set `PUBLIC_APP_ORIGIN`, `ADMIN_APP_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, and `R2_PUBLIC_BASE_URL`

## Cloudflare Setup

- Cloudflare Pages for `apps/web`
  - set `VITE_API_BASE_URL`
  - optionally set `VITE_ADMIN_APP_URL`
- Cloudflare Pages for `apps/admin`
  - set `VITE_API_BASE_URL`
  - optionally set `VITE_PUBLIC_APP_URL`
- Cloudflare Worker for `apps/api`
  - set `PUBLIC_APP_ORIGIN`
  - set `ADMIN_APP_ORIGIN`
  - set `ADMIN_EMAIL`
  - set `ADMIN_PASSWORD_HASH`
  - set `JWT_SECRET`
  - set `R2_PUBLIC_BASE_URL`
