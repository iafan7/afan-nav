import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

describe("admin password change + bootstrap authority", () => {
  let dbPath = "";

  beforeEach(() => {
    vi.resetModules();
    dbPath = path.join(os.tmpdir(), `linknest-admin-sec-${Date.now()}-${Math.random()}.db`);
    process.env.DATABASE_PATH = dbPath;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "bootstrap-pass-1";
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
  }

  async function getAdmin() {
    const { getDb } = await import("@/lib/db/client");
    const { adminCredentials } = await import("@/lib/db/schema");
    return getDb().select().from(adminCredentials).where(eq(adminCredentials.id, 1)).get();
  }

  it("initializes admin from env when DB has no admin row", async () => {
    await boot();
    const admin = await getAdmin();
    expect(admin).toBeTruthy();
    expect(admin!.username).toBe("admin");
    expect(admin!.passwordHash).toMatch(/^\$2[aby]?\$/);
    expect(admin!.passwordHash).not.toContain("bootstrap-pass-1");
    expect(admin!.authVersion).toBe(1);
    const { verifyPassword } = await import("@/lib/auth/password");
    expect(await verifyPassword("bootstrap-pass-1", admin!.passwordHash)).toBe(true);
  });

  it("does not overwrite existing admin when env password changes", async () => {
    await boot();
    const before = await getAdmin();
    process.env.ADMIN_PASSWORD = "env-should-not-win-999";
    vi.resetModules();
    process.env.DATABASE_PATH = dbPath;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "env-should-not-win-999";
    const { bootstrapDatabase } = await import("@/lib/db/seed");
    await bootstrapDatabase();
    const after = await getAdmin();
    expect(after!.passwordHash).toBe(before!.passwordHash);
    expect(after!.authVersion).toBe(before!.authVersion);
    const { verifyPassword } = await import("@/lib/auth/password");
    expect(await verifyPassword("bootstrap-pass-1", after!.passwordHash)).toBe(true);
    expect(await verifyPassword("env-should-not-win-999", after!.passwordHash)).toBe(false);
  });

  it("changes password with correct current password and bumps auth_version", async () => {
    await boot();
    const { changeAdminPassword } = await import("@/lib/services/admin-security");
    const result = await changeAdminPassword({
      currentPassword: "bootstrap-pass-1",
      newPassword: "new-secure-pass1",
      confirmPassword: "new-secure-pass1",
    });
    expect(result.authVersion).toBe(2);
    const admin = await getAdmin();
    expect(admin!.authVersion).toBe(2);
    expect(admin!.passwordChangedAt).toBeTruthy();
    expect(JSON.stringify(admin)).not.toMatch(/new-secure-pass1|bootstrap-pass-1/);
    const { verifyPassword } = await import("@/lib/auth/password");
    expect(await verifyPassword("new-secure-pass1", admin!.passwordHash)).toBe(true);
    expect(await verifyPassword("bootstrap-pass-1", admin!.passwordHash)).toBe(false);
  });

  it("rejects wrong current password", async () => {
    await boot();
    const { changeAdminPassword } = await import("@/lib/services/admin-security");
    await expect(
      changeAdminPassword({
        currentPassword: "wrong-password",
        newPassword: "new-secure-pass1",
        confirmPassword: "new-secure-pass1",
      }),
    ).rejects.toThrow("当前密码不正确");
  });

  it("rejects mismatched confirm password", async () => {
    await boot();
    const { changePasswordSchema } = await import("@/lib/validators/auth");
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "bootstrap-pass-1",
      newPassword: "new-secure-pass1",
      confirmPassword: "different-pass!!",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === "两次输入的新密码不一致")).toBe(true);
    }
  });

  it("rejects short new password", async () => {
    await boot();
    const { changePasswordSchema } = await import("@/lib/validators/auth");
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "bootstrap-pass-1",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === "新密码长度需为 6～18 个字符")).toBe(true);
    }
  });

  it("allows 6-char and 18-char new passwords", async () => {
    await boot();
    const { changePasswordSchema } = await import("@/lib/validators/auth");
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "bootstrap-pass-1",
        newPassword: "abcdef",
        confirmPassword: "abcdef",
      }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "bootstrap-pass-1",
        newPassword: "123456789012345678",
        confirmPassword: "123456789012345678",
      }).success,
    ).toBe(true);
  });

  it("rejects 19-char and blank new passwords", async () => {
    await boot();
    const { changePasswordSchema } = await import("@/lib/validators/auth");
    const tooLong = changePasswordSchema.safeParse({
      currentPassword: "bootstrap-pass-1",
      newPassword: "1234567890123456789",
      confirmPassword: "1234567890123456789",
    });
    expect(tooLong.success).toBe(false);
    const blank = changePasswordSchema.safeParse({
      currentPassword: "bootstrap-pass-1",
      newPassword: "      ",
      confirmPassword: "      ",
    });
    expect(blank.success).toBe(false);
    if (!blank.success) {
      expect(blank.error.issues.some((i) => i.message === "新密码不能为空白")).toBe(true);
    }
  });

  it("rejects new password equal to current password", async () => {
    await boot();
    const { changePasswordSchema } = await import("@/lib/validators/auth");
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "same-password-xx",
      newPassword: "same-password-xx",
      confirmPassword: "same-password-xx",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === "新密码不能与当前密码相同")).toBe(true);
    }
  });
});
