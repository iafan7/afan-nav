import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getPublicNavigation", () => {
  let dbPath = "";

  beforeEach(() => {
    vi.resetModules();
    dbPath = path.join(os.tmpdir(), `linknest-nav-test-${Date.now()}-${Math.random()}.db`);
    process.env.DATABASE_PATH = dbPath;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  afterEach(async () => {
    const { __resetDbForTests } = await import("@/lib/db/client");
    __resetDbForTests();
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + suffix);
      } catch {
        /* ignore */
      }
    }
  });

  it("groups links without dropping categories and hides private by default", async () => {
    const { bootstrapDatabase } = await import("@/lib/db/seed");
    await bootstrapDatabase();
    const { createCategory } = await import("@/lib/services/categories");
    const { createLink } = await import("@/lib/services/links");
    const { getPublicNavigation } = await import("@/lib/services/navigation");

    const pub = await createCategory({ name: "公开A", sortOrder: 0, visibility: "public" });
    const priv = await createCategory({ name: "私有B", sortOrder: 1, visibility: "private" });
    await createLink({
      categoryId: pub.id,
      title: "Pub Link",
      url: "https://example.com/pub",
      sortOrder: 0,
    });
    await createLink({
      categoryId: priv.id,
      title: "Priv Link",
      url: "https://example.com/priv",
      sortOrder: 0,
    });

    const anon = await getPublicNavigation();
    expect(anon.categories.map((c) => c.name)).toEqual(["公开A"]);
    expect(anon.categories[0]?.links).toHaveLength(1);

    const admin = await getPublicNavigation({ includePrivate: true });
    expect(admin.categories.map((c) => c.name)).toEqual(["公开A", "私有B"]);
    expect(admin.categories.find((c) => c.id === priv.id)?.links[0]?.title).toBe("Priv Link");
  });
});
