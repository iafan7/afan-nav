import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("returns dash for empty values", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("returns dash for invalid dates", () => {
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("formats a valid ISO timestamp as YYYY/MM/DD HH:mm", () => {
    const formatted = formatDateTime("2026-07-19T12:34:00.000Z");
    expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});
