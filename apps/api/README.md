# Cloudflare Worker API

DonggriArchive 템플릿의 API 서버입니다.  
Public 콘텐츠 조회, Admin 콘텐츠 관리, Blogger 호환 자동화, Integrations API를 제공합니다.

## Local Run (WSL)

```bash
cd /mnt/d/Donggri_Platform/cloudflare-blog
pnpm install
pwsh ./scripts/setup-local-dev.ps1
pnpm --filter @cloudflare-blog/api exec wrangler d1 migrations apply cloudflare-blog --local
pnpm --filter @cloudflare-blog/api dev
```

로컬 문서:

```text
http://127.0.0.1:8787/__api
```

## Required Env

- `PUBLIC_APP_ORIGIN`
- `ADMIN_APP_ORIGIN`
- `BLOGGERGENT_ALLOWED_ORIGIN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `JWT_SECRET`
- `R2_PUBLIC_BASE_URL`
- `AUTOMATION_API_KEY`
- `AUTOMATION_ALLOWED_IPS`

## Route Groups

- `/health`
- `/api/public/*`
- `/api/admin/*`
- `/api/blogger/v3/*`
- `/api/integrations/*`
- `/rss.xml`, `/feed.xml`, `/sitemap.xml`, `/assets/*`

## Auth Rules

- Public: 인증 없음
- Admin: `POST /api/admin/login` 후 세션 쿠키 필요
- Blogger: 세션 쿠키 또는 `x-automation-key`
- Integrations: Integration 인증 헤더(코드의 `requireIntegrationAuth`) 필요

## Reference

- 상세 엔드포인트 문서: `docs/worker_api.md`
- 명령 예시 페이지: `docs/api-command-examples.html`
