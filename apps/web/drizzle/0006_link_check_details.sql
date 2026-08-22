-- Richer link-check probe fields (HTTP status, latency, error kind).
-- Runtime SoT remains ensureSchema(); this file mirrors for drizzle migrate / docs.

ALTER TABLE links ADD COLUMN check_http_status INTEGER;
--> statement-breakpoint
ALTER TABLE links ADD COLUMN check_latency_ms INTEGER;
--> statement-breakpoint
ALTER TABLE links ADD COLUMN check_error TEXT;
