import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { deleteLink, updateLink } from "@/lib/services/links";
import { linkUpdateSchema } from "@/lib/validators/link";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const { id } = await params;
    const body = linkUpdateSchema.parse(await request.json());
    return NextResponse.json(await updateLink(id, body));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const { id } = await params;
    await deleteLink(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
