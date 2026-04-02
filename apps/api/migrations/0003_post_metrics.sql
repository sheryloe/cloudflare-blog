CREATE TABLE IF NOT EXISTS post_metrics (
  post_id TEXT PRIMARY KEY,
  view_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_metrics_view_count_updated_at
  ON post_metrics(view_count, updated_at);
