-- Incremental changes for existing LinkNest DBs (also applied by ensureSchema).
-- Runtime uses ensureSchema() + ALTER ADD COLUMN; do not apply this by hand on production unless needed.

ALTER TABLE site_settings ADD COLUMN owner_nickname TEXT NOT NULL DEFAULT '阿凡';

CREATE TABLE IF NOT EXISTS daily_quote_cache (
  day_key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  author TEXT,
  fetched_at TEXT NOT NULL
);

-- Legacy daily_quotes content table (if present) is unused; dropped in 0002.
-- Public quotes: Hitokoto free API + daily_quote_cache + fixed fallback.
