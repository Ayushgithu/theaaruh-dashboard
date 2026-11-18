"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import type { ReviewRequestRow, ReviewRequestSettings } from "@/lib/review-request-types";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, Switch } from "@/components/ui/form";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d.replace(/^0+/, ""); };
const TABS = ["due", "waiting", "sent"] as const;
type Tab = (typeof TABS)[number];

export function ReviewRequests({ rows: initial, settings: initialSettings }: { rows: ReviewRequestRow[]; settings: ReviewRequestSettings }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  React.useEffect(() => setRows(initial), [initial]);
  const [settings, setSettings] = React.useState(initialSettings);
  const [tab, setTab] = React.useState<Tab>("due");
  const [busy, setBusy] = React.useState<string | null>(null);
  const now = Date.now();

  const isDue = (r: ReviewRequestRow) => !r.requested && +new Date(r.dueAt) <= now;
  const groups: Record<Tab, ReviewRequestRow[]> = {
    due: rows.filter(isDue),
    waiting: rows.filter((r) => !r.requested && !isDue(r)),
    sent: rows.filter((r) => !!r.requested),
  };
  const shown = groups[tab];

  const save = async (next: ReviewRequestSettings) => {
    setSettings(next);
    try {
      await postJson("/api/admin/review-requests", next, "PUT");
      toast.success(next.autoEmail ? `Automatic email on: ${next.afterDays} days after delivery` : "Automatic email is off");
      router.refresh();
    } catch (e) {
      setSettings(settings);
      toast.error("Could not save", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const mark = (id: string, via: "email" | "whatsapp") => setRows((cur) => cur.map((r) => (r.orderId === id ? { ...r, requested: { at: new Date().toISOString(), via } } : r)));

  const email = async (r: ReviewRequestRow) => {
    setBusy(r.orderId);
    try {
      await postJson("/api/admin/review-requests", { orderId: r.orderId, via: "email" });
      mark(r.orderId, "email");
      toast.success(`Email sent to ${r.customerName}`);
      router.refresh();
    } catch (e) {
      toast.error("Could not send the email", { description: e instanceof Error ? e.message : "Please try again." });
    } finally { setBusy(null); }
  };

  const whatsapp = (r: ReviewRequestRow) => {
    const n = waNumber(r.phone);
    if (n.length < 10) { toast.error("This customer has no valid phone number"); return; }
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(r.whatsapp)}`, "_blank", "noopener,noreferrer"); // open first so the browser does not block it
    mark(r.orderId, "whatsapp");
    void postJson("/api/admin/review-requests", { orderId: r.orderId, via: "whatsapp" }).then(() => router.refresh()).catch(() => {});
  };

  const emailAllDue = async () => {
    const list = groups.due.filter((r) => /^\S+@\S+\.\S+$/.test(r.email));
    if (!list.length) { toast("No due orders with an email address"); return; }
    setBusy("all");
    let sent = 0;
    for (const r of list) {
      try { await postJson("/api/admin/review-requests", { orderId: r.orderId, via: "email" }); mark(r.orderId, "email"); sent++; }
      catch (e) { toast.error("Stopped", { description: e instanceof Error ? e.message : "Could not send." }); break; }
    }
    setBusy(null);
    if (sent) { toast.success(`${sent} email${sent === 1 ? "" : "s"} sent`); router.refresh(); }
  };

  return (
    <>
      <section className="mb-5 rounded-sm bg-card p-4 shadow-card ring-1 ring-line sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-ink">Send review requests automatically</p>
            <p className="mt-0.5 text-sm text-body">When on, an email goes to each customer once, a few days after their order is delivered. It runs once a day. Orders you already asked (by email or WhatsApp) are skipped.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">After
              <Select value={settings.afterDays} onChange={(e) => void save({ ...settings, afterDays: Number(e.target.value) })} className="w-24!" aria-label="Days after delivery">
                {[1, 2, 3, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"}</option>)}
              </Select>
            </label>
            <Switch checked={settings.autoEmail} onChange={(v) => void save({ ...settings, autoEmail: v })} label="Send review requests automatically" />
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Review requests" className="no-scrollbar flex gap-1 overflow-x-auto rounded-sm bg-card p-1 shadow-card ring-1 ring-line">
          {([["due", "Ready to ask"], ["waiting", "Not due yet"], ["sent", "Already asked"]] as const).map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("min-h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition", tab === t ? "bg-primary text-white" : "text-body hover:bg-surface")}>
              {label} <span className={cn("ml-1 text-xs", tab === t ? "text-white/80" : "text-body/70")}>{groups[t].length}</span>
            </button>
          ))}
        </div>
        {tab === "due" && groups.due.length > 0 && <Button size="sm" onClick={emailAllDue} disabled={busy !== null}><Send className="h-4 w-4" />Email all ({groups.due.length})</Button>}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-sm bg-card p-10 text-center text-body shadow-card ring-1 ring-line">
          {tab === "due" ? "Nobody to ask right now. Delivered orders show up here a few days after delivery." : tab === "waiting" ? "No recent deliveries waiting." : "You have not asked anyone yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.orderId} className="rounded-sm bg-card p-4 shadow-card ring-1 ring-line">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.customerName} <span className="font-normal text-body">· {r.orderNumber}</span></p>
                  <p className="text-sm text-body">{r.email || "No email"}{r.phone && ` · ${r.phone}`}</p>
                  <p className="mt-0.5 text-xs text-body">
                    Delivered {day(r.deliveredAt)}
                    {r.requested ? ` · Asked on ${day(r.requested.at)} via ${r.requested.via === "whatsapp" ? "WhatsApp" : r.requested.via === "auto" ? "automatic email" : "email"}` : isDue(r) ? " · Ready to ask" : ` · Due on ${day(r.dueAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy !== null || !r.email} onClick={() => email(r)}><Mail className="h-4 w-4" />{r.requested ? "Email again" : "Send email"}</Button>
                  <Button size="sm" variant="whatsapp" disabled={busy !== null || !r.phone} onClick={() => whatsapp(r)}><MessageCircle className="h-4 w-4" />{r.requested ? "WhatsApp again" : "WhatsApp"}</Button>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {r.items.map((i) => (
                  <li key={i.productId} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-xs text-ink">
                    {i.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={i.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                      : <span className="h-7 w-7 rounded-full bg-line" />}
                    <span className="max-w-[16rem] truncate">{i.name}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}