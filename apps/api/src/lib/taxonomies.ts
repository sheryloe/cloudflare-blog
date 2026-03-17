import type { Category, Tag, TaxonomyInput } from "@donggeuri/shared";

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
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
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

export async function listTagsForAdmin(db: D1Database) {
  const result = await db
    .prepare("SELECT id, slug, name FROM tags ORDER BY name ASC")
    .all<Record<string, unknown>>();

  return result.results.map(mapTag);
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
        INSERT INTO tags (id, slug, name, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `,
    )
    .bind(id, slug, input.name, now, now)
    .run();

  const result = await db
    .prepare("SELECT id, slug, name FROM tags WHERE id = ?1")
    .bind(id)
    .first<Record<string, unknown>>();

  return result ? mapTag(result) : null;
}

export async function updateTag(db: D1Database, id: string, input: Partial<TaxonomyInput>) {
  const existing = await db
    .prepare("SELECT id, slug, name FROM tags WHERE id = ?1")
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
        SET slug = ?2, name = ?3, updated_at = ?4
        WHERE id = ?1
      `,
    )
    .bind(id, slug, input.name ?? String(existing.name), now)
    .run();

  const result = await db
    .prepare("SELECT id, slug, name FROM tags WHERE id = ?1")
    .bind(id)
    .first<Record<string, unknown>>();

  return result ? mapTag(result) : null;
}

export async function deleteTag(db: D1Database, id: string) {
  await db.prepare("DELETE FROM post_tags WHERE tag_id = ?1").bind(id).run();
  const result = await db.prepare("DELETE FROM tags WHERE id = ?1").bind(id).run();
  return result.meta.changes > 0;
}
