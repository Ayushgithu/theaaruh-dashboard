"use client";
import * as React from "react";
import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Banner } from "@/lib/types";
import { postJson, uploadImages } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { AdminPageHeader } from "./shell";

const themeCls: Record<Banner["theme"], string> = {
  blue: "from-primary to-blue-800",
  slate: "from-slate-900 to-slate-700",
  sky: "from-sky-200 to-primary-soft",
};

const schema = z.object({
  title: z.string().trim().min(5, "Enter a headline"),
  subtitle: z.string().trim().min(5, "Add a short supporting line"),
  cta: z.string().trim().min(2, "Enter the button label"),
  href: z.string().trim().startsWith("/", "Use a page path such as /shop"),
  theme: z.enum(["blue", "slate", "sky"]),
});
type Values = z.infer<typeof schema>;

function BannerForm({ banner, onSave, onCancel }: { banner: Banner | null; onSave: (b: Banner) => Promise<boolean>; onCancel: () => void }) {
  const [active, setActive] = React.useState(banner?.active ?? true);
  const [files, setFiles] = React.useState<File[]>([]);
  const [image, setImage] = React.useState<string | undefined>(banner?.image);
  const [busy, setBusy] = React.useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: banner?.title ?? "", subtitle: banner?.subtitle ?? "", cta: banner?.cta ?? "Shop now", href: banner?.href ?? "/shop", theme: banner?.theme ?? "blue" },
  });
  const submit = async (v: Values) => {
    setBusy(true);
    try {
      let img = image;
      if (files[0]) {
        try { [img] = await uploadImages([files[0]]); }
        catch (e) { toast.error("Image upload failed", { description: e instanceof Error ? e.message : "Please try again." }); return; }
      }
      await onSave({ id: banner?.id ?? "", ...v, active, image: img });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      <Field label="Headline" error={errors.title?.message}><Input aria-invalid={!!errors.title} {...register("title")} /></Field>
      <Field label="Supporting text" error={errors.subtitle?.message}><Textarea className="min-h-20" aria-invalid={!!errors.subtitle} {...register("subtitle")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Button label" error={errors.cta?.message}><Input {...register("cta")} /></Field>
        <Field label="Button link" error={errors.href?.message}><Input {...register("href")} /></Field>
      </div>
      <Field label="Colour theme"><Select {...register("theme")}><option value="blue">Blue</option><option value="slate">Dark slate</option><option value="sky">Light sky</option></Select></Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Banner image (optional)</p>
        {image && !files.length && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Current banner" className="h-16 w-28 rounded-lg border border-line object-cover" />
            <Button type="button" variant="dangerSoft" size="sm" onClick={() => setImage(undefined)}>Remove image</Button>
          </div>
        )}
        <PhotoUpload files={files} onChange={(f) => setFiles(f.slice(-1))} max={1} />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Show on the website</p>
        <Switch checked={active} onChange={setActive} label="Show banner on website" />
      </div>
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : banner ? "Save changes" : "Add banner"}</Button>
      </div>
    </form>
  );
}

export function BannerAdmin({ initial }: { initial: Banner[] }) {
  const [items, setItems] = React.useState<Banner[]>(initial);
  const [editing, setEditing] = React.useState<Banner | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Banner | null>(null);

  const save = async (b: Banner): Promise<boolean> => {
    const isNew = editing === "new";
    const { id: _id, ...body } = b;
    try {
      if (isNew) {
        const { id } = await postJson<{ id: string }>("/api/admin/banners", body);
        setItems((cur) => [{ ...b, id }, ...cur]);
      } else {
        await postJson(`/api/admin/banners/${b.id}`, body, "PUT");
        setItems((cur) => cur.map((x) => (x.id === b.id ? b : x)));
      }
      toast.success(isNew ? "Banner added" : "Changes saved", { description: "Updated on the website." });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save banner", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    }
  };

  const toggle = async (b: Banner, v: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === b.id ? { ...x, active: v } : x)));
    try {
      await postJson(`/api/admin/banners/${b.id}`, { active: v }, "PUT");
      toast.success(v ? "Banner shown on website" : "Banner hidden from website");
    } catch (e) {
      setItems((cur) => cur.map((x) => (x.id === b.id ? { ...x, active: !v } : x)));
      toast.error("Could not update banner", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/banners/${deleting.id}`, {}, "DELETE");
      setItems((c) => c.filter((x) => x.id !== deleting.id));
      toast.success("Banner deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete banner", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader title="Banners" description="Offers shown in the rotating banner on the home page." action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add banner</Button>} />
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-faint text-primary"><ImageOff className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No banners yet</h2>
          <p className="mt-1 text-sm">Add an offer to feature it on the home page.</p>
          <Button className="mt-5" onClick={() => setEditing("new")}>Add banner</Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {items.map((b) => (
            <li key={b.id} className={cn("flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:flex-row sm:items-center", !b.active && "opacity-75")}>
              <div className={cn("relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br sm:h-24 sm:w-44", themeCls[b.theme])}>
                {b.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                <span className={cn("absolute inset-x-3 bottom-3 line-clamp-2 text-xs font-semibold", b.theme === "sky" ? "text-ink" : "text-white")}>{b.title}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{b.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm">{b.subtitle}</p>
                <p className="mt-1 text-xs">Button: “{b.cta}” to {b.href}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Switch checked={b.active} onChange={(v) => toggle(b, v)} label={`${b.active ? "Hide" : "Show"} ${b.title}`} />
                  {b.active ? "Active" : "Inactive"}
                </label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${b.title}`} onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="dangerSoft" size="icon" aria-label={`Delete ${b.title}`} onClick={() => setDeleting(b)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add banner" : "Edit banner"}>
        {editing !== null && <BannerForm key={editing === "new" ? "new" : editing.id} banner={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this banner?"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete banner</Button></>}
      >
        <p className="text-sm">“{deleting?.title}” will be removed. This cannot be undone.</p>
      </Dialog>
    </>
  );
}
