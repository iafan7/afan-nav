-- Speed up category-scoped link lists / FK lookups.
-- Runtime SoT: ensureSchema() also creates this index.

CREATE INDEX IF NOT EXISTS links_category_id_idx ON links(category_id);
