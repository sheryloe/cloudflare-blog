CREATE TABLE IF NOT EXISTS prompt_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  schedule_time TEXT NOT NULL DEFAULT '12:00',
  schedule_timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category_id, stage),
  FOREIGN KEY (category_id) REFERENCES prompt_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prompt_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(template_id, version),
  FOREIGN KEY (template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  category_id TEXT,
  category_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES prompt_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_categories_slug ON prompt_categories(slug);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category_stage ON prompt_templates(category_id, stage);
CREATE INDEX IF NOT EXISTS idx_automation_runs_category_started_at ON automation_runs(category_slug, started_at DESC);

INSERT OR IGNORE INTO prompt_categories (
  id,
  slug,
  name,
  description,
  status,
  schedule_time,
  schedule_timezone,
  created_at,
  updated_at
) VALUES
  (
    'category-travel',
    'travel',
    'Travel',
    'Travel and culture automation channel.',
    'active',
    '12:00',
    'Asia/Seoul',
    '2026-03-21T00:00:00.000Z',
    '2026-03-21T00:00:00.000Z'
  ),
  (
    'category-mystery',
    'mystery',
    'Mystery',
    'Mystery, incident, legend, and history automation channel.',
    'active',
    '12:30',
    'Asia/Seoul',
    '2026-03-21T00:00:00.000Z',
    '2026-03-21T00:00:00.000Z'
  );
