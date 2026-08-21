import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adminCredentials } from "@/lib/db/schema";
import { ensureReady } from "@/lib/ready";

export type SessionData = {
  isAdmin?: boolean;
  /** Must match admin_credentials.auth_version or session is invalid. */
  authVersion?: number;
};

export function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  // Default: secure in production. Set COOKIE_SECURE=false for plain HTTP self-host.
  const secure =
    process.env.COOKIE_SECURE != null
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production";
  return {
    password,
    cookieName: "linknest_session",
    cookieOptions: {
      secure,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

export async function getAdminAuthVersion(): Promise<number> {
  await ensureReady();
  const admin = getDb().select().from(adminCredentials).where(eq(adminCredentials.id, 1)).get();
  return admin?.authVersion ?? 1;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) {
    return null;
  }
  const dbVersion = await getAdminAuthVersion();
  if (session.authVersion !== dbVersion) {
    // Cookie writes are only allowed in Route Handlers / Server Actions.
    // In RSC (e.g. admin layout) treat mismatch as logged out without mutating cookies.
    try {
      session.destroy();
    } catch {
      /* ignore — stale cookie remains until next login or route-handler destroy */
    }
    return null;
  }
  return session;
}
