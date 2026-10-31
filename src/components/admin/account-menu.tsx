"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/** Top-right "who is signed in" chip with a small account menu. */
export function AdminAccountMenu({ name, email, onLogout }: { name: string; email: string; onLogout: () => void | Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const display = name.trim() || email.split("@")[0] || "Admin";
  const initial = (display[0] ?? "A").toUpperCase();

  React.useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);

  const avatar = "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white";
  const item = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-ink hover:bg-surface";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-card py-1 pl-1.5 pr-1.5 transition hover:border-primary/40 hover:bg-primary-faint sm:pr-3"
      >
        <span className={cn(avatar, "relative h-8 w-8 text-sm")}>
          {initial}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" aria-hidden />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[9rem] truncate text-sm font-semibold text-ink">{display}</span>
          <span className="block text-[11px] text-body">Administrator</span>
        </span>
        <ChevronDown className={cn("hidden h-4 w-4 text-body transition-transform sm:block", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-card p-2 shadow-lift">
          <div className="flex items-center gap-3 border-b border-line px-3 pb-3 pt-2">
            <span className={cn(avatar, "h-11 w-11 text-base")}>{initial}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{display}</p>
              <p className="truncate text-xs">{email}</p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary-faint px-2 py-0.5 text-[11px] font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Signed in as admin
              </span>
            </div>
          </div>
          <div className="pt-2">
            <a role="menuitem" href={(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || "/"} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}><ExternalLink className="h-4 w-4" /> View website</a>
            <Link role="menuitem" href="/admin/settings" onClick={() => setOpen(false)} className={item}><Settings className="h-4 w-4" /> Settings</Link>
            <button role="menuitem" type="button" onClick={() => { setOpen(false); void onLogout(); }} className={cn(item, "text-red-600 hover:bg-red-50")}><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
