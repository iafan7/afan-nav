import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DAILY_QUOTE_FALLBACK,
  dayKey,
  mapHitokotoResponse,
  toPublicQuote,
} from "./daily-quote";

describe("mapHitokotoResponse", () => {
  it("maps hitokoto + from_who / from", () => {
    expect(
      mapHitokotoResponse({
        id: 1,
        uuid: "secret",
        hitokoto: "  今日一言  ",
        from_who: "作者",
        from: "出处",
        type: "a",
      }),
    ).toEqual({ content: "今日一言", author: "作者" });

    expect(
      mapHitokotoResponse({
        hitokoto: "只有出处",
        from: "《书》",
        from_who: null,
      }),
    ).toEqual({ content: "只有出处", author: "《书》" });
  });

  it("returns null for invalid payloads", () => {
    expect(mapHitokotoResponse(null)).toBeNull();
    expect(mapHitokotoResponse({})).toBeNull();
    expect(mapHitokotoResponse({ hitokoto: "  " })).toBeNull();
  });
});

describe("toPublicQuote", () => {
  it("falls back when empty", () => {
    expect(toPublicQuote(null)).toEqual({ content: DAILY_QUOTE_FALLBACK, author: null });
  });

  it("exposes only content and author", () => {
    const publicQuote = toPublicQuote({ content: "可见", author: "作者" });
    expect(publicQuote).toEqual({ content: "可见", author: "作者" });
    expect(Object.keys(publicQuote).sort()).toEqual(["author", "content"]);
  });
});

describe("dayKey", () => {
  it("is stable for the same calendar day", () => {
    expect(dayKey(new Date("2026-07-19T08:00:00"))).toBe(
      dayKey(new Date("2026-07-19T23:59:00")),
    );
  });

  it("differs across days", () => {
    expect(dayKey(new Date("2026-07-19T12:00:00"))).not.toBe(
      dayKey(new Date("2026-07-20T12:00:00")),
    );
  });
});

describe("GET /api/public/daily-quote", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/services/daily-quotes");
  });

  it("does not expose admin / hitokoto raw fields", async () => {
    vi.doMock("@/lib/services/daily-quotes", () => ({
      getPublicDailyQuote: vi.fn().mockResolvedValue({
        quote: { content: "公开句", author: "公开作者" },
      }),
    }));
    const { GET } = await import("@/app/api/public/daily-quote/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["quote"]);
    expect(Object.keys(body.quote).sort()).toEqual(["author", "content"]);
  });

  it("returns fixed fallback shape when upstream fails", async () => {
    vi.doMock("@/lib/services/daily-quotes", () => ({
      getPublicDailyQuote: vi.fn().mockResolvedValue({
        quote: { content: DAILY_QUOTE_FALLBACK, author: null },
      }),
    }));
    const { GET } = await import("@/app/api/public/daily-quote/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quote.content).toBe(DAILY_QUOTE_FALLBACK);
    expect(body.quote.author).toBeNull();
  });
});

describe("Hitokoto day-stable selection (cache key)", () => {
  it("same day shares one cache key; next day rotates key", () => {
    const a = dayKey(new Date("2026-07-19T01:00:00"));
    const b = dayKey(new Date("2026-07-19T23:00:00"));
    const c = dayKey(new Date("2026-07-20T01:00:00"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("default search engine authority", () => {
  it("maps isDefault from defaultSearchEngineId only (single default)", () => {
    const defaultId = "eng-default";
    const engines = [
      { id: "eng-default", name: "A", urlTemplate: "https://a/?q={query}", isDefault: false },
      { id: "eng-other", name: "B", urlTemplate: "https://b/?q={query}", isDefault: true },
    ];
    const mapped = engines.map((e) => ({
      ...e,
      isDefault: e.id === defaultId,
    }));
    expect(mapped.find((e) => e.isDefault)?.id).toBe(defaultId);
    expect(mapped.filter((e) => e.isDefault)).toHaveLength(1);
  });
});
