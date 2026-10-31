"use client";
import * as React from "react";
import { BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { postJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { AdminPageHeader } from "./shell";

const IDEAS = [
  { title: "New arrivals are here ✨", body: "Fresh festive suit sets just landed. Tap to see them first.", url: "/shop?sort=new" },
  { title: "Sale is live 🎉", body: "Up to 40% off for the next 48 hours.", url: "/shop?sort=discount" },
];

export function NotificationsAdmin({ configured, subscribers }: { configured: boolean; subscribers: number }) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [url, setUrl] = React.useState("/shop?sort=new");
  const [busy, setBusy] = React.useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const r = await postJson<{ sent: number; failed: number; removed: number }>("/api/admin/push", { title, body, url });
      toast.success(`Sent to ${r.sent} customer${r.sent === 1 ? "" : "s"}`, { description: r.failed ? `${r.failed} could not be reached${r.removed ? ` (${r.removed} old subscriptions removed)` : ""}.` : undefined });
      setTitle(""); setBody("");
    } catch (e) { toast.error("Could not send", { description: e instanceof Error ? e.message : "Please try again." }); }
    setBusy(false);
  };

  return (
    <>
      <AdminPageHeader title="Notifications" description="Send a new-arrival or sale alert to customers who turned alerts on (website footer → “Get new-arrival & sale alerts”)." />
      {!configured && (
        <div role="alert" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <p className="font-semibold">Push notifications are not set up yet.</p>
          <p className="mt-1">Run <code className="rounded bg-white/70 px-1">npx web-push generate-vapid-keys</code>, then add <code className="rounded bg-white/70 px-1">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> (also on the website), <code className="rounded bg-white/70 px-1">VAPID_PRIVATE_KEY</code> and <code className="rounded bg-white/70 px-1">VAPID_SUBJECT</code> (mailto:you@brand.com) to the environment variables and redeploy.</p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
          <p className="flex items-center gap-2 text-sm"><BellRing className="h-4 w-4 text-primary" /> <strong className="text-ink">{subscribers}</strong> subscriber{subscribers === 1 ? "" : "s"}</p>
          <div className="flex flex-wrap gap-2">{IDEAS.map((i) => <Button key={i.title} type="button" variant="soft" size="sm" onClick={() => { setTitle(i.title); setBody(i.body); setUrl(i.url); }}>{i.title}</Button>)}</div>
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></Field>
          <Field label="Message" hint={`${body.length}/160`}><Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={160} /></Field>
          <Field label="Opens this page" hint="e.g. /shop?sort=new, /collections/sarees or a full link"><Input value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
          <Button onClick={send} disabled={busy || !configured || title.length < 2 || body.length < 2}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send to everyone</>}</Button>
        </section>
        <aside aria-label="Preview" className="h-fit rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="mb-3 text-xs font-semibold">How it looks on a phone</p>
          <div className="rounded-2xl bg-surface p-4 shadow-inner"><div className="flex gap-3 rounded-xl bg-card p-3 shadow-card"><span className="h-10 w-10 shrink-0 rounded-xl bg-primary" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{title || "Your title"}</p><p className="line-clamp-2 text-xs">{body || "Your message appears here."}</p></div></div></div>
          <p className="mt-3 text-xs">Send alerts only when there is something worth opening — a few a month works best.</p>
        </aside>
      </div>
    </>
  );
}
