import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { contentTypeForLinkIcon, resolveSafeLinkIconPath } from "@/lib/uploads/link-icons";

export const runtime = "nodejs";

type Params = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { filename } = await params;
    const full = resolveSafeLinkIconPath(filename);
    if (!fs.existsSync(full)) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    const data = fs.readFileSync(full);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForLinkIcon(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
