UPDATE categories
SET parent_id = (SELECT id FROM categories WHERE slug = '동그리의-기록')
WHERE slug IN ('개발과-프로그래밍', '일상과-메모', '여행과-기록');

UPDATE categories
SET parent_id = (SELECT id FROM categories WHERE slug = '정보의-기록')
WHERE slug IN ('문화와-공간', '축제와-시즌', '행사와-현장');

UPDATE categories
SET parent_id = (SELECT id FROM categories WHERE slug = '세상의-기록')
WHERE slug IN ('역사와-문화', '이슈와-해설', '미스터리와-전설');

UPDATE categories
SET parent_id = (SELECT id FROM categories WHERE slug = '시장의-기록')
WHERE slug IN ('주식의-흐름', '크립토의-흐름');

UPDATE categories
SET parent_id = (SELECT id FROM categories WHERE slug = '기술의-기록')
WHERE slug IN ('유용한-정보', '유용한-기술', '삶의-기름칠');
