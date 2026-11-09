"use client";
import * as React from "react";

export const NAV_ORDER_KEY = "lc_nav_order";
const EVENT = "lc-nav-order";
type Order = Record<string, string[]>;

const read = (): Order => {
  try { return JSON.parse(localStorage.getItem(NAV_ORDER_KEY) ?? "{}") || {}; } catch { return {}; }
};
const notify = () => window.dispatchEvent(new Event(EVENT));

/** Back to the default menu order. */
export function resetNavOrder() {
  try { localStorage.removeItem(NAV_ORDER_KEY); } catch {}
  notify();
}

/** Sidebar order the admin chose by dragging. Saved per browser; pages can only move inside their own section. */
export function useNavOrder<T extends { title: string; items: { href: string }[] }>(sections: T[]) {
  const [order, setOrder] = React.useState<Order>({});

  React.useEffect(() => {
    const sync = () => setOrder(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  const ordered = React.useMemo(
    () => sections.map((s) => {
      const saved = order[s.title];
      if (!saved) return s;
      const rank = (href: string) => { const i = saved.indexOf(href); return i < 0 ? 999 : i; };
      return { ...s, items: [...s.items].sort((a, b) => rank(a.href) - rank(b.href)) } as T;
    }),
    [sections, order],
  );

  /** Moves `from` to where `to` is. */
  const move = React.useCallback((title: string, from: string, to: string) => {
    if (from === to) return;
    const section = ordered.find((s) => s.title === title);
    if (!section) return;
    const hrefs = section.items.map((i) => i.href);
    const fi = hrefs.indexOf(from), ti = hrefs.indexOf(to);
    if (fi < 0 || ti < 0) return;
    hrefs.splice(ti, 0, ...hrefs.splice(fi, 1));
    try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify({ ...read(), [title]: hrefs })); } catch {}
    notify();
  }, [ordered]);

  return { sections: ordered, move };
}
