import { ServiceError } from "@/lib/services/categories";
import { assertSafePublicHttpUrl } from "@/lib/services/fetch-link-meta";

const CHECK_TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 3;
const RETRY_DELAY_MS = 1_000;

const UA =
  "Mozilla/5.0 (compatible; LinkNestCheckBot/1.0; +https://github.com/linknest)";

/** Internal health (DB still maps to valid | invalid | null). */
export type LinkHealth = "healthy" | "restricted" | "broken" | "unchecked";

/** Probe / transport failures — not the same as a broken link. */
export type CheckErrorKind =
  | "timeout"
  | "dns_error"
  | "connection_error"
  | "tls_error"
  | "redirect_error"
  | "http_error"
  | null;

export type LinkCheckResult = {
  /** Compatible: healthy | restricted → true; broken | unchecked → false */
  ok: boolean;
  health: LinkHealth;
  status: number | null;
  finalUrl: string;
  latencyMs: number;
  message: string;
  errorKind: CheckErrorKind;
};

const FALLBACK_GET_STATUSES = new Set([
  403, 404, 405, 429, 500, 501, 502, 503, 504,
]);

const RETRY_HTTP_STATUSES = new Set([502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shouldFallbackToGet(status: number): boolean {
  return FALLBACK_GET_STATUSES.has(status);
}

export function mapHealthToDbStatus(
  health: LinkHealth,
): "valid" | "invalid" | null {
  if (health === "healthy" || health === "restricted") return "valid";
  if (health === "broken") return "invalid";
  return null;
}

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

function classifyHttp(status: number): {
  health: LinkHealth;
  ok: boolean;
  message: string;
  errorKind: CheckErrorKind;
} {
  if (status >= 200 && status < 400) {
    return {
      health: "healthy",
      ok: true,
      message: `可访问（HTTP ${status}）`,
      errorKind: null,
    };
  }
  if (status === 401 || status === 403 || status === 429) {
    return {
      health: "restricted",
      ok: true,
      message: `访问受限（HTTP ${status}）`,
      errorKind: null,
    };
  }
  // Method quirks after GET confirm — host is up
  if (status === 405) {
    return {
      health: "restricted",
      ok: true,
      message: `主机可达（HTTP ${status}）`,
      errorKind: null,
    };
  }
  if (status === 404 || status === 410) {
    return {
      health: "broken",
      ok: false,
      message: `页面不存在（HTTP ${status}）`,
      errorKind: null,
    };
  }
  if (status >= 500) {
    return {
      health: "broken",
      ok: false,
      message: `服务器错误（HTTP ${status}）`,
      errorKind: null,
    };
  }
  return {
    health: "broken",
    ok: false,
    message: `不可用（HTTP ${status}）`,
    errorKind: "http_error",
  };
}

function classifyFetchFailure(error: unknown): {
  errorKind: Exclude<CheckErrorKind, null>;
  message: string;
} {
  if (error instanceof Error && error.name === "AbortError") {
    return { errorKind: "timeout", message: "检测超时" };
  }
  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.message);
    if (error.cause instanceof Error) parts.push(error.cause.message);
    else if (error.cause != null) parts.push(String(error.cause));
    const code = (error as Error & { code?: string }).code;
    if (code) parts.push(code);
  } else {
    parts.push(String(error));
  }
  const text = parts.join(" ").toLowerCase();

  if (/enotfound|getaddrinfo|err_name_not_resolved|\bdns\b/.test(text)) {
    return { errorKind: "dns_error", message: "DNS 解析失败" };
  }
  if (/cert|ssl|tls|err_tls|unable to verify/.test(text)) {
    return { errorKind: "tls_error", message: "TLS/证书错误" };
  }
  if (
    /econnreset|econnrefused|econnaborted|ehostunreach|enetunreach|socket|network|fetch failed/.test(
      text,
    )
  ) {
    return { errorKind: "connection_error", message: "无法连接该网址" };
  }
  return { errorKind: "connection_error", message: "无法连接该网址" };
}

function withLatency(message: string, latencyMs: number): string {
  return `${message} · ${latencyMs}ms`;
}

function uncheckedResult(
  finalUrl: string,
  started: number,
  errorKind: Exclude<CheckErrorKind, null>,
  message: string,
): LinkCheckResult {
  const latencyMs = Date.now() - started;
  return {
    ok: false,
    health: "unchecked",
    status: null,
    finalUrl,
    latencyMs,
    message: withLatency(message, latencyMs),
    errorKind,
  };
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

function shouldRetryResult(result: LinkCheckResult): boolean {
  if (result.errorKind === "timeout" || result.errorKind === "connection_error") {
    return true;
  }
  if (result.status != null && RETRY_HTTP_STATUSES.has(result.status)) {
    return true;
  }
  return false;
}

/**
 * Single probe pass: HEAD first, GET confirm on suspicious statuses / HEAD network failure.
 */
async function probeOnce(rawUrl: string): Promise<LinkCheckResult> {
  const started = Date.now();
  let current = assertSafePublicHttpUrl(rawUrl.trim()).toString();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await requestOnce(current, "HEAD", controller.signal);
        if (shouldFallbackToGet(res.status)) {
          await discardBody(res);
          res = await requestOnce(current, "GET", controller.signal);
        }
      } catch (headError) {
        if (headError instanceof Error && headError.name === "AbortError") {
          return uncheckedResult(current, started, "timeout", "检测超时");
        }
        // HEAD network fail → GET confirm
        try {
          res = await requestOnce(current, "GET", controller.signal);
        } catch (getError) {
          if (getError instanceof Error && getError.name === "AbortError") {
            return uncheckedResult(current, started, "timeout", "检测超时");
          }
          const classified = classifyFetchFailure(getError);
          return uncheckedResult(current, started, classified.errorKind, classified.message);
        }
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        await discardBody(res);
        if (!location) {
          return uncheckedResult(current, started, "redirect_error", "页面重定向无效");
        }
        try {
          current = resolveSafeRedirect(current, location);
        } catch (error) {
          const message =
            error instanceof ServiceError ? error.message : "页面重定向无效";
          return uncheckedResult(current, started, "redirect_error", message);
        }
        continue;
      }

      await discardBody(res);
      const latencyMs = Date.now() - started;
      const classified = classifyHttp(res.status);
      return {
        ok: classified.ok,
        health: classified.health,
        status: res.status,
        finalUrl: current,
        latencyMs,
        message: withLatency(classified.message, latencyMs),
        errorKind: classified.errorKind,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return uncheckedResult(current, started, "timeout", "检测超时");
      }
      const classified = classifyFetchFailure(error);
      return uncheckedResult(current, started, classified.errorKind, classified.message);
    } finally {
      clearTimeout(timer);
    }
  }

  return uncheckedResult(current, started, "redirect_error", "重定向次数过多");
}

/**
 * Reachability check with HEAD→GET confirm and one light retry for flaky failures.
 */
export async function checkLinkReachable(rawUrl: string): Promise<LinkCheckResult> {
  // SSRF on input still throws (invalid URL in caller / DB)
  assertSafePublicHttpUrl(rawUrl.trim());

  let result = await probeOnce(rawUrl);
  if (shouldRetryResult(result)) {
    await sleep(RETRY_DELAY_MS);
    result = await probeOnce(rawUrl);
  }
  return result;
}
