import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { deleteCategory, updateCategory } from "@/lib/services/categories";
import { categoryDeleteSchema, categoryUpdateSchema } from "@/lib/validators/category";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const { id } = await params;
    const body = categoryUpdateSchema.parse(await request.json());
    const category = await updateCategory(id, body);
    return NextResponse.json(category);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const { id } = await params;
    const url = new URL(request.url);
    let confirm = url.searchParams.get("confirm") === "true";
    if (request.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = categoryDeleteSchema.parse(await request.json());
        if (body.confirm) confirm = true;
      } catch {
        // empty body ok
      }
    }
    await deleteCategory(id, confirm);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
