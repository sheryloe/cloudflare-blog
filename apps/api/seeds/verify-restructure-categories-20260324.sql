SELECT slug, name, parent_id
FROM categories
ORDER BY slug;

SELECT c.slug, c.name, COUNT(p.id) AS post_count
FROM categories c
LEFT JOIN posts p ON p.category_id = c.id
GROUP BY c.id, c.slug, c.name
ORDER BY c.slug;

SELECT slug
FROM categories
WHERE slug IN (
  '유용한-기술',
  '유용한-정보',
  '미스터리와-전설',
  '역사와-문화',
  '이슈와-해설',
  '축제와-시즌',
  '행사와-현장'
)
ORDER BY slug;