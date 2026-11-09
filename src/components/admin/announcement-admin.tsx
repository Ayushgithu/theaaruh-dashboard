"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { Announcement } from "@/lib/types";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { AnnouncementBar } from "@/components/shared/announcement-bar";
import { AdminPageHeader } from "./shell";

const formSchema = z.object({
  text: z.string().trim().min(3, "Write the message to show (at least 3 characters)").max(160, "Keep it under 160 characters"),
  href: z.string().trim().refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), "Use a page path like /shop or a full https:// link"),
});
type Values = z.infer<typeof formSchema>;

function AnnouncementForm({ item, onSave, onCancel }: { item: Announcement | null; onSave: (v: Omit<Announcement, "id">) => Promise<boolean>; onCancel: () => void }) {
  const [active, setActive] = React.useState(item?.active ?? true);
  const [busy, setBusy] = React.useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { text: item?.text ?? "", href: item?.href ?? "" },
  });
  const text = watch("text");

  const submit = async (v: Values) => {
    setBusy(true);
    try { await onSave({ text: v.text, href: v.href || undefined, active }); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      <Field label="Message" error={errors.text?.message} hint="Emojis are fine, e.g. 🔥 Free delivery on orders above ₹999">
        <Input aria-invalid={!!errors.text} {...register("text")} />
      </Field>
      <Field label="Link (optional)" error={errors.href?.message} hint="Where the message goes when clicked, e.g. /shop">
        <Input placeholder="/shop" aria-invalid={!!errors.href} {...register("href")} />
      </Field>
      <div className="flex items-center justify-between rounded-sm border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Show on the website</p>
        <Switch checked={active} onChange={setActive} label="Show message on website" />
      </div>
      {text.trim().length >= 3 && (
        <div>
          <p className="mb-1.5 text-xs">Preview</p>
          <div className="overflow-hidden rounded-sm"><AnnouncementBar items={[{ id: "preview", text: text.trim(), active: true }]} /></div>
        </div>
      )}
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add message"}</Button>
      </div>
    </form>
  );
}

export function AnnouncementAdmin({ initial }: { initial: Announcement[] }) {
  const [items, setItems] = React.useState<Announcement[]>(initial);
  const [editing, setEditing] = React.useState<Announcement | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Announcement | null>(null);
  const live = items.filter((i) => i.active);

  const save = async (v: Omit<Announcement, "id">): Promise<boolean> => {
    const isNew = editing === "new";
    try {
      const saved = isNew
        ? await postJson<Announcement>("/api/admin/announcements", v)
        : await postJson<Announcement>(`/api/admin/announcements/${(editing as Announcement).id}`, v, "PUT");
      setItems((cur) => (isNew ? [saved, ...cur] : cur.map((x) => (x.id === saved.id ? saved : x))));
      toast.success(isNew ? "Message added" : "Changes saved", { description: "Updated on the website." });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    }
  };

  const toggle = async (a: Announcement, v: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === a.id ? { ...x, active: v } : x)));
    try {
      await postJson(`/api/admin/announcements/${a.id}`, { active: v }, "PUT");
      toast.success(v ? "Message shown on website" : "Message hidden from website");
    } catch (e) {
      setItems((cur) => cur.map((x) => (x.id === a.id ? { ...x, active: !v } : x)));
      toast.error("Could not update", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/announcements/${deleting.id}`, {}, "DELETE");
      setItems((c) => c.filter((x) => x.id !== deleting.id));
      toast.success("Message deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Top bar"
        description="Short messages that scroll across the very top of every page of the website."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add message</Button>}
      />

      <section aria-label="Live preview" className="mb-6">
        <p className="mb-2 text-sm font-medium text-ink">Live preview</p>
        <div className="overflow-hidden rounded-sm border border-line">
          {live.length ? <AnnouncementBar items={live} /> : (
            <p className="bg-surface px-4 py-3 text-sm">No active messages, so the top bar is hidden on the website.</p>
          )}
        </div>
      </section>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><Megaphone className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No messages yet</h2>
          <p className="mt-1 text-sm">Add an offer or notice and it will scroll across the top of the website.</p>
          <Button className="mt-5" onClick={() => setEditing("new")}>Add message</Button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((a) => (
            <li key={a.id} className={cn("flex flex-col gap-3 rounded-sm border border-line bg-card p-4 shadow-card sm:flex-row sm:items-center", !a.active && "opacity-70")}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{a.text}</p>
                {a.href && <p className="mt-0.5 flex items-center gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> {a.href}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Switch checked={a.active} onChange={(v) => toggle(a, v)} label={`${a.active ? "Hide" : "Show"} ${a.text}`} />
                  {a.active ? "Live" : "Hidden"}
                </label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${a.text}`} onClick={() => setEditing(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="dangerSoft" size="icon" aria-label={`Delete ${a.text}`} onClick={() => setDeleting(a)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add message" : "Edit message"}>
        {editing !== null && <AnnouncementForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this message?"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete message</Button></>}
      >
        <p className="text-sm">“{deleting?.text}” will be removed from the top bar. This cannot be undone.</p>
      </Dialog>
    </>
  );
}
