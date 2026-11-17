import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { getSession } from "@/lib/auth";
import { getRules } from "@/lib/settings";
import { toOrder } from "@/lib/repo-shop";
import { brandName, storeAddress, storePhone } from "@/lib/brand";
import { formatPrice } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Packing slips", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MAX = 60;
const dt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Packing slip + shipping label for one or many orders (?ids=a,b,c). Standalone page so it prints cleanly. */
export default async function PrintOrdersPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  if (!(await getSession())) redirect("/login");
  const ids = ((await searchParams).ids ?? "").split(",").map((x) => x.trim()).filter((x) => mongoose.isValidObjectId(x)).slice(0, MAX);
  await connectDB();
  const docs = ids.length ? await OrderModel.find({ _id: { $in: ids } }).sort({ createdAt: 1 }).lean() : [];
  const orders = docs.map(toOrder);
  const rules = await getRules();

  return (
    <main className="mx-auto max-w-[210mm] p-4 text-ink print:max-w-none print:p-0">
      <style>{`@page { size: A4; margin: 10mm; } @media print { body { background: #fff !important; } .sheet { break-after: page; page-break-after: always; } .sheet:last-child { break-after: auto; page-break-after: auto; } }`}</style>
      <PrintButton count={orders.length} />
      {orders.length === 0 && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm">No orders to print. Open this page from the Orders screen.</p>}

      {orders.map((o) => {
        const advance = o.payment.method === "cod" && o.payment.advance?.status === "paid" ? o.payment.advance.amount : 0;
        const collect = o.payment.method === "cod" ? Math.max(0, o.total - (o.walletUsed ?? 0) - advance) : 0;
        const units = o.items.reduce((n, i) => n + i.quantity, 0);
        const a = o.address;
        return (
          <section key={o.id} className="sheet mb-8 space-y-6 rounded-2xl border border-line bg-white p-4 sm:p-6 print:mb-0 print:rounded-none print:border-0 print:p-0" aria-label={`Order ${o.orderNumber}`}>
            {/* ---------------- packing slip ---------------- */}
            <div>
              <div className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
                <div><p className="font-serif text-2xl font-semibold">{brandName}</p><p className="text-xs uppercase tracking-widest">Packing slip</p></div>
                <div className="text-right text-sm"><p className="font-mono text-base font-bold">{o.orderNumber}</p><p>Ordered {dt(o.createdAt)}</p>{o.expectedBy && <p>Promise: by {dt(o.expectedBy)}</p>}</div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
                <div className="text-sm"><p className="text-xs font-semibold uppercase tracking-wider">Ship to</p><p className="mt-1 text-base font-bold">{a.name}</p><p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p><p>{a.city}, {a.state} — <strong>{a.pincode}</strong></p><p>Phone: {a.phone}</p></div>
                <div className={`rounded-xl border-2 px-5 py-3 text-center ${o.payment.method === "cod" ? "border-ink" : "border-line"}`}>
                  {o.payment.method === "cod" ? <><p className="text-xs font-bold uppercase tracking-wider">Cash on delivery</p><p className="font-serif text-3xl font-bold">{formatPrice(collect)}</p><p className="text-[11px]">{advance > 0 ? `₹${advance} advance already paid` : "collect from customer"}</p></> : <><p className="text-xs font-bold uppercase tracking-wider">Prepaid</p><p className="font-serif text-2xl font-bold">Do not collect</p><p className="text-[11px]">{o.payment.method === "wallet" ? "paid with store credit" : "paid online"}</p></>}
                </div>
              </div>

              <div className="mt-5 overflow-x-auto print:overflow-visible"><table className="w-full min-w-[26rem] text-sm">
                <thead><tr className="border-b border-ink text-left text-xs uppercase tracking-wider"><th className="w-8 py-2">✓</th><th className="py-2">Item</th><th className="py-2">Size</th><th className="py-2">Colour</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th></tr></thead>
                <tbody>
                  {o.items.map((i, k) => (
                    <tr key={k} className="border-b border-line"><td className="py-2.5"><span className="inline-block h-4 w-4 border-2 border-ink" /></td><td className="py-2.5 font-semibold">{i.name}</td><td className="py-2.5">{i.size ?? "—"}</td><td className="py-2.5">{i.color ?? "—"}</td><td className="py-2.5 text-right font-bold">{i.quantity}</td><td className="py-2.5 text-right">{formatPrice(i.price * i.quantity)}</td></tr>
                  ))}
                </tbody>
              </table></div>
              <dl className="ml-auto mt-3 w-60 space-y-1 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
                <div className="flex justify-between"><dt>Delivery</dt><dd>{o.shipping ? formatPrice(o.shipping) : "Free"}</dd></div>
                {(o.walletUsed ?? 0) > 0 && <div className="flex justify-between"><dt>Wallet credit</dt><dd>−{formatPrice(o.walletUsed!)}</dd></div>}
                <div className="flex justify-between border-t border-ink pt-1 text-base font-bold"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
              </dl>
              <p className="mt-4 text-xs">Packed by: ________ &nbsp; Checked by: ________ &nbsp; Gift wrap / note: ____________________</p>
              {rules.returns.enabled && <p className="mt-2 text-[11px]">Thank you for shopping with {brandName}! Exchange/return within {Math.max(rules.returns.returnDays, rules.returns.exchangeDays)} days of delivery — request it from your order page.</p>}
            </div>

            <p className="border-t-2 border-dashed border-slate-400 pt-1 text-center text-[11px] text-slate-500" aria-hidden>✂ cut here — stick the label below on the parcel</p>

            {/* ---------------- shipping label ---------------- */}
            <div className="mx-auto w-full max-w-[150mm] border-2 border-ink p-4">
              <div className="flex items-start justify-between gap-3 border-b border-ink pb-2">
                <div><p className="text-[11px] font-bold uppercase tracking-widest">To</p><p className="text-xl font-bold leading-tight">{a.name}</p></div>
                <div className="text-right text-xs"><p className="font-mono text-sm font-bold">{o.orderNumber}</p>{o.tracking?.number && <p>AWB <strong>{o.tracking.number}</strong></p>}{o.tracking?.carrier && <p>{o.tracking.carrier}</p>}</div>
              </div>
              <p className="mt-2 text-base leading-snug">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state}</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-widest">{a.pincode}</p>
              <p className="text-sm">Phone: <strong>{a.phone}</strong></p>
              <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-ink pt-2 text-xs">
                <div><p className="text-[11px] font-bold uppercase tracking-widest">From</p><p className="font-semibold">{brandName}</p>{storeAddress && <p>{storeAddress}</p>}{storePhone && <p>Phone: {storePhone}</p>}</div>
                <div className="text-right"><p className={`border-2 px-3 py-1 text-sm font-bold ${collect > 0 ? "border-ink" : "border-line"}`}>{collect > 0 ? `COD ${formatPrice(collect)}` : "PREPAID"}</p><p className="mt-1">{units} pc · ~{(rules.shipment.weightKg * units).toFixed(1)} kg</p></div>
              </div>
            </div>
            {o.tracking?.labelUrl && <p className="text-center text-xs print:hidden">The courier’s own label (with its barcode) is here: <a href={o.tracking.labelUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">open Shiprocket label</a>. Use that one on the parcel if your courier needs to scan it.</p>}
          </section>
        );
      })}
    </main>
  );
}
