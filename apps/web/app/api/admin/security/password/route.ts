import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { getSession, requireAdmin } from "@/lib/auth/session";
import { changeAdminPassword } from "@/lib/services/admin-security";
import { changePasswordSchema } from "@/lib/validators/auth";

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "请使用 JSON 提交" }, { status: 415 });
    }

    const body = changePasswordSchema.parse(await request.json());
    const { authVersion } = await changeAdminPassword(body);

    // Keep this browser session valid; other sessions fail on next requireAdmin.
    const live = await getSession();
    live.isAdmin = true;
    live.authVersion = authVersion;
    await live.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
