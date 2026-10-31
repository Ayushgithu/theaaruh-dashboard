"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the page's server component every `every` ms (and when the tab becomes visible again),
 * so new data shows up without a manual reload. Client state (search box, open panels) is kept.
 */
export function AutoRefresh({ every = 15000 }: { every?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = window.setInterval(tick, every);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [router, every]);
  return null;
}
