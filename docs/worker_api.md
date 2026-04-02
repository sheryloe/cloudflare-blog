# Worker API Reference

이 문서는 `apps/api` Worker 엔드포인트를 템플릿 기준으로 정리한 API 문서입니다.

## Base URL

- Local: `http://127.0.0.1:8787`
- Production Example: `https://api.example.com`

---

## 1) System Endpoints

### `GET /health`

- 설명: 헬스체크
- 인증: 없음
- 응답 예시:

```json
{
  "ok": true,
  "data": {
    "status": "ok"
  }
}
```

### `GET /__api`

- 설명: 로컬 전용 API 문서 HTML
- 인증: 없음
- 주의: 로컬 요청(`localhost`, `127.0.0.1`)에서만 접근 가능

---

## 2) Public API (`/api/public`)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/public/posts` | 공개 게시글 목록 |
| GET | `/api/public/posts/top?limit=5` | 조회수 상위 게시글 |
| GET | `/api/public/posts/:slug` | 게시글 상세 |
| POST | `/api/public/posts/:slug/view` | 조회수 증가 |
| GET | `/api/public/search?q=keyword` | 게시글 검색 |
| GET | `/api/public/categories` | 카테고리 목록 |
| GET | `/api/public/categories/:slug/posts` | 카테고리별 게시글 |
| GET | `/api/public/tags/:slug/posts` | 태그별 게시글 |
| GET | `/api/public/site-settings` | 사이트 설정 |

### Public XML/Asset

| Method | Path | 설명 |
|---|---|---|
| GET | `/rss.xml` | RSS |
| GET | `/feed.xml` | RSS Alias |
| GET | `/sitemap.xml` | 사이트맵 |
| GET/HEAD | `/assets/*` | R2 프록시 정적 자산 |

---

## 3) Admin API (`/api/admin`)

## Auth

1. `POST /api/admin/login` 로그인
2. 세션 쿠키 기반으로 보호 라우트 접근
3. 로그아웃: `POST /api/admin/logout`

### 인증 관련

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/admin/login` | 관리자 로그인 |
| POST | `/api/admin/logout` | 로그아웃 |
| GET | `/api/admin/session` | 세션 상태 조회 |

### 게시글

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/posts` | 게시글 목록 |
| GET | `/api/admin/posts/:id` | 게시글 상세 |
| POST | `/api/admin/posts` | 게시글 생성 |
| PUT | `/api/admin/posts/:id` | 게시글 수정 |
| DELETE | `/api/admin/posts/:id` | 게시글 삭제 |
| POST | `/api/admin/posts/upsert-by-slug` | 자동화 키 기반 업서트 |
| POST | `/api/admin/posts/upsert-by-slug/manual` | 세션 기반 업서트 |

### 분류/태그

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/categories` | 카테고리 목록 |
| POST | `/api/admin/categories` | 카테고리 생성 |
| PUT | `/api/admin/categories/:id` | 카테고리 수정 |
| DELETE | `/api/admin/categories/:id` | 카테고리 삭제 |
| GET | `/api/admin/tags` | 태그 목록 |
| POST | `/api/admin/tags` | 태그 생성 |
| PUT | `/api/admin/tags/:id` | 태그 수정 |
| DELETE | `/api/admin/tags/:id` | 태그 삭제 |

### 미디어/설정

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/media` | 미디어 목록 |
| POST | `/api/admin/media` | 미디어 업로드 |
| PUT | `/api/admin/media/:id` | 미디어 메타 업데이트 |
| GET | `/api/admin/site-settings` | 사이트 설정 조회 |
| PUT | `/api/admin/site-settings` | 사이트 설정 수정 |
| POST | `/api/admin/link-preview` | 외부 링크 프리뷰 생성 |

---

## 4) Blogger-Compatible API (`/api/blogger/v3`)

지원 블로그 ID: `self`, `dongriarchive`

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/blogger/v3/blogs/:blogId/posts` | Blogger 호환 게시글 목록 |
| POST | `/api/blogger/v3/blogs/:blogId/posts` | 게시글 생성/업데이트(슬러그 기준) |
| GET | `/api/blogger/v3/blogs/:blogId/labels` | 라벨 목록 |
| GET | `/api/blogger/v3/blogs/:blogId/categories` | 카테고리 목록 |

### 인증

- `x-automation-key` 헤더 또는 관리자 세션 쿠키
- `x-automation-key` 사용 시 `AUTOMATION_ALLOWED_IPS` allowlist 검사

---

## 5) Integrations API (`/api/integrations`)

`requireIntegrationAuth` 미들웨어 통과가 필수입니다.

### 콘텐츠

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/integrations/posts` | 연동용 게시글 목록 |
| GET | `/api/integrations/posts/:id` | 연동용 게시글 상세 |
| POST | `/api/integrations/posts` | 연동용 게시글 생성 |
| PUT | `/api/integrations/posts/:id` | 연동용 게시글 수정 |
| GET | `/api/integrations/post-categories` | 게시글 카테고리 목록 |
| GET | `/api/integrations/categories` | 프롬프트 카테고리 목록 |

### 자동화 런/플랜

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/integrations/runs?limit=30` | 자동화 실행 이력 조회 |
| POST | `/api/integrations/runs` | 자동화 실행 이력 생성 |
| PUT | `/api/integrations/runs/:id` | 자동화 실행 이력 수정 |
| GET | `/api/integrations/automation-plan` | 자동화 계획 조회 |
| POST | `/api/integrations/automation-plan` | 자동화 계획 일괄 교체 |
| PUT | `/api/integrations/automation-plan/:id` | 자동화 계획 항목 수정 |

### 프롬프트/카탈로그

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/integrations/prompts` | 프롬프트 카테고리/템플릿 조회 |
| PUT | `/api/integrations/prompts/:category/:stage` | 프롬프트 템플릿 업데이트 |
| GET | `/api/integrations/prompt-catalog` | 프롬프트 카탈로그 조회 |
| POST | `/api/integrations/prompt-catalog/sync` | 프롬프트 카탈로그 동기화 |

### 기타

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/integrations/site-settings` | 사이트 설정 조회 |
| POST | `/api/integrations/assets` | 연동용 자산 업로드 |

---

## 6) 공통 응답 형식

성공:

```json
{
  "ok": true,
  "data": {}
}
```

실패:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message"
  }
}
```

---

## 7) 보안/운영 정책

- CORS allowlist 기반 (`PUBLIC_APP_ORIGIN`, `ADMIN_APP_ORIGIN`, `BLOGGERGENT_ALLOWED_ORIGIN`)
- Admin 로그인/자동화 요청 rate-limit 적용
- 자동화 경로는 `AUTOMATION_API_KEY` + 허용 IP 조건 충족 필요
- 템플릿 공개 저장소에는 실제 비밀키/리소스 ID 포함 금지

---

## 8) 빠른 검증 시나리오

```bash
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8787/api/public/posts
curl -s "http://127.0.0.1:8787/api/public/search?q=cloudflare"
```

추가 예시는 `docs/api-command-examples.html` 참고.
