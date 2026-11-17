"use client";
import * as React from "react";
import { Copy, Mail, MapPin, Phone, Search, ShoppingCart, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { brandName } from "@/lib/brand";
import type { AdminCart } from "@/lib/types";
import { cn, formatPrice, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { WhatsAppIcon } from "@/components/ui/icons";
import { ItemThumb } from "@/components/shared/order-ui";
import { AdminPageHeader } from "./shell";
import { AutoRefresh } from "./auto-refresh";

const HOUR = 3_600_000;
const first = (n: string) => n.split(" ")[0];
const tenDigits = (p: string) => p.replace(/\D/g, "").slice(-10);
const idleHours = (c: AdminCart) => (Date.now() - new Date(c.updatedAt).getTime()) / HOUR;
const canContact = (c: AdminCart) => !c.customer.guest && tenDigits(c.customer.phone).length === 10;

const reminder = (c: AdminCart) =>
  `Hi ${first(c.customer.name)}, this is ${brandName}. You left ${c.items.map((i) => i.name + (i.size ? ` (${i.size})` : "")).join(", ")} in your bag (${formatPrice(c.total)}). Still interested? We can help with sizing, and these pieces are selling fast.`;

/** Everything the owner knows about this shopper, as plain text (to paste into WhatsApp / a notebook). */
export const cartDetails = (c: AdminCart) => [
  `${c.customer.guest ? "Guest visitor" : c.customer.name}${c.customer.guest ? "" : ` · ${c.customer.phone} · ${c.customer.email}`}`,
  c.customer.address ? `Address: ${[c.customer.address.line1, c.customer.address.line2, c.customer.address.city, c.customer.address.state, c.customer.address.pincode].filter(Boolean).join(", ")}` : "",
  `Orders: ${c.customer.orders ?? 0} (${formatPrice(c.customer.spent ?? 0)} spent)`,
  `In bag (${formatPrice(c.total)}): ${c.items.map((i) => `${i.quantity}× ${i.name}${i.size ? ` (${i.size}${i.color ? `, ${i.color}` : ""})` : ""}`).join("; ")}`,
  `Last activity: ${new Date(c.updatedAt).toLocaleString("en-IN")}`,
].filter(Boolean).join("\n");

type Tab = "all" | "idle1" | "idle24" | "members" | "guests";
const TABS: { id: Tab; label: string; match: (c: AdminCart) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "idle1", label: "Left 1h+ ago", match: (c) => idleHours(c) >= 1 },
  { id: "idle24", label: "Left 24h+ ago", match: (c) => idleHours(c) >= 24 },
  { id: "members", label: "Members", match: (c) => !c.customer.guest },
  { id: "guests", label: "Guests", match: (c) => !!c.customer.guest },
];

export function CartsAdmin({ initial }: { initial: AdminCart[] }) {
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("all");
  const [sort, setSort] = React.useState<"recent" | "value">("recent");

  const matchTab = TABS.find((t) => t.id === tab)!.match;
  const list = initial
    .filter((c) => matchTab(c) && `${c.customer.name} ${c.customer.email} ${c.customer.phone} ${c.items.map((i) => i.name).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "value" ? b.total - a.total : +new Date(b.updatedAt) - +new Date(a.updatedAt)));
  const value = initial.reduce((s, c) => s + c.total, 0);
  const recoverable = initial.filter((c) => canContact(c) && idleHours(c) >= 1);

  const copy = async (c: AdminCart) => { try { await navigator.clipboard.writeText(cartDetails(c)); toast.success("Customer details copied"); } catch { toast.error("Could not copy"); } };

  return (
    <>
      <AutoRefresh every={10000} />
      <AdminPageHeader title="Carts" description="Shoppers who added something to their bag but have not ordered — with everything we know about them. Updates by itself every few seconds." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-sm border border-line bg-card p-4 shadow-card"><p className="text-xs font-semibold">Carts right now</p><p className="mt-1 text-2xl font-bold text-ink" aria-live="polite"><strong className="font-bold">{initial.length}</strong> <span className="text-sm font-medium text-body">{initial.length === 1 ? "customer has" : "customers have"} items in their cart</span></p></div>
        <div className="rounded-sm border border-line bg-card p-4 shadow-card"><p className="text-xs font-semibold">Value waiting</p><p className="mt-1 text-2xl font-bold text-ink">{formatPrice(value)}</p></div>
        <div className="rounded-sm border border-line bg-card p-4 shadow-card"><p className="text-xs font-semibold">Worth a reminder</p><p className="mt-1 text-2xl font-bold text-primary">{recoverable.length}</p><p className="text-xs">signed-in, with a phone number, idle for 1h+ · {formatPrice(recoverable.reduce((n, c) => n + c.total, 0))}</p></div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filter carts" className="no-scrollbar flex gap-1 overflow-x-auto rounded-sm bg-card p-1 shadow-card ring-1 ring-line">
          {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("min-h-10 shrink-0 rounded-lg px-3.5 text-sm font-medium transition", tab === t.id ? "bg-primary text-white" : "text-body hover:bg-surface")}>{t.label} <span className={cn("ml-1 text-xs", tab === t.id ? "text-white/80" : "text-slate-500")}>{initial.filter(t.match).length}</span></button>)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="Sort carts" value={sort} onChange={(e) => setSort(e.target.value as "recent" | "value")} className="h-11 rounded-sm border border-line bg-card px-3 text-sm font-medium text-ink"><option value="recent">Latest activity</option><option value="value">Highest value</option></select>
          <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer or product" className="pl-10" aria-label="Search carts" /></div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><ShoppingCart className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">{initial.length === 0 ? "No active carts" : "Nothing matches"}</h2>
          <p className="mt-1 text-sm">{initial.length === 0 ? "When a shopper adds something to their bag, it shows up here." : "Try a different filter, name or product."}</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {list.map((c) => {
            const hrs = idleHours(c);
            const cu = c.customer; const a = cu.address;
            return (
              <li key={c.userId} className="rounded-sm border border-line bg-card p-4 shadow-card sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink"><UserRound className="h-4 w-4 text-primary" /> {cu.guest ? "Guest visitor" : cu.name}
                      {cu.guest ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Not signed in</span> : (cu.orders ?? 0) > 0 ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Returning · {cu.orders} order{cu.orders === 1 ? "" : "s"}</span> : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">New customer</span>}
                    </p>
                    {cu.guest ? <p className="text-sm">No contact details yet — they will appear here once the shopper signs in or checks out.</p> : <p className="text-sm">{cu.phone || "No phone"} · {cu.email}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 font-semibold", hrs < 1 ? "bg-emerald-50 text-emerald-700" : hrs < 24 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700")}>{hrs < 1 ? "Active now" : hrs < 24 ? "Idle" : "Abandoned"} · last activity {timeAgo(c.updatedAt)}</span>
                      {cu.joined && !cu.guest && <span>Joined {new Date(cu.joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                    </p>
                  </div>
                  <div className="text-right"><p className="text-lg font-bold text-ink">{formatPrice(c.total)}</p><p className="text-xs">{c.items.reduce((n, i) => n + i.quantity, 0)} item(s)</p></div>
                </div>

                {!cu.guest && (
                  <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-sm bg-surface p-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs font-semibold">Purchase history</dt><dd className="mt-0.5 text-ink">{cu.orders ?? 0} order{cu.orders === 1 ? "" : "s"} · {formatPrice(cu.spent ?? 0)}{cu.lastOrderAt && <span className="block text-xs text-body">last order {timeAgo(cu.lastOrderAt)}</span>}</dd></div>
                    <div><dt className="flex items-center gap-1 text-xs font-semibold"><Wallet className="h-3 w-3" /> Wallet</dt><dd className="mt-0.5 text-ink">{formatPrice(cu.wallet ?? 0)}</dd></div>
                    <div><dt className="flex items-center gap-1 text-xs font-semibold"><MapPin className="h-3 w-3" /> Address</dt><dd className="mt-0.5 text-ink">{a ? [a.line1, a.city, a.state, a.pincode].filter(Boolean).join(", ") : <span className="text-body">Not saved yet</span>}</dd></div>
                  </dl>
                )}

                <ul className="mt-4 divide-y divide-line rounded-sm border border-line">
                  {c.items.map((i) => (
                    <li key={`${i.productId}|${i.size ?? ""}|${i.color ?? ""}`} className="flex items-center gap-3 p-3">
                      <ItemThumb item={i} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{i.name}</p>
                        <p className="text-xs">{[i.size && `Size ${i.size}`, i.color].filter(Boolean).join(" · ")}{(i.size || i.color) ? " · " : ""}{formatPrice(i.price)} × {i.quantity} · added {timeAgo(i.addedAt)}{i.available <= 0 ? " · sold out" : i.available < i.quantity ? ` · only ${i.available} left` : ""}</p>
                      </div>
                      <p className="text-sm font-bold text-ink">{formatPrice(i.price * i.quantity)}</p>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canContact(c) && <Button asChild variant="whatsapp" size="sm"><a href={`https://wa.me/91${tenDigits(cu.phone)}?text=${encodeURIComponent(reminder(c))}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-4 w-4" /> WhatsApp reminder</a></Button>}
                  {canContact(c) && <Button asChild variant="outline" size="sm"><a href={`tel:+91${tenDigits(cu.phone)}`}><Phone className="h-4 w-4" /> Call</a></Button>}
                  {!cu.guest && cu.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${cu.email}?subject=${encodeURIComponent(`You left something in your bag — ${brandName}`)}&body=${encodeURIComponent(reminder(c))}`}><Mail className="h-4 w-4" /> Email</a></Button>}
                  <Button variant="ghost" size="sm" onClick={() => void copy(c)}><Copy className="h-4 w-4" /> Copy details</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
