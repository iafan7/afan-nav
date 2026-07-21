import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { TimingCollector } from "@/lib/server-timing";
import { getSettings, updateSettings } from "@/lib/services/settings";
import { settingsUpdateSchema } from "@/lib/validators/auth";

export async function GET() {
  const t = new TimingCollector();
  const session = await t.measure("auth", () => requireAdmin());
  if (!session) return unauthorized();
  try {
    const settings = await t.measure("service", () => getSettings());
    return t.json({ settings });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = settingsUpdateSchema.parse(await request.json());
    return NextResponse.json({ settings: await updateSettings(body) });
  } catch (error) {
    return jsonError(error);
  }
}
