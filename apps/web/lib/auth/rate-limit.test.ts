import { afterEach, describe, expect, it } from "vitest";
import {
  __resetLoginRateLimitForTests,
  checkLoginRateLimit,
} from "./rate-limit";

describe("login rate limit", () => {
  afterEach(() => {
    __resetLoginRateLimitForTests();
  });

  it("allows under the limit and blocks after", () => {
    const key = "1.2.3.4:admin";
    for (let i = 0; i < 8; i++) {
      expect(checkLoginRateLimit(key).ok).toBe(true);
    }
    const blocked = checkLoginRateLimit(key);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
