DELETE FROM post_tags
WHERE post_id IN (
  SELECT id
  FROM posts
  WHERE slug IN (
    'articles-test',
    'guides-test',
    'reviews-test',
    'notes-test',
    'resources-test'
  )
)
OR tag_id IN (
  SELECT id
  FROM tags
  WHERE slug IN (
    'articles-test',
    'guides-test',
    'reviews-test',
    'notes-test',
    'resources-test'
  )
);

DELETE FROM posts
WHERE slug IN (
  'articles-test',
  'guides-test',
  'reviews-test',
  'notes-test',
  'resources-test'
);

DELETE FROM tags
WHERE slug IN (
  'articles-test',
  'guides-test',
  'reviews-test',
  'notes-test',
  'resources-test'
);

DELETE FROM categories
WHERE slug IN (
  'articles',
  'guides',
  'reviews',
  'notes',
  'resources'
);

DELETE FROM post_tags
WHERE post_id IN (
  SELECT id
  FROM posts
  WHERE slug IN (
    'culture-space-test',
    'festivals-seasons-test',
    'events-on-site-test',
    'history-culture-test',
    'issues-analysis-test',
    'mystery-legends-test',
    'stock-trends-test',
    'crypto-trends-test',
    'emerging-tech-tools-test',
    'youtube-reviews-test',
    'writing-analysis-test',
    'development-programming-test',
    'travel-journal-test',
    'daily-notes-test'
  )
);

INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at)
VALUES
  ('cat-info-records', 'info-records', '정보의 기록', '정보와 현장을 차분하게 정리하는 상위 카테고리입니다.', NULL, '2026-03-18T00:00:00.000Z', '2026-03-18T00:00:00.000Z'),
  ('cat-world-records', 'world-records', '세상의 기록', '세상 이슈와 역사, 흥미로운 주제를 모아두는 상위 카테고리입니다.', NULL, '2026-03-18T00:05:00.000Z', '2026-03-18T00:05:00.000Z'),
  ('cat-market-records', 'market-records', '시장의 기록', '시장 흐름과 투자 관찰을 정리하는 상위 카테고리입니다.', NULL, '2026-03-18T00:10:00.000Z', '2026-03-18T00:10:00.000Z'),
  ('cat-tech-records', 'tech-records', '기술의 기록', '기술, 도구, 리뷰와 분석 글을 모으는 상위 카테고리입니다.', NULL, '2026-03-18T00:15:00.000Z', '2026-03-18T00:15:00.000Z'),
  ('cat-donggri-records', 'donggri-records', '동그리의 기록', '개인적인 기록과 개발, 여행, 메모를 모으는 상위 카테고리입니다.', NULL, '2026-03-18T00:20:00.000Z', '2026-03-18T00:20:00.000Z')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  parent_id = NULL,
  updated_at = excluded.updated_at;

INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at)
VALUES
  ('cat-culture-space', 'culture-space', '문화와 공간', '정보의 기록 아래에서 공간과 문화 경험을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'info-records'), '2026-03-18T00:25:00.000Z', '2026-03-18T00:25:00.000Z'),
  ('cat-festivals-seasons', 'festivals-seasons', '축제와 시즌', '정보의 기록 아래에서 시즌 이슈와 축제를 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'info-records'), '2026-03-18T00:30:00.000Z', '2026-03-18T00:30:00.000Z'),
  ('cat-events-on-site', 'events-on-site', '행사와 현장', '정보의 기록 아래에서 현장성 있는 기록을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'info-records'), '2026-03-18T00:35:00.000Z', '2026-03-18T00:35:00.000Z'),
  ('cat-history-culture', 'history-culture', '역사와 문화', '세상의 기록 아래에서 역사와 문화 소재를 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'world-records'), '2026-03-18T00:40:00.000Z', '2026-03-18T00:40:00.000Z'),
  ('cat-issues-analysis', 'issues-analysis', '이슈와 해설', '세상의 기록 아래에서 시사성과 해설형 글을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'world-records'), '2026-03-18T00:45:00.000Z', '2026-03-18T00:45:00.000Z'),
  ('cat-mystery-legends', 'mystery-legends', '미스터리와 전설', '세상의 기록 아래에서 미스터리와 전설 소재를 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'world-records'), '2026-03-18T00:50:00.000Z', '2026-03-18T00:50:00.000Z'),
  ('cat-stock-trends', 'stock-trends', '주식의 흐름', '시장의 기록 아래에서 주식 흐름을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'market-records'), '2026-03-18T00:55:00.000Z', '2026-03-18T00:55:00.000Z'),
  ('cat-crypto-trends', 'crypto-trends', '크립토의 흐름', '시장의 기록 아래에서 크립토 흐름을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'market-records'), '2026-03-18T01:00:00.000Z', '2026-03-18T01:00:00.000Z'),
  ('cat-emerging-tech-tools', 'emerging-tech-tools', '신기술과 도구', '기술의 기록 아래에서 신기술과 도구를 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'tech-records'), '2026-03-18T01:05:00.000Z', '2026-03-18T01:05:00.000Z'),
  ('cat-youtube-reviews', 'youtube-reviews', '유튜브 리뷰', '기술의 기록 아래에서 유튜브 기반 리뷰를 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'tech-records'), '2026-03-18T01:10:00.000Z', '2026-03-18T01:10:00.000Z'),
  ('cat-writing-analysis', 'writing-analysis', '글 분석과 해설', '기술의 기록 아래에서 글 분석과 해설을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'tech-records'), '2026-03-18T01:15:00.000Z', '2026-03-18T01:15:00.000Z'),
  ('cat-development-programming', 'development-programming', '개발과 프로그래밍', '동그리의 기록 아래에서 개발과 프로그래밍을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'donggri-records'), '2026-03-18T01:20:00.000Z', '2026-03-18T01:20:00.000Z'),
  ('cat-travel-journal', 'travel-journal', '여행과 기록', '동그리의 기록 아래에서 여행 기록을 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'donggri-records'), '2026-03-18T01:25:00.000Z', '2026-03-18T01:25:00.000Z'),
  ('cat-daily-notes', 'daily-notes', '일상과 메모', '동그리의 기록 아래에서 일상 메모를 정리하는 하위 카테고리입니다.', (SELECT id FROM categories WHERE slug = 'donggri-records'), '2026-03-18T01:30:00.000Z', '2026-03-18T01:30:00.000Z')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  parent_id = excluded.parent_id,
  updated_at = excluded.updated_at;

INSERT INTO tags (id, slug, name, created_at, updated_at)
VALUES
  ('tag-test-common', 'test', 'test', '2026-03-18T02:00:00.000Z', '2026-03-18T02:00:00.000Z'),
  ('tag-culture-space', 'culture-space', '문화와 공간', '2026-03-18T02:05:00.000Z', '2026-03-18T02:05:00.000Z'),
  ('tag-festivals-seasons', 'festivals-seasons', '축제와 시즌', '2026-03-18T02:10:00.000Z', '2026-03-18T02:10:00.000Z'),
  ('tag-events-on-site', 'events-on-site', '행사와 현장', '2026-03-18T02:15:00.000Z', '2026-03-18T02:15:00.000Z'),
  ('tag-history-culture', 'history-culture', '역사와 문화', '2026-03-18T02:20:00.000Z', '2026-03-18T02:20:00.000Z'),
  ('tag-issues-analysis', 'issues-analysis', '이슈와 해설', '2026-03-18T02:25:00.000Z', '2026-03-18T02:25:00.000Z'),
  ('tag-mystery-legends', 'mystery-legends', '미스터리와 전설', '2026-03-18T02:30:00.000Z', '2026-03-18T02:30:00.000Z'),
  ('tag-stock-trends', 'stock-trends', '주식의 흐름', '2026-03-18T02:35:00.000Z', '2026-03-18T02:35:00.000Z'),
  ('tag-crypto-trends', 'crypto-trends', '크립토의 흐름', '2026-03-18T02:40:00.000Z', '2026-03-18T02:40:00.000Z'),
  ('tag-emerging-tech-tools', 'emerging-tech-tools', '신기술과 도구', '2026-03-18T02:45:00.000Z', '2026-03-18T02:45:00.000Z'),
  ('tag-youtube-reviews', 'youtube-reviews', '유튜브 리뷰', '2026-03-18T02:50:00.000Z', '2026-03-18T02:50:00.000Z'),
  ('tag-writing-analysis', 'writing-analysis', '글 분석과 해설', '2026-03-18T02:55:00.000Z', '2026-03-18T02:55:00.000Z'),
  ('tag-development-programming', 'development-programming', '개발과 프로그래밍', '2026-03-18T03:00:00.000Z', '2026-03-18T03:00:00.000Z'),
  ('tag-travel-journal', 'travel-journal', '여행과 기록', '2026-03-18T03:05:00.000Z', '2026-03-18T03:05:00.000Z'),
  ('tag-daily-notes', 'daily-notes', '일상과 메모', '2026-03-18T03:10:00.000Z', '2026-03-18T03:10:00.000Z')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
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
VALUES
  (
    'post-culture-space-test',
    'culture-space-test',
    '문화와 공간 test',
    '정보의 기록 / 문화와 공간 카테고리 test 글',
    '문화와 공간 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 문화와 공간 test\n\ncontent test\n\n## test\n\n문화와 공간 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'culture-space'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:00:00.000Z',
    '2026-03-18T09:00:00.000Z',
    '2026-03-18T09:00:00.000Z'
  ),
  (
    'post-festivals-seasons-test',
    'festivals-seasons-test',
    '축제와 시즌 test',
    '정보의 기록 / 축제와 시즌 카테고리 test 글',
    '축제와 시즌 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 축제와 시즌 test\n\ncontent test\n\n## test\n\n축제와 시즌 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'festivals-seasons'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:05:00.000Z',
    '2026-03-18T09:05:00.000Z',
    '2026-03-18T09:05:00.000Z'
  ),
  (
    'post-events-on-site-test',
    'events-on-site-test',
    '행사와 현장 test',
    '정보의 기록 / 행사와 현장 카테고리 test 글',
    '행사와 현장 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 행사와 현장 test\n\ncontent test\n\n## test\n\n행사와 현장 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'events-on-site'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:10:00.000Z',
    '2026-03-18T09:10:00.000Z',
    '2026-03-18T09:10:00.000Z'
  ),
  (
    'post-history-culture-test',
    'history-culture-test',
    '역사와 문화 test',
    '세상의 기록 / 역사와 문화 카테고리 test 글',
    '역사와 문화 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 역사와 문화 test\n\ncontent test\n\n## test\n\n역사와 문화 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'history-culture'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:15:00.000Z',
    '2026-03-18T09:15:00.000Z',
    '2026-03-18T09:15:00.000Z'
  ),
  (
    'post-issues-analysis-test',
    'issues-analysis-test',
    '이슈와 해설 test',
    '세상의 기록 / 이슈와 해설 카테고리 test 글',
    '이슈와 해설 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 이슈와 해설 test\n\ncontent test\n\n## test\n\n이슈와 해설 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'issues-analysis'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:20:00.000Z',
    '2026-03-18T09:20:00.000Z',
    '2026-03-18T09:20:00.000Z'
  ),
  (
    'post-mystery-legends-test',
    'mystery-legends-test',
    '미스터리와 전설 test',
    '세상의 기록 / 미스터리와 전설 카테고리 test 글',
    '미스터리와 전설 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 미스터리와 전설 test\n\ncontent test\n\n## test\n\n미스터리와 전설 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'mystery-legends'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:25:00.000Z',
    '2026-03-18T09:25:00.000Z',
    '2026-03-18T09:25:00.000Z'
  ),
  (
    'post-stock-trends-test',
    'stock-trends-test',
    '주식의 흐름 test',
    '시장의 기록 / 주식의 흐름 카테고리 test 글',
    '주식의 흐름 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 주식의 흐름 test\n\ncontent test\n\n## test\n\n주식의 흐름 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'stock-trends'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:30:00.000Z',
    '2026-03-18T09:30:00.000Z',
    '2026-03-18T09:30:00.000Z'
  ),
  (
    'post-crypto-trends-test',
    'crypto-trends-test',
    '크립토의 흐름 test',
    '시장의 기록 / 크립토의 흐름 카테고리 test 글',
    '크립토의 흐름 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 크립토의 흐름 test\n\ncontent test\n\n## test\n\n크립토의 흐름 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'crypto-trends'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:35:00.000Z',
    '2026-03-18T09:35:00.000Z',
    '2026-03-18T09:35:00.000Z'
  ),
  (
    'post-emerging-tech-tools-test',
    'emerging-tech-tools-test',
    '신기술과 도구 test',
    '기술의 기록 / 신기술과 도구 카테고리 test 글',
    '신기술과 도구 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 신기술과 도구 test\n\ncontent test\n\n## test\n\n신기술과 도구 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'emerging-tech-tools'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:40:00.000Z',
    '2026-03-18T09:40:00.000Z',
    '2026-03-18T09:40:00.000Z'
  ),
  (
    'post-youtube-reviews-test',
    'youtube-reviews-test',
    '유튜브 리뷰 test',
    '기술의 기록 / 유튜브 리뷰 카테고리 test 글',
    '유튜브 리뷰 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 유튜브 리뷰 test\n\ncontent test\n\n## test\n\n유튜브 리뷰 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'youtube-reviews'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:45:00.000Z',
    '2026-03-18T09:45:00.000Z',
    '2026-03-18T09:45:00.000Z'
  ),
  (
    'post-writing-analysis-test',
    'writing-analysis-test',
    '글 분석과 해설 test',
    '기술의 기록 / 글 분석과 해설 카테고리 test 글',
    '글 분석과 해설 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 글 분석과 해설 test\n\ncontent test\n\n## test\n\n글 분석과 해설 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'writing-analysis'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:50:00.000Z',
    '2026-03-18T09:50:00.000Z',
    '2026-03-18T09:50:00.000Z'
  ),
  (
    'post-development-programming-test',
    'development-programming-test',
    '개발과 프로그래밍 test',
    '동그리의 기록 / 개발과 프로그래밍 카테고리 test 글',
    '개발과 프로그래밍 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 개발과 프로그래밍 test\n\ncontent test\n\n## test\n\n개발과 프로그래밍 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'development-programming'),
    NULL,
    NULL,
    'published',
    '2026-03-18T09:55:00.000Z',
    '2026-03-18T09:55:00.000Z',
    '2026-03-18T09:55:00.000Z'
  ),
  (
    'post-travel-journal-test',
    'travel-journal-test',
    '여행과 기록 test',
    '동그리의 기록 / 여행과 기록 카테고리 test 글',
    '여행과 기록 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 여행과 기록 test\n\ncontent test\n\n## test\n\n여행과 기록 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'travel-journal'),
    NULL,
    NULL,
    'published',
    '2026-03-18T10:00:00.000Z',
    '2026-03-18T10:00:00.000Z',
    '2026-03-18T10:00:00.000Z'
  ),
  (
    'post-daily-notes-test',
    'daily-notes-test',
    '일상과 메모 test',
    '동그리의 기록 / 일상과 메모 카테고리 test 글',
    '일상과 메모 카테고리 화면과 목록 노출을 확인하기 위한 test 글입니다.',
    '{"markdown":"# 일상과 메모 test\n\ncontent test\n\n## test\n\n일상과 메모 카테고리 화면과 연결 상태를 확인하기 위한 샘플 게시글입니다."}',
    (SELECT id FROM categories WHERE slug = 'daily-notes'),
    NULL,
    NULL,
    'published',
    '2026-03-18T10:05:00.000Z',
    '2026-03-18T10:05:00.000Z',
    '2026-03-18T10:05:00.000Z'
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

INSERT OR IGNORE INTO post_tags (post_id, tag_id)
VALUES
  ((SELECT id FROM posts WHERE slug = 'culture-space-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'culture-space-test'), (SELECT id FROM tags WHERE slug = 'culture-space')),
  ((SELECT id FROM posts WHERE slug = 'festivals-seasons-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'festivals-seasons-test'), (SELECT id FROM tags WHERE slug = 'festivals-seasons')),
  ((SELECT id FROM posts WHERE slug = 'events-on-site-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'events-on-site-test'), (SELECT id FROM tags WHERE slug = 'events-on-site')),
  ((SELECT id FROM posts WHERE slug = 'history-culture-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'history-culture-test'), (SELECT id FROM tags WHERE slug = 'history-culture')),
  ((SELECT id FROM posts WHERE slug = 'issues-analysis-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'issues-analysis-test'), (SELECT id FROM tags WHERE slug = 'issues-analysis')),
  ((SELECT id FROM posts WHERE slug = 'mystery-legends-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'mystery-legends-test'), (SELECT id FROM tags WHERE slug = 'mystery-legends')),
  ((SELECT id FROM posts WHERE slug = 'stock-trends-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'stock-trends-test'), (SELECT id FROM tags WHERE slug = 'stock-trends')),
  ((SELECT id FROM posts WHERE slug = 'crypto-trends-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'crypto-trends-test'), (SELECT id FROM tags WHERE slug = 'crypto-trends')),
  ((SELECT id FROM posts WHERE slug = 'emerging-tech-tools-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'emerging-tech-tools-test'), (SELECT id FROM tags WHERE slug = 'emerging-tech-tools')),
  ((SELECT id FROM posts WHERE slug = 'youtube-reviews-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'youtube-reviews-test'), (SELECT id FROM tags WHERE slug = 'youtube-reviews')),
  ((SELECT id FROM posts WHERE slug = 'writing-analysis-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'writing-analysis-test'), (SELECT id FROM tags WHERE slug = 'writing-analysis')),
  ((SELECT id FROM posts WHERE slug = 'development-programming-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'development-programming-test'), (SELECT id FROM tags WHERE slug = 'development-programming')),
  ((SELECT id FROM posts WHERE slug = 'travel-journal-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'travel-journal-test'), (SELECT id FROM tags WHERE slug = 'travel-journal')),
  ((SELECT id FROM posts WHERE slug = 'daily-notes-test'), (SELECT id FROM tags WHERE slug = 'test')),
  ((SELECT id FROM posts WHERE slug = 'daily-notes-test'), (SELECT id FROM tags WHERE slug = 'daily-notes'));

INSERT INTO post_metrics (post_id, view_count, updated_at)
VALUES
  ((SELECT id FROM posts WHERE slug = 'daily-notes-test'), 124, '2026-03-18T10:05:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'travel-journal-test'), 117, '2026-03-18T10:00:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'development-programming-test'), 110, '2026-03-18T09:55:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'writing-analysis-test'), 102, '2026-03-18T09:50:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'youtube-reviews-test'), 96, '2026-03-18T09:45:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'emerging-tech-tools-test'), 88, '2026-03-18T09:40:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'crypto-trends-test'), 79, '2026-03-18T09:35:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'stock-trends-test'), 74, '2026-03-18T09:30:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'mystery-legends-test'), 69, '2026-03-18T09:25:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'issues-analysis-test'), 63, '2026-03-18T09:20:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'history-culture-test'), 57, '2026-03-18T09:15:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'events-on-site-test'), 51, '2026-03-18T09:10:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'festivals-seasons-test'), 46, '2026-03-18T09:05:00.000Z'),
  ((SELECT id FROM posts WHERE slug = 'culture-space-test'), 40, '2026-03-18T09:00:00.000Z')
ON CONFLICT(post_id) DO UPDATE SET
  view_count = excluded.view_count,
  updated_at = excluded.updated_at;
