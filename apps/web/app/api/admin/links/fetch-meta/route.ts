import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { fetchLinkMeta } from "@/lib/services/fetch-link-meta";
import { isHttpUrl } from "@/lib/validators/link";

const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .refine(isHttpUrl, "URL 须为 http 或 https"),
});

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = bodySchema.parse(await request.json());
    const meta = await fetchLinkMeta(body.url);
    return NextResponse.json({
      ok: true,
      title: meta.title,
      description: meta.description,
      iconUrl: meta.iconUrl,
      finalUrl: meta.finalUrl,
    });
  } catch (error) {
    return jsonError(error);
  }
}
