INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at)
VALUES
  ('cat-tech-useful-life', '삶을-유용하게', '삶을 유용하게', '유용한 기술과 정보를 합쳐 바로 쓰는 실용 기록', (SELECT id FROM categories WHERE slug = '기술의-기록'), datetime('now'), datetime('now')),
  ('cat-world-mysteria-story', '미스테리아-스토리', '미스테리아 스토리', '미스터리와 역사 문화를 엮어 맥락을 정리하는 기록', (SELECT id FROM categories WHERE slug = '세상의-기록'), datetime('now'), datetime('now')),
  ('cat-world-donggri-thought', '동그리의-생각', '동그리의 생각', '이슈를 동그리 관점으로 정리하는 해설 기록', (SELECT id FROM categories WHERE slug = '세상의-기록'), datetime('now'), datetime('now')),
  ('cat-info-festival-field', '축제와-현장', '축제와 현장', '축제 정보와 현장 운영 가이드를 합쳐 정리하는 기록', (SELECT id FROM categories WHERE slug = '정보의-기록'), datetime('now'), datetime('now'))
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  parent_id = excluded.parent_id,
  updated_at = excluded.updated_at;

UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '삶을-유용하게')
WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN ('유용한-기술', '유용한-정보')
);

UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '미스테리아-스토리')
WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN ('미스터리와-전설', '역사와-문화')
);

UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '동그리의-생각')
WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN ('이슈와-해설')
);

UPDATE posts
SET category_id = (SELECT id FROM categories WHERE slug = '축제와-현장')
WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN ('축제와-시즌', '행사와-현장')
);

DELETE FROM categories
WHERE slug IN (
  '유용한-기술',
  '유용한-정보',
  '미스터리와-전설',
  '역사와-문화',
  '이슈와-해설',
  '축제와-시즌',
  '행사와-현장'
);