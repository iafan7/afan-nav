import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** bcrypt effective input limit */
export const BCRYPT_MAX_BYTES = 72;

export const ADMIN_PASSWORD_MIN_LENGTH = 6;
export const ADMIN_PASSWORD_MAX_LENGTH = 18;

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

/**
 * Shared admin password policy (bootstrap, change-password, restore script).
 * Does not trim or truncate — callers must pass the raw password string.
 */
export function getAdminPasswordPolicyError(password: string): string | null {
  if (password.length === 0 || /^\s*$/.test(password)) {
    return "密码不能为空白";
  }
  // Byte limit before char-length so oversized multi-byte input is rejected clearly.
  if (utf8ByteLength(password) > BCRYPT_MAX_BYTES) {
    return "密码过长，请缩短后重试";
  }
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH || password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return "密码长度需为 6～18 个字符";
  }
  return null;
}

export async function hashPassword(password: string) {
  const policyError = getAdminPasswordPolicyError(password);
  if (policyError) {
    throw new Error(policyError);
  }
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
