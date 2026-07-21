import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { exportSnapshot } from "@/lib/services/settings";

function exportFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `linknest-export-${y}-${m}-${d}.json`;
}

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const snapshot = await exportSnapshot();
    const body = JSON.stringify(snapshot, null, 2);
    const filename = exportFilename();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
