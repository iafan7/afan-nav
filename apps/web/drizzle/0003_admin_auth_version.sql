-- Add auth_version / timestamps for admin password change invalidation.
-- Idempotent-friendly: ensureSchema also adds these columns for existing DBs.

ALTER TABLE admin_credentials ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE admin_credentials ADD COLUMN created_at TEXT;
--> statement-breakpoint
ALTER TABLE admin_credentials ADD COLUMN password_changed_at TEXT;
