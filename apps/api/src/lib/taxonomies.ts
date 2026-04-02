import { computeTagIndexCandidate, computeTagQualityIssues, type Category, type Tag, type TaxonomyInput } from "@cloudflare-blog/shared";

import { slugify } from "./posts";

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

async function resolveParentId(db: D1Database, parentId?: string | null, currentId?: string) {
  const normalized = parentId?.trim() || null;

  if (!normalized || normalized === currentId) {
    return null;
  }

  const parent = await db
    .prepare("SELECT id, parent_id FROM categories WHERE id = ?1")
    .bind(normalized)
    .first<Record<string, unknown>>();

  if (!parent || parent.parent_id) {
    return null;
  }

  return String(parent.id);
}

async function hasChildCategories(db: D1Database, id: string) {
  const child = await db
    .prepare("SELECT id FROM categories WHERE parent_id = ?1 LIMIT 1")
    .bind(id)
    .first<Record<string, unknown>>();

  return Boolean(child);
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

export async function listCategoriesForAdmin(db: D1Database) {
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

export async function resolveCategoryIdentifier(db: D1Database, category: string | null | undefined) {
  const normalized = (category ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length >= 36) {
    const direct = await db
      .prepare("SELECT id FROM categories WHERE id = ?1 LIMIT 1")
      .bind(normalized)
      .first<{ id: string }>();

    if (direct?.id) {
      return String(direct.id);
    }
  }

  const bySlug = await db
    .prepare("SELECT id FROM categories WHERE slug = ?1 LIMIT 1")
    .bind(normalized)
    .first<{ id: string }>();

  return bySlug?.id ? String(bySlug.id) : null;
}

export async function listTagsForAdmin(db: D1Database) {
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
          MAX(COALESCE(p.published_at, p.created_at)) AS latest_published_at,
          (
            SELECT p2.title
            FROM posts p2
            INNER JOIN post_tags pt2 ON pt2.post_id = p2.id
            LEFT JOIN post_metrics pm2 ON pm2.post_id = p2.id
            WHERE pt2.tag_id = t.id
              AND p2.status = 'published'
            ORDER BY COALESCE(pm2.view_count, 0) DESC, COALESCE(p2.published_at, p2.created_at) DESC, p2.updated_at DESC
            LIMIT 1
          ) AS top_post_title
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
        GROUP BY t.id
      `,
    )
    .all<Record<string, unknown>>();

  return result.results
    .map(mapTag)
    .sort((left, right) => {
      const candidateGap = Number(Boolean(right.indexCandidate)) - Number(Boolean(left.indexCandidate));

      if (candidateGap !== 0) {
        return candidateGap;
      }

      const countGap = Number(right.publishedCount ?? 0) - Number(left.publishedCount ?? 0);

      if (countGap !== 0) {
        return countGap;
      }

      return left.name.localeCompare(right.name, "ko");
    });
}

export async function createCategory(db: D1Database, input: TaxonomyInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = input.slug && input.slug.length > 0 ? slugify(input.slug) : slugify(input.name);
  const parentId = await resolveParentId(db, input.parentId);

  await db
    .prepare(
      `
        INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `,
    )
    .bind(id, slug, input.name, input.description ?? null, parentId, now, now)
    .run();

  const result = await db
    .prepare("SELECT id, slug, name, description, parent_id, created_at, updated_at FROM categories WHERE id = ?1")
    .bind(id)
    .first<Record<string, unknown>>();

  return result ? mapCategory(result) : null;
}

export async function updateCategory(db: D1Database, id: string, input: Partial<TaxonomyInput>) {
  const existing = await db
    .prepare("SELECT id, slug, name, description, parent_id FROM categories WHERE id = ?1")
    .bind(id)
    .first<Record<string, unknown>>();

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const slug = input.slug && input.slug.length > 0 ? slugify(input.slug) : slugify(input.name ?? String(existing.name));
  const lockedAsParent = await hasChildCategories(db, id);
  const parentId =
    input.parentId !== undefined
      ? lockedAsParent
        ? null
        : await resolveParentId(db, input.parentId, id)
      : existing.parent_id
        ? String(existing.parent_id)
        : null;

  await db
    .prepare(
      `
        UPDATE categories
        SET slug = ?2, name = ?3, description = ?4, parent_id = ?5, updated_at = ?6
        WHERE id = ?1
      `,
    )
    .bind(
      id,
      slug,
      input.name ?? String(existing.name),
      input.description ?? (existing.description ? String(existing.description) : null),
      parentId,
      now,
    )
    .run();

  const result = await db
    .prepare("SELECT id, slug, name, description, parent_id, created_at, updated_at FROM categories WHERE id = ?1")
    .bind(id)
    .first<Record<string, unknown>>();

  return result ? mapCategory(result) : null;
}

export async function deleteCategory(db: D1Database, id: string) {
  await db.prepare("UPDATE posts SET category_id = NULL WHERE category_id = ?1").bind(id).run();
  await db.prepare("UPDATE categories SET parent_id = NULL WHERE parent_id = ?1").bind(id).run();
  const result = await db.prepare("DELETE FROM categories WHERE id = ?1").bind(id).run();
  return result.meta.changes > 0;
}

export async function createTag(db: D1Database, input: TaxonomyInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = input.slug && input.slug.length > 0 ? slugify(input.slug) : slugify(input.name);

  await db
    .prepare(
      `
        INSERT INTO tags (id, slug, name, description, seo_title, seo_description, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `,
    )
    .bind(
      id,
      slug,
      input.name,
      input.description?.trim() || null,
      input.seoTitle?.trim() || null,
      input.seoDescription?.trim() || null,
      now,
      now,
    )
    .run();

  const result = await db
    .prepare(
      `
        SELECT
          id,
          slug,
          name,
          description,
          seo_title,
          seo_description,
          0 AS published_count,
          NULL AS latest_published_at,
          NULL AS top_post_title
        FROM tags
        WHERE id = ?1
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();

  return result ? mapTag(result) : null;
}

export async function updateTag(db: D1Database, id: string, input: Partial<TaxonomyInput>) {
  const existing = await db
    .prepare("SELECT id, slug, name, description, seo_title, seo_description FROM tags WHERE id = ?1")
    .bind(id)
    .first<Record<string, unknown>>();

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const slug = input.slug && input.slug.length > 0 ? slugify(input.slug) : slugify(input.name ?? String(existing.name));

  await db
    .prepare(
      `
        UPDATE tags
        SET slug = ?2, name = ?3, description = ?4, seo_title = ?5, seo_description = ?6, updated_at = ?7
        WHERE id = ?1
      `,
    )
    .bind(
      id,
      slug,
      input.name ?? String(existing.name),
      input.description !== undefined ? input.description?.trim() || null : existing.description ? String(existing.description) : null,
      input.seoTitle !== undefined ? input.seoTitle?.trim() || null : existing.seo_title ? String(existing.seo_title) : null,
      input.seoDescription !== undefined
        ? input.seoDescription?.trim() || null
        : existing.seo_description
          ? String(existing.seo_description)
          : null,
      now,
    )
    .run();

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
          MAX(COALESCE(p.published_at, p.created_at)) AS latest_published_at,
          (
            SELECT p2.title
            FROM posts p2
            INNER JOIN post_tags pt2 ON pt2.post_id = p2.id
            LEFT JOIN post_metrics pm2 ON pm2.post_id = p2.id
            WHERE pt2.tag_id = t.id
              AND p2.status = 'published'
            ORDER BY COALESCE(pm2.view_count, 0) DESC, COALESCE(p2.published_at, p2.created_at) DESC, p2.updated_at DESC
            LIMIT 1
          ) AS top_post_title
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
        WHERE t.id = ?1
        GROUP BY t.id
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();

  return result ? mapTag(result) : null;
}

export async function deleteTag(db: D1Database, id: string) {
  await db.prepare("DELETE FROM post_tags WHERE tag_id = ?1").bind(id).run();
  const result = await db.prepare("DELETE FROM tags WHERE id = ?1").bind(id).run();
  return result.meta.changes > 0;
}
