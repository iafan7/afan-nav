import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { checkAndPersistAllLinks } from "@/lib/services/links";

export const maxDuration = 300;

export async function POST() {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const results = await checkAndPersistAllLinks();
    return NextResponse.json({
      ok: true,
      checked: results.length,
      results: results.map((r) => ({
        id: r.id,
        checkStatus: r.checkStatus,
        checkMessage: r.checkMessage,
        checkedAt: r.checkedAt,
        health: r.health,
        status: r.status,
        latencyMs: r.latencyMs,
        errorKind: r.errorKind,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
