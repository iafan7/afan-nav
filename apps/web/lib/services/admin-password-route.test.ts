import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("PATCH /api/admin/security/password auth", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/auth/session");
  });

  it("returns 401 when not logged in and never leaks password fields", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      requireAdmin: vi.fn().mockResolvedValue(null),
      getSession: vi.fn(),
    }));
    const { PATCH } = await import("@/app/api/admin/security/password/route");
    const res = await PATCH(
      new Request("http://localhost/api/admin/security/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: "x",
          newPassword: "new-secure-password",
          confirmPassword: "new-secure-password",
        }),
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("未登录");
    expect(body).not.toHaveProperty("password_hash");
    expect(JSON.stringify(body)).not.toMatch(/new-secure-password/);
  });
});
