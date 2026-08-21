import { z } from "zod";
import { isUploadedLinkIconPath } from "@/lib/uploads/link-icon-path";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedIconUrl(value: string) {
  return isHttpUrl(value) || isUploadedLinkIconPath(value);
}

export const linkCreateSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(1, "标题不能为空").max(200),
  url: z
    .string()
    .trim()
    .min(1)
    .refine(isHttpUrl, "URL 须为 http 或 https"),
  description: z.string().trim().max(500).optional().nullable(),
  iconUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || isAllowedIconUrl(v), "图标须为 http(s) 或已上传地址"),
  sortOrder: z.number().int().default(0),
});

export const linkUpdateSchema = linkCreateSchema.partial();

export { isHttpUrl, isAllowedIconUrl };
