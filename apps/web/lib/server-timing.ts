import { NextResponse } from "next/server";

/** Opt-in via ENABLE_SERVER_TIMING=true (off by default in production). */
export function isServerTimingEnabled() {
  return process.env.ENABLE_SERVER_TIMING === "true";
}

/** Collect Server-Timing metrics for admin route handlers (devtools Network). */
export class TimingCollector {
  private parts: string[] = [];
  private enabled = isServerTimingEnabled();

  async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    if (!this.enabled) {
      return await fn();
    }
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const ms = performance.now() - start;
      this.parts.push(`${name};dur=${ms.toFixed(1)}`);
    }
  }

  apply(headers: Headers) {
    if (this.enabled && this.parts.length > 0) {
      headers.set("Server-Timing", this.parts.join(", "));
    }
  }

  json(data: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    this.apply(headers);
    return NextResponse.json(data, { ...init, headers });
  }
}
