"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { Product, ProductType } from "@/lib/types";
import { uploadImages, uploadVideo } from "@/lib/api";
import { discountPct } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { PhotoUpload } from "@/components/shared/photo-upload";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the product name"),
  category: z.string().trim().min(2, "Enter a collection / category"),
  price: z.string().regex(/^\d{1,8}$/, "Enter the selling price in rupees"),
  mrp: z.string().regex(/^(\d{1,8})?$/, "Numbers only").optional(),
  units: z.string().regex(/^(\d{1,3})?$/, "Numbers only").optional(),
  fabric: z.string().optional(),
  fit: z.string().optional(),
  occasion: z.string().optional(),
  washCare: z.string().optional(),
  highlights: z.string().optional(),
  description: z.string().trim().min(10, "Add a short description"),
});
type Values = z.infer<typeof schema>;

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"];
const BADGES = ["New", "Best Seller", "Trending", "Deal"];
const COLLECTIONS = ["Suit Sets", "Sarees", "Co-ord Sets", "Dresses", "Kurtis", "Lehengas"];
const ACCESSORY_CATEGORIES = ["Dupattas", "Jewellery", "Bags", "Footwear"];
const lines = (t?: string) => (t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

export function ProductForm({ type, product, categories = [], onSave, onCancel }: {
  type: ProductType;
  product: Product | null;
  categories?: string[];
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const clothing = type !== "accessory";
  const [featured, setFeatured] = React.useState(product?.featured ?? false);
  const [badges, setBadges] = React.useState<string[]>(product?.badges ?? []);
  const [sizes, setSizes] = React.useState<{ label: string; qty: string }[]>((product?.sizes ?? []).map((s) => ({ label: s.label, qty: String(s.qty) })));
  const [customSize, setCustomSize] = React.useState("");
  const [colors, setColors] = React.useState<{ name: string; hex: string; images: string[]; files: File[] }[]>((product?.colors ?? []).map((c) => ({ name: c.name, hex: c.hex ?? "#8c1d40", images: c.images ?? [], files: [] })));
  const [flashOn, setFlashOn] = React.useState(!!product?.flashRaw);
  const [flashPrice, setFlashPrice] = React.useState(product?.flashRaw ? String(product.flashRaw.price) : "");
  const [flashEnds, setFlashEnds] = React.useState(() => { const e = product?.flashRaw?.endsAt; if (!e) return ""; const d = new Date(e); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; });
  const [videoUrl, setVideoUrl] = React.useState(product?.videoUrl ?? "");
  const [videoBusy, setVideoBusy] = React.useState(false);
  const pickVideo = async (f?: File) => {
    if (!f) return;
    setVideoBusy(true);
    try { setVideoUrl(await uploadVideo(f)); toast.success("Video uploaded"); }
    catch (e) { toast.error("Video upload failed", { description: e instanceof Error ? e.message : "Please try again." }); }
    finally { setVideoBusy(false); }
  };
  const [returnable, setReturnable] = React.useState(product?.returnable !== false);
  const [exchangeable, setExchangeable] = React.useState(product?.exchangeable !== false);
  const [specs, setSpecs] = React.useState<{ k: string; v: string }[]>(product ? Object.entries(product.specs).map(([k, v]) => ({ k, v })) : []);
  const [existing, setExisting] = React.useState<string[]>(product?.images ?? []);
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);

  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? "",
      category: product?.category ?? "",
      price: product ? String(product.base?.price ?? product.price) : "",
      mrp: (() => { const m = product ? (product.base ? product.base.mrp : product.mrp) : undefined; return m ? String(m) : ""; })(),
      units: String(product ? product.quantity ?? 0 : 5),
      fabric: product?.fabric ?? "", fit: product?.fit ?? "", occasion: product?.occasion ?? "", washCare: product?.washCare ?? "",
      highlights: product?.highlights.join("\n") ?? "",
      description: product?.description ?? "",
    },
  });
  const price = Number(watch("price") || 0);
  const mrp = Number(watch("mrp") || 0);
  const off = discountPct(price, mrp);
  const totalUnits = sizes.reduce((n, s) => n + (Number(s.qty) || 0), 0);
  const cats = [...new Set([...categories, ...(clothing ? COLLECTIONS : ACCESSORY_CATEGORIES)])];

  const toggleSize = (label: string) => setSizes((cur) => (cur.some((s) => s.label === label) ? cur.filter((s) => s.label !== label) : [...cur, { label, qty: "5" }]));
  const addCustom = () => {
    const label = customSize.trim();
    if (label && !sizes.some((s) => s.label.toLowerCase() === label.toLowerCase())) setSizes((c) => [...c, { label, qty: "5" }]);
    setCustomSize("");
  };

  const submit = async (v: Values) => {
    if (clothing && sizes.length === 0 && !v.units) { setError("units", { message: "Add sizes with stock, or enter the units in stock" }); return; }
    if (flashOn && (!Number(flashPrice) || Number(flashPrice) >= Number(v.price))) { toast.error("The flash price must be lower than the normal price"); return; }
    if (flashOn && (!flashEnds || new Date(flashEnds).getTime() <= Date.now())) { toast.error("Choose a future end time for the flash sale"); return; }
    setBusy(true);
    try {
      let uploaded: string[] = [];
      if (files.length) {
        try { uploaded = await uploadImages(files); }
        catch (e) { toast.error("Image upload failed", { description: e instanceof Error ? e.message : "Please try again." }); return; }
      }
      // photos chosen for individual colours are uploaded together with the main ones
      const colorPayload: { name: string; hex: string; images: string[] }[] = [];
      for (const c of colors.filter((x) => x.name.trim())) {
        let more: string[] = [];
        if (c.files.length) {
          try { more = await uploadImages(c.files); }
          catch (e) { toast.error(`Photo upload failed for ${c.name}`, { description: e instanceof Error ? e.message : "Please try again." }); return; }
        }
        colorPayload.push({ name: c.name.trim(), hex: c.hex, images: [...c.images, ...more] });
      }
      await onSave({
        type, name: v.name, brand: "", category: v.category,
        price: Number(v.price), mrp: v.mrp ? Number(v.mrp) : undefined,
        condition: "New", units: clothing && sizes.length ? undefined : Number(v.units || 0), featured, tags: [], badges,
        sizes: clothing ? sizes.map((s) => ({ label: s.label, qty: Number(s.qty) || 0 })) : [],
        colors: colorPayload, videoUrl: videoUrl.trim(), returnable, exchangeable, flashPrice: flashOn ? Number(flashPrice) : undefined, flashEndsAt: flashOn ? new Date(flashEnds).toISOString() : undefined,
        fabric: v.fabric?.trim() ?? "", fit: v.fit?.trim() ?? "", occasion: v.occasion?.trim() ?? "", washCare: v.washCare?.trim() ?? "",
        specs: Object.fromEntries(specs.filter((s) => s.k.trim() && s.v.trim()).map((s) => [s.k.trim(), s.v.trim()])),
        highlights: lines(v.highlights).slice(0, 3), included: [], conditionNotes: [],
        description: v.description, warranty: "",
        images: [...existing, ...uploaded],
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message} className="sm:col-span-2"><Input aria-invalid={!!errors.name} placeholder={clothing ? "Maroon Anarkali Suit Set" : "Banarasi Dupatta"} {...register("name")} /></Field>
        <Field label={clothing ? "Collection" : "Category"} htmlFor="category-input" error={errors.category?.message} hint={clothing ? "Customers shop by this, e.g. Suit Sets, Sarees. Pick one or type a new one." : "e.g. Dupattas, Jewellery, Bags"}>
          <Input id="category-input" list="category-options" aria-invalid={!!errors.category} {...register("category")} />
          <datalist id="category-options">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Selling price (₹)" error={errors.price?.message}><Input inputMode="numeric" aria-invalid={!!errors.price} {...register("price")} /></Field>
        <Field label="Original price / MRP (₹)" error={errors.mrp?.message} hint={off > 0 ? `Shown struck through with ${off}% off` : "Shown struck through with a % off"}><Input inputMode="numeric" {...register("mrp")} /></Field>
        {!(clothing && sizes.length > 0) && (
          <Field label="Units in stock" error={errors.units?.message} hint="0 = sold out · 1–3 shows as low stock · reduces automatically when customers buy"><Input inputMode="numeric" {...register("units")} /></Field>
        )}
      </div>

      {clothing && (
        <div className="rounded-sm border border-line p-4">
          <p className="text-sm font-semibold text-ink">Sizes &amp; stock</p>
          <p className="mb-3 text-xs">Tap the sizes you stitch, then enter how many pieces you have in each. Customers must choose a size to order.</p>
          <div className="flex flex-wrap gap-2">
            {SIZE_PRESETS.map((s) => {
              const on = sizes.some((x) => x.label === s);
              return <button key={s} type="button" aria-pressed={on} onClick={() => toggleSize(s)} className={on ? "rounded-full border border-primary bg-primary px-3.5 py-1.5 text-sm font-semibold text-white" : "rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-ink hover:border-primary"}>{s}</button>;
            })}
            {sizes.filter((s) => !SIZE_PRESETS.includes(s.label)).map((s) => (
              <button key={s.label} type="button" aria-pressed onClick={() => toggleSize(s.label)} className="rounded-full border border-primary bg-primary px-3.5 py-1.5 text-sm font-semibold text-white">{s.label} ×</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input aria-label="Custom size" placeholder="Custom size, e.g. 38" value={customSize} onChange={(e) => setCustomSize(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} className="max-w-48" />
            <Button type="button" variant="soft" size="sm" onClick={addCustom}><Plus className="h-4 w-4" /> Add size</Button>
          </div>
          {sizes.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sizes.map((s, i) => (
                <label key={s.label} className="text-sm">
                  <span className="mb-1 block font-medium text-ink">{s.label} — pieces</span>
                  <Input inputMode="numeric" aria-label={`Stock for size ${s.label}`} value={s.qty} onChange={(e) => setSizes((cur) => cur.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/\D/g, "").slice(0, 4) } : x)))} />
                </label>
              ))}
              <p className="col-span-full text-xs">Total in stock: <strong className="text-ink">{totalUnits}</strong>{totalUnits > 0 && totalUnits <= 3 ? " (shows as low stock)" : ""}</p>
            </div>
          )}
        </div>
      )}

      <fieldset className="rounded-sm border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Colours</legend>
        <div className="space-y-2">
          {colors.map((c, i) => (
            <div key={i} className="space-y-2"><div className="flex items-center gap-2">
              <input type="color" aria-label="Colour swatch" value={c.hex} onChange={(e) => setColors((cur) => cur.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-card p-1" />
              <Input aria-label="Colour name" placeholder="Colour name, e.g. Maroon" value={c.name} onChange={(e) => setColors((cur) => cur.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove colour" onClick={() => setColors((cur) => cur.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
            <div className="ml-14 rounded-sm bg-surface p-3">
              <p className="mb-2 text-xs font-medium text-ink">Photos of this colour (optional) — shown when a customer picks {c.name || "this colour"}</p>
              {c.images.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">{c.images.map((url) => (
                  <li key={url} className="relative h-16 w-12 overflow-hidden rounded-lg border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button type="button" aria-label={`Remove ${c.name} photo`} onClick={() => setColors((cur) => cur.map((x, j) => (j === i ? { ...x, images: x.images.filter((u) => u !== url) } : x)))} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/75 text-white"><X className="h-3 w-3" /></button>
                  </li>))}</ul>
              )}
              {c.images.length + c.files.length < 8 && <PhotoUpload files={c.files} onChange={(f) => setColors((cur) => cur.map((x, j) => (j === i ? { ...x, files: f } : x)))} max={8 - c.images.length} />}
            </div></div>
          ))}
        </div>
        <Button type="button" variant="soft" size="sm" className="mt-3" onClick={() => setColors((c) => [...c, { name: "", hex: "#8c1d40", images: [], files: [] }])}><Plus className="h-4 w-4" /> Add colour</Button>
      </fieldset>

      {clothing && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fabric" hint="e.g. Pure cotton, Rayon, Georgette"><Input {...register("fabric")} /></Field>
          <Field label="Fit" hint="e.g. Regular, Relaxed, A-line"><Input {...register("fit")} /></Field>
          <Field label="Occasion" hint="Creates a “shop by occasion” page on the website — use the same spelling every time"><Input list="occasion-options" {...register("occasion")} /><datalist id="occasion-options">{["Festive", "Wedding", "Party", "Casual", "Daily wear", "Office", "Loungewear"].map((o) => <option key={o} value={o} />)}</datalist></Field>
          <Field label="Wash care" className="sm:col-span-3" hint="e.g. Hand wash cold. Do not bleach. Dry in shade."><Input {...register("washCare")} /></Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface p-4">
          <div><p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Star className="h-3.5 w-3.5 text-amber-500" /> Featured</p><p className="text-xs">Show under Best sellers on the home page.</p></div>
          <Switch checked={featured} onChange={setFeatured} label="Featured on home page" />
        </div>
        <fieldset className="rounded-sm border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Tags on the product card</legend>
          <div className="flex flex-wrap gap-x-5">
            {BADGES.map((b) => <Checkbox key={b} label={b} checked={badges.includes(b)} onChange={(c) => setBadges((cur) => (c ? [...cur, b] : cur.filter((x) => x !== b)))} />)}
          </div>
        </fieldset>
      </div>

      <fieldset className="rounded-sm border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">⚡ Flash sale (optional)</legend>
        <div className="flex items-center justify-between gap-3"><p className="text-xs">A special price for this product only, with its own countdown. When the timer ends, the normal price comes back by itself.</p><Switch checked={flashOn} onChange={setFlashOn} label="Flash sale" /></div>
        {flashOn && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Flash price (₹)" hint={watch("price") ? `Normal price ₹${watch("price")}` : undefined}><Input inputMode="numeric" value={flashPrice} onChange={(e) => setFlashPrice(e.target.value.replace(/\D/g, ""))} aria-label="Flash price" /></Field>
            <Field label="Ends on"><Input type="datetime-local" value={flashEnds} onChange={(e) => setFlashEnds(e.target.value)} aria-label="Flash sale ends" /></Field>
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface p-4"><div><p className="text-sm font-semibold text-ink">Allow return (refund)</p><p className="text-xs">Switch off for sale or custom pieces.</p></div><Switch checked={returnable} onChange={setReturnable} label="Allow return" /></div>
        <div className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface p-4"><div><p className="text-sm font-semibold text-ink">Allow exchange</p><p className="text-xs">Customers can swap for another size.</p></div><Switch checked={exchangeable} onChange={setExchangeable} label="Allow exchange" /></div>
      </div>
      <Field label="Product video (optional)" hint="Upload a short video (up to 50 MB) or paste a YouTube / .mp4 link. It appears as a play button in the photo gallery — great for fabric close-ups and 360° turns.">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="min-w-0 flex-1" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/shorts/…" />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-line px-3 text-sm font-semibold text-primary hover:bg-surface">
            {videoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Upload video
            <input type="file" accept="video/*" hidden disabled={videoBusy} onChange={(e) => { void pickVideo(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </Field>

      <Field label="Description" error={errors.description?.message}><Textarea className="min-h-24" aria-invalid={!!errors.description} {...register("description")} /></Field>
      <Field label="Highlights" hint="Up to 3 short lines (one per line), shown on the product page."><Textarea className="min-h-20" placeholder={"Soft pure-cotton fabric\nHand-block printed\nComes with dupatta"} {...register("highlights")} /></Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">More details (optional)</legend>
        <div className="space-y-2">
          {specs.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label="Detail name" placeholder="e.g. Length" value={s.k} className="w-2/5" onChange={(e) => setSpecs((cur) => cur.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
              <Input aria-label="Detail value" placeholder="e.g. 46 inches" value={s.v} onChange={(e) => setSpecs((cur) => cur.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove detail" onClick={() => setSpecs((cur) => cur.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="soft" size="sm" className="mt-3" onClick={() => setSpecs((c) => [...c, { k: "", v: "" }])}><Plus className="h-4 w-4" /> Add detail</Button>
      </fieldset>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Photos</p>
        {existing.length > 0 && (
          <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {existing.map((url, i) => (
              <li key={url} className="relative aspect-[3/4] overflow-hidden rounded-sm border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
                {i > 0 && (
                  <button type="button" onClick={() => setExisting((c) => [url, ...c.filter((x) => x !== url)])} className="absolute bottom-1 left-1 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-slate-900">Make cover</button>
                )}
                <button type="button" onClick={() => setExisting((c) => c.filter((x) => x !== url))} aria-label={`Remove photo ${i + 1}`} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/75 text-white hover:bg-slate-900"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {existing.length < 8 && <PhotoUpload files={files} onChange={setFiles} max={8 - existing.length} />}
        <p className="mt-2 text-xs">Use portrait (3:4) photos for the best look. Photos are resized automatically. The first is the cover and the second shows on hover. With no photos, a neutral illustration is shown.</p>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : product ? "Save changes" : `Add ${clothing ? "product" : "accessory"}`}</Button>
      </div>
    </form>
  );
}
