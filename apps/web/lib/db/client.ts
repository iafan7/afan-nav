import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function resolveDatabasePath() {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "linknest.db");
}

function createSqlite() {
  const dbPath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export function getSqlite() {
  if (!globalForDb.sqlite) {
    globalForDb.sqlite = createSqlite();
  }
  return globalForDb.sqlite;
}

export function getDb() {
  if (!globalForDb.db) {
    globalForDb.db = drizzle(getSqlite(), { schema });
  }
  return globalForDb.db;
}

/** Close and clear cached DB handles (tests only). */
export function __resetDbForTests() {
  if (globalForDb.sqlite) {
    try {
      globalForDb.sqlite.close();
    } catch {
      /* ignore */
    }
  }
  globalForDb.sqlite = undefined;
  globalForDb.db = undefined;
}

export type AppDb = ReturnType<typeof getDb>;
