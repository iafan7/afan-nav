import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { TimingCollector } from "@/lib/server-timing";
import { createCategory, listCategories } from "@/lib/services/categories";
import { categoryCreateSchema } from "@/lib/validators/category";

export async function GET() {
  const t = new TimingCollector();
  const session = await t.measure("auth", () => requireAdmin());
  if (!session) return unauthorized();
  try {
    const categories = await t.measure("service", () => listCategories());
    return t.json({ categories });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = categoryCreateSchema.parse(await request.json());
    const category = await createCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
