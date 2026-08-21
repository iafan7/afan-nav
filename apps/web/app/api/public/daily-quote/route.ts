import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getPublicDailyQuote } from "@/lib/services/daily-quotes";

export async function GET() {
  try {
    const data = await getPublicDailyQuote();
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
