/**
 * Password-mutation E2E — run only against the isolated compose stack
 * (apps/web/e2e-security/run-isolated.sh), never against the deployed ./data volume.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-security",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3101",
    ...devices["Desktop Chrome"],
  },
});
