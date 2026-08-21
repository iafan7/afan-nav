import { ensureReady } from "@/lib/ready";
import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "@/lib/link-check-defaults";
import { checkAndPersistAllLinks } from "@/lib/services/links";
import { getSettings } from "@/lib/services/settings";

const globalForScheduler = globalThis as unknown as {
  __linkCheckSchedulerStarted?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-process background loop: reads interval from site_settings and checks all links.
 * Runs for the lifetime of the Node server (Docker / next start). Independent of admin UI.
 */
export function startLinkCheckScheduler() {
  if (globalForScheduler.__linkCheckSchedulerStarted) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV === "test") return;

  globalForScheduler.__linkCheckSchedulerStarted = true;

  void (async () => {
    // Let HTTP server finish booting / schema migrate first
    await sleep(8_000);

    for (;;) {
      try {
        await ensureReady();
        const settings = await getSettings();
        const minutes = settings?.linkCheckIntervalMinutes ?? DEFAULT_LINK_CHECK_INTERVAL_MINUTES;

        if (minutes <= 0) {
          await sleep(30_000);
          continue;
        }

        console.info(`[link-check] batch start (interval=${minutes}m)`);
        const results = await checkAndPersistAllLinks();
        const valid = results.filter((r) => r.checkStatus === "valid").length;
        console.info(
          `[link-check] batch done: ${results.length} links, ${valid} valid, ${results.length - valid} invalid`,
        );

        await sleep(Math.max(1, minutes) * 60_000);
      } catch (error) {
        console.error("[link-check] batch failed", error);
        await sleep(60_000);
      }
    }
  })();
}
