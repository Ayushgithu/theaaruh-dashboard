"use client";
import { brandName } from "@/lib/brand";
import * as React from "react";
import { Loader2, MapPin, Package, Phone, Printer, RefreshCcw, Search, Tag, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderStatus } from "@/lib/types";
import { nextStatuses, STATUS_LABEL } from "@/lib/order-flow";
import { postJson } from "@/lib/api";
import { cn, formatPrice, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/drawer";
import { Input, Textarea } from "@/components/ui/form";
import { WhatsAppIcon } from "@/components/ui/icons";
import { ItemThumb, OrderStatusBadge, OrderTimeline, PaymentBadge } from "@/components/shared/order-ui";
import { AdminPageHeader } from "./shell";

type Tab = "all" | "process" | "shipped" | "delivered" | "cancelled" | "unpaid";
const TABS: { id: Tab; label: string; match: (o: Order) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "process", label: "To process", match: (o) => o.status === "placed" || o.status === "confirmed" },
  { id: "shipped", label: "Shipped", match: (o) => o.status === "shipped" },
  { id: "delivered", label: "Delivered", match: (o) => o.status === "delivered" },
  { id: "unpaid", label: "Awaiting payment", match: (o) => o.status === "pending_payment" },
  { id: "cancelled", label: "Cancelled", match: (o) => o.status === "cancelled" },
];
const ACTION_LABEL: Partial<Record<OrderStatus, string>> = { confirmed: "Confirm order", shipped: "Mark as shipped", delivered: "Mark as delivered" };

export function OrdersAdmin({ initial, shiprocket = false }: { initial: Order[]; shiprocket?: boolean }) {
  const [orders, setOrders] = React.useState(initial);
  // Keep the editable list aligned with server data after router.refresh().
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setOrders(initial), [initial]); // new orders arrive via router.refresh()
  const [tab, setTab] = React.useState<Tab>("all");
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [shipping, setShipping] = React.useState(false);
  const [carrier, setCarrier] = React.useState("");
  const [tracking, setTracking] = React.useState("");
  const [trackUrl, setTrackUrl] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const open = orders.find((o) => o.id === openId) ?? null;
  const list = orders.filter((o) => TABS.find((t) => t.id === tab)!.match(o) && `${o.orderNumber} ${o.customer.name} ${o.customer.email} ${o.customer.phone}`.toLowerCase().includes(q.toLowerCase()));
  const count = (t: Tab) => orders.filter(TABS.find((x) => x.id === t)!.match).length;

  const close = () => { setOpenId(null); setShipping(false); setCancelling(false); setNote(""); setCarrier(""); setTracking(""); setTrackUrl(""); };

  const update = async (status: OrderStatus, extra: Record<string, string> = {}) => {
    if (!open) return;
    setBusy(true);
    try {
      const { order } = await postJson<{ order: Order }>(`/api/admin/orders/${open.id}`, { status, ...extra }, "PATCH");
      setOrders((cur) => cur.map((o) => (o.id === order.id ? order : o)));
      toast.success(status === "cancelled" ? "Order cancelled" : "Order updated", { description: status === "cancelled" && order.payment.status === "refunded" ? "Refund issued to the customer." : `Marked as ${STATUS_LABEL[status].toLowerCase()}. The customer was emailed.` });
      setShipping(false); setCancelling(false); setNote("");
    } catch (e) {
      toast.error("Could not update the order", { description: e instanceof Error ? e.message : "Please try again." });
    }
    setBusy(false);
  };

  const courier = async (what: "ship" | "sync") => {
    if (!open) return;
    setBusy(true);
    try {
      const res = await postJson<{ order: Order; warnings?: string[] }>(`/api/admin/orders/${open.id}/${what}`, {});
      setOrders((cur) => cur.map((o) => (o.id === res.order.id ? res.order : o)));
      toast.success(what === "ship" ? "Shipped with Shiprocket" : "Tracking updated", { description: what === "ship" ? `AWB ${res.order.tracking?.number}. The customer was emailed.` : undefined });
      res.warnings?.forEach((w) => toast.warning(w));
    } catch (e) { toast.error(what === "ship" ? "Could not ship with Shiprocket" : "Could not refresh tracking", { description: e instanceof Error ? e.message : "Please try again." }); }
    setBusy(false);
  };

  const toPack = orders.filter((o) => o.status === "placed" || o.status === "confirmed");
  const phone91 = (p: string) => `91${p.replace(/\D/g, "").slice(-10)}`;

  return (
    <>
      <AdminPageHeader title="Orders" description="Every order placed on the website. Update the status and the customer is notified by email."
        action={toPack.length > 0 ? <Button asChild variant="outline" className="h-auto max-w-full whitespace-normal py-2 text-center"><a href={`/print/orders?ids=${toPack.slice(0, 60).map((o) => o.id).join(",")}`} target="_blank" rel="noopener noreferrer"><Printer className="h-4 w-4" /> Print slips for {Math.min(toPack.length, 60)} order{toPack.length === 1 ? "" : "s"} to pack</a></Button> : undefined} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filter orders" className="no-scrollbar flex gap-1 overflow-x-auto rounded-sm bg-card p-1 shadow-card ring-1 ring-line">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn("min-h-10 shrink-0 rounded-lg px-3.5 text-sm font-medium transition", tab === t.id ? "bg-primary text-white" : "text-body hover:bg-surface")}>
              {t.label} <span className={cn("ml-1 text-xs", tab === t.id ? "text-white/80" : "text-slate-500")}>{count(t.id)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no., name, phone or email" className="pl-10" aria-label="Search orders" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><Package className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">{orders.length === 0 ? "No orders yet" : "No orders here"}</h2>
          <p className="mt-1 text-sm">{orders.length === 0 ? "Orders appear here as soon as customers buy." : "Nothing matches this filter."}</p>
          {orders.length > 0 && <Button variant="outline" className="mt-5" onClick={() => { setTab("all"); setQ(""); }}>Show all orders</Button>}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-sm border border-line bg-card shadow-card md:block">
            <table className="w-full min-w-[620px] text-sm xl:min-w-[820px]">
              <thead className="bg-surface text-left text-xs font-semibold text-body">
                <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="hidden px-4 py-3 xl:table-cell">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Placed</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((o) => (
                  <tr key={o.id} tabIndex={0} onClick={() => setOpenId(o.id)} onKeyDown={(e) => e.key === "Enter" && setOpenId(o.id)} className="cursor-pointer hover:bg-primary-faint/50 focus-visible:bg-primary-faint/50">
                    <td className="px-4 py-3 font-semibold text-ink">{o.orderNumber}</td>
                    <td className="px-4 py-3"><p className="font-medium text-ink">{o.customer.name}</p><p className="text-xs">{o.customer.phone}</p><p className="mt-0.5 max-w-[12rem] truncate text-xs xl:hidden">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p></td>
                    <td className="hidden max-w-[14rem] px-4 py-3 xl:table-cell"><p className="truncate">{o.items.map((i) => `${i.quantity}× ${i.name}${i.size ? ` (${i.size})` : ""}`).join(", ")}</p></td>
                    <td className="px-4 py-3 font-semibold text-ink">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3"><PaymentBadge order={o} /></td>
                    <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3">{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {list.map((o) => (
              <li key={o.id}>
                <button onClick={() => setOpenId(o.id)} className="w-full rounded-sm border border-line bg-card p-4 text-left shadow-card">
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold text-ink">{o.orderNumber}</p><OrderStatusBadge status={o.status} /></div>
                  <p className="mt-1 text-sm">{o.customer.name} · {formatPrice(o.total)}</p>
                  <p className="mt-1 line-clamp-1 text-xs">{o.items.map((i) => i.name).join(", ")}</p>
                  <p className="mt-2 text-xs">{timeAgo(o.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={!!open} onClose={close} wide title={open ? `Order ${open.orderNumber}` : "Order"}>
        {open && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3"><OrderStatusBadge status={open.status} className="text-sm" /><PaymentBadge order={open} /></div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-sm border border-line p-4 text-sm">
                <p className="text-xs font-semibold">Customer</p>
                <p className="mt-1 font-semibold text-ink">{open.customer.name}</p>
                <p>{open.customer.email}</p><p>{open.customer.phone}</p>
                <div className="mt-3 flex gap-2">
                  <Button asChild variant="whatsapp" size="sm"><a href={`https://wa.me/${phone91(open.customer.phone)}?text=${encodeURIComponent(`Hi ${open.customer.name}, this is ${brandName} about your order ${open.orderNumber}.`)}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a></Button>
                  <Button asChild variant="outline" size="sm"><a href={`tel:+${phone91(open.customer.phone)}`}><Phone className="h-4 w-4" /> Call</a></Button>
                </div>
              </section>
              <section className="rounded-sm border border-line p-4 text-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold"><MapPin className="h-3.5 w-3.5" /> Ship to</p>
                <address className="mt-1 not-italic leading-relaxed"><strong className="font-semibold text-ink">{open.address.name}</strong><br />{open.address.line1}{open.address.line2 ? `, ${open.address.line2}` : ""}<br />{open.address.city}, {open.address.state} {open.address.pincode}<br />{open.address.phone}</address>
              </section>
            </div>

            <section>
              <p className="mb-2 text-xs font-semibold">Items</p>
              <ul className="divide-y divide-line rounded-sm border border-line">
                {open.items.map((i) => (
                  <li key={`${i.productId}|${i.size ?? ""}|${i.color ?? ""}`} className="flex items-center gap-3 p-3">
                    <ItemThumb item={i} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{i.name}</p><p className="text-xs">{[i.size && `Size ${i.size}`, i.color, `${formatPrice(i.price)} × ${i.quantity}`].filter(Boolean).join(" · ")}</p></div>
                    <p className="text-sm font-bold text-ink">{formatPrice(i.price * i.quantity)}</p>
                  </li>
                ))}
              </ul>
              <dl className="ml-auto mt-3 w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(open.subtotal)}</dd></div>
                {open.coupon && <div className="flex justify-between text-emerald-700"><dt>Coupon ({open.coupon.code})</dt><dd>{open.discount ? `−${formatPrice(open.discount)}` : "Free delivery"}</dd></div>}
                <div className="flex justify-between"><dt>Delivery</dt><dd>{open.shipping ? formatPrice(open.shipping) : "Free"}</dd></div>
                <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold text-ink"><dt>Total</dt><dd>{formatPrice(open.total)}</dd></div>
              </dl>
              {open.payment.razorpayPaymentId && <p className="mt-2 text-xs">Razorpay payment: {open.payment.razorpayPaymentId}{open.payment.refundId ? ` · refund ${open.payment.refundId}` : ""}</p>}
            </section>

            <div className="grid gap-6 sm:grid-cols-2">
              <section>
                <p className="mb-3 text-xs font-semibold">History</p><OrderTimeline order={open} />
                {open.tracking && (
                  <div className="mt-3 space-y-2 rounded-sm bg-primary-faint p-3 text-sm">
                    <p className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {open.tracking.carrier} · <strong className="text-ink">{open.tracking.number}</strong></p>
                    <div className="flex flex-wrap gap-2">
                      {open.tracking.labelUrl && <Button asChild size="sm" variant="outline"><a href={open.tracking.labelUrl} target="_blank" rel="noopener noreferrer"><Tag className="h-4 w-4" /> Print label</a></Button>}
                      {shiprocket && open.status === "shipped" && <Button size="sm" variant="outline" disabled={busy} onClick={() => courier("sync")}><RefreshCcw className="h-4 w-4" /> Refresh tracking</Button>}
                    </div>
                    {(open.trackingEvents?.length ?? 0) > 0 && <ul className="space-y-1 border-t border-line pt-2 text-xs">{[...open.trackingEvents!].reverse().slice(0, 6).map((e, i) => <li key={i}><strong className="text-ink">{e.status}</strong> · {new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{e.location ? ` · ${e.location}` : ""}</li>)}</ul>}
                  </div>
                )}
                {open.payment.method === "cod" && open.payment.advance && <p className="mt-3 rounded-sm bg-amber-50 px-3 py-2 text-xs text-amber-700">{open.payment.advance.status === "paid" ? `COD with ₹${open.payment.advance.amount} advance paid online — collect ${formatPrice(open.total - open.payment.advance.amount)} on delivery.` : open.payment.advance.status === "refunded" ? `Advance of ₹${open.payment.advance.amount} was refunded.` : `Waiting for the ₹${open.payment.advance.amount} advance.`}</p>}
              </section>

              <section aria-label="Update order" className="space-y-3">
                <p className="text-xs font-semibold">Update status</p>
                {nextStatuses(open.status).length === 0 && <p className="text-sm">This order is {STATUS_LABEL[open.status].toLowerCase()}. No further changes.</p>}

                {nextStatuses(open.status).filter((s) => s !== "cancelled").map((s) =>
                  s === "shipped" ? (
                    shipping ? (
                      <div key={s} className="space-y-2 rounded-sm border border-line p-3">
                        <Input placeholder="Courier (e.g. Delhivery)" value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Courier name" />
                        <Input placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} aria-label="Tracking number" />
                        <Input placeholder="Tracking link (optional)" value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} aria-label="Tracking link" />
                        <div className="flex gap-2">
                          <Button className="flex-1" disabled={busy} onClick={() => update("shipped", { carrier, trackingNumber: tracking, ...(trackUrl ? { trackingUrl: trackUrl } : {}) })}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & notify customer"}</Button>
                          <Button variant="ghost" onClick={() => setShipping(false)}>Back</Button>
                        </div>
                      </div>
                    ) : (
                      <div key={s} className="space-y-2">
                        {shiprocket && !open.tracking?.shiprocketOrderId && ["placed", "confirmed"].includes(open.status) && <Button className="w-full" disabled={busy} onClick={() => courier("ship")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Ship with Shiprocket</Button>}
                        <Button className="w-full" variant={shiprocket ? "outline" : "primary"} onClick={() => setShipping(true)}>{shiprocket ? "Enter tracking manually" : ACTION_LABEL[s]}</Button>
                      </div>
                    )
                  ) : <Button key={s} className="w-full" disabled={busy} onClick={() => update(s)}>{ACTION_LABEL[s] ?? STATUS_LABEL[s]}</Button>,
                )}

                {nextStatuses(open.status).includes("cancelled") && (
                  cancelling ? (
                    <div className="space-y-2 rounded-sm border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-700">{open.payment.status === "paid" && open.payment.method === "razorpay" ? `Cancel and refund ${formatPrice(open.total)} to the customer via Razorpay?` : "Cancel this order and put the items back in stock?"}</p>
                      <Textarea className="min-h-16 bg-card" placeholder="Reason (optional, shown in history)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Cancellation reason" />
                      <div className="flex gap-2"><Button variant="danger" className="flex-1" disabled={busy} onClick={() => update("cancelled", note ? { note } : {})}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, cancel order"}</Button><Button variant="ghost" onClick={() => setCancelling(false)}>Back</Button></div>
                    </div>
                  ) : <Button variant="dangerSoft" className="w-full" onClick={() => setCancelling(true)}>Cancel order{open.payment.status === "paid" && open.payment.method === "razorpay" ? " & refund" : ""}</Button>
                )}
              </section>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}