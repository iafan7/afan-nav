import { eq } from "drizzle-orm";
import type { z } from "zod";
import { getAdminPasswordPolicyError, hashPassword, verifyPassword } from "@/lib/auth/password";
import { getDb, getSqlite } from "@/lib/db/client";
import { adminCredentials } from "@/lib/db/schema";
import { ensureReady } from "@/lib/ready";
import { ServiceError } from "@/lib/services/categories";
import type { changePasswordSchema } from "@/lib/validators/auth";

function nowIso() {
  return new Date().toISOString();
}

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Update admin password hash and bump auth_version.
 * Returns the new authVersion (for updating the current session).
 * Never returns password or hash.
 */
export async function changeAdminPassword(input: ChangePasswordInput): Promise<{ authVersion: number }> {
  await ensureReady();
  const db = getDb();
  const admin = db.select().from(adminCredentials).where(eq(adminCredentials.id, 1)).get();
  if (!admin) {
    throw new ServiceError("密码修改失败，请稍后重试", 500);
  }

  const currentOk = await verifyPassword(input.currentPassword, admin.passwordHash);
  if (!currentOk) {
    throw new ServiceError("当前密码不正确", 400);
  }

  // Defense in depth (schema already checks equality / length)
  if (input.newPassword !== input.confirmPassword) {
    throw new ServiceError("两次输入的新密码不一致", 400);
  }
  if (input.newPassword === input.currentPassword) {
    throw new ServiceError("新密码不能与当前密码相同", 400);
  }
  const policyError = getAdminPasswordPolicyError(input.newPassword);
  if (policyError) {
    throw new ServiceError(policyError.startsWith("密码") ? `新${policyError}` : policyError, 400);
  }

  const sameAsStored = await verifyPassword(input.newPassword, admin.passwordHash);
  if (sameAsStored) {
    throw new ServiceError("新密码不能与当前密码相同", 400);
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.newPassword);
  } catch {
    throw new ServiceError("密码修改失败，请稍后重试", 500);
  }

  const now = nowIso();
  const nextVersion = (admin.authVersion ?? 1) + 1;

  try {
    getSqlite().transaction(() => {
      db.update(adminCredentials)
        .set({
          passwordHash,
          authVersion: nextVersion,
          passwordChangedAt: now,
          updatedAt: now,
        })
        .where(eq(adminCredentials.id, 1))
        .run();
    })();
  } catch {
    throw new ServiceError("密码修改失败，请稍后重试", 500);
  }

  return { authVersion: nextVersion };
}
