import { z } from "zod";
import { isHttpUrl } from "./link";

export const searchEngineCreateSchema = z.object({
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
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().optional().default(false),
});

export const searchEngineUpdateSchema = searchEngineCreateSchema.partial();

export function buildSearchUrl(template: string, query: string) {
  return template.replaceAll("{query}", encodeURIComponent(query));
}
