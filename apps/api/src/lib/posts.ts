import type {
  Category,
  CategoryFeed,
  CreatePostInput,
  Post,
  PostSummary,
  Tag,
  TagFeed,
  UpdatePostInput,
} from "@cloudflare-blog/shared";
import { computeTagIndexCandidate, computeTagQualityIssues } from "@cloudflare-blog/shared";

import { applyPublishImageAltFallback, collectMediaPathsFromContent } from "./post-image-alt";

export function slugify(value: string) {
  const romanized = romanizeKorean(value.normalize("NFKC"));

  return romanized
    .toLowerCase()
    .trim()
    .replace(/^#+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const INITIAL_ROMAN = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const VOWEL_ROMAN = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINAL_ROMAN = ["", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "h"];

function romanizeHangulSyllable(char: string) {
  const code = char.charCodeAt(0);

  if (code < HANGUL_BASE || code > HANGUL_LAST) {
    return char;
  }

  const syllableIndex = code - HANGUL_BASE;
  const initialIndex = Math.floor(syllableIndex / 588);
  const vowelIndex = Math.floor((syllableIndex % 588) / 28);
  const finalIndex = syllableIndex % 28;

  return `${INITIAL_ROMAN[initialIndex]}${VOWEL_ROMAN[vowelIndex]}${FINAL_ROMAN[finalIndex]}`;
}

function romanizeKorean(value: string) {
  let result = "";

  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      result += romanizeHangulSyllable(char);
      continue;
    }

    if (/[a-zA-Z0-9]/.test(char)) {
      result += char;
      continue;
    }

    if (/\s|[-_/]+/.test(char)) {
      result += " ";
    }
  }

  return result;
}

export class PostValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = "PostValidationError";
  }
}

function normalizeRelatedLinks(relatedLinks?: Post["relatedLinks"]) {
  return (relatedLinks ?? [])
    .map((item) => ({
      url: item.url.trim(),
      title: item.title?.trim() || undefined,
      description: item.description?.trim() || undefined,
      image: item.image?.trim() || undefined,
      siteName: item.siteName?.trim() || undefined,
    }))
    .filter((item) => item.url.length > 0)
    .slice(0, 5);
}

type StoredContentPayload = {
  markdown: string;
  relatedLinks: Post["relatedLinks"];
};

function parseContentPayload(contentJson: string): StoredContentPayload {
  try {
    const parsed = JSON.parse(contentJson) as {
      markdown?: string;
      relatedLinks?: Post["relatedLinks"];
    };

    return {
      markdown: parsed.markdown ?? "",
      relatedLinks: normalizeRelatedLinks(parsed.relatedLinks),
    };
  } catch {
    return {
      markdown: "",
      relatedLinks: [],
    };
  }
}

function buildContentJson(markdown: string, relatedLinks?: Post["relatedLinks"]) {
  return JSON.stringify({
    markdown,
    relatedLinks: normalizeRelatedLinks(relatedLinks),
  });
}

function normalizeTagName(value: string) {
  return value.replace(/^#+/g, "").trim().replace(/\s+/g, " ");
}

function normalizeTagNames(tagNames: string[] | undefined) {
  const deduped = new Map<string, string>();

  for (const rawName of tagNames ?? []) {
    const name = normalizeTagName(rawName);

    if (!name) {
      continue;
    }

    const slug = slugify(name);

    if (!slug) {
      continue;
    }

    if (!deduped.has(slug)) {
      deduped.set(slug, name);
    }
  }

  return [...deduped.entries()].map(([slug, name]) => ({ slug, name }));
}

function parseContent(contentJson: string) {
  return parseContentPayload(contentJson).markdown;
}

function parseRelatedLinks(contentJson: string) {
  return parseContentPayload(contentJson).relatedLinks;
}

function buildContentLead(contentJson: string | null | undefined, maxLength = 180) {
  if (!contentJson) {
    return null;
  }

  const markdown = parseContent(contentJson);

  if (!markdown) {
    return null;
  }

  const normalized = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

async function resolveMediaAltByPath(db: D1Database, content: string) {
  const paths = collectMediaPathsFromContent(content).slice(0, 120);

  if (!paths.length) {
    return new Map<string, string>();
  }

  const placeholders = paths.map((_, index) => `?${index + 1}`).join(", ");
  const result = await db
    .prepare(
      `
        SELECT path, alt_text
        FROM media_assets
        WHERE path IN (${placeholders})
      `,
    )
    .bind(...paths)
    .all<Record<string, unknown>>();

  const altByPath = new Map<string, string>();

  for (const row of result.results) {
    const path = typeof row.path === "string" ? row.path : "";
    const altText = typeof row.alt_text === "string" ? row.alt_text.trim() : "";

    if (path && altText) {
      altByPath.set(path, altText);
    }
  }

  return altByPath;
}

function mapPostSummary(row: Record<string, unknown>): PostSummary {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: row.subtitle ? String(row.subtitle) : null,
    excerpt: row.excerpt ? String(row.excerpt) : null,
    seoTitle: row.seo_title ? String(row.seo_title) : null,
    seoDescription: row.seo_description ? String(row.seo_description) : null,
    contentLead: buildContentLead(typeof row.content_json === "string" ? row.content_json : null),
    coverImage: row.cover_image ? String(row.cover_image) : null,
    coverAlt: row.cover_alt ? String(row.cover_alt) : null,
    category: row.category_id
      ? {
          id: String(row.category_id),
          slug: String(row.category_slug),
          name: String(row.category_name),
          description: row.category_description ? String(row.category_description) : null,
          parentId: row.category_parent_id ? String(row.category_parent_id) : null,
        }
      : null,
    status: String(row.status) as PostSummary["status"],
    viewCount: Number(row.view_count ?? 0),
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
    parentId: row.parent_id ? String(row.parent_id) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapTag(row: Record<string, unknown>): Tag {
  const tag: Tag = {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    seoTitle: row.seo_title ? String(row.seo_title) : null,
    seoDescription: row.seo_description ? String(row.seo_description) : null,
    publishedCount: Number(row.published_count ?? 0),
    latestPublishedAt: row.latest_published_at ? String(row.latest_published_at) : null,
    topPostTitle: row.top_post_title ? String(row.top_post_title) : null,
  };

  const hasSeoContext =
    row.description !== undefined ||
    row.seo_title !== undefined ||
    row.seo_description !== undefined ||
    row.published_count !== undefined ||
    row.latest_published_at !== undefined ||
    row.top_post_title !== undefined;

  if (!hasSeoContext) {
    return {
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
    };
  }

  return {
    ...tag,
    qualityIssues: computeTagQualityIssues(tag),
    indexCandidate: computeTagIndexCandidate(tag),
  };
}

function toComparableTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickFeaturedTagPost(posts: PostSummary[]) {
  if (!posts.length) {
    return null;
  }

  return [...posts].sort((left, right) => {
    const viewGap = Number(right.viewCount ?? 0) - Number(left.viewCount ?? 0);

    if (viewGap !== 0) {
      return viewGap;
    }

    const publishedGap =
      toComparableTimestamp(right.publishedAt ?? right.createdAt) - toComparableTimestamp(left.publishedAt ?? left.createdAt);

    if (publishedGap !== 0) {
      return publishedGap;
    }

    return toComparableTimestamp(right.updatedAt) - toComparableTimestamp(left.updatedAt);
  })[0];
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
    relatedLinks: parseRelatedLinks(String(row.content_json)),
    category: row.category_id
      ? {
          id: String(row.category_id),
          slug: String(row.category_slug),
          name: String(row.category_name),
          description: row.category_description ? String(row.category_description) : null,
          parentId: row.category_parent_id ? String(row.category_parent_id) : null,
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
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
        WHERE p.status = 'published'
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapPostSummary);
}

function normalizeSearchTerms(query: string) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function searchPublishedPosts(db: D1Database, query: string, limit = 20) {
  const terms = normalizeSearchTerms(query);

  if (!terms.length) {
    return [];
  }

  const conditions = terms.map(
    (_, index) => `
      (
        lower(p.title) LIKE ?${index * 8 + 1}
        OR lower(COALESCE(p.subtitle, '')) LIKE ?${index * 8 + 2}
        OR lower(COALESCE(p.excerpt, '')) LIKE ?${index * 8 + 3}
        OR lower(COALESCE(p.seo_title, '')) LIKE ?${index * 8 + 4}
        OR lower(COALESCE(p.seo_description, '')) LIKE ?${index * 8 + 5}
        OR lower(COALESCE(p.content_json, '')) LIKE ?${index * 8 + 6}
        OR EXISTS (
          SELECT 1
          FROM post_tags pt
          INNER JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id = p.id
            AND (
              lower(t.name) LIKE ?${index * 8 + 7}
              OR lower(t.slug) LIKE ?${index * 8 + 8}
            )
        )
      )
    `,
  );

  const params = terms.flatMap((term) => {
    const value = `%${term}%`;
    return [value, value, value, value, value, value, value, value];
  });

  const result = await db
    .prepare(
      `
        SELECT DISTINCT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
        WHERE p.status = 'published'
          AND ${conditions.join("\n          AND ")}
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
        LIMIT ?${params.length + 1}
      `,
    )
    .bind(...params, Math.max(1, Math.min(limit, 50)))
    .all<Record<string, unknown>>();

  return result.results.map(mapPostSummary);
}

export async function listAdminPosts(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
        ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.updated_at DESC
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
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.youtube_url,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
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
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.youtube_url,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
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
        SELECT id, slug, name, description, parent_id, created_at, updated_at
        FROM categories
        ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END ASC, COALESCE(parent_id, id), name ASC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapCategory);
}

export async function listTags(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT
          t.id,
          t.slug,
          t.name,
          t.description,
          t.seo_title,
          t.seo_description,
          COUNT(DISTINCT p.id) AS published_count,
          MAX(COALESCE(p.published_at, p.created_at)) AS latest_published_at
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
        GROUP BY t.id
        ORDER BY t.name ASC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapTag);
}

export async function getCategoryFeedBySlug(db: D1Database, slug: string): Promise<CategoryFeed | null> {
  const category = await db
    .prepare(
      `
        SELECT id, slug, name, description, parent_id, created_at, updated_at
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
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
        WHERE p.status = 'published'
          AND (
            p.category_id = ?1
            OR p.category_id IN (
              SELECT id
              FROM categories
              WHERE parent_id = ?1
            )
          )
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
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
        SELECT
          t.id,
          t.slug,
          t.name,
          t.description,
          t.seo_title,
          t.seo_description,
          COUNT(DISTINCT p.id) AS published_count,
          MAX(COALESCE(p.published_at, p.created_at)) AS latest_published_at
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
        WHERE t.slug = ?1
        GROUP BY t.id
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
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
        INNER JOIN post_tags pt ON pt.post_id = p.id
        WHERE pt.tag_id = ?1 AND p.status = 'published'
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
      `,
    )
    .bind(String(tag.id))
    .all<Record<string, unknown>>();

  const posts = postsResult.results.map(mapPostSummary);

  return {
    tag: mapTag(tag),
    posts,
    featuredPost: pickFeaturedTagPost(posts),
  };
}

export async function listTopPublishedPosts(db: D1Database, limit = 5) {
  const result = await db
    .prepare(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.seo_title,
          p.seo_description,
          p.content_json,
          p.cover_image,
          p.cover_alt,
          p.status,
          COALESCE(pm.view_count, 0) AS view_count,
          p.published_at,
          p.created_at,
          p.updated_at,
          c.id AS category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.description AS category_description,
          c.parent_id AS category_parent_id
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
        WHERE p.status = 'published'
        ORDER BY COALESCE(pm.view_count, 0) DESC, COALESCE(p.published_at, p.created_at) DESC, p.updated_at DESC
        LIMIT ?1
      `,
    )
    .bind(Math.max(1, Math.min(limit, 10)))
    .all<Record<string, unknown>>();

  return result.results.map(mapPostSummary);
}

export async function recordPostViewBySlug(db: D1Database, slug: string) {
  const post = await db
    .prepare("SELECT id, slug FROM posts WHERE slug = ?1 AND status = 'published' LIMIT 1")
    .bind(slug)
    .first<{ id: string; slug: string }>();

  if (!post) {
    return null;
  }

  const now = new Date().toISOString();

  await db
    .prepare(
      `
        INSERT INTO post_metrics (post_id, view_count, updated_at)
        VALUES (?1, 1, ?2)
        ON CONFLICT(post_id) DO UPDATE
        SET view_count = post_metrics.view_count + 1,
            updated_at = excluded.updated_at
      `,
    )
    .bind(post.id, now)
    .run();

  const metric = await db
    .prepare("SELECT view_count FROM post_metrics WHERE post_id = ?1 LIMIT 1")
    .bind(post.id)
    .first<{ view_count: number }>();

  return {
    slug: post.slug,
    viewCount: Number(metric?.view_count ?? 0),
  };
}

async function getPostTagIds(db: D1Database, postId: string) {
  const result = await db
    .prepare("SELECT tag_id FROM post_tags WHERE post_id = ?1")
    .bind(postId)
    .all<{ tag_id: string }>();

  return result.results.map((row) => row.tag_id);
}

async function resolveTagIds(db: D1Database, input: Pick<CreatePostInput, "tagIds" | "tagNames">) {
  if (input.tagNames === undefined) {
    return input.tagIds ?? [];
  }

  const normalizedTags = normalizeTagNames(input.tagNames);

  if (normalizedTags.length > 10) {
    throw new PostValidationError("A post can have up to 10 tags.", "TAG_LIMIT_EXCEEDED", 400);
  }

  const tagIds: string[] = [];

  for (const tag of normalizedTags) {
    const existing = await db
      .prepare("SELECT id FROM tags WHERE slug = ?1 LIMIT 1")
      .bind(tag.slug)
      .first<{ id: string }>();

    if (existing?.id) {
      tagIds.push(existing.id);
      continue;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `
          INSERT INTO tags (id, slug, name, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5)
        `,
      )
      .bind(id, tag.slug, tag.name, now, now)
      .run();

    tagIds.push(id);
  }

  return tagIds;
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
        SELECT id, slug, title, subtitle, excerpt, seo_title, seo_description, content_json, category_id, cover_image, cover_alt, youtube_url, status, published_at
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
  const mediaAltByPath =
    status === "published" ? await resolveMediaAltByPath(db, input.content) : new Map<string, string>();
  const content =
    status === "published"
      ? applyPublishImageAltFallback({
          content: input.content,
          title: input.title,
          mediaAltByPath,
        })
      : input.content;
  const tagIds = await resolveTagIds(db, input);

  if (!slug) {
    throw new PostValidationError("A post slug could not be generated.", "INVALID_POST_SLUG", 400);
  }

  await db
    .prepare(
      `
        INSERT INTO posts (
          id, slug, title, subtitle, excerpt, seo_title, seo_description, content_json, category_id, cover_image,
          cover_alt, youtube_url, status, published_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
      `,
    )
    .bind(
      id,
      slug,
      input.title,
      input.subtitle ?? null,
      input.excerpt ?? null,
      input.seoTitle?.trim() || null,
      input.seoDescription?.trim() || null,
      buildContentJson(content, input.relatedLinks),
      input.categoryId ?? null,
      input.coverImage?.trim() || null,
      input.coverAlt?.trim() || null,
      input.youtubeUrl ?? null,
      status,
      publishedAt,
      now,
      now,
    )
    .run();

  await replacePostTags(db, id, tagIds);
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
  const slug =
    input.slug && input.slug.trim().length > 0 && input.slug.trim() !== String(existing.slug)
      ? slugify(input.slug)
      : String(existing.slug);
  const status = input.status ?? ((String(existing.status) as CreatePostInput["status"]) ?? "draft");
  const content =
    input.content ??
    parseContent(typeof existing.content_json === "string" ? existing.content_json : "");
  const existingRelatedLinks =
    parseRelatedLinks(typeof existing.content_json === "string" ? existing.content_json : "");
  const publishedAt =
    input.publishedAt !== undefined
      ? input.publishedAt
      : status === "published"
        ? String(existing.published_at ?? now)
        : null;
  const tagIds =
    input.tagNames !== undefined || input.tagIds !== undefined
      ? await resolveTagIds(db, input)
      : currentTagIds;
  const subtitle =
    input.subtitle !== undefined
      ? input.subtitle?.trim() || null
      : existing.subtitle
        ? String(existing.subtitle)
        : null;
  const excerpt =
    input.excerpt !== undefined
      ? input.excerpt?.trim() || null
      : existing.excerpt
        ? String(existing.excerpt)
        : null;
  const seoTitle =
    input.seoTitle !== undefined
      ? input.seoTitle?.trim() || null
      : existing.seo_title
        ? String(existing.seo_title)
        : null;
  const seoDescription =
    input.seoDescription !== undefined
      ? input.seoDescription?.trim() || null
      : existing.seo_description
        ? String(existing.seo_description)
        : null;
  const categoryId =
    input.categoryId !== undefined
      ? input.categoryId?.trim() || null
      : existing.category_id
        ? String(existing.category_id)
        : null;
  const coverImage =
    input.coverImage !== undefined
      ? input.coverImage?.trim() || null
      : existing.cover_image
        ? String(existing.cover_image)
        : null;
  const coverAlt =
    input.coverAlt !== undefined
      ? input.coverAlt?.trim() || null
      : existing.cover_alt
        ? String(existing.cover_alt)
        : null;
  const youtubeUrl =
    input.youtubeUrl !== undefined
      ? input.youtubeUrl?.trim() || null
      : existing.youtube_url
        ? String(existing.youtube_url)
        : null;
  const contentForPersistence =
    status === "published"
      ? applyPublishImageAltFallback({
          content,
          title,
          mediaAltByPath: await resolveMediaAltByPath(db, content),
        })
      : content;

  if (!slug) {
    throw new PostValidationError("A post slug could not be generated.", "INVALID_POST_SLUG", 400);
  }

  await db
    .prepare(
      `
        UPDATE posts
        SET slug = ?2,
            title = ?3,
            subtitle = ?4,
            excerpt = ?5,
            seo_title = ?6,
            seo_description = ?7,
            content_json = ?8,
            category_id = ?9,
            cover_image = ?10,
            cover_alt = ?11,
            youtube_url = ?12,
            status = ?13,
            published_at = ?14,
            updated_at = ?15
        WHERE id = ?1
      `,
    )
    .bind(
      id,
      slug,
      title,
      subtitle,
      excerpt,
      seoTitle,
      seoDescription,
      buildContentJson(
        contentForPersistence,
        input.relatedLinks !== undefined ? normalizeRelatedLinks(input.relatedLinks) : existingRelatedLinks,
      ),
      categoryId,
      coverImage,
      coverAlt,
      youtubeUrl,
      status,
      publishedAt,
      now,
    )
    .run();

  await replacePostTags(db, id, tagIds);
  return getAdminPostById(db, id);
}

export async function deletePost(db: D1Database, id: string) {
  await db.prepare("DELETE FROM post_tags WHERE post_id = ?1").bind(id).run();
  await db.prepare("DELETE FROM series_posts WHERE post_id = ?1").bind(id).run();
  const result = await db.prepare("DELETE FROM posts WHERE id = ?1").bind(id).run();
  return result.meta.changes > 0;
}


