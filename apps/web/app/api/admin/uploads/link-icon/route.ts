import { NextResponse } from "next/server";
import { jsonError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { saveLinkIconUpload } from "@/lib/uploads/link-icons";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
    }
    const saved = await saveLinkIconUpload(file);
    return NextResponse.json({ url: saved.url }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
