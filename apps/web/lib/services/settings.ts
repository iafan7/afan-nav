import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { z } from "zod";
import { getDb, getSqlite } from "../db/client";
import { categories, links, searchEngines, siteSettings } from "../db/schema";
import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "../link-check-defaults";
import { ensureReady } from "../ready";
import type { settingsUpdateSchema } from "../validators/auth";
import type { ExportSnapshotInput } from "../validators/import-snapshot";
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
    linkCheckIntervalMinutes:
      input.linkCheckIntervalMinutes === undefined
        ? (current.linkCheckIntervalMinutes ?? DEFAULT_LINK_CHECK_INTERVAL_MINUTES)
        : input.linkCheckIntervalMinutes,
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
          linkCheckIntervalMinutes: settings.linkCheckIntervalMinutes,
          updatedAt: settings.updatedAt,
        }
      : null,
    categories: db.select().from(categories).all(),
    links: db.select().from(links).all(),
    searchEngines: await listSearchEngines(),
  };
}

/**
 * Full replace of site content from an export JSON snapshot.
 * Does not touch admin_credentials or daily_quote_cache.
 */
export async function importSnapshot(snapshot: ExportSnapshotInput) {
  await ensureReady();
  const db = getDb();
  const current = db.select().from(siteSettings).where(eq(siteSettings.id, 1)).get();
  if (!current) {
    throw new ServiceError("站点设置不存在", 500);
  }

  const categoryIds = new Set(snapshot.categories.map((c) => c.id));
  if (categoryIds.size !== snapshot.categories.length) {
    throw new ServiceError("分类 ID 重复", 400);
  }
  const categoryNames = new Set(snapshot.categories.map((c) => c.name));
  if (categoryNames.size !== snapshot.categories.length) {
    throw new ServiceError("分类名称重复", 400);
  }

  const linkIds = new Set(snapshot.links.map((l) => l.id));
  if (linkIds.size !== snapshot.links.length) {
    throw new ServiceError("链接 ID 重复", 400);
  }
  const linkUrls = new Set(snapshot.links.map((l) => l.url));
  if (linkUrls.size !== snapshot.links.length) {
    throw new ServiceError("链接 URL 重复", 400);
  }
  for (const link of snapshot.links) {
    if (!categoryIds.has(link.categoryId)) {
      throw new ServiceError(`链接「${link.title}」引用了不存在的分类`, 400);
    }
  }

  const engineIds = new Set(snapshot.searchEngines.map((e) => e.id));
  if (engineIds.size !== snapshot.searchEngines.length) {
    throw new ServiceError("搜索引擎 ID 重复", 400);
  }

  let nextDefault: string | null = null;
  const fromSettings = snapshot.siteSettings?.defaultSearchEngineId ?? null;
  if (fromSettings && engineIds.has(fromSettings)) {
    nextDefault = fromSettings;
  } else {
    nextDefault =
      snapshot.searchEngines.find((e) => e.isDefault)?.id ??
      snapshot.searchEngines[0]?.id ??
      null;
  }

  if (!nextDefault) {
    throw new ServiceError("至少需要一个搜索引擎", 400);
  }

  const nextSiteName = snapshot.siteSettings?.siteName ?? current.siteName;
  const nextOwnerNickname = snapshot.siteSettings?.ownerNickname ?? current.ownerNickname;
  const nextLinkCheckInterval =
    snapshot.siteSettings?.linkCheckIntervalMinutes ??
    current.linkCheckIntervalMinutes ??
    DEFAULT_LINK_CHECK_INTERVAL_MINUTES;
  const stamp = nowIso();

  try {
    getSqlite().transaction(() => {
      db.delete(links).run();
      db.delete(categories).run();
      db.delete(searchEngines).run();

      for (const category of snapshot.categories) {
        db.insert(categories)
          .values({
            id: category.id,
            name: category.name,
            sortOrder: category.sortOrder,
            visibility: category.visibility,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
          })
          .run();
      }

      for (const link of snapshot.links) {
        db.insert(links)
          .values({
            id: link.id,
            categoryId: link.categoryId,
            title: link.title,
            url: link.url,
            description: link.description ?? null,
            iconUrl: link.iconUrl ?? null,
            sortOrder: link.sortOrder,
            checkStatus: link.checkStatus ?? null,
            checkMessage: link.checkMessage ?? null,
            checkedAt: link.checkedAt ?? null,
            checkHttpStatus: link.checkHttpStatus ?? null,
            checkLatencyMs: link.checkLatencyMs ?? null,
            checkError: link.checkError ?? null,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
          })
          .run();
      }

      for (const engine of snapshot.searchEngines) {
        db.insert(searchEngines)
          .values({
            id: engine.id,
            name: engine.name,
            urlTemplate: engine.urlTemplate,
            sortOrder: engine.sortOrder,
            isDefault: false,
          })
          .run();
      }

      db.update(siteSettings)
        .set({
          siteName: nextSiteName,
          ownerNickname: nextOwnerNickname,
          defaultSearchEngineId: nextDefault,
          linkCheckIntervalMinutes: nextLinkCheckInterval,
          updatedAt: stamp,
        })
        .where(eq(siteSettings.id, 1))
        .run();

      applyDefaultEngine(nextDefault);
    })();
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("导入失败，数据未写入", 400);
  }

  return {
    categories: snapshot.categories.length,
    links: snapshot.links.length,
    searchEngines: snapshot.searchEngines.length,
  };
}
