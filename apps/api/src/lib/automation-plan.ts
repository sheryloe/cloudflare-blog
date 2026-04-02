export interface AutomationPlanItemRecord {
  id: string;
  planDateKst: string;
  slotTimeKst: string;
  slotOrder: number;
  categoryId: string | null;
  categorySlug: string;
  status: string;
  postId: string | null;
  plannerRunId: string | null;
  errorSummary: string | null;
  metadata: Record<string, unknown>;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunWriteInput {
  id?: string;
  categoryId?: string | null;
  categorySlug: string;
  status: string;
  triggerType: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string | null;
}

export interface AutomationPlanWriteInput {
  id?: string;
  planDateKst?: string;
  slotTimeKst: string;
  slotOrder: number;
  categoryId?: string | null;
  categorySlug: string;
  status?: string;
  postId?: string | null;
  plannerRunId?: string | null;
  errorSummary?: string | null;
  metadata?: Record<string, unknown>;
  executedAt?: string | null;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(String(raw)) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function mapAutomationPlanItem(row: Record<string, unknown>): AutomationPlanItemRecord {
  return {
    id: String(row.id),
    planDateKst: String(row.plan_date_kst),
    slotTimeKst: String(row.slot_time_kst),
    slotOrder: Number(row.slot_order ?? 0),
    categoryId: row.category_id ? String(row.category_id) : null,
    categorySlug: String(row.category_slug),
    status: String(row.status ?? "planned"),
    postId: row.post_id ? String(row.post_id) : null,
    plannerRunId: row.planner_run_id ? String(row.planner_run_id) : null,
    errorSummary: row.error_summary ? String(row.error_summary) : null,
    metadata: parseJsonObject(row.metadata_json),
    executedAt: row.executed_at ? String(row.executed_at) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listAutomationPlanItems(
  db: D1Database,
  options: { planDateKst?: string; limit?: number; recent?: boolean; dueBefore?: string } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  if (options.dueBefore) {
    const result = await db
      .prepare(
        `
          SELECT
            id,
            plan_date_kst,
            slot_time_kst,
            slot_order,
            category_id,
            category_slug,
            status,
            post_id,
            planner_run_id,
            error_summary,
            metadata_json,
            executed_at,
            created_at,
            updated_at
          FROM automation_plan_items
          WHERE status = 'planned'
            AND slot_time_kst <= ?1
          ORDER BY slot_time_kst ASC, slot_order ASC
          LIMIT ?2
        `,
      )
      .bind(options.dueBefore, limit)
      .all<Record<string, unknown>>();
    return result.results.map(mapAutomationPlanItem);
  }

  if (options.recent) {
    const result = await db
      .prepare(
        `
          SELECT
            id,
            plan_date_kst,
            slot_time_kst,
            slot_order,
            category_id,
            category_slug,
            status,
            post_id,
            planner_run_id,
            error_summary,
            metadata_json,
            executed_at,
            created_at,
            updated_at
          FROM automation_plan_items
          ORDER BY slot_time_kst DESC, created_at DESC
          LIMIT ?1
        `,
      )
      .bind(limit)
      .all<Record<string, unknown>>();
    return result.results.map(mapAutomationPlanItem);
  }

  const planDateKst = options.planDateKst ?? "";
  const result = await db
    .prepare(
      `
        SELECT
          id,
          plan_date_kst,
          slot_time_kst,
          slot_order,
          category_id,
          category_slug,
          status,
          post_id,
          planner_run_id,
          error_summary,
          metadata_json,
          executed_at,
          created_at,
          updated_at
        FROM automation_plan_items
        WHERE plan_date_kst = ?1
        ORDER BY slot_order ASC, slot_time_kst ASC
      `,
    )
    .bind(planDateKst)
    .all<Record<string, unknown>>();
  return result.results.map(mapAutomationPlanItem);
}

export async function replaceAutomationPlanItems(
  db: D1Database,
  input: { planDateKst: string; items: AutomationPlanWriteInput[] },
) {
  const now = new Date().toISOString();
  await db.prepare("DELETE FROM automation_plan_items WHERE plan_date_kst = ?1").bind(input.planDateKst).run();

  if (!input.items.length) {
    return [];
  }

  await db.batch(
    input.items.map((item) =>
      db
        .prepare(
          `
            INSERT INTO automation_plan_items (
              id,
              plan_date_kst,
              slot_time_kst,
              slot_order,
              category_id,
              category_slug,
              status,
              post_id,
              planner_run_id,
              error_summary,
              metadata_json,
              executed_at,
              created_at,
              updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
          `,
        )
        .bind(
          item.id ?? crypto.randomUUID(),
          input.planDateKst,
          item.slotTimeKst,
          item.slotOrder,
          item.categoryId ?? null,
          item.categorySlug,
          item.status ?? "planned",
          item.postId ?? null,
          item.plannerRunId ?? null,
          item.errorSummary ?? null,
          JSON.stringify(item.metadata ?? {}),
          item.executedAt ?? null,
          now,
          now,
        ),
    ),
  );

  return listAutomationPlanItems(db, { planDateKst: input.planDateKst });
}

export async function updateAutomationPlanItem(
  db: D1Database,
  id: string,
  patch: Partial<AutomationPlanWriteInput>,
) {
  const existing = await db
    .prepare(
      `
        SELECT
          id,
          plan_date_kst,
          slot_time_kst,
          slot_order,
          category_id,
          category_slug,
          status,
          post_id,
          planner_run_id,
          error_summary,
          metadata_json,
          executed_at,
          created_at,
          updated_at
        FROM automation_plan_items
        WHERE id = ?1
        LIMIT 1
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const current = mapAutomationPlanItem(existing);
  const metadata = patch.metadata !== undefined ? patch.metadata : current.metadata;
  await db
    .prepare(
      `
        UPDATE automation_plan_items
        SET status = ?2,
            post_id = ?3,
            planner_run_id = ?4,
            error_summary = ?5,
            metadata_json = ?6,
            executed_at = ?7,
            updated_at = ?8
        WHERE id = ?1
      `,
    )
    .bind(
      id,
      patch.status ?? current.status,
      patch.postId ?? current.postId,
      patch.plannerRunId ?? current.plannerRunId,
      patch.errorSummary ?? current.errorSummary,
      JSON.stringify(metadata ?? {}),
      patch.executedAt ?? current.executedAt,
      now,
    )
    .run();

  const refreshed = await db
    .prepare(
      `
        SELECT
          id,
          plan_date_kst,
          slot_time_kst,
          slot_order,
          category_id,
          category_slug,
          status,
          post_id,
          planner_run_id,
          error_summary,
          metadata_json,
          executed_at,
          created_at,
          updated_at
        FROM automation_plan_items
        WHERE id = ?1
        LIMIT 1
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();

  return refreshed ? mapAutomationPlanItem(refreshed) : null;
}

export async function createAutomationRun(db: D1Database, input: AutomationRunWriteInput) {
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `
        INSERT INTO automation_runs (
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
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `,
    )
    .bind(
      id,
      input.categoryId ?? null,
      input.categorySlug,
      input.status,
      input.triggerType,
      input.summary ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.startedAt ?? now,
      input.finishedAt ?? null,
      now,
      now,
    )
    .run();

  return { id };
}

export async function updateAutomationRun(db: D1Database, id: string, patch: Partial<AutomationRunWriteInput>) {
  const existing = await db
    .prepare("SELECT metadata_json, status, summary, finished_at FROM automation_runs WHERE id = ?1 LIMIT 1")
    .bind(id)
    .first<Record<string, unknown>>();

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const metadata = patch.metadata !== undefined ? patch.metadata : parseJsonObject(existing.metadata_json);
  await db
    .prepare(
      `
        UPDATE automation_runs
        SET status = ?2,
            summary = ?3,
            metadata_json = ?4,
            finished_at = ?5,
            updated_at = ?6
        WHERE id = ?1
      `,
    )
    .bind(
      id,
      patch.status ?? String(existing.status ?? "completed"),
      patch.summary ?? (existing.summary ? String(existing.summary) : null),
      JSON.stringify(metadata ?? {}),
      patch.finishedAt ?? (existing.finished_at ? String(existing.finished_at) : null),
      now,
    )
    .run();

  return { id };
}
