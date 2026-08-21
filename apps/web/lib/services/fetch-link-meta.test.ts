import { describe, expect, it } from "vitest";
import {
  assertSafePublicHttpUrl,
  parseHtmlMeta,
} from "@/lib/services/fetch-link-meta";
import { ServiceError } from "@/lib/services/categories";

describe("assertSafePublicHttpUrl", () => {
  it("accepts public https urls", () => {
    expect(assertSafePublicHttpUrl("https://example.com/path").hostname).toBe("example.com");
  });

  it("rejects localhost and private networks", () => {
    const blocked = [
      "http://localhost/",
      "http://127.0.0.1/",
      "http://192.168.1.1/",
      "http://10.0.0.2/",
      "http://172.16.5.1/",
      "http://[::1]/",
    ];
    for (const url of blocked) {
      expect(() => assertSafePublicHttpUrl(url)).toThrow(ServiceError);
    }
  });
});

describe("parseHtmlMeta", () => {
  it("reads title, description and icon from html", () => {
    const html = `
      <html><head>
        <title>Hello &amp; World</title>
        <meta name="description" content="A short &amp; sweet summary." />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="https://cdn.example.com/a.png" sizes="180x180" />
      </head></html>
    `;
    const meta = parseHtmlMeta(html, "https://example.com/page");
    expect(meta.title).toBe("Hello & World");
    expect(meta.description).toBe("A short & sweet summary.");
    expect(meta.iconUrl).toBe("https://cdn.example.com/a.png");
  });

  it("prefers og:title and og:description when present", () => {
    const html = `
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG Desc" />
      <meta name="description" content="Plain Desc" />
      <title>Plain</title>
    `;
    const meta = parseHtmlMeta(html, "https://example.com");
    expect(meta.title).toBe("OG Title");
    expect(meta.description).toBe("OG Desc");
  });
});
