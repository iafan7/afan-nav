/** Daily quote helpers — public content comes from a free API (Hitokoto), not a local list. */

export const DAILY_QUOTE_FALLBACK = "整理常用站点，快速抵达每一个入口";

export const HITOKOTO_API_URL = "https://v1.hitokoto.cn/?encode=json";

export type PublicQuote = {
  content: string;
  author: string | null;
};

/** YYYYMMDD string for stable day-based cache keys. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function toPublicQuote(quote: { content: string; author: string | null } | null): PublicQuote {
  if (!quote?.content?.trim()) {
    return { content: DAILY_QUOTE_FALLBACK, author: null };
  }
  return {
    content: quote.content.trim(),
    author: quote.author?.trim() ? quote.author.trim() : null,
  };
}

/** Map Hitokoto JSON → public quote fields (never expose uuid/id/type/…). */
export function mapHitokotoResponse(data: unknown): PublicQuote | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const content = typeof row.hitokoto === "string" ? row.hitokoto.trim() : "";
  if (!content) return null;
  const fromWho = typeof row.from_who === "string" ? row.from_who.trim() : "";
  const from = typeof row.from === "string" ? row.from.trim() : "";
  const author = fromWho || from || null;
  return { content, author };
}
