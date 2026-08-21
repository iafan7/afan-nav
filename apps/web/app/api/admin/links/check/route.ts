import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { checkAndPersistLink } from "@/lib/services/links";

const bodySchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = bodySchema.parse(await request.json());
    const result = await checkAndPersistLink(body.id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
