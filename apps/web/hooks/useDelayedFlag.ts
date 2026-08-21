"use client";

import { useEffect, useState } from "react";

/** True only after `delayMs` while `active` stays true; resets when inactive. */
export function useDelayedFlag(active: boolean, delayMs = 300) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return shown;
}
