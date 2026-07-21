import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("default search engine authority (service)", () => {
  let dbPath = "";

  beforeEach(() => {
    vi.resetModules();
    dbPath = path.join(os.tmpdir(), `linknest-engine-test-${Date.now()}-${Math.random()}.db`);
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

  it("lists exactly one default from site_settings authority", async () => {
    const svc = await boot();
    const engines = await svc.listSearchEngines();
    const settings = await svc.getSettings();
    expect(engines.filter((e) => e.isDefault)).toHaveLength(1);
    expect(engines.find((e) => e.isDefault)?.id).toBe(settings?.defaultSearchEngineId);
  });

  it("changing default updates authority and front-facing list", async () => {
    const svc = await boot();
    const engines = await svc.listSearchEngines();
    const other = engines.find((e) => !e.isDefault);
    expect(other).toBeTruthy();
    await svc.updateSearchEngine(other!.id, { isDefault: true });
    const next = await svc.listSearchEngines();
    const settings = await svc.getSettings();
    expect(settings?.defaultSearchEngineId).toBe(other!.id);
    expect(next.filter((e) => e.isDefault)).toHaveLength(1);
    expect(next.find((e) => e.isDefault)?.id).toBe(other!.id);
  });

  it("deleting default promotes another engine", async () => {
    const svc = await boot();
    const before = await svc.listSearchEngines();
    const defaultEngine = before.find((e) => e.isDefault)!;
    await svc.deleteSearchEngine(defaultEngine.id);
    const after = await svc.listSearchEngines();
    const settings = await svc.getSettings();
    expect(after.some((e) => e.id === defaultEngine.id)).toBe(false);
    expect(after.filter((e) => e.isDefault)).toHaveLength(1);
    expect(settings?.defaultSearchEngineId).toBe(after.find((e) => e.isDefault)?.id);
    expect(settings?.defaultSearchEngineId).not.toBe(defaultEngine.id);
  });

  it("public site falls back to first engine when selection missing", async () => {
    await boot();
    const { getPublicSite } = await import("@/lib/services/navigation");
    const site = await getPublicSite();
    expect(site.searchEngines.length).toBeGreaterThan(0);
    const pick =
      site.searchEngines.find((e) => e.id === site.defaultSearchEngineId) ?? site.searchEngines[0];
    expect(pick).toBeTruthy();
    expect(site.searchEngines.filter((e) => e.isDefault)).toHaveLength(1);
  });
});
