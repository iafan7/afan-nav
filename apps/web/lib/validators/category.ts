import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "分类名称不能为空").max(100),
  sortOrder: z.number().int().default(0),
  visibility: z.enum(["public", "private"]),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const categoryDeleteSchema = z.object({
  confirm: z.boolean().optional(),
});
