import { and, asc, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { z } from "zod";
import { getDb } from "../db/client";
import { categories, links } from "../db/schema";
import { ensureReady } from "../ready";
import type { linkCreateSchema, linkUpdateSchema } from "../validators/link";
import {
  checkLinkReachable,
  mapHealthToDbStatus,
  type CheckErrorKind,
  type LinkHealth,
} from "./check-link";
import { ServiceError } from "./categories";

function nowIso() {
  return new Date().toISOString();
}

/** Parallel outbound checks; keep modest to avoid socket storms. */
const LINK_CHECK_CONCURRENCY = 5;

type LinkCheckResult = {
  id: string;
  ok: boolean;
  checkStatus: "valid" | "invalid" | null;
  checkMessage: string;
  checkedAt: string;
  latencyMs: number | null;
  status: number | null;
  finalUrl: string;
  message: string;
  health: LinkHealth;
  errorKind: CheckErrorKind;
};

const globalForLinkCheck = globalThis as unknown as {
  __linkCheckBatchInflight?: Promise<LinkCheckResult[]>;
};

export type LinkCheckStatus = "valid" | "invalid" | null;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }
  const pool = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: pool }, () => run()));
  return results;
}

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
    checkHttpStatus: null as number | null,
    checkLatencyMs: null as number | null,
    checkError: null as string | null,
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
      ? {
          checkStatus: null as LinkCheckStatus,
          checkMessage: null,
          checkedAt: null,
          checkHttpStatus: null,
          checkLatencyMs: null,
          checkError: null,
        }
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

export async function checkAndPersistLink(
  id: string,
  preloaded?: { id: string; url: string; checkStatus?: LinkCheckStatus },
): Promise<LinkCheckResult> {
  await ensureReady();
  const db = getDb();
  const current =
    preloaded && preloaded.id === id
      ? preloaded
      : db
          .select({
            id: links.id,
            url: links.url,
            checkStatus: links.checkStatus,
          })
          .from(links)
          .where(eq(links.id, id))
          .get();
  if (!current) {
    throw new ServiceError("链接不存在", 404);
  }

  const previousStatus: LinkCheckStatus =
    current.checkStatus === "valid" || current.checkStatus === "invalid"
      ? current.checkStatus
      : null;

  let checkStatus: LinkCheckStatus = previousStatus;
  let checkMessage = "检测失败";
  let latencyMs: number | null = null;
  let httpStatus: number | null = null;
  let checkError: CheckErrorKind = null;
  let health: LinkHealth = "unchecked";
  let finalUrl = current.url;
  let ok = false;

  try {
    const result = await checkLinkReachable(current.url);
    health = result.health;
    checkMessage = result.message;
    latencyMs = result.latencyMs;
    httpStatus = result.status;
    finalUrl = result.finalUrl;
    checkError = result.errorKind;
    // Probe failures must not flip the link to "broken"
    if (result.health === "unchecked") {
      checkStatus = previousStatus;
      ok = previousStatus === "valid";
    } else {
      checkStatus = mapHealthToDbStatus(result.health);
      ok = result.ok;
    }
  } catch (error) {
    health = "unchecked";
    checkError = "connection_error";
    if (error instanceof ServiceError) {
      checkMessage = error.message;
      if (/重定向|内网|本地/.test(error.message)) {
        checkError = "redirect_error";
      }
    }
    checkStatus = previousStatus;
    ok = previousStatus === "valid";
  }

  const checkedAt = nowIso();
  db.update(links)
    .set({
      checkStatus,
      checkMessage,
      checkedAt,
      checkHttpStatus: httpStatus,
      checkLatencyMs: latencyMs,
      checkError,
    })
    .where(eq(links.id, id))
    .run();

  return {
    id,
    ok,
    checkStatus,
    checkMessage,
    checkedAt,
    latencyMs,
    status: httpStatus,
    finalUrl,
    message: checkMessage,
    health,
    errorKind: checkError,
  };
}

/**
 * Check all links with bounded concurrency.
 * Single-flight: overlapping scheduler + admin check-all share one in-flight batch.
 */
export async function checkAndPersistAllLinks(): Promise<LinkCheckResult[]> {
  if (globalForLinkCheck.__linkCheckBatchInflight) {
    return globalForLinkCheck.__linkCheckBatchInflight;
  }

  globalForLinkCheck.__linkCheckBatchInflight = (async () => {
    try {
      await ensureReady();
      const db = getDb();
      const rows = db
        .select({
          id: links.id,
          url: links.url,
          checkStatus: links.checkStatus,
        })
        .from(links)
        .orderBy(asc(links.sortOrder))
        .all();
      return mapPool(rows, LINK_CHECK_CONCURRENCY, (row) =>
        checkAndPersistLink(row.id, {
          id: row.id,
          url: row.url,
          checkStatus:
            row.checkStatus === "valid" || row.checkStatus === "invalid"
              ? row.checkStatus
              : null,
        }),
      );
    } finally {
      globalForLinkCheck.__linkCheckBatchInflight = undefined;
    }
  })();

  return globalForLinkCheck.__linkCheckBatchInflight;
}
