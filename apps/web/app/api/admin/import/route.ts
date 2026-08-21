import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { importSnapshot } from "@/lib/services/settings";
import { importRequestSchema } from "@/lib/validators/import-snapshot";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = importRequestSchema.parse(await request.json());
    const result = await importSnapshot(body.snapshot);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
