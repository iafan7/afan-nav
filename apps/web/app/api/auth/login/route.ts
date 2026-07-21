import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adminCredentials } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  clientIpFromRequest,
  resetLoginRateLimit,
} from "@/lib/auth/rate-limit";
import { getSession } from "@/lib/auth/session";
import { ensureReady } from "@/lib/ready";
import { loginSchema } from "@/lib/validators/auth";
import { jsonError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    await ensureReady();
    const body = loginSchema.parse(await request.json());
    const ip = clientIpFromRequest(request);
    const rateKey = `${ip}:${body.username.trim().toLowerCase()}`;
    const limited = checkLoginRateLimit(rateKey);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "尝试次数过多，请稍后再试" },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const db = getDb();
    const admin = db.select().from(adminCredentials).where(eq(adminCredentials.id, 1)).get();
    const usernameOk =
      !!admin?.username && admin.username.trim().toLowerCase() === body.username.trim().toLowerCase();
    const passwordOk = !!admin && (await verifyPassword(body.password, admin.passwordHash));
    if (!admin || !usernameOk || !passwordOk) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }
    resetLoginRateLimit(rateKey);
    const session = await getSession();
    session.isAdmin = true;
    session.authVersion = admin.authVersion ?? 1;
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
