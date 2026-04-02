INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at)
VALUES
  ('cat-tech-useful-info', '유용한-정보', '유용한 정보', '바로 써먹는 팁과 요약 정보', (SELECT id FROM categories WHERE slug = '기술의-기록'), datetime('now'), datetime('now'))
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  parent_id = excluded.parent_id,
  updated_at = excluded.updated_at;

INSERT INTO posts (
  id,
  slug,
  title,
  subtitle,
  excerpt,
  content_json,
  category_id,
  cover_image,
  youtube_url,
  status,
  published_at,
  created_at,
  updated_at
)
VALUES (
  'post-useful-info-20260322',
  '유용한-정보-20260322',
  '하루를 덜 피곤하게 만드는 3분 정보 정리법',
  NULL,
  '정보는 많고 시간은 짧을 때, 3분만 써도 흐름이 정리된다.',
  json_object('markdown', '<p>유용한 정보는 길게 늘어놓는 설명보다 <strong>지금 바로 적용할 수 있는 한 가지</strong>가 더 오래 남는다. 오늘은 하루를 가볍게 만드는 3분 정리법을 기록한다.</p>
<h2>오늘 바로 적용할 3가지</h2>
<ul>
  <li><strong>파일 이름 한 줄 규칙</strong>: 날짜-주제-버전으로 통일한다.</li>
  <li><strong>스크린샷 정리</strong>: 하루에 한 폴더로 묶고 제목만 바꾼다.</li>
  <li><strong>브라우저 탭 정리</strong>: 읽지 않을 탭은 닫고, 남길 탭은 북마크로 이동한다.</li>
</ul>
<h2>3분 루틴</h2>
<ol>
  <li>오늘 저장한 파일 3개만 이름을 고친다.</li>
  <li>스크린샷 폴더 하나를 비운다.</li>
  <li>브라우저 탭을 5개만 남긴다.</li>
</ol>
<h2>오늘의 메모</h2>
<p>정리는 완벽함보다 <strong>가벼움</strong>에 가깝다. 3분만 써도 내일의 피로가 줄어든다.</p>'),
  (SELECT id FROM categories WHERE slug = '유용한-정보'),
  '/images/useful-info-20260322.svg',
  NULL,
  'published',
  '2026-03-22T09:00:00+09:00',
  '2026-03-22T09:00:00+09:00',
  '2026-03-22T09:00:00+09:00'
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  subtitle = excluded.subtitle,
  excerpt = excluded.excerpt,
  content_json = excluded.content_json,
  category_id = excluded.category_id,
  cover_image = excluded.cover_image,
  youtube_url = excluded.youtube_url,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at;
