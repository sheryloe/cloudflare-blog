ALTER TABLE prompt_categories ADD COLUMN selection_weight REAL NOT NULL DEFAULT 1.0;
ALTER TABLE prompt_categories ADD COLUMN selection_enabled INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS automation_plan_items (
  id TEXT PRIMARY KEY,
  plan_date_kst TEXT NOT NULL,
  slot_time_kst TEXT NOT NULL,
  slot_order INTEGER NOT NULL,
  category_id TEXT,
  category_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  post_id TEXT,
  planner_run_id TEXT,
  error_summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  executed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(plan_date_kst, slot_time_kst),
  FOREIGN KEY (category_id) REFERENCES prompt_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_plan_items_plan_date ON automation_plan_items(plan_date_kst, slot_order ASC);
CREATE INDEX IF NOT EXISTS idx_automation_plan_items_due ON automation_plan_items(status, slot_time_kst ASC);
