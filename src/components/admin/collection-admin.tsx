"use client";
import * as React from "react";
import { Check, ChevronDown, ChevronUp, ChevronsUp, ImageOff, LayoutGrid, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CollectionItem, PickProduct } from "@/lib/collection-types";
import { postJson, uploadImages } from "@/lib/api";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { AdminPageHeader } from "./shell";

type Draft = { name: string; description: string; image?: string; products: string[]; active: boolean };

function CollectionForm({ item, products, onSave, onCancel }: { item: CollectionItem | null; products: PickProduct[]; onSave: (d: Draft) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = React.useState(item?.name ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [active, setActive] = React.useState(item?.active ?? true);
  const [image, setImage] = React.useState<string | undefined>(item?.image);
  const [files, setFiles] = React.useState<File[]>([]);
  const known = React.useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const [picked, setPicked] = React.useState<string[]>((item?.products ?? []).filter((id) => known.has(id)));
  const [q, setQ] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const shown = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)) : products;
  }, [products, q]);
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shift = (i: number, d: -1 | 1) => setPicked((cur) => { const j = i + d; if (j < 0 || j >= cur.length) return cur; const n = [...cur]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toTop = (i: number) => setPicked((cur) => (i === 0 ? cur : [cur[i], ...cur.filter((_, k) => k !== i)]));
  const selectShown = () => setPicked((cur) => [...cur, ...shown.map((p) => p.id).filter((id) => !cur.includes(id))]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter a name, e.g. Women, Kids, Twinning or 20% Off");
    setError("");
    setBusy(true);
    try {
      let img = image;
      if (files[0]) img = (await uploadImages([files[0]]))[0];
      await onSave({ name: name.trim(), description: description.trim(), image: img, products: picked, active });
    } catch (err) {
      toast.error("Photo upload failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Collection name" hint="Shown on the website, e.g. Women, Kids, Twinning, 20% Off."><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Twinning" /></Field>
        <Field label="Short line (optional)" hint="Shown at the top of the collection page."><Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="e.g. Mom & me matching sets" /></Field>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Collection photo</p>
        {image && !files.length && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-24 w-20 rounded-sm border border-line object-cover" />
            <Button type="button" variant="outline" size="sm" onClick={() => setImage(undefined)}>Remove photo</Button>
          </div>
        )}
        <PhotoUpload files={files} onChange={(f) => setFiles(f.slice(-1))} max={1} />
        <p className="mt-2 text-xs">This photo is shown on the home page card. If you add none, the first product&apos;s photo is used.</p>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-ink">Products in this collection</p>
            <p className="text-xs"><strong className="text-ink">{picked.length}</strong> selected of {products.length}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="soft" size="sm" onClick={selectShown}>Select all shown</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPicked([])} disabled={picked.length === 0}>Clear</Button>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input aria-label="Search products" className="pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {products.length === 0 ? <p className="rounded-sm border border-dashed border-line p-6 text-center text-sm">Add clothing products first, then pick them here.</p> : (
          <div className="grid max-h-[26rem] grid-cols-3 gap-2 overflow-y-auto rounded-sm border border-line p-2 sm:grid-cols-4">
            {shown.length === 0 && <p className="col-span-full p-6 text-center text-sm">No products match “{q}”.</p>}
            {shown.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)} className={cn("relative overflow-hidden rounded-sm border-2 bg-card text-left transition", on ? "border-primary" : "border-line hover:border-primary/50")}>
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
        )}
      </div>

      {picked.length > 1 && (
        <div>
          <p className="text-sm font-medium text-ink">Order on the website</p>
          <p className="mb-2 text-xs">The first product is shown at the very top of this collection. Use the arrows, or “Top” to move one to the front.</p>
          <ol className="max-h-80 divide-y divide-line overflow-y-auto rounded-sm border border-line">
            {picked.map((id, i) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <li key={id} className="flex items-center gap-3 p-2">
                  <span className="w-6 text-center text-xs font-semibold text-ink">{i + 1}</span>
                  <div className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-4 w-4" />}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</p>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Move ${p.name} to top`} disabled={i === 0} onClick={() => toTop(i)}><ChevronsUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => shift(i, -1)}><ChevronUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Move ${p.name} down`} disabled={i === picked.length - 1} onClick={() => shift(i, 1)}><ChevronDown className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="flex items-center justify-between rounded-sm border border-line bg-surface p-4">
        <div><p className="text-sm font-semibold text-ink">Show on the website</p><p className="text-xs">Switch off to hide it without deleting.</p></div>
        <Switch checked={active} onChange={setActive} label="Show collection on website" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add collection"}</Button>
      </div>
    </form>
  );
}

export function CollectionAdmin({ initial, products }: { initial: CollectionItem[]; products: PickProduct[] }) {
  const [items, setItems] = React.useState<CollectionItem[]>(initial);
  const [editing, setEditing] = React.useState<CollectionItem | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<CollectionItem | null>(null);
  const known = React.useMemo(() => new Set(products.map((p) => p.id)), [products]);

  const save = async (d: Draft): Promise<boolean> => {
    try {
      if (editing === "new") {
        const { id, slug } = await postJson<{ id: string; slug: string }>("/api/admin/collections", d);
        setItems((cur) => [...cur, { ...d, id, slug, order: cur.length }]);
      } else if (editing) {
        const id = editing.id;
        await postJson(`/api/admin/collections/${id}`, d, "PUT");
        setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...d } : x)));
      }
      toast.success(editing === "new" ? "Collection added" : "Changes saved", { description: "Updated on the website." });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save collection", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    }
  };

  const toggle = async (c: CollectionItem, v: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, active: v } : x)));
    try {
      await postJson(`/api/admin/collections/${c.id}`, { active: v }, "PUT");
      toast.success(v ? "Collection shown on website" : "Collection hidden from website");
    } catch (e) {
      setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, active: !v } : x)));
      toast.error("Could not update", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const prev = items;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    try {
      await postJson("/api/admin/collections/reorder", { ids: next.map((x) => x.id) });
    } catch (e) {
      setItems(prev);
      toast.error("Could not change the order", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/collections/${deleting.id}`, {}, "DELETE");
      setItems((c) => c.filter((x) => x.id !== deleting.id));
      toast.success("Collection deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Collections"
        description="Make your own collections, for example Women, Kids, Twinning or 20% Off. Give each a name and photo, then pick the products inside. These show under “Shop by collection” on the website, in the menu and in the shop filter."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add collection</Button>}
      />
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><LayoutGrid className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No collections yet</h2>
          <p className="mt-1 max-w-sm text-sm">Add your first collection. Until you do, the website shows no collections in “Shop by collection”.</p>
          <Button className="mt-5" onClick={() => setEditing("new")}>Add collection</Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {items.map((c, idx) => {
            const count = c.products.filter((id) => known.has(id)).length;
            return (
              <li key={c.id} className={cn("rounded-sm border border-line bg-card p-4 shadow-card", !c.active && "opacity-75")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{c.name}</p>
                      <p className="text-sm">{count} product{count === 1 ? "" : "s"}{c.description ? ` · ${c.description}` : ""}</p>
                      {count === 0 && <p className="text-xs font-semibold text-amber-700">Empty: not shown on the website until you add products.</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <label className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Switch checked={c.active} onChange={(v) => toggle(c, v)} label={`${c.active ? "Hide" : "Show"} ${c.name}`} />
                      {c.active ? "Active" : "Inactive"}
                    </label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Move ${c.name} up`} disabled={idx === 0} onClick={() => move(idx, -1)}><ChevronUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Move ${c.name} down`} disabled={idx === items.length - 1} onClick={() => move(idx, 1)}><ChevronDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="dangerSoft" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add collection" : "Edit collection"} wide>
        {editing !== null && <CollectionForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} products={products} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this collection?"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete collection</Button></>}
      >
        <p className="text-sm">“{deleting?.name}” will be removed from the website. Your products are not deleted. This cannot be undone.</p>
      </Dialog>
    </>
  );
}