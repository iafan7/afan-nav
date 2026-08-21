export async function register() {
  // Only the Node server runtime — not Edge, not during static generation alone.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLinkCheckScheduler } = await import("@/lib/services/link-check-scheduler");
    startLinkCheckScheduler();
  }
}
