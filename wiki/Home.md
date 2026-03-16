# donggeuri-cloudflare-blog Wiki

## 현재 상태

donggeuri-cloudflare-blog는 Cloudflare 기반의 Public 블로그, Admin CMS, API를 분리한 블로그 워크스페이스입니다.

- Public: `https://donggeuri-blog.pages.dev`
- Admin: `https://donggeuri-admin.pages.dev`
- API: `https://donggeuri-api.wlflqna.workers.dev`

현재는 `pages.dev` / `workers.dev` 조합으로 실배포가 끝난 상태이며, 커스텀 도메인은 나중에 붙일 수 있게 열어 둔 상태입니다.

## 이번에 정리된 것

- 공개 블로그 UI를 과한 매거진형에서 벗겨 내고, 티스토리/워드프레스형의 단순한 리스트 + 사이드바 구조로 재정리했습니다.
- 관리자 로그인 흐름을 `admin.pages.dev -> api.workers.dev` 배포 환경에 맞게 수정했습니다.
- Google / Naver 사이트 검증 메타 태그를 공개 웹에 반영했습니다.
- 관리자 글 편집 화면을 본문 중심 구조로 단순화했습니다.

## 지금 남아 있는 핵심 TODO

- 실제 카테고리, 태그, 샘플 글을 넣고 공개 홈/상세 노출을 검증합니다.
- `/about`, `/search`, `/rss.xml`, `/sitemap.xml`의 placeholder를 실제 기능으로 교체합니다.
- 관리자 에디터에 Markdown 툴바, 미리보기, 임시저장 같은 작성 편의 기능을 보강합니다.
- 미디어 라이브러리, 목록 필터링, 검색 같은 CMS 운영 기능을 다듬습니다.
- 테스트, CI, 로깅, 모니터링을 정리해 운영 안정성을 올립니다.

## 바로 볼 문서

- [README.md](../README.md)
- [남은 작업.md](../남은%20작업.md)
- [Service-Roadmap.md](./Service-Roadmap.md)

## 메모

- 지금 단계에서 구조를 다시 갈아엎을 필요는 없습니다.
- 다음 우선순위는 디자인 재실험보다 실제 콘텐츠 입력과 기능 완성입니다.
