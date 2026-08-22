import { z } from "zod";
import { isAllowedIconUrl, isHttpUrl } from "./link";

const isoString = z.string().min(1);

const siteSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(100),
  ownerNickname: z.string().trim().min(1).max(100),
  defaultSearchEngineId: z.string().min(1).nullable(),
  /** Optional for older exports; import keeps current value when omitted. */
  linkCheckIntervalMinutes: z.number().int().min(0).max(1440).optional(),
  updatedAt: isoString.optional(),
});

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int(),
  visibility: z.enum(["public", "private"]),
  createdAt: isoString,
  updatedAt: isoString,
});

const linkSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .min(1)
    .refine(isHttpUrl, "链接 URL 须为 http 或 https"),
  description: z.string().trim().max(500).nullable().optional(),
  iconUrl: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || isAllowedIconUrl(v), "图标须为 http(s) 或已上传地址"),
  sortOrder: z.number().int(),
  /** Optional for older exports; omitted → treated as never checked. */
  checkStatus: z.enum(["valid", "invalid"]).nullable().optional(),
  checkMessage: z.string().max(500).nullable().optional(),
  checkedAt: isoString.nullable().optional(),
  checkHttpStatus: z.number().int().nullable().optional(),
  checkLatencyMs: z.number().int().nullable().optional(),
  checkError: z.string().max(64).nullable().optional(),
  createdAt: isoString,
  updatedAt: isoString,
});

const searchEngineSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  urlTemplate: z
    .string()
    .trim()
    .min(1)
    .refine((v) => v.includes("{query}"), "模板须包含 {query}")
    .refine((v) => {
      try {
        const base = v.replaceAll("{query}", "q");
        return isHttpUrl(base);
      } catch {
        return false;
      }
    }, "模板须为 http 或 https"),
  sortOrder: z.number().int(),
  isDefault: z.boolean().optional(),
});

/** Shape produced by `exportSnapshot()` (and accepted by import). */
export const exportSnapshotSchema = z.object({
  exportedAt: isoString.optional(),
  siteSettings: siteSettingsSchema.nullable(),
  categories: z.array(categorySchema),
  links: z.array(linkSchema),
  searchEngines: z.array(searchEngineSchema).min(1, "至少需要一个搜索引擎"),
});

export const importRequestSchema = z.object({
  confirm: z
    .boolean()
    .refine((v) => v === true, "请确认导入将覆盖现有数据"),
  snapshot: exportSnapshotSchema,
});

export type ExportSnapshotInput = z.infer<typeof exportSnapshotSchema>;
export type ImportRequestInput = z.infer<typeof importRequestSchema>;
