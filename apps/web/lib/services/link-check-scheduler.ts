import { ensureReady } from "@/lib/ready";
import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "@/lib/link-check-defaults";
import { checkAndPersistAllLinks } from "@/lib/services/links";
import { getSettings } from "@/lib/services/settings";

const globalForScheduler = globalThis as unknown as {
  __linkCheckSchedulerStarted?: boolean;
  /** True while a scheduled batch is in flight (blocks overlapping ticks). */
  __linkCheckSchedulerBusy?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-process background loop: reads interval from site_settings and checks all links.
 * Runs for the lifetime of the Node server (Docker / next start). Independent of admin UI.
 *
 * Overlap guards:
 * - `__linkCheckSchedulerStarted` — only one loop per process
 * - `__linkCheckSchedulerBusy` — skip tick if previous batch still running
 * - `checkAndPersistAllLinks` single-flight — shares work with admin check-all
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

        if (globalForScheduler.__linkCheckSchedulerBusy) {
          console.info("[link-check] skip tick — previous batch still running");
          await sleep(Math.max(1, minutes) * 60_000);
          continue;
        }

        globalForScheduler.__linkCheckSchedulerBusy = true;
        try {
          console.info(`[link-check] batch start (interval=${minutes}m)`);
          const results = await checkAndPersistAllLinks();
          const valid = results.filter((r) => r.checkStatus === "valid").length;
          const broken = results.filter((r) => r.checkStatus === "invalid").length;
          console.info(
            `[link-check] batch done: ${results.length} links, ${valid} valid, ${broken} invalid`,
          );
        } finally {
          globalForScheduler.__linkCheckSchedulerBusy = false;
        }

        await sleep(Math.max(1, minutes) * 60_000);
      } catch (error) {
        globalForScheduler.__linkCheckSchedulerBusy = false;
        console.error("[link-check] batch failed", error);
        await sleep(60_000);
      }
    }
  })();
}
