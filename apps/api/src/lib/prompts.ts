export const PROMPT_STAGES = [
  "editorial_strategy",
  "topic_discovery",
  "article_generation",
  "image_prompt_generation",
] as const;

export type PromptStage = (typeof PROMPT_STAGES)[number];

export interface PromptCategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  scheduleTime: string;
  scheduleTimezone: string;
  selectionWeight: number;
  selectionEnabled: boolean;
  postCategorySlug?: string;
  targetLengthMin?: number;
  targetLengthMax?: number;
  targetLengthBand?: string;
  freshnessMode?: string;
  preferredDiscoveryModel?: string;
  preferredArticleModel?: string;
  preferredReviewModel?: string;
  preferredRevisionModel?: string;
  preferredImagePromptModel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateRecord {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  stage: PromptStage;
  currentVersion: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunRecord {
  id: string;
  categoryId: string | null;
  categorySlug: string;
  status: string;
  triggerType: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapPromptCategory(row: Record<string, unknown>): PromptCategoryRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    status: String(row.status ?? "active"),
    scheduleTime: String(row.schedule_time ?? "12:00"),
    scheduleTimezone: String(row.schedule_timezone ?? "Asia/Seoul"),
    selectionWeight: Number(row.selection_weight ?? 1),
    selectionEnabled: Number(row.selection_enabled ?? 1) === 1,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapPromptTemplate(row: Record<string, unknown>): PromptTemplateRecord {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    categorySlug: String(row.category_slug),
    categoryName: String(row.category_name),
    stage: String(row.stage) as PromptStage,
    currentVersion: Number(row.current_version ?? 1),
    content: String(row.content ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function isPromptStage(value: string): value is PromptStage {
  return PROMPT_STAGES.includes(value as PromptStage);
}

export async function listPromptCategories(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          slug,
          name,
          description,
          status,
          schedule_time,
          schedule_timezone,
          selection_weight,
          selection_enabled,
          created_at,
          updated_at
        FROM prompt_categories
        ORDER BY slug ASC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapPromptCategory);
}

export async function getPromptCategoryBySlug(db: D1Database, slug: string) {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          slug,
          name,
          description,
          status,
          schedule_time,
          schedule_timezone,
          selection_weight,
          selection_enabled,
          created_at,
          updated_at
        FROM prompt_categories
        WHERE slug = ?1
        LIMIT 1
      `,
    )
    .bind(slug)
    .first<Record<string, unknown>>();

  return result ? mapPromptCategory(result) : null;
}

export async function listPromptTemplates(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT
          pt.id,
          pt.category_id,
          pc.slug AS category_slug,
          pc.name AS category_name,
          pt.stage,
          pt.current_version,
          pt.content,
          pt.created_at,
          pt.updated_at
        FROM prompt_templates pt
        INNER JOIN prompt_categories pc ON pc.id = pt.category_id
        ORDER BY pc.slug ASC, pt.stage ASC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map(mapPromptTemplate);
}

export async function upsertPromptTemplate(
  db: D1Database,
  input: { categorySlug: string; stage: PromptStage; content: string },
) {
  const category = await getPromptCategoryBySlug(db, input.categorySlug);

  if (!category) {
    return null;
  }

  const existing = await db
    .prepare(
      `
        SELECT
          id,
          current_version
        FROM prompt_templates
        WHERE category_id = ?1 AND stage = ?2
        LIMIT 1
      `,
    )
    .bind(category.id, input.stage)
    .first<{ id: string; current_version: number }>();

  const now = new Date().toISOString();

  if (existing?.id) {
    const nextVersion = Number(existing.current_version ?? 1) + 1;

    await db.batch([
      db
        .prepare(
          `
            UPDATE prompt_templates
            SET content = ?2,
                current_version = ?3,
                updated_at = ?4
            WHERE id = ?1
          `,
        )
        .bind(existing.id, input.content, nextVersion, now),
      db
        .prepare(
          `
            INSERT INTO prompt_template_versions (id, template_id, version, content, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
          `,
        )
        .bind(crypto.randomUUID(), existing.id, nextVersion, input.content, now),
    ]);
  } else {
    const templateId = crypto.randomUUID();

    await db.batch([
      db
        .prepare(
          `
            INSERT INTO prompt_templates (
              id,
              category_id,
              stage,
              current_version,
              content,
              created_at,
              updated_at
            ) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)
          `,
        )
        .bind(templateId, category.id, input.stage, input.content, now, now),
      db
        .prepare(
          `
            INSERT INTO prompt_template_versions (id, template_id, version, content, created_at)
            VALUES (?1, ?2, 1, ?3, ?4)
          `,
        )
        .bind(crypto.randomUUID(), templateId, input.content, now),
    ]);
  }

  const refreshed = await db
    .prepare(
      `
        SELECT
          pt.id,
          pt.category_id,
          pc.slug AS category_slug,
          pc.name AS category_name,
          pt.stage,
          pt.current_version,
          pt.content,
          pt.created_at,
          pt.updated_at
        FROM prompt_templates pt
        INNER JOIN prompt_categories pc ON pc.id = pt.category_id
        WHERE pc.slug = ?1 AND pt.stage = ?2
        LIMIT 1
      `,
    )
    .bind(input.categorySlug, input.stage)
    .first<Record<string, unknown>>();

  return refreshed ? mapPromptTemplate(refreshed) : null;
}

export async function listAutomationRuns(db: D1Database, limit = 30) {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          category_id,
          category_slug,
          status,
          trigger_type,
          summary,
          metadata_json,
          started_at,
          finished_at,
          created_at,
          updated_at
        FROM automation_runs
        ORDER BY started_at DESC, created_at DESC
        LIMIT ?1
      `,
    )
    .bind(Math.max(1, Math.min(limit, 100)))
    .all<Record<string, unknown>>();

  return result.results.map((row) => ({
    id: String(row.id),
    categoryId: row.category_id ? String(row.category_id) : null,
    categorySlug: String(row.category_slug),
    status: String(row.status),
    triggerType: String(row.trigger_type ?? "manual"),
    summary: row.summary ? String(row.summary) : null,
    metadata: (() => {
      try {
        return row.metadata_json ? (JSON.parse(String(row.metadata_json)) as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    })(),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  } satisfies AutomationRunRecord));
}
