# donggeuri-cloudflare-blog Service Roadmap

## 서비스 목표

Cloudflare 환경에서 Public 블로그와 Admin CMS, API를 분리해 운영하면서도, 실제 글 작성과 발행 흐름이 가볍고 안정적으로 이어지는 블로그 플랫폼으로 정리합니다.

## 현재 스냅샷

- Public / Admin / API 실배포 완료
- `pages.dev` / `workers.dev` 환경에서 관리자 로그인 동작 보정 완료
- 공개 블로그를 단순한 블로그형 구조로 재정리 완료
- 기본 메타 검증 태그 반영 완료

## 완료된 항목

- Cloudflare Pages / Workers / D1 / R2 연결
- 공개 홈, 글 상세, 카테고리/태그 아카이브 구현
- 관리자 로그인, 글 CRUD, 카테고리/태그 관리, R2 업로드 구현
- 공개 웹과 관리자 앱의 1차 UI 정리
- 배포 경계 보강과 인증/CORS 수정

## Next

### P0. 운영 가능한 상태 만들기

- 실제 카테고리, 태그, 샘플 글 입력
- 관리자에서 발행한 글이 공개 홈과 상세에 정상 노출되는지 확인
- 커버 이미지 업로드와 공개 반영 확인
- 관리자 로그인, 세션 유지, 로그아웃 흐름 재검증

### P1. 공개 블로그 완성도 올리기

- `/about` 실제 소개 페이지 구현
- `/search` 실제 검색 API 및 UI 구현
- `/rss.xml` 생성
- `/sitemap.xml` 생성

### P2. 관리자 작성 경험 개선

- Markdown 툴바 추가
- 미리보기 또는 split view 추가
- 임시저장 / 저장 상태 표시 강화
- slug 생성 및 수정 UX 개선
- 목록 필터링, 정렬, 검색 추가

### P3. 콘텐츠 모델 확장

- series 기능 연결
- related posts 추천 규칙 연결
- 예약 발행 정책과 UI 연결

## Ops

- Worker API 테스트와 관리자 E2E 테스트 추가
- GitHub Actions 기반 `pnpm build` / 검증 파이프라인 정리
- Worker 에러 로깅, health check, 기본 모니터링 정리
- 커스텀 도메인으로 옮길 경우 same-site 쿠키 기준으로 재검증

## 메모

- 지금은 재설계보다 기능 비우기 제거와 실제 운영 준비가 더 중요합니다.
- 현재 배포 구조에서는 토큰 기반 관리자 인증이 맞고, 커스텀 도메인 전환 시 쿠키 전략을 다시 단순화할 수 있습니다.
