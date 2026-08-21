import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, getSqlite } from "./client";
import { ensureSchema } from "./ensure-schema";
import { adminCredentials, searchEngines, siteSettings } from "./schema";
import { getAdminPasswordPolicyError, hashPassword } from "../auth/password";

function nowIso() {
  return new Date().toISOString();
}

/**
 * ADMIN_USERNAME / ADMIN_PASSWORD are first-boot only.
 * Once an admin_credentials row exists, SQLite is the sole authority —
 * env vars must never overwrite username or password_hash.
 * Password is never trimmed or truncated.
 */
function resolveBootstrapCredentials() {
  const isProd = process.env.NODE_ENV === "production";
  const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
  const username = process.env.ADMIN_USERNAME?.trim() || "";
  // Do not trim ADMIN_PASSWORD — spaces are significant.
  const password = process.env.ADMIN_PASSWORD ?? "";

  // Runtime production must set credentials; `next build` may still touch the DB without env.
  if (isProd && !isNextBuild) {
    if (!username || !password) {
      throw new Error(
        "Production bootstrap requires ADMIN_USERNAME and ADMIN_PASSWORD when no admin exists (weak defaults are not auto-created).",
      );
    }
    const policyError = getAdminPasswordPolicyError(password);
    if (policyError) {
      throw new Error(`Production ADMIN_PASSWORD invalid: ${policyError}`);
    }
    return { username, password };
  }

  const resolved = {
    username: username || "admin",
    password: password || "123456",
  };
  const policyError = getAdminPasswordPolicyError(resolved.password);
  if (policyError) {
    throw new Error(`ADMIN_PASSWORD invalid: ${policyError}`);
  }
  return resolved;
}

export async function bootstrapDatabase() {
  ensureSchema();
  const db = getDb();
  const now = nowIso();

  const settings = db.select().from(siteSettings).where(eq(siteSettings.id, 1)).get();
  if (!settings) {
    db.insert(siteSettings)
      .values({
        id: 1,
        siteName: "LinkNest",
        ownerNickname: "阿凡",
        defaultSearchEngineId: null,
        updatedAt: now,
      })
      .run();
  }

  const admin = db.select().from(adminCredentials).where(eq(adminCredentials.id, 1)).get();
  if (!admin) {
    const { username: defaultUsername, password: defaultPassword } = resolveBootstrapCredentials();
    const passwordHash = await hashPassword(defaultPassword);
    db.insert(adminCredentials)
      .values({
        id: 1,
        username: defaultUsername,
        passwordHash,
        authVersion: 1,
        createdAt: now,
        passwordChangedAt: now,
        updatedAt: now,
      })
      .run();
  } else {
    // Existing admin is authoritative — never overwrite password from env.
    // Only backfill empty username (legacy) without touching password_hash / auth_version.
    if (!admin.username?.trim()) {
      const username = process.env.ADMIN_USERNAME?.trim() || "admin";
      db.update(adminCredentials)
        .set({ username, updatedAt: now })
        .where(eq(adminCredentials.id, 1))
        .run();
    }
    if (admin.authVersion == null) {
      db.update(adminCredentials)
        .set({ authVersion: 1, updatedAt: now })
        .where(eq(adminCredentials.id, 1))
        .run();
    }
    if (!admin.createdAt) {
      db.update(adminCredentials)
        .set({ createdAt: admin.updatedAt || now, updatedAt: now })
        .where(eq(adminCredentials.id, 1))
        .run();
    }
  }

  const engines = db.select().from(searchEngines).all();
  if (engines.length === 0) {
    const defaults = [
      {
        id: nanoid(),
        name: "DuckDuckGo",
        urlTemplate: "https://duckduckgo.com/?q={query}",
        sortOrder: 0,
        isDefault: false,
      },
      {
        id: nanoid(),
        name: "Google",
        urlTemplate: "https://www.google.com/search?q={query}",
        sortOrder: 1,
        isDefault: false,
      },
      {
        id: nanoid(),
        name: "Bing",
        urlTemplate: "https://www.bing.com/search?q={query}",
        sortOrder: 2,
        isDefault: false,
      },
    ];
    const defaultId = defaults[0]!.id;
    getSqlite().transaction(() => {
      for (const engine of defaults) {
        db.insert(searchEngines)
          .values({ ...engine, isDefault: engine.id === defaultId })
          .run();
      }
      db.update(siteSettings)
        .set({ defaultSearchEngineId: defaultId, updatedAt: now })
        .where(eq(siteSettings.id, 1))
        .run();
    })();
  } else {
    // Heal drift: ensure settings authority and isDefault mirror agree
    const current = db.select().from(siteSettings).where(eq(siteSettings.id, 1)).get();
    let defaultId = current?.defaultSearchEngineId ?? null;
    if (defaultId && !engines.some((e) => e.id === defaultId)) {
      defaultId = engines[0]?.id ?? null;
    }
    if (!defaultId && engines[0]) {
      defaultId = engines[0].id;
    }
    if (defaultId) {
      getSqlite().transaction(() => {
        db.update(searchEngines).set({ isDefault: false }).run();
        db.update(searchEngines).set({ isDefault: true }).where(eq(searchEngines.id, defaultId)).run();
        db.update(siteSettings)
          .set({ defaultSearchEngineId: defaultId, updatedAt: now })
          .where(eq(siteSettings.id, 1))
          .run();
      })();
    }
  }
}
