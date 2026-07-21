import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LINK_ICON_MAX_BYTES,
  getLinkIconsDir,
  resolveSafeLinkIconPath,
  saveLinkIconUpload,
} from "./link-icons";

function makePngFile(name: string, size = 64) {
  // Minimal valid-ish PNG header bytes + padding (MIME/extension validated, not magic)
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const buf = Buffer.concat([header, Buffer.alloc(Math.max(0, size - header.length), 1)]);
  return new File([buf], name, { type: "image/png" });
}

describe("link icon uploads", () => {
  let tmpRoot = "";

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "linknest-upload-"));
    process.env.DATABASE_PATH = path.join(tmpRoot, "linknest.db");
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("saves png and returns public url", async () => {
    const saved = await saveLinkIconUpload(makePngFile("icon.png"));
    expect(saved.url).toMatch(/^\/api\/uploads\/link-icons\/[a-zA-Z0-9_-]+\.png$/);
    const full = path.join(getLinkIconsDir(), path.basename(saved.url));
    expect(fs.existsSync(full)).toBe(true);
  });

  it("rejects files over 2MB", async () => {
    const big = new File([Buffer.alloc(LINK_ICON_MAX_BYTES + 1)], "big.png", {
      type: "image/png",
    });
    await expect(saveLinkIconUpload(big)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects illegal extension / mime", async () => {
    await expect(
      saveLinkIconUpload(new File([Buffer.from("x")], "x.svg", { type: "image/svg+xml" })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      saveLinkIconUpload(new File([Buffer.from("x")], "x.png", { type: "text/plain" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects path-traversal filenames when resolving", () => {
    expect(() => resolveSafeLinkIconPath("../etc/passwd")).toThrow();
    expect(() => resolveSafeLinkIconPath("..%2Fsecret.png")).toThrow();
    expect(() => resolveSafeLinkIconPath("ok.png")).not.toThrow();
  });
});

describe("POST /api/admin/uploads/link-icon auth", () => {
  let tmpRoot = "";

  beforeEach(() => {
    vi.resetModules();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "linknest-upload-route-"));
    process.env.DATABASE_PATH = path.join(tmpRoot, "linknest.db");
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/auth/session");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns 401 when not logged in", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      requireAdmin: vi.fn().mockResolvedValue(null),
    }));
    const { POST } = await import("@/app/api/admin/uploads/link-icon/route");
    const form = new FormData();
    form.set("file", makePngFile("a.png"));
    const res = await POST(new Request("http://localhost/api/admin/uploads/link-icon", {
      method: "POST",
      body: form,
    }));
    expect(res.status).toBe(401);
  });

  it("returns url when admin and file ok; url is readable", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      requireAdmin: vi.fn().mockResolvedValue({ isAdmin: true }),
    }));
    const { POST } = await import("@/app/api/admin/uploads/link-icon/route");
    const form = new FormData();
    form.set("file", makePngFile("a.png", 128));
    const res = await POST(new Request("http://localhost/api/admin/uploads/link-icon", {
      method: "POST",
      body: form,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toMatch(/^\/api\/uploads\/link-icons\//);

    const filename = path.basename(body.url);
    const { GET } = await import("@/app/api/uploads/link-icons/[filename]/route");
    const getRes = await GET(new Request(`http://localhost${body.url}`), {
      params: Promise.resolve({ filename }),
    });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Content-Type")).toBe("image/png");
    const bytes = Buffer.from(await getRes.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
