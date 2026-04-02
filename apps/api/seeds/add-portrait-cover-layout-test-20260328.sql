INSERT OR REPLACE INTO posts (
  id,
  slug,
  title,
  subtitle,
  excerpt,
  content_json,
  category_id,
  cover_image,
  cover_alt,
  youtube_url,
  status,
  published_at,
  created_at,
  updated_at
) VALUES (
  'post-portrait-cover-layout-test',
  'portrait-cover-layout-test',
  '세로 대표 이미지 레이아웃 검증',
  '세로형 대표 이미지가 잘리지 않고 본문 흐름과 자연스럽게 맞물리는지 확인하는 검증 글',
  '실제 문제였던 프로덕션 글과 비슷한 세로 대표 이미지 상황을 로컬에서 다시 확인하기 위한 검증용 글입니다.',
  json_object(
    'markdown',
    '# 세로 대표 이미지 레이아웃 검증

대표 이미지가 세로형일 때 본문 시작부 오른쪽에 붙고, 초반 문단이 자연스럽게 흐르는지 확인합니다.

출퇴근길 메모처럼 짧은 생활 기록 글에서는 대표 이미지를 크게 단독 배치하는 것보다, 본문 옆에 두고 읽기 흐름을 유지하는 편이 더 적합합니다.

이미지 높이가 끝나면 본문은 전체 너비로 이어져야 합니다. 이 문단은 플로트가 해제된 뒤의 읽기 폭을 확인하기 위한 문단입니다.

## 본문 이미지

![본문 참고 이미지](https://placehold.co/1200x800/f3efe7/2c241d.png?text=Body+Reference+Image)

본문 이미지도 잘리지 않고 전체 비율이 유지되어야 합니다.

## 마무리

세로 대표 이미지가 있는 글에서도 정보 손실 없이 전체가 보여야 하며, 카드 썸네일과 상세 이미지는 서로 다른 정책을 유지해야 합니다.'
  ),
  'cat-donggri-daily',
  'https://placehold.co/900x1600/e9e1d6/2c241d.png?text=Portrait+Cover+Image+Should+Not+Crop',
  '세로 대표 이미지 검증용 표지',
  null,
  'published',
  '2026-03-28T14:20:00+09:00',
  '2026-03-28T14:20:00+09:00',
  '2026-03-28T14:20:00+09:00'
);
