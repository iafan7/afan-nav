import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkLinkReachable,
  shouldFallbackToGet,
} from "@/lib/services/check-link";
import { ServiceError } from "@/lib/services/categories";

function jsonResponse(status: number, headers?: HeadersInit) {
  return new Response(null, { status, headers });
}

describe("shouldFallbackToGet", () => {
  it("matches the configured suspicious statuses", () => {
    for (const code of [403, 404, 405, 429, 500, 501, 502, 503, 504]) {
      expect(shouldFallbackToGet(code)).toBe(true);
    }
    expect(shouldFallbackToGet(200)).toBe(false);
    expect(shouldFallbackToGet(301)).toBe(false);
    expect(shouldFallbackToGet(401)).toBe(false);
    expect(shouldFallbackToGet(400)).toBe(false);
  });
});

describe("checkLinkReachable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rejects private urls before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkLinkReachable("http://127.0.0.1/")).rejects.toBeInstanceOf(ServiceError);
    await expect(checkLinkReachable("http://192.168.0.1/")).rejects.toBeInstanceOf(ServiceError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HEAD 200 → healthy without GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://example.com/");
    expect(result.health).toBe("healthy");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.errorKind).toBeNull();
    expect(result.message).toMatch(/200/);
    expect(result.message).toMatch(/\d+ms/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
  });

  it("HEAD 404 + GET 200 → healthy (false HEAD)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://wenxin.baidu.com/");
    expect(result.health).toBe("healthy");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
  });

  it("HEAD 404 + GET 404 → broken", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404))
      .mockResolvedValueOnce(jsonResponse(404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://example.com/missing");
    expect(result.health).toBe("broken");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("HEAD 403 + GET 200 → healthy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(403))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://example.com/");
    expect(result.health).toBe("healthy");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("HEAD 401 without GET → restricted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://example.com/private");
    expect(result.health).toBe("restricted");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("timeout → unchecked with errorKind timeout (after retry)", async () => {
    vi.useFakeTimers();
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    const promise = checkLinkReachable("https://example.com/slow");
    // First probe timeout + 1s retry delay + second probe timeout
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.health).toBe("unchecked");
    expect(result.errorKind).toBe("timeout");
    expect(result.message).toMatch(/超时/);
    expect(result.ok).toBe(false);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("follows 301 → 302 → 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(301, { Location: "https://example.com/b" }))
      .mockResolvedValueOnce(jsonResponse(302, { Location: "https://example.com/c" }))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://example.com/a");
    expect(result.health).toBe("healthy");
    expect(result.ok).toBe(true);
    expect(result.finalUrl).toBe("https://example.com/c");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("blocks redirect to private host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(302, { Location: "http://127.0.0.1/" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://example.com/start");
    expect(result.health).toBe("unchecked");
    expect(result.errorKind).toBe("redirect_error");
    expect(result.message).toMatch(/内网|本地/);
  });

  it("retries once on GET 503 then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      // attempt 1: HEAD 503 → GET 503
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(503))
      // attempt 2 after retry: HEAD 200
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const promise = checkLinkReachable("https://example.com/");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.health).toBe("healthy");
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry true 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404))
      .mockResolvedValueOnce(jsonResponse(404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLinkReachable("https://example.com/gone");
    expect(result.health).toBe("broken");
    expect(result.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
