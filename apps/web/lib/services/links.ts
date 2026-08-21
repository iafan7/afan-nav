import { and, asc, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { z } from "zod";
import { getDb } from "../db/client";
import { categories, links } from "../db/schema";
import { ensureReady } from "../ready";
import type { linkCreateSchema, linkUpdateSchema } from "../validators/link";
import { checkLinkReachable } from "./check-link";
import { ServiceError } from "./categories";

function nowIso() {
  return new Date().toISOString();
}

export type LinkCheckStatus = "valid" | "invalid" | null;

export async function listLinks(categoryId?: string) {
  await ensureReady();
  const db = getDb();
  if (categoryId) {
    return db
      .select()
      .from(links)
      .where(eq(links.categoryId, categoryId))
      .orderBy(asc(links.sortOrder), asc(links.title))
      .all();
  }
  return db.select().from(links).orderBy(asc(links.sortOrder), asc(links.title)).all();
}

export async function createLink(input: z.infer<typeof linkCreateSchema>) {
  await ensureReady();
  const db = getDb();
  const category = db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
  if (!category) {
    throw new ServiceError("分类不存在", 400);
  }
  const existing = db.select().from(links).where(eq(links.url, input.url)).get();
  if (existing) {
    throw new ServiceError("链接 URL 已存在", 409);
  }
  const now = nowIso();
  const row = {
    id: nanoid(),
    categoryId: input.categoryId,
    title: input.title,
    url: input.url,
    description: input.description ?? null,
    iconUrl: input.iconUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
    checkStatus: null as LinkCheckStatus,
    checkMessage: null as string | null,
    checkedAt: null as string | null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(links).values(row).run();
  return row;
}

export async function updateLink(id: string, input: z.infer<typeof linkUpdateSchema>) {
  await ensureReady();
  const db = getDb();
  const current = db.select().from(links).where(eq(links.id, id)).get();
  if (!current) {
    throw new ServiceError("链接不存在", 404);
  }
  if (input.categoryId) {
    const category = db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
    if (!category) {
      throw new ServiceError("分类不存在", 400);
    }
  }
  if (input.url && input.url !== current.url) {
    const clash = db
      .select()
      .from(links)
      .where(and(eq(links.url, input.url), ne(links.id, id)))
      .get();
    if (clash) {
      throw new ServiceError("链接 URL 已存在", 409);
    }
  }
  const urlChanged = Boolean(input.url && input.url !== current.url);
  const updated = {
    categoryId: input.categoryId ?? current.categoryId,
    title: input.title ?? current.title,
    url: input.url ?? current.url,
    description: input.description === undefined ? current.description : input.description,
    iconUrl: input.iconUrl === undefined ? current.iconUrl : input.iconUrl,
    sortOrder: input.sortOrder ?? current.sortOrder,
    updatedAt: nowIso(),
    ...(urlChanged
      ? { checkStatus: null as LinkCheckStatus, checkMessage: null, checkedAt: null }
      : {}),
  };
  db.update(links).set(updated).where(eq(links.id, id)).run();
  return { ...current, ...updated };
}

export async function deleteLink(id: string) {
  await ensureReady();
  const db = getDb();
  const current = db.select().from(links).where(eq(links.id, id)).get();
  if (!current) {
    throw new ServiceError("链接不存在", 404);
  }
  db.delete(links).where(eq(links.id, id)).run();
}

export async function checkAndPersistLink(id: string) {
  await ensureReady();
  const db = getDb();
  const current = db.select().from(links).where(eq(links.id, id)).get();
  if (!current) {
    throw new ServiceError("链接不存在", 404);
  }

  let checkStatus: "valid" | "invalid" = "invalid";
  let checkMessage = "检测失败";
  let latencyMs: number | null = null;
  let httpStatus: number | null = null;
  let finalUrl = current.url;

  try {
    const result = await checkLinkReachable(current.url);
    checkStatus = result.ok ? "valid" : "invalid";
    checkMessage = result.message;
    latencyMs = result.latencyMs;
    httpStatus = result.status;
    finalUrl = result.finalUrl;
  } catch (error) {
    if (error instanceof ServiceError) {
      checkMessage = error.message;
    }
  }

  const checkedAt = nowIso();
  db.update(links)
    .set({ checkStatus, checkMessage, checkedAt })
    .where(eq(links.id, id))
    .run();

  return {
    id,
    ok: checkStatus === "valid",
    checkStatus,
    checkMessage,
    checkedAt,
    latencyMs,
    status: httpStatus,
    finalUrl,
    message: checkMessage,
  };
}

/** Sequentially check all links (used by admin auto-refresh). */
export async function checkAndPersistAllLinks() {
  await ensureReady();
  const db = getDb();
  const rows = db.select({ id: links.id }).from(links).orderBy(asc(links.sortOrder)).all();
  const results = [];
  for (const row of rows) {
    results.push(await checkAndPersistLink(row.id));
  }
  return results;
}
