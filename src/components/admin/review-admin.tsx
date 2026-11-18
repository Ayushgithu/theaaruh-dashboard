"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Home, MessageSquareReply, Search, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { AdminReview, ReviewStatus } from "@/lib/review-types";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { AdminPageHeader } from "./shell";

const TABS = ["pending", "approved", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];
const FIT = { small: "Ran small", right: "True to size", large: "Ran large" } as const;
const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

const Stars = ({ n }: { n: number }) => (
  <span className="inline-flex" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("h-4 w-4", i <= n ? "fill-amber-400 text-amber-400" : "text-slate-300")} />)}
  </span>
);

export function ReviewAdmin({ initial }: { initial: AdminReview[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  React.useEffect(() => setItems(initial), [initial]);
  const [tab, setTab] = React.useState<Tab>(initial.some((r) => r.status === "pending") ? "pending" : "all");
  const [q, setQ] = React.useState("");
  const [replying, setReplying] = React.useState<AdminReview | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [removing, setRemoving] = React.useState<AdminReview | null>(null);
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const count = (t: Tab) => (t === "all" ? items.length : items.filter((r) => r.status === t).length);
  const shown = items.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    const s = q.trim().toLowerCase();
    return !s || [r.productName, r.customerName, r.customerEmail, r.title, r.text].some((x) => x.toLowerCase().includes(s));
  });

  const patch = async (r: AdminReview, body: { status?: ReviewStatus; featured?: boolean; reply?: string }, done?: string) => {
    setBusy(true);
    try {
      await postJson(`/api/admin/reviews/${r.id}`, body, "PUT");
      setItems((cur) => cur.map((x) => {
        if (x.id !== r.id) return x;
        const status = body.status ?? x.status;
        return { ...x, status, featured: status === "approved" ? (body.featured ?? x.featured) : false, reply: body.reply === undefined ? x.reply : body.reply || undefined };
      }));
      if (done) toast.success(done);
      router.refresh();
      return true;
    } catch (e) {
      toast.error("Could not save", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await postJson(`/api/admin/reviews/${removing.id}`, {}, "DELETE");
      setItems((cur) => cur.filter((x) => x.id !== removing.id));
      toast.success("Review deleted");
      setRemoving(null);
      router.refresh();
    } catch (e) {
      toast.error("Could not delete", { description: e instanceof Error ? e.message : "Please try again." });
    } finally { setBusy(false); }
  };

  const saveReply = async () => {
    if (!replying) return;
    if (await patch(replying, { reply: replyText.trim() }, replyText.trim() ? "Reply saved" : "Reply removed")) setReplying(null);
  };

  return (
    <>
      <AdminPageHeader title="Reviews" description="Approve customer reviews before they appear on the website." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter by status" className="no-scrollbar flex gap-1 overflow-x-auto rounded-sm bg-card p-1 shadow-card ring-1 ring-line">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("min-h-10 shrink-0 rounded-lg px-4 text-sm font-medium capitalize transition", tab === t ? "bg-primary text-white" : "text-body hover:bg-surface")}>
              {t} <span className={cn("ml-1 text-xs", tab === t ? "text-white/80" : "text-body/70")}>{count(t)}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, customer or text" className="pl-9" aria-label="Search reviews" />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-sm bg-card p-10 text-center text-body shadow-card ring-1 ring-line">
          {items.length === 0 ? "No reviews yet. Customers can review a product from its page once they are signed in." : "Nothing here."}
        </div>
      ) : (
        <ul className="space-y-4">
          {shown.map((r) => (
            <li key={r.id} className="rounded-sm bg-card p-4 shadow-card ring-1 ring-line sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {r.avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.avatar.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_96,h_96,c_fill,g_face/")} alt="" title="Reviewer's own photo" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-primary/30" />
                    : null}
                  {r.productImage
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.productImage} alt="" className="h-14 w-12 shrink-0 rounded-md object-cover" />
                    : <div className="h-14 w-12 shrink-0 rounded-md bg-surface" />}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{r.productName}</p>
                    <p className="truncate text-sm text-body">{r.customerName}{r.customerEmail && ` · ${r.customerEmail}`}</p>
                    <p className="text-xs text-body">{new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.featured && <span className="inline-flex items-center gap-1 rounded-full bg-primary-faint px-2.5 py-1 text-xs font-semibold text-primary"><Home className="h-3.5 w-3.5" />On home page</span>}
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", STATUS_STYLE[r.status])}>{r.status}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars n={r.rating} />
                {r.verified && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck className="h-4 w-4" />Verified buyer</span>}
                {r.sizeBought && <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink">Size {r.sizeBought}</span>}
                {r.fit && <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink">{FIT[r.fit]}</span>}
              </div>
              {r.title && <p className="mt-2 font-semibold text-ink">{r.title}</p>}
              <p className="mt-1 whitespace-pre-line text-[15px] text-ink/90">{r.text}</p>

              {r.photos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {r.photos.map((u, i) => (
                    <li key={u}>
                      <button type="button" aria-label={`Open photo ${i + 1}`} onClick={() => setPhoto(u)} className="block h-20 w-20 overflow-hidden rounded-lg border border-line hover:opacity-90">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_200,c_limit/")} alt="" className="h-full w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {r.reply && (
                <div className="mt-3 rounded-lg border-l-4 border-primary bg-primary-faint p-3 text-sm">
                  <p className="font-semibold text-primary">Your public reply</p>
                  <p className="mt-0.5 whitespace-pre-line text-ink/90">{r.reply}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                {r.status !== "approved" && <Button size="sm" disabled={busy} onClick={() => patch(r, { status: "approved" }, "Approved. It is now on the website.")}><Check className="h-4 w-4" />Approve</Button>}
                {r.status !== "rejected" && <Button size="sm" variant="outline" disabled={busy} onClick={() => patch(r, { status: "rejected" }, r.status === "approved" ? "Hidden from the website" : "Rejected")}><X className="h-4 w-4" />{r.status === "approved" ? "Hide" : "Reject"}</Button>}
                {r.status === "approved" && (
                  <Button size="sm" variant={r.featured ? "soft" : "outline"} disabled={busy} onClick={() => patch(r, { featured: !r.featured }, r.featured ? "Removed from home page" : "Now shown on the home page")}>
                    <Home className="h-4 w-4" />{r.featured ? "Remove from home" : "Show on home page"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setReplying(r); setReplyText(r.reply ?? ""); }}><MessageSquareReply className="h-4 w-4" />{r.reply ? "Edit reply" : "Reply"}</Button>
                <Button size="sm" variant="dangerSoft" className="ml-auto" disabled={busy} onClick={() => setRemoving(r)}><Trash2 className="h-4 w-4" />Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!replying} onClose={() => setReplying(null)} title="Reply to this review"
        footer={<><Button variant="outline" onClick={() => setReplying(null)}>Cancel</Button><Button disabled={busy} onClick={saveReply}>Save reply</Button></>}>
        <p className="mb-3 text-sm text-body">Your reply appears publicly under the review as “Reply from The Aaruh”. Leave it empty to remove it.</p>
        <Textarea rows={5} value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={600} placeholder="Thank you for your kind words…" aria-label="Reply" />
        <p className="mt-1 text-right text-xs text-body">{replyText.length}/600</p>
      </Dialog>

      <Dialog open={!!removing} onClose={() => setRemoving(null)} title="Delete this review?"
        footer={<><Button variant="outline" onClick={() => setRemoving(null)}>Keep it</Button><Button variant="danger" disabled={busy} onClick={remove}>Delete</Button></>}>
        <p className="text-sm text-body">This permanently deletes the review and its photos. The customer will be able to write a new review for this product.</p>
      </Dialog>

      {photo && (
        <div role="dialog" aria-modal="true" aria-label="Review photo" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4" onClick={() => setPhoto(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_1400,c_limit/")} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" aria-label="Close" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" onClick={() => setPhoto(null)}><X className="h-5 w-5" /></button>
        </div>
      )}
    </>
  );
}