"use client";
import * as React from "react";
import { ChevronDown, ChevronUp, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Slide } from "@/lib/carousel-types";
import { postJson, uploadImages } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { AdminPageHeader } from "./shell";

type Draft = Omit<Slide, "id" | "order">;

function SlideForm({ slide, onSave, onCancel }: { slide: Slide | null; onSave: (d: Draft) => Promise<boolean>; onCancel: () => void }) {
  const [title, setTitle] = React.useState(slide?.title ?? "");
  const [href, setHref] = React.useState(slide?.href ?? "");
  const [active, setActive] = React.useState(slide?.active ?? true);
  const [image, setImage] = React.useState<string | undefined>(slide?.image);
  const [mobileImage, setMobileImage] = React.useState<string | undefined>(slide?.mobileImage);
  const [files, setFiles] = React.useState<File[]>([]);
  const [mFiles, setMFiles] = React.useState<File[]>([]);
  const [errors, setErrors] = React.useState<{ title?: string; href?: string; image?: string }>({});
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (title.trim().length < 2) next.title = "Enter a name for this slide";
    const h = href.trim();
    if (h && !h.startsWith("/") && !/^https?:\/\//i.test(h)) next.href = "Use a page path such as /shop or a full https:// link";
    if (!image && !files[0]) next.image = "Add the main image";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      let img = image;
      let mImg = mobileImage;
      try {
        if (files[0]) [img] = await uploadImages([files[0]]);
        if (mFiles[0]) [mImg] = await uploadImages([mFiles[0]]);
      } catch (err) {
        toast.error("Image upload failed", { description: err instanceof Error ? err.message : "Please try again." });
        return;
      }
      await onSave({ title: title.trim(), href: h, active, image: img!, mobileImage: mImg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Slide name" error={errors.title} hint="Only for you and for screen readers. Not shown on the image.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} placeholder="e.g. Festive collection" />
      </Field>
      <Field label="Click link (optional)" error={errors.href} hint="Where the slide goes when tapped, e.g. /collections/suit-sets. Leave empty for no link.">
        <Input value={href} onChange={(e) => setHref(e.target.value)} aria-invalid={!!errors.href} placeholder="/shop" />
      </Field>

      <div>
        <p className="mb-1 text-sm font-medium text-ink">Main image (desktop)</p>
        <p className="mb-2 text-xs">Best size 1920 × 720 px (8:3 wide banner). Any size works — the full photo is always shown, never cropped.</p>
        {image && !files.length && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Current slide" className="h-14 w-40 rounded-lg border border-line object-cover" />
          </div>
        )}
        <PhotoUpload files={files} onChange={(f) => setFiles(f.slice(-1))} max={1} />
        {errors.image && <p className="mt-1.5 text-xs text-red-600">{errors.image}</p>}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-ink">Mobile image (optional)</p>
        <p className="mb-2 text-xs">Best size 800 × 600 px (4:3). If empty, phones show the main image.</p>
        {mobileImage && !mFiles.length && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobileImage} alt="Current mobile slide" className="h-16 w-20 rounded-lg border border-line object-cover" />
            <Button type="button" variant="dangerSoft" size="sm" onClick={() => setMobileImage(undefined)}>Remove</Button>
          </div>
        )}
        <PhotoUpload files={mFiles} onChange={(f) => setMFiles(f.slice(-1))} max={1} />
      </div>

      <div className="flex items-center justify-between rounded-sm border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Show on the website</p>
        <Switch checked={active} onChange={setActive} label="Show slide on website" />
      </div>
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : slide ? "Save changes" : "Add slide"}</Button>
      </div>
    </form>
  );
}

export function SlideAdmin({ initial }: { initial: Slide[] }) {
  const [items, setItems] = React.useState<Slide[]>(initial);
  const [editing, setEditing] = React.useState<Slide | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Slide | null>(null);

  const save = async (d: Draft): Promise<boolean> => {
    try {
      if (editing === "new") {
        const { id } = await postJson<{ id: string }>("/api/admin/slides", d);
        setItems((cur) => [...cur, { ...d, id, order: cur.length }]);
      } else if (editing) {
        const id = editing.id;
        await postJson(`/api/admin/slides/${id}`, d, "PUT");
        setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...d } : x)));
      }
      toast.success(editing === "new" ? "Slide added" : "Changes saved", { description: "Updated on the website." });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save slide", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    }
  };

  const toggle = async (s: Slide, v: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === s.id ? { ...x, active: v } : x)));
    try {
      await postJson(`/api/admin/slides/${s.id}`, { active: v }, "PUT");
      toast.success(v ? "Slide shown on website" : "Slide hidden from website");
    } catch (e) {
      setItems((cur) => cur.map((x) => (x.id === s.id ? { ...x, active: !v } : x)));
      toast.error("Could not update slide", { description: e instanceof Error ? e.message : "Please try again." });
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
      await postJson("/api/admin/slides/reorder", { ids: next.map((x) => x.id) });
    } catch (e) {
      setItems(prev);
      toast.error("Could not change the order", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/slides/${deleting.id}`, {}, "DELETE");
      setItems((c) => c.filter((x) => x.id !== deleting.id));
      toast.success("Slide deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete slide", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Hero carousel"
        description="Wide image slides shown right below the hero on the home page. Use the arrows to change the order."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add slide</Button>}
      />
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><ImageOff className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No slides yet</h2>
          <p className="mt-1 text-sm">Add your first banner image to show the carousel on the home page.</p>
          <Button className="mt-5" onClick={() => setEditing("new")}>Add slide</Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {items.map((s, idx) => (
            <li key={s.id} className={cn("flex flex-col gap-4 rounded-sm border border-line bg-card p-4 shadow-card lg:flex-row lg:items-center", !s.active && "opacity-75")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt={s.title} className="aspect-[4/1] w-full shrink-0 rounded-sm border border-line object-cover lg:w-72" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{s.title}</p>
                <p className="mt-0.5 truncate text-sm">{s.href ? `Links to ${s.href}` : "No link"}{s.mobileImage ? " · has mobile image" : ""}</p>
                <p className="mt-0.5 text-xs">Position {idx + 1} of {items.length}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Switch checked={s.active} onChange={(v) => toggle(s, v)} label={`${s.active ? "Hide" : "Show"} ${s.title}`} />
                  {s.active ? "Active" : "Inactive"}
                </label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Move ${s.title} up`} disabled={idx === 0} onClick={() => move(idx, -1)}><ChevronUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Move ${s.title} down`} disabled={idx === items.length - 1} onClick={() => move(idx, 1)}><ChevronDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${s.title}`} onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="dangerSoft" size="icon" aria-label={`Delete ${s.title}`} onClick={() => setDeleting(s)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add slide" : "Edit slide"}>
        {editing !== null && <SlideForm key={editing === "new" ? "new" : editing.id} slide={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this slide?"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete slide</Button></>}
      >
        <p className="text-sm">“{deleting?.title}” and its images will be removed. This cannot be undone.</p>
      </Dialog>
    </>
  );
}
