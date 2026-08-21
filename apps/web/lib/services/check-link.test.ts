import { describe, expect, it } from "vitest";
import { checkLinkReachable } from "@/lib/services/check-link";
import { ServiceError } from "@/lib/services/categories";

describe("checkLinkReachable", () => {
  it("rejects private urls before fetching", async () => {
    await expect(checkLinkReachable("http://127.0.0.1/")).rejects.toBeInstanceOf(ServiceError);
    await expect(checkLinkReachable("http://192.168.0.1/")).rejects.toBeInstanceOf(ServiceError);
  });
});
