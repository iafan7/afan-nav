import { asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { categories, links, searchEngines, siteSettings } from "../db/schema";
import { ensureReady } from "../ready";

export async function getPublicNavigation(options?: { includePrivate?: boolean }) {
  await ensureReady();
  const db = getDb();
  const includePrivate = Boolean(options?.includePrivate);

  const allCategories = db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  const visibleCategories = includePrivate
    ? allCategories
    : allCategories.filter((cat) => cat.visibility === "public");

  const visibleIds = new Set(visibleCategories.map((c) => c.id));

  // Single query for all links, then group in memory (avoids N+1 per category).
  const allLinks = db
    .select()
    .from(links)
    .orderBy(asc(links.sortOrder), asc(links.title))
    .all();

  const linksByCategory = new Map<string, typeof allLinks>();
  for (const link of allLinks) {
    if (!visibleIds.has(link.categoryId)) continue;
    const bucket = linksByCategory.get(link.categoryId);
    if (bucket) bucket.push(link);
    else linksByCategory.set(link.categoryId, [link]);
  }

  return {
    categories: visibleCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sortOrder,
      visibility: cat.visibility as "public" | "private",
      links: (linksByCategory.get(cat.id) ?? []).map((link) => ({
        id: link.id,
        title: link.title,
        url: link.url,
        description: link.description,
        iconUrl: link.iconUrl,
        sortOrder: link.sortOrder,
      })),
    })),
  };
}

export async function getPublicSite() {
  await ensureReady();
  const db = getDb();
  const settings = db.select().from(siteSettings).where(eq(siteSettings.id, 1)).get();
  const engines = db
    .select()
    .from(searchEngines)
    .orderBy(asc(searchEngines.sortOrder), asc(searchEngines.name))
    .all();

  return {
    siteName: settings?.siteName ?? "LinkNest",
    ownerNickname: settings?.ownerNickname?.trim() || "阿凡",
    defaultSearchEngineId: settings?.defaultSearchEngineId ?? null,
    searchEngines: engines.map((e) => ({
      id: e.id,
      name: e.name,
      urlTemplate: e.urlTemplate,
      isDefault: settings?.defaultSearchEngineId != null && e.id === settings.defaultSearchEngineId,
    })),
  };
}
