import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** QR-printer style stat card: flat, thin border, accent-tinted icon tile on the left, small uppercase label, big value, hint. */
export function StatCard({
  Icon, label, value, hint, href, small, tone = "default",
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  small?: boolean;
  tone?: "default" | "muted" | "danger";
}) {
  const tile = {
    default: "bg-primary/[0.08] text-primary",
    muted: "bg-slate-100 text-slate-500",
    danger: "bg-red-50 text-red-600",
  }[tone];
  const body = (
    <div className="flex items-start gap-3 p-4 sm:p-5">
      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-sm", tile)}><Icon className="h-6 w-6" /></span>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</div>
        <div className={cn("mt-0.5 text-ink", small ? "line-clamp-2 text-lg font-bold leading-snug" : "text-2xl font-extrabold leading-tight")}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-ink/55">{hint}</div>}
      </div>
    </div>
  );
  const cls = "block rounded-sm border border-line bg-card";
  return href ? <Link href={href} className={cn(cls, "transition hover:border-primary/40")}>{body}</Link> : <div className={cls}>{body}</div>;
}
