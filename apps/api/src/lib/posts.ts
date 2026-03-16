import type {
  Category,
  CategoryFeed,
  CreatePostInput,
  Post,
  PostSummary,
  Tag,
  TagFeed,
  UpdatePostInput,
} from "@donggeuri/shared";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseContent(contentJson: string) {
  try {
    const parsed = JSON.parse(contentJson) as { markdown?: string };
    return parsed.markdown ?? "";
  } catch {
    return "";
  }
}

function mapPostSummary(row: Record<string, unknown>): PostSummary {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: row.subtitle ? String(row.subtitle) : null,
    excerpt: row.excerpt ? String(row.excerpt) : null,
    coverImage: row.cover_image ? String(row.cover_image) : null,
    status: String(row.status) as PostSummary["status"],
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapTag(row: Record<string, unknown>): Tag {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
  };
}

async function getTagsForPost(db: D1Database, postId: string) {
  const tagsResult = await db
    .prepare(
      `
        SELECT t.id, t.slug, t.name
        FROM tags t
        INNER JOIN post_tags pt ON pt.tag_id = t.id
        WHERE pt.post_id = ?1
        ORDER BY t.name ASC
      `,
    )
    .bind(postId)
    .all<Record<string, unknown>>();

  return tagsResult.results.map(mapTag);
}

async function hydratePost(
  db: D1Database,
  row: Record<string, unknown> | null,
): Promise<Post | null> {
  if (!row) {
    return null;
  }

  const tags = await getTagsForPost(db, String(row.id));

  return {
    ...mapPostSummary(row),
    content: parseContent(String(row.content_json)),
    category: row.category_id
      ? {
          id: String(row.category_id),
          slug: String(row.category_slug),
          name: String(row.category_name),
          description: row.category_description ? String(row.category_description) : null,
        }
      : null,
    tags,
    youtubeUrl: row.youtube_url ? String(row.youtube_url) : null,
  };
}

export async function listPublishedPosts(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT id, slug, title, subtitle, excerpt, cover_image, status, published_at, created_at, updated_at
        FROM posts
        WHERE status = 'published'
        ORDER BY COALESCE(published_at, created_at) DESC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapPostSummary);
}

export async function listAdminPosts(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT id, slug, title, subtitle, excerpt, cover_image, status, published_at, created_at, updated_at
        FROM posts
        ORDER BY updated_at DESC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapPostSummary);
}

export async function getPublishedPostBySlug(db: D1Database, slug: string) {
  const post = await db
    .prepare(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.content_json,
          p.cover_image,
          p.youtube_url,
          p.status,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.slug = ?1 AND p.status = 'published'
        LIMIT 1
      `,
    )
    .bind(slug)
    .first<Record<string, unknown>>();

  return hydratePost(db, post);
}

export async function getAdminPostById(db: D1Database, id: string) {
  const post = await db
    .prepare(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.content_json,
          p.cover_image,
          p.youtube_url,
          p.status,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?1
        LIMIT 1
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();

  return hydratePost(db, post);
}

export async function listCategories(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT id, slug, name, description, created_at, updated_at
        FROM categories
        ORDER BY name ASC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapCategory);
}

export async function listTags(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT id, slug, name
        FROM tags
        ORDER BY name ASC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapTag);
}

export async function getCategoryFeedBySlug(db: D1Database, slug: string): Promise<CategoryFeed | null> {
  const category = await db
    .prepare(
      `
        SELECT id, slug, name, description, created_at, updated_at
        FROM categories
        WHERE slug = ?1
        LIMIT 1
      `,
    )
    .bind(slug)
    .first<Record<string, unknown>>();

  if (!category) {
    return null;
  }

  const postsResult = await db
    .prepare(
      `
        SELECT id, slug, title, subtitle, excerpt, cover_image, status, published_at, created_at, updated_at
        FROM posts
        WHERE category_id = ?1 AND status = 'published'
        ORDER BY COALESCE(published_at, created_at) DESC
      `,
    )
    .bind(String(category.id))
    .all<Record<string, unknown>>();

  return {
    category: mapCategory(category),
    posts: postsResult.results.map(mapPostSummary),
  };
}

export async function getTagFeedBySlug(db: D1Database, slug: string): Promise<TagFeed | null> {
  const tag = await db
    .prepare(
      `
        SELECT id, slug, name
        FROM tags
        WHERE slug = ?1
        LIMIT 1
      `,
    )
    .bind(slug)
    .first<Record<string, unknown>>();

  if (!tag) {
    return null;
  }

  const postsResult = await db
    .prepare(
      `
        SELECT p.id, p.slug, p.title, p.subtitle, p.excerpt, p.cover_image, p.status, p.published_at, p.created_at, p.updated_at
        FROM posts p
        INNER JOIN post_tags pt ON pt.post_id = p.id
        WHERE pt.tag_id = ?1 AND p.status = 'published'
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
      `,
    )
    .bind(String(tag.id))
    .all<Record<string, unknown>>();

  return {
    tag: mapTag(tag),
    posts: postsResult.results.map(mapPostSummary),
  };
}

async function getPostTagIds(db: D1Database, postId: string) {
  const result = await db
    .prepare("SELECT tag_id FROM post_tags WHERE post_id = ?1")
    .bind(postId)
    .all<{ tag_id: string }>();

  return result.results.map((row) => row.tag_id);
}

async function replacePostTags(db: D1Database, postId: string, tagIds: string[] | undefined) {
  await db.prepare("DELETE FROM post_tags WHERE post_id = ?1").bind(postId).run();

  if (!tagIds?.length) {
    return;
  }

  await db.batch(
    tagIds.map((tagId) =>
      db.prepare("INSERT INTO post_tags (post_id, tag_id) VALUES (?1, ?2)").bind(postId, tagId),
    ),
  );
}

async function getExistingPostRow(db: D1Database, id: string) {
  return db
    .prepare(
      `
        SELECT id, slug, title, subtitle, excerpt, content_json, category_id, cover_image, youtube_url, status, published_at
        FROM posts
        WHERE id = ?1
        LIMIT 1
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();
}

export async function createPost(db: D1Database, input: CreatePostInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = input.slug && input.slug.length > 0 ? slugify(input.slug) : slugify(input.title);
  const status = input.status ?? "draft";
  const publishedAt = input.publishedAt ?? (status === "published" ? now : null);

  await db
    .prepare(
      `
        INSERT INTO posts (
          id, slug, title, subtitle, excerpt, content_json, category_id, cover_image,
          youtube_url, status, published_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
      `,
    )
    .bind(
      id,
      slug,
      input.title,
      input.subtitle ?? null,
      input.excerpt ?? null,
      JSON.stringify({ markdown: input.content }),
      input.categoryId ?? null,
      input.coverImage ?? null,
      input.youtubeUrl ?? null,
      status,
      publishedAt,
      now,
      now,
    )
    .run();

  await replacePostTags(db, id, input.tagIds);
  return getAdminPostById(db, id);
}

export async function updatePost(db: D1Database, id: string, input: UpdatePostInput) {
  const existing = await getExistingPostRow(db, id);

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const currentTagIds = await getPostTagIds(db, id);
  const title = input.title ?? String(existing.title);
  const slug = input.slug ? slugify(input.slug) : String(existing.slug);
  const status = input.status ?? ((String(existing.status) as CreatePostInput["status"]) ?? "draft");
  const content =
    input.content ??
    parseContent(typeof existing.content_json === "string" ? existing.content_json : "");
  const publishedAt =
    input.publishedAt !== undefined
      ? input.publishedAt
      : status === "published"
        ? String(existing.published_at ?? now)
        : null;

  await db
    .prepare(
      `
        UPDATE posts
        SET slug = ?2,
            title = ?3,
            subtitle = ?4,
            excerpt = ?5,
            content_json = ?6,
            category_id = ?7,
            cover_image = ?8,
            youtube_url = ?9,
            status = ?10,
            published_at = ?11,
            updated_at = ?12
        WHERE id = ?1
      `,
    )
    .bind(
      id,
      slug,
      title,
      input.subtitle ?? (existing.subtitle ? String(existing.subtitle) : null),
      input.excerpt ?? (existing.excerpt ? String(existing.excerpt) : null),
      JSON.stringify({ markdown: content }),
      input.categoryId ?? (existing.category_id ? String(existing.category_id) : null),
      input.coverImage ?? (existing.cover_image ? String(existing.cover_image) : null),
      input.youtubeUrl ?? (existing.youtube_url ? String(existing.youtube_url) : null),
      status,
      publishedAt,
      now,
    )
    .run();

  await replacePostTags(db, id, input.tagIds ?? currentTagIds);
  return getAdminPostById(db, id);
}

export async function deletePost(db: D1Database, id: string) {
  await db.prepare("DELETE FROM post_tags WHERE post_id = ?1").bind(id).run();
  await db.prepare("DELETE FROM series_posts WHERE post_id = ?1").bind(id).run();
  const result = await db.prepare("DELETE FROM posts WHERE id = ?1").bind(id).run();
  return result.meta.changes > 0;
}
