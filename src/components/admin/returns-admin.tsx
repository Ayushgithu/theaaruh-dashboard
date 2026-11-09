"use client";
import * as React from "react";
import Link from "next/link";
import { Loader2, PackageCheck, Search, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { ReturnRequest, ReturnStatus } from "@/lib/types";
import { RETURN_STATUS_LABEL } from "@/lib/returns-rules";
import { postJson } from "@/lib/api";
import { cn, formatPrice, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/drawer";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ItemThumb } from "@/components/shared/order-ui";
import { AdminPageHeader } from "./shell";

type Tab = "todo" | "requested" | "progress" | "closed" | "all";
const TABS: { id: Tab; label: string; match: (r: ReturnRequest) => boolean }[] = [
  { id: "todo", label: "Needs action", match: (r) => ["requested", "received"].includes(r.status) || (r.status === "approved") },
  { id: "requested", label: "New requests", match: (r) => r.status === "requested" },
  { id: "progress", label: "In progress", match: (r) => ["approved", "pickup_scheduled", "received"].includes(r.status) },
  { id: "closed", label: "Closed", match: (r) => ["refunded", "exchange_shipped", "rejected", "cancelled"].includes(r.status) },
  { id: "all", label: "All", match: () => true },
];
const tone = (s: ReturnStatus) => s === "refunded" || s === "exchange_shipped" ? "bg-emerald-50 text-emerald-700" : s === "rejected" || s === "cancelled" ? "bg-red-50 text-red-700" : s === "requested" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
const Badge = ({ s }: { s: ReturnStatus }) => <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", tone(s))}>{RETURN_STATUS_LABEL[s]}</span>;

export function ReturnsAdmin({ initial, shiprocket, online, wallet = { bonus: 0 } }: { initial: ReturnRequest[]; shiprocket: boolean; online: boolean; wallet?: { bonus: number } }) {
  const [list, setList] = React.useState(initial);
  const [tab, setTab] = React.useState<Tab>("todo");
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [carrier, setCarrier] = React.useState("");
  const [awb, setAwb] = React.useState("");
  const [restock, setRestock] = React.useState(true);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<"razorpay" | "manual" | "wallet">(online ? "razorpay" : "manual");
  const [rejecting, setRejecting] = React.useState(false);

  const open = list.find((r) => r.id === openId) ?? null;
  const shown = list.filter((r) => TABS.find((t) => t.id === tab)!.match(r) && `${r.number} ${r.orderNumber} ${r.customer.name} ${r.customer.phone}`.toLowerCase().includes(q.toLowerCase()));
  const count = (t: Tab) => list.filter(TABS.find((x) => x.id === t)!.match).length;
  const value = (r: ReturnRequest) => r.items.reduce((n, i) => n + i.price * i.quantity, 0);

  const reset = () => { setNote(""); setCarrier(""); setAwb(""); setRejecting(false); setRestock(true); setAmount(""); };
  const show = (r: ReturnRequest) => { reset(); setAmount(String(value(r))); setMethod(r.refundTo === "wallet" ? "wallet" : online ? "razorpay" : "manual"); setOpenId(r.id); };

  const run = async (body: Record<string, unknown>, done: string) => {
    if (!open) return;
    setBusy(true);
    try {
      const { request } = await postJson<{ request: ReturnRequest }>(`/api/admin/returns/${open.id}`, body);
      setList((c) => c.map((x) => (x.id === request.id ? request : x)));
      toast.success(done);
      reset(); setAmount(String(value(request)));
    } catch (e) { toast.error("Could not update the request", { description: e instanceof Error ? e.message : "Please try again." }); }
    setBusy(false);
  };

  return (
    <>
      <AdminPageHeader title="Returns & exchanges" description="Requests from customers. Approve, arrange the pickup, receive the item, then refund or ship the replacement." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filter requests" className="no-scrollbar flex gap-1 overflow-x-auto rounded-sm bg-card p-1 shadow-card ring-1 ring-line">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("min-h-10 shrink-0 rounded-lg px-3.5 text-sm font-medium transition", tab === t.id ? "bg-primary text-white" : "text-body hover:bg-surface")}>
              {t.label} <span className={cn("ml-1 text-xs", tab === t.id ? "text-white/80" : "text-slate-500")}>{count(t.id)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-xs"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search request, order or customer" aria-label="Search returns" className="pl-10" /></div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><Undo2 className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">{q ? "Nothing matches your search" : "No requests here"}</h2>
          <p className="mt-1 text-sm">{q ? "Try a different request or order number." : "Return and exchange requests from customers will show up here."}</p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Return requests">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => show(r)} className="flex w-full flex-wrap items-center gap-3 rounded-sm border border-line bg-card p-4 text-left shadow-card transition hover:border-primary/40">
                <ItemThumb item={r.items[0]} className="h-16 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{r.number} <span className="font-normal">· {r.type === "exchange" ? "Exchange" : "Return"} · order {r.orderNumber}</span></p>
                  <p className="truncate text-sm">{r.customer.name} · {r.items.map((i) => `${i.quantity}× ${i.name}${i.size ? ` (${i.size})` : ""}`).join(", ")}</p>
                  <p className="text-xs">{r.reason} · {timeAgo(r.createdAt)}</p>
                </div>
                <div className="text-right"><Badge s={r.status} /><p className="mt-1 text-sm font-bold text-ink">{formatPrice(value(r))}</p></div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!open} onClose={() => { setOpenId(null); reset(); }} title={open ? `${open.number} · ${open.type === "exchange" ? "Exchange" : "Return"}` : ""} wide>
        {open && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><Badge s={open.status} /><Link href="/admin/orders" className="text-sm font-semibold text-primary hover:underline">Order {open.orderNumber}</Link></div>

            <section>
              <ul className="divide-y divide-line rounded-sm border border-line">
                {open.items.map((i) => (
                  <li key={i.index} className="flex items-center gap-3 p-3">
                    <ItemThumb item={i} className="h-16 w-12" />
                    <div className="min-w-0 flex-1 text-sm"><p className="font-semibold text-ink">{i.name}</p><p className="text-xs">{[i.size && `Size ${i.size}`, i.color, `${i.quantity} × ${formatPrice(i.price)}`].filter(Boolean).join(" · ")}</p></div>
                    <p className="font-bold text-ink">{formatPrice(i.price * i.quantity)}</p>
                  </li>
                ))}
              </ul>
              {open.exchangeTo?.size && <p className="mt-2 text-sm font-medium text-ink">Wants size <strong>{open.exchangeTo.size}</strong>{open.exchangeTo.color ? ` in ${open.exchangeTo.color}` : ""} instead.</p>}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-semibold">Customer</p><p className="mt-1 text-sm"><strong className="text-ink">{open.customer.name}</strong><br />{open.customer.phone}<br />{open.customer.email.endsWith("@guest.invalid") ? "Guest (no email)" : open.customer.email}</p></div>
              {open.type === "return" && <div className="sm:col-span-2 rounded-sm bg-amber-50 p-3 text-sm text-amber-800"><p className="font-semibold">Customer wants the refund {open.refundTo === "wallet" ? "in the store wallet" : "to the original payment / bank"}</p>{open.refundDetails && <p className="mt-1 break-words">Details: <strong>{open.refundDetails}</strong></p>}</div>}
              <div><p className="text-xs font-semibold">Reason</p><p className="mt-1 text-sm"><strong className="text-ink">{open.reason}</strong>{open.comment ? <><br />“{open.comment}”</> : null}</p></div>
            </section>

            {open.photos.length > 0 && (
              <section><p className="mb-2 text-xs font-semibold">Customer photos</p>
                <ul className="flex flex-wrap gap-2">{open.photos.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="Customer photo" className="h-24 w-24 rounded-sm border border-line object-cover" /></a></li>)}</ul></section>
            )}

            {(open.pickup?.awb || open.exchangeShipment?.awb || open.refund) && (
              <section className="space-y-1 rounded-sm bg-primary-faint p-4 text-sm">
                {open.pickup?.awb && <p><Truck className="mr-1.5 inline h-4 w-4 text-primary" />Pickup: {open.pickup.carrier} · <strong className="text-ink">{open.pickup.awb}</strong>{open.pickup.url && <> · <a href={open.pickup.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Track</a></>}</p>}
                {open.exchangeShipment?.awb && <p><Truck className="mr-1.5 inline h-4 w-4 text-primary" />Replacement: {open.exchangeShipment.carrier} · <strong className="text-ink">{open.exchangeShipment.awb}</strong></p>}
                {open.refund && <p><PackageCheck className="mr-1.5 inline h-4 w-4 text-primary" />Refunded <strong className="text-ink">{formatPrice(open.refund.amount)}</strong> {open.refund.method === "razorpay" ? `via Razorpay (${open.refund.refundId})` : open.refund.method === "wallet" ? `to the wallet${open.refund.bonus ? ` (+${formatPrice(open.refund.bonus)} bonus)` : ""}` : "manually"}{open.refund.note ? ` — ${open.refund.note}` : ""}</p>}
              </section>
            )}

            <section aria-label="Actions" className="space-y-4">
              <p className="text-xs font-semibold">What would you like to do?</p>

              {open.status === "requested" && (rejecting ? (
                <div className="space-y-2 rounded-sm border border-red-200 bg-red-50 p-3">
                  <Textarea className="min-h-16 bg-card" placeholder="Reason shown to the customer" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Rejection reason" />
                  <div className="flex gap-2"><Button variant="danger" className="flex-1" disabled={busy} onClick={() => run({ action: "reject", note }, "Request rejected")}>Reject request</Button><Button variant="ghost" onClick={() => setRejecting(false)}>Back</Button></div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => run({ action: "approve", note: note || undefined }, "Request approved — the customer was emailed")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Approve</Button><Button variant="dangerSoft" onClick={() => setRejecting(true)}>Reject…</Button></div>
              ))}

              {open.status === "approved" && (
                <div className="space-y-3 rounded-sm border border-line p-3">
                  <p className="text-sm font-medium text-ink">Arrange the pickup from the customer</p>
                  <Button variant="soft" disabled={busy || !shiprocket} onClick={() => run({ action: "shiprocket_pickup" }, "Reverse pickup booked")}><Truck className="h-4 w-4" /> Book pickup with Shiprocket</Button>
                  {!shiprocket && <p className="text-xs">Shiprocket is not set up — add the SHIPROCKET_* environment variables, or enter the pickup details manually below.</p>}
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input placeholder="Courier" value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Pickup courier" /><Input placeholder="Tracking / AWB" value={awb} onChange={(e) => setAwb(e.target.value)} aria-label="Pickup tracking number" /><Button variant="outline" disabled={busy || awb.length < 3} onClick={() => run({ action: "pickup", carrier, awb }, "Pickup saved")}>Save pickup</Button></div>
                </div>
              )}

              {["approved", "pickup_scheduled"].includes(open.status) && (
                <div className="space-y-2 rounded-sm border border-line p-3">
                  <p className="text-sm font-medium text-ink">Item reached you?</p>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="h-4 w-4 accent-primary" /> Put it back in stock (untick if damaged)</label>
                  <Button variant="outline" disabled={busy} onClick={() => run({ action: "received", restock }, "Marked as received")}>Mark as received</Button>
                </div>
              )}

              {open.type === "return" && ["approved", "pickup_scheduled", "received"].includes(open.status) && (
                <div className="space-y-3 rounded-sm border border-line p-3">
                  <p className="text-sm font-medium text-ink">Refund</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Amount (₹)" hint={`Items value ${formatPrice(value(open))}. Delivery charges are usually not refunded.`}><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} aria-label="Refund amount" /></Field>
                    <Field label="How"><Select value={method} onChange={(e) => setMethod(e.target.value as "razorpay" | "manual" | "wallet")} aria-label="Refund method"><option value="wallet">Add to store wallet (instant{wallet.bonus ? `, +${wallet.bonus}% bonus` : ""})</option><option value="razorpay" disabled={!online}>Refund to original payment via Razorpay (prepaid orders)</option><option value="manual">I refunded manually (UPI / bank transfer)</option></Select></Field>
                  </div>
                  <Input placeholder="Note to the customer (optional), e.g. UPI ref no." value={note} onChange={(e) => setNote(e.target.value)} aria-label="Refund note" />
                  <Button disabled={busy || !Number(amount)} onClick={() => run({ action: "refund", amount: Number(amount), method, note: note || undefined }, "Refund recorded — the customer was emailed")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Refund {Number(amount) ? formatPrice(Number(amount)) : ""}</Button>
                </div>
              )}

              {open.type === "exchange" && ["approved", "pickup_scheduled", "received"].includes(open.status) && (
                <div className="space-y-2 rounded-sm border border-line p-3">
                  <p className="text-sm font-medium text-ink">Send the replacement{open.exchangeTo?.size ? ` (size ${open.exchangeTo.size})` : ""}</p>
                  <p className="text-xs">The replacement size is taken out of stock when you mark it shipped.</p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input placeholder="Courier" value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Replacement courier" /><Input placeholder="Tracking / AWB (optional)" value={awb} onChange={(e) => setAwb(e.target.value)} aria-label="Replacement tracking number" /><Button disabled={busy} onClick={() => run({ action: "exchange_ship", carrier, awb }, "Replacement marked as shipped")}>Mark shipped</Button></div>
                </div>
              )}

              {!["rejected", "cancelled"].includes(open.status) && (
                <div className="flex gap-2"><Input placeholder="Internal note (only you see it)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Internal note" /><Button variant="ghost" disabled={busy || note.length < 2} onClick={() => run({ action: "note", note }, "Note saved")}>Save note</Button></div>
              )}
              {open.adminNote && <p className="text-xs">Latest note: {open.adminNote}</p>}
            </section>

            <section><p className="mb-2 text-xs font-semibold">History</p>
              <ol className="space-y-2 border-l-2 border-line pl-4">{[...open.timeline].reverse().map((t, i) => <li key={i} className="text-sm"><strong className="text-ink">{RETURN_STATUS_LABEL[t.status]}</strong> <span className="text-xs">· {new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{t.by ? ` · ${t.by}` : ""}</span>{t.note && <p className="text-xs">{t.note}</p>}</li>)}</ol></section>
          </div>
        )}
      </Dialog>
    </>
  );
}
