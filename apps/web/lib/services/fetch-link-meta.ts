import { isHttpUrl } from "@/lib/validators/link";
import { ServiceError } from "@/lib/services/categories";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 512_000;
const MAX_REDIRECTS = 3;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

export type LinkMetaResult = {
  title: string | null;
  description: string | null;
  iconUrl: string | null;
  finalUrl: string;
};

function decodeBasicEntities(input: string) {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = Number.parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function isPrivateOrLocalIpv4(host: string) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isBlockedHostname(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.includes(":")) {
    // IPv6: block loopback / ULA / link-local roughly
    if (host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
      return true;
    }
  }
  if (isPrivateOrLocalIpv4(host)) return true;
  return false;
}

/** Exported for unit tests. */
export function assertSafePublicHttpUrl(raw: string): URL {
  if (!isHttpUrl(raw)) {
    throw new ServiceError("URL 须为 http 或 https", 400);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ServiceError("URL 无效", 400);
  }
  if (url.username || url.password) {
    throw new ServiceError("URL 不能包含用户名或密码", 400);
  }
  if (isBlockedHostname(url.hostname)) {
    throw new ServiceError("不允许访问内网或本地地址", 400);
  }
  return url;
}

function resolveUrl(base: string, href: string): string | null {
  try {
    const absolute = new URL(href, base).toString();
    assertSafePublicHttpUrl(absolute);
    return absolute;
  } catch {
    return null;
  }
}

function pickAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = re.exec(tag);
  return m?.[1] ?? m?.[2] ?? m?.[3] ?? null;
}

function findMetaContent(html: string, attr: "name" | "property", value: string): string | null {
  const linkRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html))) {
    const tag = match[0];
    const key = (pickAttr(tag, attr) ?? "").trim().toLowerCase();
    if (key !== value.toLowerCase()) continue;
    const content = pickAttr(tag, "content");
    if (content?.trim()) return decodeBasicEntities(content.trim().replace(/\s+/g, " "));
  }
  return null;
}

const DESCRIPTION_MAX = 500;

/** Exported for unit tests. */
export function parseHtmlMeta(
  html: string,
  pageUrl: string,
): { title: string | null; description: string | null; iconUrl: string | null } {
  let title =
    findMetaContent(html, "property", "og:title") ||
    (() => {
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      if (!titleMatch?.[1]) return null;
      return decodeBasicEntities(titleMatch[1].replace(/\s+/g, " ").trim());
    })();

  if (title && title.length > 200) {
    title = title.slice(0, 200);
  }

  let description =
    findMetaContent(html, "property", "og:description") ||
    findMetaContent(html, "name", "description") ||
    findMetaContent(html, "property", "twitter:description");

  if (description && description.length > DESCRIPTION_MAX) {
    description = description.slice(0, DESCRIPTION_MAX);
  }

  const iconCandidates: Array<{ href: string; score: number }> = [];
  const linkRe = /<link\b[^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRe.exec(html))) {
    const tag = linkMatch[0];
    const rel = (pickAttr(tag, "rel") ?? "").toLowerCase();
    if (!rel) continue;
    const relParts = rel.split(/\s+/);
    const isIcon =
      relParts.includes("icon") ||
      relParts.includes("shortcut") ||
      rel.includes("apple-touch-icon");
    if (!isIcon) continue;
    const href = pickAttr(tag, "href");
    if (!href) continue;
    const absolute = resolveUrl(pageUrl, href);
    if (!absolute) continue;
    let score = 10;
    if (rel.includes("apple-touch-icon")) score = 30;
    else if (relParts.includes("icon")) score = 20;
    const sizes = pickAttr(tag, "sizes");
    if (sizes && /\d+x\d+/i.test(sizes)) {
      const n = Number(sizes.split("x")[0]);
      if (Number.isFinite(n)) score += Math.min(n, 256) / 10;
    }
    iconCandidates.push({ href: absolute, score });
  }

  iconCandidates.sort((a, b) => b.score - a.score);
  const iconUrl = iconCandidates[0]?.href ?? null;

  return { title: title || null, description: description || null, iconUrl };
}

function fallbackIconFor(pageUrl: string): string | null {
  try {
    const host = new URL(pageUrl).hostname;
    // Public CDN favicon proxy — works even when /favicon.ico is missing
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

async function readLimitedText(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    return text.slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, Math.max(0, maxBytes - (total - value.byteLength))));
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchFollowSafe(startUrl: string): Promise<{ finalUrl: string; html: string }> {
  let current = assertSafePublicHttpUrl(startUrl).toString();

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LinkNestMetaBot/1.0; +https://github.com/linknest)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) {
          throw new ServiceError("页面重定向无效", 400);
        }
        const next = resolveUrl(current, location);
        if (!next) {
          throw new ServiceError("不允许重定向到内网或本地地址", 400);
        }
        current = next;
        continue;
      }

      if (!res.ok) {
        throw new ServiceError(`无法访问该网址（HTTP ${res.status}）`, 400);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
        // Still try if empty content-type; otherwise soft-fail to hostname title + fallback icon
        if (/image\//i.test(contentType)) {
          return { finalUrl: current, html: "" };
        }
      }

      const html = await readLimitedText(res, MAX_HTML_BYTES);
      return { finalUrl: current, html };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceError("识别超时，请稍后重试或手动填写", 408);
      }
      throw new ServiceError("无法访问该网址", 400);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new ServiceError("重定向次数过多", 400);
}

export async function fetchLinkMeta(rawUrl: string): Promise<LinkMetaResult> {
  const start = assertSafePublicHttpUrl(rawUrl.trim()).toString();
  const { finalUrl, html } = await fetchFollowSafe(start);
  const parsed = html
    ? parseHtmlMeta(html, finalUrl)
    : { title: null, description: null, iconUrl: null };

  let title = parsed.title;
  if (!title) {
    try {
      title = new URL(finalUrl).hostname.replace(/^www\./, "");
    } catch {
      title = null;
    }
  }

  const iconUrl = parsed.iconUrl ?? fallbackIconFor(finalUrl);

  return {
    title,
    description: parsed.description,
    iconUrl,
    finalUrl,
  };
}
