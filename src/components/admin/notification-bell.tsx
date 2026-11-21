"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Inbox, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";

interface Note { id: string; kind: "order" | "enquiry"; title: string; body: string; href: string; at: string }

const SEEN_KEY = "lc_admin_notif_seen";
const POLL_MS = 15000;
const ICON = { order: ShoppingBag, enquiry: Inbox } as const;
const TINT = { order: "bg-emerald-50 text-emerald-600", enquiry: "bg-primary-faint text-primary" } as const;

const DISMISSED_KEY = "lc_admin_notif_dismissed";
const readDismissed = (): string[] => { try { const v = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeDismissed = (ids: string[]) => { try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-300))); } catch {} };

const readSeen = () => { try { const v = Number(localStorage.getItem(SEEN_KEY)); return v > 0 ? v : null; } catch { return null; } };
const writeSeen = (t: number) => { try { localStorage.setItem(SEEN_KEY, String(t)); } catch {} };

/** Dashboard bell: polls for new orders and enquiries, toasts new ones and refreshes the page data. */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = React.useState<Note[]>([]);
  const [seen, setSeen] = React.useState<number>(() => Date.now());
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState<string[]>([]); // ids the admin cleared with "Mark all read"
  const known = React.useRef<Set<string> | null>(null); // null until the first answer, so old items don't toast on page load
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Restore browser-only preferences after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
  }, []);
  React.useEffect(() => {
    // Restore the browser-only read timestamp after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeen(readSeen() ?? Date.now());
    if (readSeen() === null) writeSeen(Date.now());
  }, []);

  const poll = React.useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const r = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const { items: next = [] } = (await r.json()) as { items?: Note[] };
      setItems(next);
      if (known.current === null) { known.current = new Set(next.map((n) => n.id)); return; }
      const fresh = next.filter((n) => !known.current!.has(n.id));
      if (fresh.length === 0) return;
      fresh.forEach((n) => known.current!.add(n.id));
      fresh.slice(0, 3).forEach((n) => toast(n.title, { description: n.body, action: { label: "View", onClick: () => router.push(n.href) } }));
      router.refresh(); // server-rendered admin pages pick up the new data
    } catch { /* offline or signed out: try again next tick */ }
  }, [router]);

  React.useEffect(() => {
    const initialPoll = window.setTimeout(() => { void poll(); }, 0);
    const id = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearTimeout(initialPoll);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [poll]);

  const markRead = React.useCallback(() => { const t = Date.now(); writeSeen(t); setSeen(t); }, []);

  React.useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); markRead(); } };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); markRead(); } };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open, markRead]);

  // "Mark all read" clears the list: cleared notifications disappear from the bell for good (until new ones arrive).
  const clearAll = React.useCallback(() => {
    markRead();
    setDismissed((cur) => { const next = Array.from(new Set([...cur, ...items.map((n) => n.id)])); writeDismissed(next); return next; });
  }, [markRead, items]);

  const visible = items.filter((n) => !dismissed.includes(n.id));
  const unread = visible.filter((n) => +new Date(n.at) > seen).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { if (open) markRead(); setOpen((o) => !o); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        className="relative flex h-11 w-11 items-center justify-center rounded-sm text-body transition hover:bg-primary-faint hover:text-primary"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-sm border border-line bg-card shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <button type="button" onClick={clearAll} disabled={visible.length === 0} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary disabled:opacity-40">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm">{items.length === 0 ? "Nothing yet. New orders and enquiries will show up here." : "You're all caught up. New orders and enquiries will appear here."}</p>
          )}
          {items.length > 0 && (
            <ul data-lenis-prevent className="max-h-[min(24rem,70dvh)] divide-y divide-line overflow-y-auto">
              <AnimatePresence initial={false}>
              {visible.map((n) => {
                const Icon = ICON[n.kind];
                const isNew = +new Date(n.at) > seen;
                return (
                  <motion.li key={n.id} layout="position" exit={{ opacity: 0, x: 24, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                    <Link href={n.href} onClick={() => { setOpen(false); markRead(); }} className={cn("flex gap-3 px-4 py-3 transition hover:bg-surface", isNew && "bg-primary-faint/40")}>
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-sm", TINT[n.kind])}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-ink">{n.title}</span>{isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="New" />}</span>
                        <span className="block truncate text-sm">{n.body}</span>
                        <span className="text-xs">{timeAgo(n.at)}</span>
                      </span>
                    </Link>
                  </motion.li>
                );
              })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}