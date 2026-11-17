"use client";
import * as React from "react";

const SECTIONS = [
  { key: "orders", href: "/admin/orders" },
  { key: "carts", href: "/admin/carts" },
  { key: "enquiries", href: "/admin/enquiries" },
  { key: "returns", href: "/admin/returns" },
  { key: "reviews", href: "/admin/reviews" },
] as const;

export type BadgeKey = (typeof SECTIONS)[number]["key"];
export type Badges = Record<BadgeKey, number>;

const POLL_MS = 15000;
const storeKey = (k: BadgeKey) => `lc_admin_seen_${k}`;
const read = (k: BadgeKey) => { try { const v = Number(localStorage.getItem(storeKey(k))); return v > 0 ? v : null; } catch { return null; } };
const write = (k: BadgeKey, t: number) => { try { localStorage.setItem(storeKey(k), String(t)); } catch {} };
const isOpen = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * How many new orders / carts / enquiries arrived since the admin last opened each page.
 * Opening a page (or being on it when something arrives) counts as seeing it. First visit on a browser starts from zero.
 */
export function useAdminBadges(pathname: string): Badges {
  const [counts, setCounts] = React.useState<Badges>({ orders: 0, carts: 0, enquiries: 0, returns: 0, reviews: 0 });

  const poll = React.useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const params = new URLSearchParams();
    for (const s of SECTIONS) { const seen = read(s.key); if (seen) params.set(s.key, String(seen)); }
    try {
      const r = await fetch(`/api/admin/badges?${params}`, { cache: "no-store" });
      if (!r.ok) return;
      const { now, counts: next } = (await r.json()) as { now: number; counts: Badges };
      const out: Badges = { orders: next.orders ?? 0, carts: next.carts ?? 0, enquiries: next.enquiries ?? 0, returns: next.returns ?? 0, reviews: next.reviews ?? 0 };
      for (const s of SECTIONS) {
        if (isOpen(pathname, s.href) || read(s.key) === null) { write(s.key, now); out[s.key] = 0; }
      }
      setCounts(out);
    } catch { /* offline or signed out: try again next tick */ }
  }, [pathname]);

  React.useEffect(() => {
    const initialPoll = window.setTimeout(() => { void poll(); }, 0);
    return () => window.clearTimeout(initialPoll);
  }, [pathname, poll]);

  React.useEffect(() => {
    const id = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", poll); };
  }, [poll]);

  const visibleCounts = { ...counts };
  for (const section of SECTIONS) {
    if (isOpen(pathname, section.href)) visibleCounts[section.key] = 0;
  }
  return visibleCounts;
}