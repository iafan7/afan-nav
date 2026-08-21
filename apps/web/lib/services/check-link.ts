import { ServiceError } from "@/lib/services/categories";
import { assertSafePublicHttpUrl } from "@/lib/services/fetch-link-meta";

const CHECK_TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 3;

const UA =
  "Mozilla/5.0 (compatible; LinkNestCheckBot/1.0; +https://github.com/linknest)";

export type LinkCheckResult = {
  ok: boolean;
  status: number | null;
  finalUrl: string;
  latencyMs: number;
  message: string;
};

function resolveSafeRedirect(base: string, location: string): string {
  let absolute: string;
  try {
    absolute = new URL(location, base).toString();
  } catch {
    throw new ServiceError("页面重定向无效", 400);
  }
  try {
    return assertSafePublicHttpUrl(absolute).toString();
  } catch {
    throw new ServiceError("不允许重定向到内网或本地地址", 400);
  }
}

function classifyStatus(status: number): { ok: boolean; message: string } {
  if (status >= 200 && status < 400) {
    return { ok: true, message: `可访问（HTTP ${status}）` };
  }
  // Server responded — link host is alive, but may need auth / rate limit
  if (status === 401 || status === 403 || status === 405 || status === 429) {
    return { ok: true, message: `主机可达（HTTP ${status}）` };
  }
  if (status === 404) {
    return { ok: false, message: `页面不存在（HTTP 404）` };
  }
  if (status >= 500) {
    return { ok: false, message: `服务器错误（HTTP ${status}）` };
  }
  return { ok: false, message: `不可用（HTTP ${status}）` };
}

async function discardBody(res: Response) {
  try {
    await res.body?.cancel();
  } catch {
    /* ignore */
  }
}

async function requestOnce(
  url: string,
  method: "HEAD" | "GET",
  signal: AbortSignal,
): Promise<Response> {
  return fetch(url, {
    method,
    redirect: "manual",
    signal,
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
    },
  });
}

export async function checkLinkReachable(rawUrl: string): Promise<LinkCheckResult> {
  const started = Date.now();
  let current = assertSafePublicHttpUrl(rawUrl.trim()).toString();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await requestOnce(current, "HEAD", controller.signal);
        // Some hosts reject HEAD — fall back to GET
        if (res.status === 405 || res.status === 501) {
          await discardBody(res);
          res = await requestOnce(current, "GET", controller.signal);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new ServiceError("检测超时", 408);
        }
        // HEAD network fail → try GET once
        res = await requestOnce(current, "GET", controller.signal);
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        await discardBody(res);
        if (!location) {
          throw new ServiceError("页面重定向无效", 400);
        }
        current = resolveSafeRedirect(current, location);
        continue;
      }

      await discardBody(res);
      const latencyMs = Date.now() - started;
      const classified = classifyStatus(res.status);
      return {
        ok: classified.ok,
        status: res.status,
        finalUrl: current,
        latencyMs,
        message: classified.message,
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceError("检测超时", 408);
      }
      throw new ServiceError("无法连接该网址", 400);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new ServiceError("重定向次数过多", 400);
}
