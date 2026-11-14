"use client";
import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { postJson } from "@/lib/api";
import type { StoreRules } from "@/lib/rules";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { AdminPageHeader } from "./shell";

const pins = (t: string) => t.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
const toLocal = (iso: string) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(+d)) return ""; const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-line bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-lg">{title}</h2>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
const Row = ({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 rounded-sm border border-line bg-surface p-4"><div><p className="text-sm font-semibold text-ink">{title}</p>{text && <p className="text-xs">{text}</p>}</div>{children}</div>
);

export function StoreRulesAdmin({ initial }: { initial: StoreRules }) {
  const [r, setR] = React.useState<StoreRules>(initial);
  const [codPins, setCodPins] = React.useState(initial.cod.blockedPincodes.join(", "));
  const [noPins, setNoPins] = React.useState(initial.blockedPincodes.join(", "));
  const [reasons, setReasons] = React.useState(initial.returns.reasons.join("\n"));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof StoreRules>(k: K, v: Partial<StoreRules[K]>) => setR((c) => ({ ...c, [k]: typeof c[k] === "object" && !Array.isArray(c[k]) ? { ...(c[k] as object), ...(v as object) } : (v as never) }));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const save = async () => {
    setBusy(true);
    try {
      const body: StoreRules = { ...r, cod: { ...r.cod, blockedPincodes: pins(codPins) }, blockedPincodes: pins(noPins), returns: { ...r.returns, reasons: reasons.split("\n").map((x) => x.trim()).filter(Boolean) } };
      const res = await postJson<{ rules: StoreRules }>("/api/admin/store-rules", body, "PUT");
      setR(res.rules);
      toast.success("Store rules saved", { description: "They are live on the website within a few seconds." });
    } catch (e) { toast.error("Could not save", { description: e instanceof Error ? e.message : "Please check the values." }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <AdminPageHeader title="Store rules" description="Delivery, payments, returns, size chart and sale countdown — change them here and the website follows." />

      <div className="space-y-6 pb-24">
        <Card title="Home page sections" hint="Switch a whole section off to hide it from the home page. Turn it back on any time. Remember to press Save.">
          <Row title="Best sellers" text="“Loved by many” product row"><Switch checked={r.homeSections.bestSellers} onChange={(v) => set("homeSections", { bestSellers: v })} label="Show Best sellers" /></Row>
          <Row title="Shop by budget, occasion & colour" text="The quick-filter chips section"><Switch checked={r.homeSections.shopBy} onChange={(v) => set("homeSections", { shopBy: v })} label="Show Shop by budget, occasion and colour" /></Row>
          <Row title="New arrivals" text="“Just landed” product row"><Switch checked={r.homeSections.newArrivals} onChange={(v) => set("homeSections", { newArrivals: v })} label="Show New arrivals" /></Row>
          <Row title="Shop the look" text="The lookbook section"><Switch checked={r.homeSections.lookbook} onChange={(v) => set("homeSections", { lookbook: v })} label="Show Shop the look" /></Row>
        </Card>

        <Card title="Delivery charges">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Free delivery above (₹)" hint="Orders at or above this amount ship free. 0 = always free."><Input inputMode="numeric" value={r.shipping.freeAbove} onChange={(e) => set("shipping", { freeAbove: num(e.target.value) })} /></Field>
            <Field label="Delivery fee below that (₹)"><Input inputMode="numeric" value={r.shipping.fee} onChange={(e) => set("shipping", { fee: num(e.target.value) })} /></Field>
          </div>
        </Card>

        <Card title="Cash on delivery & fake-order protection" hint="Asking for a small advance online makes fake COD orders and returned parcels (RTO) much rarer.">
          <Row title="Allow Cash on Delivery"><Switch checked={r.cod.enabled} onChange={(v) => set("cod", { enabled: v })} label="Allow Cash on Delivery" /></Row>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="COD allowed up to (₹)"><Input inputMode="numeric" value={r.cod.max} onChange={(e) => set("cod", { max: num(e.target.value) })} /></Field>
            <Field label="Advance to pay online for COD (₹)" hint="0 = no advance. Try ₹100–200. The rest is paid on delivery. Refunded if the order is cancelled before shipping."><Input inputMode="numeric" value={r.cod.advance} onChange={(e) => set("cod", { advance: num(e.target.value) })} /></Field>
          </div>
          <Field label="No COD for these pincodes" hint="Separate with commas or new lines. A full pincode (411001) or just the first digits (4110) to block a whole area."><Textarea className="min-h-20" value={codPins} onChange={(e) => setCodPins(e.target.value)} placeholder="e.g. 794101, 7960, 193" /></Field>
          <Field label="No delivery at all to these pincodes" hint="Customers see “we do not deliver here yet”. Leave empty to deliver everywhere."><Textarea className="min-h-16" value={noPins} onChange={(e) => setNoPins(e.target.value)} /></Field>
        </Card>

        <Card title="Checkout">
          <Row title="Guest checkout" text="Customers can order without creating an account. They track the order with order number + phone."><Switch checked={r.guestCheckout} onChange={(v) => setR((c) => ({ ...c, guestCheckout: v }))} label="Guest checkout" /></Row>
        </Card>

        <Card title="Returns & exchange" hint="You can also switch returns / exchanges off for individual products (Clothing → edit product).">
          <Row title="Returns & exchanges are open"><Switch checked={r.returns.enabled} onChange={(v) => set("returns", { enabled: v })} label="Returns enabled" /></Row>
          <div className="grid gap-3 sm:grid-cols-2">
            <Row title="Allow returns (refund)"><Switch checked={r.returns.allowReturn} onChange={(v) => set("returns", { allowReturn: v })} label="Allow returns" /></Row>
            <Row title="Allow exchange"><Switch checked={r.returns.allowExchange} onChange={(v) => set("returns", { allowExchange: v })} label="Allow exchange" /></Row>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Return window (days after delivery)"><Input inputMode="numeric" value={r.returns.returnDays} onChange={(e) => set("returns", { returnDays: num(e.target.value) })} /></Field>
            <Field label="Exchange window (days after delivery)"><Input inputMode="numeric" value={r.returns.exchangeDays} onChange={(e) => set("returns", { exchangeDays: num(e.target.value) })} /></Field>
          </div>
          <Field label="Reasons customers can choose (one per line)"><Textarea className="min-h-32" value={reasons} onChange={(e) => setReasons(e.target.value)} /></Field>
          <Field label="Note shown to customers"><Input value={r.returns.note} onChange={(e) => set("returns", { note: e.target.value })} /></Field>
        </Card>

        <Card title="Size recommender" hint="Customers enter height and weight and the site suggests a size. Edit the chart to match your own sizes.">
          <Row title="Show “Find my size” on product pages"><Switch checked={r.sizeAdvisor.enabled} onChange={(v) => set("sizeAdvisor", { enabled: v })} label="Size recommender" /></Row>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead><tr className="text-left text-xs"><th className="pb-2 pr-2">Size</th><th className="pb-2 pr-2">Height min (cm)</th><th className="pb-2 pr-2">Height max</th><th className="pb-2 pr-2">Weight min (kg)</th><th className="pb-2 pr-2">Weight max</th><th /></tr></thead>
              <tbody>
                {r.sizeAdvisor.rows.map((row, i) => {
                  const upd = (p: Partial<typeof row>) => set("sizeAdvisor", { rows: r.sizeAdvisor.rows.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                  return (
                    <tr key={i}>
                      <td className="pr-2 pb-2"><Input aria-label={`Size name ${i + 1}`} value={row.size} onChange={(e) => upd({ size: e.target.value })} /></td>
                      {(["minHeight", "maxHeight", "minWeight", "maxWeight"] as const).map((k) => <td key={k} className="pr-2 pb-2"><Input aria-label={`${row.size} ${k}`} inputMode="numeric" value={row[k]} onChange={(e) => upd({ [k]: num(e.target.value) })} /></td>)}
                      <td className="pb-2"><Button type="button" variant="ghost" size="icon" aria-label={`Remove size ${row.size}`} onClick={() => set("sizeAdvisor", { rows: r.sizeAdvisor.rows.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="soft" size="sm" onClick={() => set("sizeAdvisor", { rows: [...r.sizeAdvisor.rows, { size: "", minHeight: 150, maxHeight: 165, minWeight: 50, maxWeight: 65 }] })}><Plus className="h-4 w-4" /> Add size</Button>
        </Card>

        <Card title="Festival / sale countdown" hint="Shows a countdown strip at the top of the website and inside the home-page deal banner until the end time.">
          <Row title="Show the countdown"><Switch checked={r.saleTimer.active} onChange={(v) => set("saleTimer", { active: v })} label="Show countdown" /></Row>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Heading"><Input value={r.saleTimer.title} onChange={(e) => set("saleTimer", { title: e.target.value })} placeholder="Diwali sale ends in" /></Field>
            <Field label="Ends on"><Input type="datetime-local" value={toLocal(r.saleTimer.endsAt)} onChange={(e) => set("saleTimer", { endsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })} /></Field>
            <Field label="Small text under it" className="sm:col-span-2"><Input value={r.saleTimer.subtitle} onChange={(e) => set("saleTimer", { subtitle: e.target.value })} /></Field>
            <Field label="Button text"><Input value={r.saleTimer.cta} onChange={(e) => set("saleTimer", { cta: e.target.value })} /></Field>
            <Field label="Button goes to"><Input value={r.saleTimer.href} onChange={(e) => set("saleTimer", { href: e.target.value })} placeholder="/shop?sort=discount" /></Field>
          </div>
        </Card>

        <Card title="Delivery time promise" hint="Customers see an exact date at checkout and on the product page, e.g. “Get it by Fri, 24 Oct”. Working days skip Sundays when that is switched on.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Packing time (working days)" hint="0 = ships the same day if ordered before the cut-off"><Input inputMode="numeric" value={r.delivery.handlingDays} onChange={(e) => set("delivery", { handlingDays: num(e.target.value) })} /></Field>
            <Field label="Order cut-off hour (24h, IST)" hint="Orders after this hour count from the next working day. e.g. 16 = 4 PM"><Input inputMode="numeric" value={r.delivery.cutoffHour} onChange={(e) => set("delivery", { cutoffHour: num(e.target.value) })} /></Field>
            <Field label="Delivery takes at least (working days)"><Input inputMode="numeric" value={r.delivery.transitMin} onChange={(e) => set("delivery", { transitMin: num(e.target.value) })} /></Field>
            <Field label="…and at most (working days)"><Input inputMode="numeric" value={r.delivery.transitMax} onChange={(e) => set("delivery", { transitMax: num(e.target.value) })} /></Field>
          </div>
          <Row title="No shipping or delivery on Sundays"><Switch checked={r.delivery.sundayOff} onChange={(v) => set("delivery", { sundayOff: v })} label="Sunday off" /></Row>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Faster or slower areas (optional)</p>
            <p className="mb-2 text-xs">Start of the pincode, e.g. <code className="rounded bg-surface px-1">11</code> for Delhi, with its own delivery days.</p>
            {r.delivery.overrides.map((o, i) => {
              const upd = (p: Partial<typeof o>) => set("delivery", { overrides: r.delivery.overrides.map((x, j) => (j === i ? { ...x, ...p } : x)) });
              return (
                <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <Input aria-label={`Pincode starts with ${i + 1}`} placeholder="Pincode starts with" value={o.prefix} onChange={(e) => upd({ prefix: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
                  <Input aria-label={`Min days ${i + 1}`} placeholder="Min days" inputMode="numeric" value={o.min} onChange={(e) => upd({ min: num(e.target.value) })} />
                  <Input aria-label={`Max days ${i + 1}`} placeholder="Max days" inputMode="numeric" value={o.max} onChange={(e) => upd({ max: num(e.target.value) })} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove area ${i + 1}`} onClick={() => set("delivery", { overrides: r.delivery.overrides.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <Button type="button" variant="soft" size="sm" onClick={() => set("delivery", { overrides: [...r.delivery.overrides, { prefix: "", min: 2, max: 4 }] })}><Plus className="h-4 w-4" /> Add area</Button>
          </div>
        </Card>

        <Card title="Store wallet (credit)" hint="Refunds can go to the customer's wallet instantly; they use it on their next order. Customers can still choose a refund to their bank / original payment.">
          <Row title="Wallet is available"><Switch checked={r.wallet.enabled} onChange={(v) => set("wallet", { enabled: v })} label="Wallet enabled" /></Row>
          <Field label="Bonus when a refund goes to the wallet (%)" hint="e.g. 5 = a ₹1,000 refund becomes ₹1,050 of credit. 0 = no bonus. This encourages customers to pick wallet and come back."><Input inputMode="numeric" value={r.wallet.bonusPercent} onChange={(e) => set("wallet", { bonusPercent: num(e.target.value) })} /></Field>
        </Card>

        <Card title="Parcel size (for Shiprocket)" hint="Default package used when you create a shipment. Weight is per piece of clothing.">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Weight / piece (kg)"><Input inputMode="decimal" value={r.shipment.weightKg} onChange={(e) => set("shipment", { weightKg: num(e.target.value) })} /></Field>
            <Field label="Length (cm)"><Input inputMode="decimal" value={r.shipment.lengthCm} onChange={(e) => set("shipment", { lengthCm: num(e.target.value) })} /></Field>
            <Field label="Breadth (cm)"><Input inputMode="decimal" value={r.shipment.breadthCm} onChange={(e) => set("shipment", { breadthCm: num(e.target.value) })} /></Field>
            <Field label="Height (cm)"><Input inputMode="decimal" value={r.shipment.heightCm} onChange={(e) => set("shipment", { heightCm: num(e.target.value) })} /></Field>
          </div>
        </Card>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-card/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-sm sm:border">
        <Button onClick={save} disabled={busy} className="w-full sm:w-auto">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}</Button>
      </div>
    </>
  );
}