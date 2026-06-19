"use client";

import { useEffect } from "react";

/**
 * Scrolls the agenda to today's date section on mount. No-op when today's
 * section isn't rendered (i.e. the viewer is looking at a non-current month).
 */
export function ScrollToToday({ targetId }: { targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
  }, [targetId]);
  return null;
}
