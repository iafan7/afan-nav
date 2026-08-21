-- Drop legacy content table from early MVP drafts.
-- Public daily quote uses Hitokoto + daily_quote_cache (keep that table).
-- Do not edit 0000 / 0001 history files; apply via ensureSchema() or this migration.

DROP TABLE IF EXISTS daily_quotes;
