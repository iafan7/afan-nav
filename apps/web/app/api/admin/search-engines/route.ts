import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { TimingCollector } from "@/lib/server-timing";
import { createSearchEngine, listSearchEngines } from "@/lib/services/settings";
import { searchEngineCreateSchema } from "@/lib/validators/search-engine";

export async function GET() {
  const t = new TimingCollector();
  const session = await t.measure("auth", () => requireAdmin());
  if (!session) return unauthorized();
  try {
    const searchEngines = await t.measure("service", () => listSearchEngines());
    return t.json({ searchEngines });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = searchEngineCreateSchema.parse(await request.json());
    return NextResponse.json(await createSearchEngine(body), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
