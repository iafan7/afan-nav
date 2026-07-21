import { and, asc, count, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../db/client";
import { categories, links } from "../db/schema";
import { ensureReady } from "../ready";
import type { z } from "zod";
import type { categoryCreateSchema, categoryUpdateSchema } from "../validators/category";

function nowIso() {
  return new Date().toISOString();
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function listCategories() {
  await ensureReady();
  const db = getDb();
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

export async function createCategory(input: z.infer<typeof categoryCreateSchema>) {
  await ensureReady();
  const db = getDb();
  const existing = db.select().from(categories).where(eq(categories.name, input.name)).get();
  if (existing) {
    throw new ServiceError("分类名称已存在", 409);
  }
  const now = nowIso();
  const row = {
    id: nanoid(),
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    visibility: input.visibility,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(categories).values(row).run();
  return row;
}

export async function updateCategory(id: string, input: z.infer<typeof categoryUpdateSchema>) {
  await ensureReady();
  const db = getDb();
  const current = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!current) {
    throw new ServiceError("分类不存在", 404);
  }
  if (input.name && input.name !== current.name) {
    const clash = db
      .select()
      .from(categories)
      .where(and(eq(categories.name, input.name), ne(categories.id, id)))
      .get();
    if (clash) {
      throw new ServiceError("分类名称已存在", 409);
    }
  }
  const updated = {
    name: input.name ?? current.name,
    sortOrder: input.sortOrder ?? current.sortOrder,
    visibility: input.visibility ?? current.visibility,
    updatedAt: nowIso(),
  };
  db.update(categories).set(updated).where(eq(categories.id, id)).run();
  return { ...current, ...updated };
}

export async function deleteCategory(id: string, confirm?: boolean) {
  await ensureReady();
  const db = getDb();
  const current = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!current) {
    throw new ServiceError("分类不存在", 404);
  }
  const linkCount =
    db.select({ value: count() }).from(links).where(eq(links.categoryId, id)).get()?.value ?? 0;
  if (linkCount > 0 && !confirm) {
    throw new ServiceError("分类非空，请确认后删除", 400);
  }
  db.delete(categories).where(eq(categories.id, id)).run();
  return { deletedLinks: linkCount };
}

export async function getCategoryLinkCount(id: string) {
  await ensureReady();
  const db = getDb();
  return db.select({ value: count() }).from(links).where(eq(links.categoryId, id)).get()?.value ?? 0;
}
