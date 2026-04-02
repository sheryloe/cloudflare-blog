# Cloudflare 확장 우선순위 (댓글 외)

## 기준
- 현재 스택: `apps/web + apps/admin + apps/api`
- 목표: 취약면 최소화, 광고/3rd-party 도입 시 제어 강화, 운영 가시성 확보

## 우선순위
1. `WAF + Rate Limiting` (즉시)
2. `Turnstile` (폼/댓글 입력 경로가 생기는 시점)
3. `Zaraz` (광고/3rd-party 스크립트 도입 단계)
4. `Web Analytics` 운영 점검 (상시)

## 적용 시점 가이드

### 1) WAF + Rate Limiting
- 적용 시점: 지금
- 대상:
  - `/api/admin/login`
  - `/api/public/posts/:slug/view`
- 상태: API 레벨 기본 rate-limit 적용 완료. Cloudflare 대시보드 규칙으로 추가 강화 권장.

### 2) Turnstile
- 적용 시점: 사용자 입력 폼(문의/제보/자체 댓글/회원가입)이 생기면 즉시
- 대상:
  - 공개 폼 POST 엔드포인트 전부
- 메모: 현재 giscus는 GitHub Discussions 기반이므로 자체 댓글 저장소 취약면이 낮음.

### 3) Zaraz
- 적용 시점: 광고/서드파티 태그 도입 단계
- 대상:
  - 광고 스크립트, 마케팅 픽셀, 실험 도구
- 메모: 태그를 앱 코드에서 직접 삽입하지 않고 Zaraz로 중앙 통제.

### 4) Web Analytics 운영 점검
- 적용 시점: 상시
- 점검 항목:
  - 트래픽 급증/봇 유입 패턴
  - 특정 경로(로그인/조회수) 이상치
  - 배포 후 이벤트 누락 여부

## 댓글 채널 선택 메모
- 권장: `giscus` (GitHub Discussions 연동)
- 이유:
  - 자체 댓글 DB/인증/스팸 필터 구현 부담 축소
  - GitHub 권한 체계 재사용
  - 운영/백업 복잡도 감소
