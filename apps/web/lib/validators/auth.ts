import { z } from "zod";
import { getAdminPasswordPolicyError } from "@/lib/auth/password";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "请输入账号"),
  password: z.string().min(1, "请输入密码"),
});

export const settingsUpdateSchema = z.object({
  siteName: z.string().trim().min(1).max(100).optional(),
  ownerNickname: z.string().trim().min(1).max(40).optional(),
  defaultSearchEngineId: z.string().nullable().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    // Do not trim — password policy is applied to the raw string.
    newPassword: z.string(),
    confirmPassword: z.string().min(1, "请确认新密码"),
  })
  .superRefine((data, ctx) => {
    const policyError = getAdminPasswordPolicyError(data.newPassword);
    if (policyError) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: policyError.startsWith("密码") ? `新${policyError}` : policyError,
      });
    }
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "两次输入的新密码不一致",
      });
    }
    if (data.newPassword === data.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "新密码不能与当前密码相同",
      });
    }
  });
