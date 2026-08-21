import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "../link-check-defaults";
import { getSqlite } from "./client";

function ensureColumn(table: string, column: string, addSql: string): boolean {
  const sqlite = getSqlite();
  const cols = sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${addSql}`);
    return true;
  }
  return false;
}

/**
 * Runtime schema source of truth (idempotent).
 * Drizzle SQL under `apps/web/drizzle/` mirrors this for documentation / optional migrate —
 * do not run migrate alone without also matching these columns.
 */
export function ensureSchema() {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      site_name TEXT NOT NULL DEFAULT 'LinkNest',
      owner_nickname TEXT NOT NULL DEFAULT '阿凡',
      default_search_engine_id TEXT,
      link_check_interval_minutes INTEGER NOT NULL DEFAULT ${DEFAULT_LINK_CHECK_INTERVAL_MINUTES},
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY DEFAULT 1,
      username TEXT NOT NULL DEFAULT 'admin',
      password_hash TEXT NOT NULL,
      auth_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      password_changed_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      description TEXT,
      icon_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      check_status TEXT,
      check_message TEXT,
      checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_engines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url_template TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_quote_cache (
      day_key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      author TEXT,
      fetched_at TEXT NOT NULL
    );
  `);

  // Existing DBs created before owner_nickname / username / auth_version
  ensureColumn("site_settings", "owner_nickname", `owner_nickname TEXT NOT NULL DEFAULT '阿凡'`);
  ensureColumn(
    "site_settings",
    "link_check_interval_minutes",
    `link_check_interval_minutes INTEGER NOT NULL DEFAULT ${DEFAULT_LINK_CHECK_INTERVAL_MINUTES}`,
  );
  ensureColumn("links", "check_status", `check_status TEXT`);
  ensureColumn("links", "check_message", `check_message TEXT`);
  ensureColumn("links", "checked_at", `checked_at TEXT`);

  const adminUsernameAdded = ensureColumn(
    "admin_credentials",
    "username",
    `username TEXT NOT NULL DEFAULT 'admin'`,
  );
  ensureColumn("admin_credentials", "auth_version", `auth_version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn("admin_credentials", "created_at", `created_at TEXT`);
  ensureColumn("admin_credentials", "password_changed_at", `password_changed_at TEXT`);

  return { adminUsernameAdded };
}

