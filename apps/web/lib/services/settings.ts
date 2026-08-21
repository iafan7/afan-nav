import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { z } from "zod";
import { getDb, getSqlite } from "../db/client";
import { categories, links, searchEngines, siteSettings } from "../db/schema";
import { ensureReady } from "../ready";
import type { settingsUpdateSchema } from "../validators/auth";
import type {
  searchEngineCreateSchema,
  searchEngineUpdateSchema,
} from "../validators/search-engine";
import { ServiceError } from "./categories";

function nowIso() {
  return new Date().toISOString();
}

/**
 * site_settings.defaultSearchEngineId is the sole authority.
 * isDefault on search_engines is a denormalized mirror — always updated in the same transaction.
 */
function applyDefaultEngine(engineId: string | null) {
  const db = getDb();
  db.update(searchEngines).set({ isDefault: false }).run();
  if (engineId) {
    const exists = db.select().from(searchEngines).where(eq(searchEngines.id, engineId)).get();
    if (!exists) {
      throw new ServiceError("搜索引擎不存在", 400);
    }
    db.update(searchEngines).set({ isDefault: true }).where(eq(searchEngines.id, engineId)).run();
  }
  db.update(siteSettings)
    .set({ defaultSearchEngineId: engineId, updatedAt: nowIso() })
    .where(eq(siteSettings.id, 1))
    .run();
}

export async function getSettings() {
  await ensureReady();
  const db = getDb();
  return db.select().from(siteSettings).where(eq(siteSettings.id, 1)).get();
}

export async function updateSettings(input: z.infer<typeof settingsUpdateSchema>) {
  await ensureReady();
  const db = getDb();
  const current = await getSettings();
  if (!current) {
    throw new ServiceError("站点设置不存在", 500);
  }

  const nextDefault =
    input.defaultSearchEngineId === undefined
      ? current.defaultSearchEngineId
      : input.defaultSearchEngineId;

  if (nextDefault) {
    const engine = db.select().from(searchEngines).where(eq(searchEngines.id, nextDefault)).get();
    if (!engine) {
      throw new ServiceError("搜索引擎不存在", 400);
    }
  }

  const updated = {
    siteName: input.siteName ?? current.siteName,
    ownerNickname: input.ownerNickname ?? current.ownerNickname,
    defaultSearchEngineId: nextDefault,
    updatedAt: nowIso(),
  };

  getSqlite().transaction(() => {
    db.update(siteSettings).set(updated).where(eq(siteSettings.id, 1)).run();
    db.update(searchEngines).set({ isDefault: false }).run();
    if (nextDefault) {
      db.update(searchEngines)
        .set({ isDefault: true })
        .where(eq(searchEngines.id, nextDefault))
        .run();
    }
  })();

  return { ...current, ...updated };
}

export async function listSearchEngines() {
  await ensureReady();
  const db = getDb();
  const settings = await getSettings();
  const defaultId = settings?.defaultSearchEngineId ?? null;
  const rows = db
    .select()
    .from(searchEngines)
    .orderBy(asc(searchEngines.sortOrder), asc(searchEngines.name))
    .all();

  // Authority: settings id — never trust stale isDefault alone
  return rows.map((e) => ({
    ...e,
    isDefault: defaultId != null && e.id === defaultId,
  }));
}

export async function createSearchEngine(input: z.infer<typeof searchEngineCreateSchema>) {
  await ensureReady();
  const db = getDb();
  const settings = await getSettings();
  const row = {
    id: nanoid(),
    name: input.name,
    urlTemplate: input.urlTemplate,
    sortOrder: input.sortOrder ?? 0,
    isDefault: false,
  };

  const makeDefault = Boolean(input.isDefault) || !settings?.defaultSearchEngineId;

  getSqlite().transaction(() => {
    db.insert(searchEngines).values(row).run();
    if (makeDefault) {
      applyDefaultEngine(row.id);
    }
  })();

  return { ...row, isDefault: makeDefault };
}

export async function updateSearchEngine(
  id: string,
  input: z.infer<typeof searchEngineUpdateSchema>,
) {
  await ensureReady();
  const db = getDb();
  const current = db.select().from(searchEngines).where(eq(searchEngines.id, id)).get();
  if (!current) {
    throw new ServiceError("搜索引擎不存在", 404);
  }
  const settings = await getSettings();
  const wasDefault = settings?.defaultSearchEngineId === id;

  const updated = {
    name: input.name ?? current.name,
    urlTemplate: input.urlTemplate ?? current.urlTemplate,
    sortOrder: input.sortOrder ?? current.sortOrder,
  };

  getSqlite().transaction(() => {
    db.update(searchEngines).set(updated).where(eq(searchEngines.id, id)).run();
    if (input.isDefault === true) {
      applyDefaultEngine(id);
    } else if (input.isDefault === false && wasDefault) {
      // Unchecking default is not allowed to leave "no default" — keep this engine as authority
      applyDefaultEngine(id);
    }
  })();

  const nextSettings = await getSettings();
  return {
    ...current,
    ...updated,
    isDefault: nextSettings?.defaultSearchEngineId === id,
  };
}

export async function deleteSearchEngine(id: string) {
  await ensureReady();
  const db = getDb();
  const all = db.select().from(searchEngines).all();
  if (all.length <= 1) {
    throw new ServiceError("至少保留一个搜索引擎", 400);
  }
  const current = all.find((e) => e.id === id);
  if (!current) {
    throw new ServiceError("搜索引擎不存在", 404);
  }
  const settings = await getSettings();
  const wasDefault = settings?.defaultSearchEngineId === id;

  getSqlite().transaction(() => {
    db.delete(searchEngines).where(eq(searchEngines.id, id)).run();
    if (wasDefault) {
      const next = db.select().from(searchEngines).all()[0];
      applyDefaultEngine(next?.id ?? null);
    }
  })();
}

export async function exportSnapshot() {
  await ensureReady();
  const db = getDb();
  const settings = db.select().from(siteSettings).where(eq(siteSettings.id, 1)).get();
  return {
    exportedAt: nowIso(),
    siteSettings: settings
      ? {
          siteName: settings.siteName,
          ownerNickname: settings.ownerNickname,
          defaultSearchEngineId: settings.defaultSearchEngineId,
          updatedAt: settings.updatedAt,
        }
      : null,
    categories: db.select().from(categories).all(),
    links: db.select().from(links).all(),
    searchEngines: await listSearchEngines(),
  };
}
