import { describe, expect, it } from "vitest";
import {
  buildCheckTooltip,
  deriveLinkHealth,
  healthLabel,
} from "@/lib/link-check-ui";

describe("link-check-ui", () => {
  it("maps healthy / restricted / broken / unchecked", () => {
    expect(
      deriveLinkHealth({
        checkStatus: "valid",
        checkMessage: null,
        checkedAt: "2026-01-01T00:00:00.000Z",
        checkHttpStatus: 200,
        checkLatencyMs: 120,
        checkError: null,
      }),
    ).toBe("healthy");

    expect(
      deriveLinkHealth({
        checkStatus: "valid",
        checkMessage: null,
        checkedAt: "2026-01-01T00:00:00.000Z",
        checkHttpStatus: 403,
        checkLatencyMs: 80,
        checkError: null,
      }),
    ).toBe("restricted");

    expect(
      deriveLinkHealth({
        checkStatus: "invalid",
        checkMessage: "页面不存在",
        checkedAt: "2026-01-01T00:00:00.000Z",
        checkHttpStatus: 404,
        checkLatencyMs: 90,
        checkError: null,
      }),
    ).toBe("broken");

    expect(
      deriveLinkHealth({
        checkStatus: null,
        checkMessage: null,
        checkedAt: null,
        checkHttpStatus: null,
        checkLatencyMs: null,
        checkError: null,
      }),
    ).toBe("unchecked");
  });

  it("keeps prior badge when probe fails", () => {
    expect(
      deriveLinkHealth({
        checkStatus: "valid",
        checkMessage: "检测超时",
        checkedAt: "2026-01-01T00:00:00.000Z",
        checkHttpStatus: 200,
        checkLatencyMs: 6000,
        checkError: "timeout",
        health: "unchecked",
      }),
    ).toBe("healthy");
  });

  it("builds human tooltip for healthy and probe failure", () => {
    const ok = buildCheckTooltip({
      checkStatus: "valid",
      checkMessage: "可访问",
      checkedAt: "2026-08-22T04:20:00.000Z",
      checkHttpStatus: 200,
      checkLatencyMs: 320,
      checkError: null,
    });
    expect(ok).toContain("HTTP 200");
    expect(ok).toContain("320ms");

    const fail = buildCheckTooltip({
      checkStatus: "valid",
      checkMessage: "检测超时",
      checkedAt: "2026-08-22T04:20:00.000Z",
      checkHttpStatus: 200,
      checkLatencyMs: 6000,
      checkError: "timeout",
    });
    expect(fail).toContain("本次检测失败");
    expect(fail).toContain("连接超时");
    expect(fail).toContain("上一次检测结果");
  });

  it("labels health in Chinese", () => {
    expect(healthLabel("healthy")).toBe("正常");
    expect(healthLabel("restricted")).toBe("受限");
    expect(healthLabel("broken")).toBe("异常");
    expect(healthLabel("unchecked")).toBe("未检测");
  });
});
