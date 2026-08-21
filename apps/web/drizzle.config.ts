import { defineConfig } from "drizzle-kit";

/**
 * Optional migrate path. Runtime schema source of truth is `lib/db/ensure-schema.ts`
 * (SQL under `./drizzle/` mirrors it). Prefer ensureSchema on boot.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/linknest.db",
  },
});
