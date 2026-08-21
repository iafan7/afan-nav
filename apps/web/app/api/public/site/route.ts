import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getPublicSite } from "@/lib/services/navigation";

export async function GET() {
  try {
    const data = await getPublicSite();
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
