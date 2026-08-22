import { formatDateTime } from "@/lib/format";

export type LinkHealthUi = "healthy" | "restricted" | "broken" | "unchecked";

export type LinkCheckFields = {
  checkStatus: "valid" | "invalid" | null;
  checkMessage: string | null;
  checkedAt: string | null;
  checkHttpStatus: number | null;
  checkLatencyMs: number | null;
  checkError: string | null;
  /** From latest check API when present */
  health?: LinkHealthUi | null;
};

const RESTRICTED_HTTP = new Set([401, 403, 405, 429]);

const ERROR_REASON: Record<string, string> = {
  timeout: "连接超时",
  dns_error: "DNS 解析失败",
  connection_error: "无法连接",
  tls_error: "TLS/证书错误",
  redirect_error: "重定向异常",
  http_error: "HTTP 响应异常",
};

export function errorKindLabel(kind: string | null | undefined): string {
  if (!kind) return "未知原因";
  return ERROR_REASON[kind] ?? kind;
}

/** Derive display health from persisted fields + optional API health. */
export function deriveLinkHealth(row: LinkCheckFields): LinkHealthUi {
  if (row.health === "healthy" || row.health === "restricted" || row.health === "broken") {
    return row.health;
  }
  if (row.health === "unchecked" && row.checkError) {
    // Probe failed — keep prior badge when we have a prior status
    if (row.checkStatus === "invalid") return "broken";
    if (row.checkStatus === "valid") {
      if (row.checkHttpStatus != null && RESTRICTED_HTTP.has(row.checkHttpStatus)) {
        return "restricted";
      }
      return "healthy";
    }
    return "unchecked";
  }
  if (row.checkStatus === "invalid") return "broken";
  if (row.checkStatus === "valid") {
    if (row.checkHttpStatus != null && RESTRICTED_HTTP.has(row.checkHttpStatus)) {
      return "restricted";
    }
    return "healthy";
  }
  return "unchecked";
}

export function healthLabel(health: LinkHealthUi): string {
  switch (health) {
    case "healthy":
      return "正常";
    case "restricted":
      return "受限";
    case "broken":
      return "异常";
    default:
      return "未检测";
  }
}

export function healthBadgeClass(health: LinkHealthUi): string {
  switch (health) {
    case "healthy":
      return "is-ok";
    case "restricted":
      return "is-restricted";
    case "broken":
      return "is-bad";
    default:
      return "is-unknown";
  }
}

function httpLine(status: number | null): string | null {
  if (status == null) return null;
  return `HTTP ${status}`;
}

function latencyLine(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return `响应耗时：\n${Math.round(ms)}ms`;
}

function checkedLine(checkedAt: string | null, label = "最后检测"): string | null {
  if (!checkedAt) return null;
  return `${label}：\n${formatDateTime(checkedAt)}`;
}

/** Multi-line tooltip for status badge hover. */
export function buildCheckTooltip(row: LinkCheckFields): string {
  const health = deriveLinkHealth(row);
  const parts: string[] = [];

  if (row.checkError) {
    parts.push("本次检测失败");
    parts.push(`原因：\n${errorKindLabel(row.checkError)}`);
    if (row.checkStatus === "valid" || row.checkStatus === "invalid") {
      parts.push("当前状态保持上一次检测结果。");
    }
    const lat = latencyLine(row.checkLatencyMs);
    if (lat) parts.push(lat);
    const checked = checkedLine(row.checkedAt, "检测时间");
    if (checked) parts.push(checked);
    return parts.join("\n\n");
  }

  if (health === "unchecked") {
    parts.push("尚未检测");
    return parts.join("\n\n");
  }

  const http = httpLine(row.checkHttpStatus);
  if (http) parts.push(http);

  if (health === "restricted") {
    parts.push("服务器可访问，\n但拒绝检测请求。");
  } else if (health === "broken") {
    const msg = row.checkMessage?.replace(/\s*·\s*\d+ms\s*$/, "").trim();
    if (msg && !/^HTTP\s+\d+/i.test(msg)) {
      parts.push(msg.includes("不存在") ? "页面不存在。" : msg);
    } else if (row.checkHttpStatus === 404 || row.checkHttpStatus === 410) {
      parts.push("页面不存在。");
    } else if (row.checkHttpStatus != null && row.checkHttpStatus >= 500) {
      parts.push("服务器异常。");
    } else {
      parts.push("链接不可用。");
    }
  }

  const lat = latencyLine(row.checkLatencyMs);
  if (lat) parts.push(lat);

  const checked = checkedLine(
    row.checkedAt,
    health === "broken" ? "检测时间" : "最后检测",
  );
  if (checked) parts.push(checked);

  return parts.join("\n\n") || healthLabel(health);
}

export function healthSortRank(health: LinkHealthUi): number {
  switch (health) {
    case "healthy":
      return 0;
    case "restricted":
      return 1;
    case "broken":
      return 2;
    default:
      return 3;
  }
}
