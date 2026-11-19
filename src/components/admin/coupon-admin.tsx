"use client";
import * as React from "react";
import { Check, Copy, EyeOff, ImageOff, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AdminCoupon, CouponAudience, CouponScope, CouponType, PayWith, PickCollection, PickCustomer } from "@/lib/coupon-types";
import type { PickProduct } from "@/lib/collection-types";
import { postJson } from "@/lib/api";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { AdminPageHeader } from "./shell";

type Draft = {
  code: string; title: string; description: string; type: CouponType; value: number; maxDiscount: number; minOrder: number;
  startsAt: string | null; endsAt: string | null; usageLimit: number; perCustomer: number; firstOrderOnly: boolean;
  scope: CouponScope; products: string[]; collections: string[]; excludeSale: boolean; payWith: PayWith; audience: CouponAudience; customers: string[]; active: boolean; visible: boolean;
};

const TYPES: { v: CouponType; label: string }[] = [
  { v: "percent", label: "Percent off (e.g. 10% off)" },
  { v: "flat", label: "Flat amount off (e.g. ₹200 off)" },
  { v: "shipping", label: "Free delivery" },
];

/** ISO → the "2026-11-20T18:30" text a datetime-local box wants (in the owner's own time zone). */
const toLocal = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const summary = (c: Pick<AdminCoupon, "type" | "value" | "maxDiscount" | "minOrder">) => {
  const what = c.type === "percent" ? `${c.value}% off${c.maxDiscount > 0 ? ` (up to ${formatPrice(c.maxDiscount)})` : ""}` : c.type === "flat" ? `${formatPrice(c.value)} off` : "Free delivery";
  return c.minOrder > 0 ? `${what} · on orders above ${formatPrice(c.minOrder)}` : what;
};

type State = { label: string; style: string };
const stateOf = (c: AdminCoupon): State => {
  const now = Date.now();
  if (!c.active) return { label: "Off", style: "bg-slate-100 text-slate-600" };
  if (c.endsAt && +new Date(c.endsAt) < now) return { label: "Expired", style: "bg-red-50 text-red-700" };
  if (c.startsAt && +new Date(c.startsAt) > now) return { label: "Scheduled", style: "bg-sky-50 text-sky-700" };
  if (c.usageLimit > 0 && c.used >= c.usageLimit) return { label: "Used up", style: "bg-amber-50 text-amber-700" };
  return { label: "Live", style: "bg-emerald-50 text-emerald-700" };
};

const dateText = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function CouponForm({ item, products, collections, customers, onSave, onCancel }: { item: AdminCoupon | null; products: PickProduct[]; collections: PickCollection[]; customers: PickCustomer[]; onSave: (d: Draft) => Promise<boolean>; onCancel: () => void }) {
  const [code, setCode] = React.useState(item?.code ?? "");
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [type, setType] = React.useState<CouponType>(item?.type ?? "percent");
  const [value, setValue] = React.useState(String(item?.value ?? 10));
  const [maxDiscount, setMaxDiscount] = React.useState(String(item?.maxDiscount || ""));
  const [minOrder, setMinOrder] = React.useState(String(item?.minOrder || ""));
  const [startsAt, setStartsAt] = React.useState(toLocal(item?.startsAt));
  const [endsAt, setEndsAt] = React.useState(toLocal(item?.endsAt));
  const [usageLimit, setUsageLimit] = React.useState(String(item?.usageLimit || ""));
  const [perCustomer, setPerCustomer] = React.useState(String(item?.perCustomer || ""));
  const [firstOrderOnly, setFirstOrderOnly] = React.useState(item?.firstOrderOnly ?? false);
  const [scope, setScope] = React.useState<CouponScope>(item?.scope ?? "all");
  const [pickedProducts, setPickedProducts] = React.useState<string[]>(item?.products ?? []);
  const [pickedCollections, setPickedCollections] = React.useState<string[]>(item?.collections ?? []);
  const [excludeSale, setExcludeSale] = React.useState(item?.excludeSale ?? false);
  const [payWith, setPayWith] = React.useState<PayWith>(item?.payWith ?? "any");
  const [audience, setAudience] = React.useState<CouponAudience>(item?.audience ?? "everyone");
  const [pickedCustomers, setPickedCustomers] = React.useState<string[]>(item?.customers ?? []);
  const [cq, setCq] = React.useState("");
  const [active, setActive] = React.useState(item?.active ?? true);
  const [visible, setVisible] = React.useState(item?.visible ?? true);
  const [q, setQ] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const shown = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)) : products;
  }, [products, q]);
  const shownCustomers = React.useMemo(() => {
    const s = cq.trim().toLowerCase();
    return s ? customers.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(s)) : customers;
  }, [customers, cq]);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const ok = await onSave({
      code: code.trim().toUpperCase(), title: title.trim(), description: description.trim(), type,
      value: type === "shipping" ? 0 : Number(value) || 0, maxDiscount: type === "percent" ? Number(maxDiscount) || 0 : 0, minOrder: Number(minOrder) || 0,
      startsAt: toIso(startsAt), endsAt: toIso(endsAt), usageLimit: Number(usageLimit) || 0, perCustomer: Number(perCustomer) || 0, firstOrderOnly,
      scope, products: scope === "products" ? pickedProducts : [], collections: scope === "collections" ? pickedCollections : [],
      excludeSale, payWith, audience, customers: audience === "selected" ? pickedCustomers : [], active, visible,
    });
    setBusy(false);
    if (!ok) setError("Please check the highlighted details and try again.");
  };

  const section = "space-y-4 rounded-sm border border-line p-4";
  const heading = "text-sm font-semibold text-ink";

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className={section}>
        <p className={heading}>1. The coupon</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coupon code" hint={item ? "The code cannot be changed after it is made." : "What the customer types, e.g. FESTIVE10. Letters and numbers only."}>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={20} placeholder="FESTIVE10" disabled={!!item} className="font-mono uppercase" />
          </Field>
          <Field label="Name shown to customers" hint="Optional. e.g. Festive 10% off"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Festive 10% off" /></Field>
        </div>
        <Field label="Small print (optional)" hint="Shown under the offer, e.g. On orders above ₹1499. Valid till Diwali."><Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} /></Field>
      </div>

      <div className={section}>
        <p className={heading}>2. What the customer gets</p>
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as CouponType)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select></Field>
        {type !== "shipping" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={type === "percent" ? "Percent off (%)" : "Rupees off (₹)"}><Input type="number" inputMode="numeric" min={1} max={type === "percent" ? 100 : undefined} value={value} onChange={(e) => setValue(e.target.value)} /></Field>
            {type === "percent" && <Field label="Maximum discount (₹)" hint="Optional. Stops a big order getting a huge discount. Empty = no limit."><Input type="number" inputMode="numeric" min={0} value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="e.g. 300" /></Field>}
          </div>
        )}
        <Field label="Minimum order value (₹)" hint="Optional. The coupon works only when the items in the bag add up to at least this. Empty = any amount."><Input type="number" inputMode="numeric" min={0} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="e.g. 999" /></Field>
        <Field label="Payment way" hint="Give the discount only when the customer pays this way. e.g. “Online payment only” to push UPI and reduce COD."><Select value={payWith} onChange={(e) => setPayWith(e.target.value as PayWith)}>
          <option value="any">Any payment way</option>
          <option value="online">Only online payment (UPI / card)</option>
          <option value="cod">Only Cash on Delivery</option>
        </Select></Field>
      </div>

      <div className={section}>
        <p className={heading}>3. Which products</p>
        <Field label="Works on"><Select value={scope} onChange={(e) => setScope(e.target.value as CouponScope)}>
          <option value="all">All products</option>
          <option value="collections">Only chosen collections</option>
          <option value="products">Only chosen products</option>
        </Select></Field>
        {scope === "collections" && (
          collections.length === 0 ? <p className="text-sm">You have no collections yet. Make one in Collections first.</p> : (
            <ul className="flex flex-wrap gap-2">
              {collections.map((c) => {
                const on = pickedCollections.includes(c.id);
                return <li key={c.id}><button type="button" aria-pressed={on} onClick={() => toggle(pickedCollections, setPickedCollections, c.id)} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition", on ? "border-primary bg-primary text-white" : "border-line text-ink hover:border-primary")}>{on && <Check className="h-4 w-4" />}{c.name}</button></li>;
              })}
            </ul>
          )
        )}
        {scope === "products" && (
          <div>
            <p className="mb-2 text-xs"><strong className="text-ink">{pickedProducts.length}</strong> selected</p>
            <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><Input aria-label="Search products" className="pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto rounded-sm border border-line p-2 sm:grid-cols-4">
              {shown.length === 0 && <p className="col-span-full p-6 text-center text-sm">No products match.</p>}
              {shown.map((p) => {
                const on = pickedProducts.includes(p.id);
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(pickedProducts, setPickedProducts, p.id)} className={cn("relative overflow-hidden rounded-sm border-2 bg-card text-left transition", on ? "border-primary" : "border-line hover:border-primary/50")}>
                    <div className="flex aspect-[3/4] items-center justify-center bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageOff className="h-5 w-5" />}
                    </div>
                    <div className="p-2"><p className="line-clamp-1 text-xs font-semibold text-ink">{p.name}</p><p className="text-xs">{formatPrice(p.price)}</p></div>
                    {on && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white"><Check className="h-4 w-4" /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={section}>
        <p className={heading}>Items already on sale</p>
        <div className="flex items-center justify-between gap-4 rounded-sm bg-surface p-3">
          <div><p className="text-sm font-semibold text-ink">Not on flash-sale items</p><p className="text-xs">On: products with a running flash sale get no coupon discount, so there is no double discount.</p></div>
          <Switch checked={excludeSale} onChange={setExcludeSale} label="Not on flash-sale items" />
        </div>
      </div>

      <div className={section}>
        <p className={heading}>4. When and how many times</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (optional)" hint="Empty = starts right now."><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
          <Field label="Ends (optional)" hint="Empty = never ends. It switches off by itself."><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
          <Field label="Total uses allowed" hint="Empty = unlimited. e.g. 100 = first 100 orders."><Input type="number" inputMode="numeric" min={0} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" /></Field>
          <Field label="Uses per customer" hint="Empty = unlimited. e.g. 1 = once per customer. The same phone number or delivery address is counted too, so a second account cannot reuse it."><Input type="number" inputMode="numeric" min={0} value={perCustomer} onChange={(e) => setPerCustomer(e.target.value)} placeholder="Unlimited" /></Field>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-sm bg-surface p-3">
          <div><p className="text-sm font-semibold text-ink">New customers only</p><p className="text-xs">Works only on a customer&apos;s first order.</p></div>
          <Switch checked={firstOrderOnly} onChange={setFirstOrderOnly} label="First order only" />
        </div>
      </div>

      <div className={section}>
        <p className={heading}>Who can use it</p>
        <Field label="Customers"><Select value={audience} onChange={(e) => setAudience(e.target.value as CouponAudience)}>
          <option value="everyone">Everyone</option>
          <option value="selected">Only chosen customers (VIP, old customers…)</option>
        </Select></Field>
        {audience === "selected" && (
          <div>
            <p className="mb-2 text-xs"><strong className="text-ink">{pickedCustomers.length}</strong> selected. Only they can see and use this coupon.</p>
            <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><Input aria-label="Search customers" className="pl-9" placeholder="Search by name, email or phone…" value={cq} onChange={(e) => setCq(e.target.value)} /></div>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-sm border border-line">
              {shownCustomers.length === 0 && <li className="p-6 text-center text-sm">No customers match.</li>}
              {shownCustomers.map((c) => {
                const on = pickedCustomers.includes(c.id);
                return (
                  <li key={c.id}>
                    <button type="button" aria-pressed={on} onClick={() => toggle(pickedCustomers, setPickedCustomers, c.id)} className={cn("flex w-full items-center gap-3 p-3 text-left transition", on ? "bg-primary-faint" : "hover:bg-surface")}>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border-2", on ? "border-primary bg-primary text-white" : "border-line")}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{c.name || "Customer"}</span><span className="block truncate text-xs">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className={section}>
        <p className={heading}>5. Show or hide</p>
        <div className="flex items-center justify-between gap-4 rounded-sm bg-surface p-3">
          <div><p className="text-sm font-semibold text-ink">Coupon is on</p><p className="text-xs">Switch off to stop it working, without deleting it.</p></div>
          <Switch checked={active} onChange={setActive} label="Coupon is on" />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-sm bg-surface p-3">
          <div><p className="text-sm font-semibold text-ink">Show in the bag and checkout</p><p className="text-xs">On: listed under “Available offers”. Off: a private code, only people you give it to can use it.</p></div>
          <Switch checked={visible} onChange={setVisible} label="Show in the bag and checkout" />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Make coupon"}</Button>
      </div>
    </form>
  );
}

export function CouponAdmin({ initial, products, collections, customers }: { initial: AdminCoupon[]; products: PickProduct[]; collections: PickCollection[]; customers: PickCustomer[] }) {
  const [items, setItems] = React.useState(initial);
  React.useEffect(() => setItems(initial), [initial]);
  const [editing, setEditing] = React.useState<AdminCoupon | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<AdminCoupon | null>(null);

  const save = async (d: Draft): Promise<boolean> => {
    try {
      if (editing === "new") {
        const { id } = await postJson<{ id: string }>("/api/admin/coupons", d);
        setItems((cur) => [{ ...d, startsAt: d.startsAt ?? undefined, endsAt: d.endsAt ?? undefined, id, used: 0, saved: 0, createdAt: new Date().toISOString() }, ...cur]);
      } else if (editing) {
        const id = editing.id;
        await postJson(`/api/admin/coupons/${id}`, d, "PUT");
        setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...d, code: x.code, startsAt: d.startsAt ?? undefined, endsAt: d.endsAt ?? undefined } : x)));
      }
      toast.success(editing === "new" ? "Coupon made" : "Changes saved", { description: "Customers see it right away." });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save the coupon", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    }
  };

  const flip = async (c: AdminCoupon, key: "active" | "visible", v: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, [key]: v } : x)));
    try {
      await postJson(`/api/admin/coupons/${c.id}`, { [key]: v }, "PUT");
      toast.success(key === "active" ? (v ? "Coupon is on" : "Coupon is off") : v ? "Now shown to customers" : "Now a private code");
    } catch (e) {
      setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, [key]: !v } : x)));
      toast.error("Could not update", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/coupons/${deleting.id}`, {}, "DELETE");
      setItems((c) => c.filter((x) => x.id !== deleting.id));
      toast.success("Coupon deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const colName = React.useMemo(() => new Map(collections.map((c) => [c.id, c.name])), [collections]);

  return (
    <>
      <AdminPageHeader
        title="Coupons"
        description="Make discount codes. Customers see them under “Available offers” in the bag and at checkout, or type a private code."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Make coupon</Button>}
      />
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><Tag className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No coupons yet</h2>
          <p className="mt-1 max-w-sm text-sm">Make your first coupon, for example 10% off above ₹999, or free delivery for new customers.</p>
          <Button className="mt-5" onClick={() => setEditing("new")}>Make coupon</Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {items.map((c) => {
            const st = stateOf(c);
            const scopeText = c.scope === "all" ? "All products" : c.scope === "collections" ? `Collections: ${c.collections.map((id) => colName.get(id) ?? "?").join(", ")}` : `${c.products.length} chosen product${c.products.length === 1 ? "" : "s"}`;
            return (
              <li key={c.id} className={cn("rounded-sm border border-line bg-card p-4 shadow-card", st.label === "Off" && "opacity-75")}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-dashed border-primary/60 bg-primary-faint px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-primary">{c.code}</span>
                      <button type="button" aria-label={`Copy code ${c.code}`} onClick={() => { void navigator.clipboard?.writeText(c.code); toast.success("Code copied"); }} className="rounded-md p-1.5 text-body hover:bg-surface"><Copy className="h-4 w-4" /></button>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.style)}>{st.label}</span>
                      {!c.visible && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><EyeOff className="h-3.5 w-3.5" />Private code</span>}
                    </div>
                    <p className="mt-2 font-semibold text-ink">{c.title || summary(c)}</p>
                    {c.title && <p className="text-sm">{summary(c)}</p>}
                    <p className="mt-1 text-xs">
                      {scopeText}
                      {c.firstOrderOnly && " · New customers only"}
                      {c.audience === "selected" && ` · Only ${c.customers.length} chosen customer${c.customers.length === 1 ? "" : "s"}`}
                      {c.payWith === "online" && " · Online payment only"}
                      {c.payWith === "cod" && " · Cash on Delivery only"}
                      {c.excludeSale && " · Not on sale items"}
                      {c.perCustomer > 0 && ` · ${c.perCustomer} per customer`}
                      {c.startsAt && ` · From ${dateText(c.startsAt)}`}
                      {c.endsAt && ` · Until ${dateText(c.endsAt)}`}
                    </p>
                    <p className="mt-1 text-xs font-medium text-ink">
                      Used {c.used}{c.usageLimit > 0 ? ` of ${c.usageLimit}` : ""} time{c.used === 1 ? "" : "s"}
                      {c.saved > 0 && ` · ${formatPrice(c.saved)} given as discount`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-ink"><Switch checked={c.active} onChange={(v) => flip(c, "active", v)} label={`Turn ${c.code} ${c.active ? "off" : "on"}`} />{c.active ? "On" : "Off"}</label>
                    <label className="flex items-center gap-2 text-sm font-medium text-ink"><Switch checked={c.visible} onChange={(v) => flip(c, "visible", v)} label={`${c.visible ? "Hide" : "Show"} ${c.code} in the bag`} />Show in bag</label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.code}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="dangerSoft" size="icon" aria-label={`Delete ${c.code}`} onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Make a coupon" : "Edit coupon"} wide>
        {editing !== null && <CouponForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} products={products} collections={collections} customers={customers} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete this coupon?"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" onClick={remove}>Delete coupon</Button></>}>
        <p className="text-sm">“{deleting?.code}” stops working right away. Orders that already used it are not changed. To pause it instead, switch it off.</p>
      </Dialog>
    </>
  );
}