"use client";
import * as React from "react";
import { Pencil, Plus, Search, Trash2, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import type { Product, ProductType } from "@/lib/types";
import { postJson } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { ConditionBadge, StockBadge } from "@/components/ui/badge";
import { ProductVisual } from "@/components/shared/product-art";
import { AdminPageHeader } from "./shell";
import { ProductForm } from "./product-form";
import { BulkUpload } from "./bulk-upload";

function SizeChips({ p }: { p: Product }) {
  if (!p.sizes?.length) return <span className="text-xs">{p.quantity ?? 0} units</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {p.sizes.map((z) => <span key={z.label} className={z.qty === 0 ? "rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 line-through" : z.qty <= 2 ? "rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700" : "rounded-md bg-primary-faint px-1.5 py-0.5 text-[11px] font-semibold text-primary"}>{z.label}: {z.qty}</span>)}
    </span>
  );
}

export function ProductAdmin({ type, initial }: { type: ProductType; initial: Product[] }) {
  const noun = type === "accessory" ? "accessory" : "product";
  const plural = type === "accessory" ? "accessories" : "products";
  const clothing = type !== "accessory";
  const [items, setItems] = React.useState<Product[]>(initial);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Product | null>(null);

  const list = items.filter((p) => `${p.name} ${p.brand} ${p.category} ${p.fabric ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  /** Saves to the database. Returns true on success so the form knows whether to close. */
  const save = async (payload: Record<string, unknown>): Promise<boolean> => {
    const isNew = editing === "new";
    try {
      const saved = await postJson<Product>(isNew ? "/api/admin/products" : `/api/admin/products/${(editing as Product).id}`, payload, isNew ? "POST" : "PUT");
      setItems((cur) => (isNew ? [saved, ...cur] : cur.map((x) => (x.id === saved.id ? saved : x))));
      toast.success(isNew ? `${noun[0].toUpperCase() + noun.slice(1)} added` : "Changes saved", { description: `${saved.name} is live on the website.` });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/products/${deleting.id}`, {}, "DELETE");
      setItems((cur) => cur.filter((x) => x.id !== deleting.id));
      toast.success(`${noun[0].toUpperCase() + noun.slice(1)} deleted`, { description: deleting.name });
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader
        title={type === "accessory" ? "Accessories" : "Clothing"}
        description={`${items.length} ${plural} listed`}
        action={<div className="flex flex-wrap gap-2">{clothing && <BulkUpload />}<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add {noun}</Button></div>}
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${plural}`} className="pl-10" aria-label="Search products" />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><PackageSearch className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">{q ? "Nothing matches your search" : `No ${plural} yet`}</h2>
          <p className="mt-1 text-sm">{q ? "Try a different name or brand." : `Add your first ${noun} to see it here.`}</p>
          {q ? <Button variant="outline" className="mt-5" onClick={() => setQ("")}>Clear search</Button> : <Button className="mt-5" onClick={() => setEditing("new")}>Add {noun}</Button>}
        </div>
      ) : (
        <>
          {/* Table on md+ */}
          <div className="hidden overflow-x-auto rounded-sm border border-line bg-card shadow-card md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface text-left text-xs font-semibold text-body">
                <tr>
                  <th className="px-4 py-3">Product</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">{clothing ? "Sizes in stock" : "Condition"}</th>
                  <th className="px-4 py-3">Stock</th><th className="px-4 py-3">Views</th><th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-16 shrink-0 overflow-hidden rounded-lg"><ProductVisual product={p} /></div>
                        <div className="min-w-0"><p className="truncate font-semibold text-ink">{p.name}</p><p className="text-xs">{[p.brand, p.category].filter(Boolean).join(" · ")}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3">{clothing ? <SizeChips p={p} /> : <ConditionBadge condition={p.condition} />}</td>
                    <td className="px-4 py-3"><StockBadge stock={p.stock} count={p.stockCount} /></td>
                    <td className="px-4 py-3">{p.views.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="dangerSoft" size="icon" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stacked cards on small screens */}
          <ul className="grid gap-3 md:hidden">
            {list.map((p) => (
              <li key={p.id} className="rounded-sm border border-line bg-card p-3 shadow-card">
                <div className="flex gap-3">
                  <div className="w-24 shrink-0 self-start overflow-hidden rounded-sm"><ProductVisual product={p} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-ink">{p.name}</p>
                    <p className="mt-0.5 text-sm font-bold text-ink">{formatPrice(p.price)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">{clothing ? <SizeChips p={p} /> : <ConditionBadge condition={p.condition} />}<StockBadge stock={p.stock} count={p.stockCount} /></div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button variant="dangerSoft" onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4" /> Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} wide title={editing === "new" ? `Add ${noun}` : `Edit ${noun}`}>
        {editing !== null && <ProductForm key={editing === "new" ? "new" : editing.id} type={type} categories={[...new Set(items.map((x) => x.category))]} product={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete this ${noun}?`}
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete {noun}</Button></>}
      >
        <p className="text-sm leading-relaxed"><strong className="font-semibold text-ink">{deleting?.name}</strong> will be removed from the store. This cannot be undone.</p>
      </Dialog>
    </>
  );
}
