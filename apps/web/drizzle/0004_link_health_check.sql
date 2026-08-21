-- Link health-check columns + auto-check interval.
-- Runtime SoT remains ensureSchema(); this file mirrors for drizzle migrate / docs.

ALTER TABLE site_settings ADD COLUMN link_check_interval_minutes INTEGER NOT NULL DEFAULT 60;
--> statement-breakpoint
ALTER TABLE links ADD COLUMN check_status TEXT;
--> statement-breakpoint
ALTER TABLE links ADD COLUMN check_message TEXT;
--> statement-breakpoint
ALTER TABLE links ADD COLUMN checked_at TEXT;
