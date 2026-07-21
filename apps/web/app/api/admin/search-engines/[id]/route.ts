import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { deleteSearchEngine, updateSearchEngine } from "@/lib/services/settings";
import { searchEngineUpdateSchema } from "@/lib/validators/search-engine";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const { id } = await params;
    const body = searchEngineUpdateSchema.parse(await request.json());
    return NextResponse.json(await updateSearchEngine(id, body));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const { id } = await params;
    await deleteSearchEngine(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
