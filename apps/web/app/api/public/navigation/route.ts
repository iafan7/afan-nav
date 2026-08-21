import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { getPublicNavigation } from "@/lib/services/navigation";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const data = await getPublicNavigation({ includePrivate: Boolean(admin) });
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
