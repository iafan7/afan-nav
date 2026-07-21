import { describe, expect, it } from "vitest";
import { isAllowedIconUrl, isHttpUrl } from "./link";
import { buildSearchUrl, searchEngineCreateSchema } from "./search-engine";

describe("isHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com/path")).toBe(true);
  });

  it("rejects non-http schemes", () => {
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not-a-url")).toBe(false);
  });
});

describe("isAllowedIconUrl", () => {
  it("accepts http(s) and uploaded paths", () => {
    expect(isAllowedIconUrl("https://cdn.example.com/a.png")).toBe(true);
    expect(isAllowedIconUrl("/api/uploads/link-icons/abc123.png")).toBe(true);
  });

  it("rejects unsafe paths", () => {
    expect(isAllowedIconUrl("/api/uploads/link-icons/../secret.png")).toBe(false);
    expect(isAllowedIconUrl("/api/uploads/other/a.png")).toBe(false);
  });
});

describe("search engine template", () => {
  it("requires {query}", () => {
    const bad = searchEngineCreateSchema.safeParse({
      name: "X",
      urlTemplate: "https://example.com/?q=test",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects non-http templates", () => {
    const bad = searchEngineCreateSchema.safeParse({
      name: "X",
      urlTemplate: "javascript:{query}",
    });
    expect(bad.success).toBe(false);
  });

  it("builds encoded search url", () => {
    expect(buildSearchUrl("https://ex.com/?q={query}", "a b")).toBe("https://ex.com/?q=a%20b");
  });
});
