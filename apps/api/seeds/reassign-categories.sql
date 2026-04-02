INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at) VALUES
  ('cat-info', '정보의-기록', '정보의 기록', '문화와 공간, 축제, 현장을 기록하는 카테고리', NULL, datetime('now'), datetime('now')),
  ('cat-world', '세상의-기록', '세상의 기록', '역사와 이슈, 전설을 기록하는 카테고리', NULL, datetime('now'), datetime('now')),
  ('cat-market', '시장의-기록', '시장의 기록', '주식과 크립토 흐름을 기록하는 카테고리', NULL, datetime('now'), datetime('now')),
  ('cat-tech-records', '기술의-기록', '기술의 기록', '유용한 정보와 기술, 삶의 기름칠을 정리하는 카테고리', NULL, datetime('now'), datetime('now')),
  ('cat-donggri', '동그리의-기록', '동그리의 기록', '개인 기록을 모아두는 카테고리', NULL, datetime('now'), datetime('now'))
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  parent_id = NULL,
  updated_at = excluded.updated_at;
INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at) VALUES
  ('cat-info-culture', '문화와-공간', '문화와 공간', '지역 문화공간과 경험 디자인', (SELECT id FROM categories WHERE slug = '정보의-기록'), datetime('now'), datetime('now')),
  ('cat-info-festival', '축제와-시즌', '축제와 시즌', '계절별 축제와 지역 리듬', (SELECT id FROM categories WHERE slug = '정보의-기록'), datetime('now'), datetime('now')),
  ('cat-info-event', '행사와-현장', '행사와 현장', '현장 운영과 안전, 운영 디테일', (SELECT id FROM categories WHERE slug = '정보의-기록'), datetime('now'), datetime('now')),
  ('cat-world-history', '역사와-문화', '역사와 문화', '역사적 맥락과 문화 유산', (SELECT id FROM categories WHERE slug = '세상의-기록'), datetime('now'), datetime('now')),
  ('cat-world-issue', '이슈와-해설', '이슈와 해설', '핵심 이슈를 맥락 있게 해설', (SELECT id FROM categories WHERE slug = '세상의-기록'), datetime('now'), datetime('now')),
  ('cat-world-mystery', '미스터리와-전설', '미스터리와 전설', '지역 전설과 상상력 기록', (SELECT id FROM categories WHERE slug = '세상의-기록'), datetime('now'), datetime('now')),
  ('cat-market-stock', '주식의-흐름', '주식의 흐름', '시장 구조와 투자 맥락', (SELECT id FROM categories WHERE slug = '시장의-기록'), datetime('now'), datetime('now')),
  ('cat-market-crypto', '크립토의-흐름', '크립토의 흐름', '디지털 자산의 제도 변화', (SELECT id FROM categories WHERE slug = '시장의-기록'), datetime('now'), datetime('now')),
  ('cat-tech-useful-info', '유용한-정보', '유용한 정보', '바로 써먹는 팁과 요약 정보', (SELECT id FROM categories WHERE slug = '기술의-기록'), datetime('now'), datetime('now')),
  ('cat-tech-useful-tech', '유용한-기술', '유용한 기술', '개발과 도구 활용 중심의 기록', (SELECT id FROM categories WHERE slug = '기술의-기록'), datetime('now'), datetime('now')),
  ('cat-tech-life-oil', '삶의-기름칠', '삶의 기름칠', '일상과 여행을 가볍게 정리', (SELECT id FROM categories WHERE slug = '기술의-기록'), datetime('now'), datetime('now')),
  ('cat-donggri-dev', '개발과-프로그래밍', '개발과 프로그래밍', '개발 트렌드와 생산성', (SELECT id FROM categories WHERE slug = '동그리의-기록'), datetime('now'), datetime('now')),
  ('cat-donggri-travel', '여행과-기록', '여행과 기록', '여행 트렌드와 기록법', (SELECT id FROM categories WHERE slug = '동그리의-기록'), datetime('now'), datetime('now')),
  ('cat-donggri-daily', '일상과-메모', '일상과 메모', '일상 루틴과 기록 습관', (SELECT id FROM categories WHERE slug = '동그리의-기록'), datetime('now'), datetime('now'))
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  parent_id = excluded.parent_id,
  updated_at = excluded.updated_at;
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '개발과-프로그래밍')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('development-programming'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '유용한-기술')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('tech-records', '기술-분석', '신기술과-도구'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '유용한-정보')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('유튜브-리뷰', '글-분석과-해설'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '여행과-기록')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('travel-records'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '일상과-메모')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('daily-memo'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '미스터리와-전설')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('mystery-legends'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '역사와-문화')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('history-culture'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '이슈와-해설')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('issues-commentary'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '주식의-흐름')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('stock-flow'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '크립토의-흐름')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('crypto', '크립토', '크팁토'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '문화와-공간')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('culture-space'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '축제와-시즌')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('festivals'));
UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '행사와-현장')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('field-guide'));
SELECT id, slug, name, parent_id
FROM categories
WHERE slug IN (
  'development-programming',
  'travel-records',
  'daily-memo',
  'tech-records',
  '기술-분석',
  '유튜브-리뷰',
  '신기술과-도구',
  '글-분석과-해설',
  '여행과-기록',
  '일상과-메모',
  'stock-flow',
  'crypto',
  'culture-space',
  'festivals',
  'field-guide',
  '크립토',
  '크팁토'
)
ORDER BY slug;
