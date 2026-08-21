import { describe, expect, it } from "vitest";
import { getAdminPasswordPolicyError, utf8ByteLength } from "@/lib/auth/password";

describe("admin password policy (6–18 chars)", () => {
  it("rejects 5 characters", () => {
    expect(getAdminPasswordPolicyError("12345")).toBe("密码长度需为 6～18 个字符");
  });

  it("allows 6 characters", () => {
    expect(getAdminPasswordPolicyError("123456")).toBeNull();
  });

  it("allows 18 characters", () => {
    expect(getAdminPasswordPolicyError("123456789012345678")).toBeNull();
  });

  it("rejects 19 characters", () => {
    expect(getAdminPasswordPolicyError("1234567890123456789")).toBe("密码长度需为 6～18 个字符");
  });

  it("rejects all-whitespace", () => {
    expect(getAdminPasswordPolicyError("      ")).toBe("密码不能为空白");
    expect(getAdminPasswordPolicyError("\t\t\t\t\t\t")).toBe("密码不能为空白");
    expect(getAdminPasswordPolicyError("")).toBe("密码不能为空白");
  });

  it("rejects UTF-8 longer than 72 bytes", () => {
    // 25 CJK characters → 75 UTF-8 bytes (length also >18; byte check runs first)
    const oversize = "密".repeat(25);
    expect(utf8ByteLength(oversize)).toBeGreaterThan(72);
    expect(getAdminPasswordPolicyError(oversize)).toBe("密码过长，请缩短后重试");
  });

  it("does not trim — leading/trailing spaces count toward length", () => {
    expect(getAdminPasswordPolicyError("  ab")).toBe("密码长度需为 6～18 个字符");
    expect(getAdminPasswordPolicyError("  abcd")).toBeNull();
  });
});
