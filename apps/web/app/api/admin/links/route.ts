import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { TimingCollector } from "@/lib/server-timing";
import { createLink, listLinks } from "@/lib/services/links";
import { linkCreateSchema } from "@/lib/validators/link";

export async function GET(request: Request) {
  const t = new TimingCollector();
  const session = await t.measure("auth", () => requireAdmin());
  if (!session) return unauthorized();
  try {
    const categoryId = new URL(request.url).searchParams.get("categoryId") ?? undefined;
    const links = await t.measure("service", () => listLinks(categoryId));
    return t.json({ links });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = linkCreateSchema.parse(await request.json());
    const link = await createLink(body);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
