UPDATE posts
SET title = '수동 업서트 점검',
    excerpt = '수동 업서트 흐름을 확인하기 위한 임시 초안입니다.',
    updated_at = '2026-03-31T18:10:00+09:00'
WHERE slug = 'manual-upsert-check';

UPDATE posts
SET title = '자동 업서트 점검',
    excerpt = '자동 업서트 흐름을 확인하기 위한 임시 초안입니다.',
    updated_at = '2026-03-31T18:10:00+09:00'
WHERE slug = 'auto-upsert-check';

UPDATE posts
SET title = '자동화 테스트 글',
    excerpt = '자동화 업데이트 동작을 확인하기 위한 테스트 글입니다.',
    updated_at = '2026-03-31T18:10:00+09:00'
WHERE slug = 'automation-test-post';