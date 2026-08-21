import { NextResponse } from "next/server";
import { ServiceError } from "./services/categories";
import { ZodError } from "zod";

export function jsonError(error: unknown) {
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const message = error.issues.map((i) => i.message).join("; ") || "校验失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "服务器错误" }, { status: 500 });
}

export function unauthorized() {
  return NextResponse.json({ error: "未登录" }, { status: 401 });
}
