import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportSnapshotSchema, importRequestSchema } from "@/lib/validators/import-snapshot";

describe("import snapshot validators", () => {
  it("rejects import without confirm", () => {
    const parsed = importRequestSchema.safeParse({
      confirm: false,
      snapshot: {
        siteSettings: null,
        categories: [],
        links: [],
        searchEngines: [
          {
            id: "e1",
            name: "DDG",
            urlTemplate: "https://duckduckgo.com/?q={query}",
            sortOrder: 0,
            isDefault: true,
          },
        ],
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty search engines", () => {
    const parsed = exportSnapshotSchema.safeParse({
      siteSettings: null,
      categories: [],
      links: [],
      searchEngines: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("importSnapshot service", () => {
  let dbPath = "";

  beforeEach(() => {
    vi.resetModules();
    dbPath = path.join(os.tmpdir(), `linknest-import-test-${Date.now()}-${Math.random()}.db`);
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

  async function boot() {
    const { bootstrapDatabase } = await import("@/lib/db/seed");
    await bootstrapDatabase();
    return import("@/lib/services/settings");
  }

  it("round-trips export → import and preserves admin credentials", async () => {
    const svc = await boot();
    const before = await svc.exportSnapshot();
    expect(before.searchEngines.length).toBeGreaterThan(0);
    expect(before.siteSettings?.linkCheckIntervalMinutes).toBe(60);

    const mutated = {
      ...before,
      siteSettings: before.siteSettings
        ? {
            ...before.siteSettings,
            siteName: "Imported Nest",
            ownerNickname: "Tester",
            linkCheckIntervalMinutes: 120,
          }
        : null,
      categories: [
        {
          id: "cat-import-1",
          name: "导入分类",
          sortOrder: 1,
          visibility: "public" as const,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      links: [
        {
          id: "link-import-1",
          categoryId: "cat-import-1",
          title: "Example",
          url: "https://example.com",
          description: null,
          iconUrl: null,
          sortOrder: 0,
          checkStatus: "valid" as const,
          checkMessage: "HTTP 200",
          checkedAt: "2026-01-02T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      searchEngines: [
        {
          id: "eng-import-1",
          name: "DuckDuckGo",
          urlTemplate: "https://duckduckgo.com/?q={query}",
          sortOrder: 0,
          isDefault: true,
        },
      ],
    };

    const { getDb } = await import("@/lib/db/client");
    const { adminCredentials } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const adminBefore = getDb().select().from(adminCredentials).where(eq(adminCredentials.id, 1)).get();

    const result = await svc.importSnapshot(mutated);
    expect(result).toEqual({ categories: 1, links: 1, searchEngines: 1 });

    const after = await svc.exportSnapshot();
    expect(after.siteSettings?.siteName).toBe("Imported Nest");
    expect(after.siteSettings?.ownerNickname).toBe("Tester");
    expect(after.siteSettings?.linkCheckIntervalMinutes).toBe(120);
    expect(after.categories).toHaveLength(1);
    expect(after.categories[0]?.id).toBe("cat-import-1");
    expect(after.links).toHaveLength(1);
    expect(after.links[0]?.url).toBe("https://example.com");
    expect(after.links[0]?.checkStatus).toBe("valid");
    expect(after.links[0]?.checkMessage).toBe("HTTP 200");
    expect(after.links[0]?.checkedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(after.searchEngines).toHaveLength(1);
    expect(after.searchEngines[0]?.isDefault).toBe(true);
    expect(after.siteSettings?.defaultSearchEngineId).toBe("eng-import-1");

    const adminAfter = getDb().select().from(adminCredentials).where(eq(adminCredentials.id, 1)).get();
    expect(adminAfter?.username).toBe(adminBefore?.username);
    expect(adminAfter?.passwordHash).toBe(adminBefore?.passwordHash);
    expect(adminAfter?.authVersion).toBe(adminBefore?.authVersion);
  });

  it("keeps current check interval when older export omits it", async () => {
    const svc = await boot();
    await svc.updateSettings({ linkCheckIntervalMinutes: 90 });
    const snapshot = await svc.exportSnapshot();
    const { linkCheckIntervalMinutes: _omit, ...restSettings } = snapshot.siteSettings!;
    await svc.importSnapshot({
      ...snapshot,
      siteSettings: restSettings as typeof snapshot.siteSettings,
      categories: [],
      links: [],
      searchEngines: snapshot.searchEngines.slice(0, 1).map((e) => ({ ...e, isDefault: true })),
    });
    const after = await svc.exportSnapshot();
    expect(after.siteSettings?.linkCheckIntervalMinutes).toBe(90);
  });

  it("rejects links that reference missing categories", async () => {
    const svc = await boot();
    const snapshot = await svc.exportSnapshot();
    await expect(
      svc.importSnapshot({
        ...snapshot,
        categories: [],
        links: [
          {
            id: "orphan",
            categoryId: "missing",
            title: "Broken",
            url: "https://example.org",
            description: null,
            iconUrl: null,
            sortOrder: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        searchEngines: snapshot.searchEngines.slice(0, 1),
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("不存在的分类"), status: 400 });
  });
});
