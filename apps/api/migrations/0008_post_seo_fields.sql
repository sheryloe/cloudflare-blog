ALTER TABLE posts ADD COLUMN seo_title TEXT;
ALTER TABLE posts ADD COLUMN seo_description TEXT;

UPDATE posts
SET seo_description = excerpt
WHERE seo_description IS NULL
  AND excerpt IS NOT NULL
  AND trim(excerpt) <> "";
