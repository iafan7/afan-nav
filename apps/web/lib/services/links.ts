import { and, asc, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { z } from "zod";
import { getDb } from "../db/client";
import { categories, links } from "../db/schema";
import { ensureReady } from "../ready";
import type { linkCreateSchema, linkUpdateSchema } from "../validators/link";
import { ServiceError } from "./categories";

function nowIso() {
  return new Date().toISOString();
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
  const updated = {
    categoryId: input.categoryId ?? current.categoryId,
    title: input.title ?? current.title,
    url: input.url ?? current.url,
    description: input.description === undefined ? current.description : input.description,
    iconUrl: input.iconUrl === undefined ? current.iconUrl : input.iconUrl,
    sortOrder: input.sortOrder ?? current.sortOrder,
    updatedAt: nowIso(),
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
