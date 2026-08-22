import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "../link-check-defaults";

export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  siteName: text("site_name").notNull().default("LinkNest"),
  ownerNickname: text("owner_nickname").notNull().default("阿凡"),
  defaultSearchEngineId: text("default_search_engine_id"),
  /** Auto link health-check interval in minutes. 0 = disabled. */
  linkCheckIntervalMinutes: integer("link_check_interval_minutes")
    .notNull()
    .default(DEFAULT_LINK_CHECK_INTERVAL_MINUTES),
  updatedAt: text("updated_at").notNull(),
});

export const adminCredentials = sqliteTable("admin_credentials", {
  id: integer("id").primaryKey().default(1),
  username: text("username").notNull().default("admin"),
  passwordHash: text("password_hash").notNull(),
  /** Bumped on password change; session must match or is treated as logged out. */
  authVersion: integer("auth_version").notNull().default(1),
  createdAt: text("created_at"),
  passwordChangedAt: text("password_changed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  visibility: text("visibility", { enum: ["public", "private"] }).notNull().default("public"), // 公开 / 私有（私有仅管理员前台可见）
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const links = sqliteTable("links", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  description: text("description"),
  iconUrl: text("icon_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  /** null = never checked / probe inconclusive; valid | invalid (maps from health) */
  checkStatus: text("check_status", { enum: ["valid", "invalid"] }),
  checkMessage: text("check_message"),
  checkedAt: text("checked_at"),
  /** Last HTTP status from probe; null if transport failure. */
  checkHttpStatus: integer("check_http_status"),
  /** Round-trip latency of last probe in ms. */
  checkLatencyMs: integer("check_latency_ms"),
  /** Probe error kind when health is unchecked (timeout, dns_error, …). */
  checkError: text("check_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const searchEngines = sqliteTable("search_engines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  urlTemplate: text("url_template").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Denormalized mirror of site_settings.defaultSearchEngineId — keep in sync in the same transaction. */
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
});

/** Day-stable cache for Hitokoto (or other free API) responses. */
export const dailyQuoteCache = sqliteTable("daily_quote_cache", {
  dayKey: text("day_key").primaryKey(),
  content: text("content").notNull(),
  author: text("author"),
  fetchedAt: text("fetched_at").notNull(),
});

export type Category = typeof categories.$inferSelect;
export type Link = typeof links.$inferSelect;
export type SearchEngine = typeof searchEngines.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type DailyQuoteCache = typeof dailyQuoteCache.$inferSelect;
