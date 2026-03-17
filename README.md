# Donggeuri Cloudflare Blog

Cloudflare Pages, Workers, D1, R2를 사용해 공개 블로그와 관리자 CMS를 분리하는 블로그 플랫폼 실험 저장소입니다.

- 저장소: `https://github.com/sheryloe/donggeuri-cloudflare-blog`

## 서비스 개요

- 공개 사이트와 관리자 앱, API를 독립 배포 단위로 분리합니다.
- Cloudflare 네이티브 스택만으로 블로그 운영 구조를 구성하는 것이 목표입니다.
- 향후 다중 사이트 운영이나 경량 CMS로 확장하기 좋은 기반을 갖고 있습니다.

## 워크스페이스 구성

- `apps/web`: 공개 블로그 프런트엔드
- `apps/admin`: 관리자 앱
- `apps/api`: D1/R2 바인딩을 사용하는 Worker API
- `packages/shared`: 공용 타입

## 보안 전제

- 관리자 세션은 HTTP-only cookie 기준입니다.
- 같은 eTLD+1 아래에서 Public/Admin/API를 분리하는 배포 모델을 권장합니다.
- Worker CORS는 허용 목록 기반으로 동작합니다.

## 구현된 API

- Public posts/categories/tags/search 조회
- Admin login/logout/session
- Admin posts CRUD
- Admin media CRUD
- Admin categories/tags CRUD
- Worker RSS / sitemap XML
- Worker asset proxy (`/assets/*`)

## 실행 방법

```bash
pnpm install
pwsh ./scripts/setup-local-dev.ps1
pnpm --filter @donggeuri/api exec wrangler d1 migrations apply donggeuri-blog --local
pnpm dev:api
pnpm dev:web
pnpm dev:admin
```

- 로컬 설정 예제는 `apps/api/.dev.vars.example`, `apps/web/.env.example`, `apps/admin/.env.example`를 참고합니다.

## 공개 블로그 분석/SEO 설정

- 공개 블로그는 Cloudflare Pages advanced mode `_worker.js`로 초기 HTML head를 라우트별로 주입합니다.
- Pages 프로젝트 `donggeuri-blog`에는 런타임 변수 `API_ORIGIN`을 `https://donggeuri-api.wlflqna.workers.dev`로 설정하는 것을 권장합니다.
- 공개 웹 빌드 환경 변수 `VITE_GA_MEASUREMENT_ID`에 `G-XXXXXXXXXX` 형식의 GA4 측정 ID를 넣으면 Google tag가 활성화됩니다.
- 측정 ID가 비어 있으면 Google Analytics 코드는 로드되지 않습니다.
- `/search`와 `/tag/*`는 `noindex,follow`로 유지하고, sitemap에는 홈, 소개, 카테고리, 글 상세만 포함합니다.
- `robots.txt`, `rss.xml`, `sitemap.xml`은 `https://donggeuri-blog.pages.dev` 기준으로 노출됩니다.

## 검색 노출 운영 체크리스트

- Google Analytics
  - GA4 속성과 웹 데이터 스트림을 만든 뒤 `VITE_GA_MEASUREMENT_ID`를 Pages build env에 등록합니다.
  - 배포 후 Tag Assistant와 GA4 Realtime에서 `page_view`를 확인합니다.
- Cloudflare Web Analytics
  - `Workers & Pages > donggeuri-blog > Metrics > Web Analytics`에서 활성화합니다.
- Google Search Console
  - `https://donggeuri-blog.pages.dev/sitemap.xml`을 제출하고 홈, 대표 카테고리, 대표 글 URL을 검사합니다.
- Naver Search Advisor
  - 사이트맵 제출 후 주요 카테고리와 글 상세 URL을 검사합니다.

## 다음 단계

- 예약 발행, 초안 상태, 미리보기 추가
- 관리자 감사 로그와 역할 분리 강화
- 대표 글 큐레이션, OG 이미지 고도화, 검색 결과 품질 개선
