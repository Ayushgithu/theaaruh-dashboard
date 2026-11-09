"use client";
import * as React from "react";
import { Inbox, Phone, Search } from "lucide-react";
import { toast } from "sonner";
import type { Enquiry, EnquiryStatus } from "@/lib/types";
import { postJson } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { StatusBadge } from "@/components/ui/badge";
import { WhatsAppIcon } from "@/components/ui/icons";
import { AdminPageHeader } from "./shell";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const tabs: ("all" | EnquiryStatus)[] = ["all", "new", "contacted", "closed"];

export function EnquiryAdmin({ initial }: { initial: Enquiry[] }) {
  const [items, setItems] = React.useState<Enquiry[]>(initial);
  // Keep the editable list aligned with server data after router.refresh().
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setItems(initial), [initial]); // new enquiries arrive via router.refresh()
  const [tab, setTab] = React.useState<(typeof tabs)[number]>("all");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<Enquiry | null>(null);

  const list = items.filter((e) => (tab === "all" || e.status === tab) && `${e.name} ${e.message} ${e.phone}`.toLowerCase().includes(q.toLowerCase()));
  const countOf = (t: (typeof tabs)[number]) => (t === "all" ? items.length : items.filter((e) => e.status === t).length);

  const setStatus = async (id: string, status: EnquiryStatus) => {
    try {
      await postJson(`/api/admin/enquiries/${id}`, { status }, "PATCH");
      setItems((cur) => cur.map((e) => (e.id === id ? { ...e, status } : e)));
      setOpen((cur) => (cur && cur.id === id ? { ...cur, status } : cur));
      toast.success("Status updated", { description: `Marked as ${status}` });
    } catch (e) {
      toast.error("Could not update status", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader title="Enquiries" description="Messages from the contact form, product enquiries and sell requests." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter by status" className="no-scrollbar flex gap-1 overflow-x-auto rounded-sm bg-card p-1 shadow-card ring-1 ring-line">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("min-h-10 shrink-0 rounded-lg px-4 text-sm font-medium capitalize transition", tab === t ? "bg-primary text-white" : "text-body hover:bg-surface")}>
              {t} <span className={cn("ml-1 text-xs", tab === t ? "text-white/80" : "text-slate-500")}>{countOf(t)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or message" className="pl-10" aria-label="Search enquiries" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><Inbox className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No enquiries here</h2>
          <p className="mt-1 text-sm">Nothing matches this filter right now.</p>
          <Button variant="outline" className="mt-5" onClick={() => { setTab("all"); setQ(""); }}>Show all enquiries</Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-sm border border-line bg-card shadow-card md:block">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-surface text-left text-xs font-semibold text-body">
                <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((e) => (
                  <tr key={e.id} tabIndex={0} onClick={() => setOpen(e)} onKeyDown={(k) => k.key === "Enter" && setOpen(e)} className="cursor-pointer hover:bg-primary-faint/50 focus-visible:bg-primary-faint/50">
                    <td className="px-4 py-3"><p className="font-semibold text-ink">{e.name}</p><p className="text-xs">{e.phone}</p></td>
                    <td className="max-w-xs px-4 py-3"><p className="truncate">{e.message}</p></td>
                    <td className="px-4 py-3">{e.source}</td>
                    <td className="whitespace-nowrap px-4 py-3">{fmt(e.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {list.map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpen(e)} className="w-full rounded-sm border border-line bg-card p-4 text-left shadow-card">
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold text-ink">{e.name}</p><StatusBadge status={e.status} /></div>
                  <p className="mt-1 line-clamp-2 text-sm">{e.message}</p>
                  <p className="mt-2 text-xs">{e.source} · {fmt(e.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={!!open} onClose={() => setOpen(null)} title="Enquiry details">
        {open && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-lg font-semibold text-ink">{open.name}</p><p className="text-sm">{open.phone}</p></div>
              <StatusBadge status={open.status} />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs">Source</dt><dd className="mt-0.5 font-medium text-ink">{open.source}</dd></div>
              <div><dt className="text-xs">Received</dt><dd className="mt-0.5 font-medium text-ink">{fmt(open.createdAt)}</dd></div>
            </dl>
            <div><p className="text-xs">Message</p><p className="mt-1 rounded-sm bg-surface p-4 text-sm leading-relaxed text-ink">{open.message}</p></div>
            {open.sell && (
              <div className="rounded-sm border border-line p-4 text-sm">
                <p className="font-semibold text-ink">{open.sell.brand} {open.sell.model}</p>
                <p className="mt-1">Condition: {open.sell.condition}</p>
                <p>Expected price: <span className="font-semibold text-ink">{formatPrice(open.sell.expectedPrice)}</span> · City: {open.sell.city}</p>
                {open.sell.photos.length > 0 && (
                  <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {open.sell.photos.map((u, i) => (
                      <li key={u}>
                        <a href={u} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {open.products.length > 0 && (
              <div><p className="text-xs">Products</p><ul className="mt-1 flex flex-wrap gap-2">{open.products.map((p) => <li key={p} className="rounded-full bg-primary-faint px-3 py-1 text-sm font-medium text-primary">{p}</li>)}</ul></div>
            )}
            <div>
              <p className="mb-2 text-xs">Update status</p>
              <div className="grid grid-cols-3 gap-2">
                {(["new", "contacted", "closed"] as const).map((s) => (
                  <Button key={s} variant={open.status === s ? "primary" : "outline"} size="sm" className="capitalize" onClick={() => setStatus(open.id, s)}>{s}</Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-5 sm:flex-row">
              <Button asChild variant="whatsapp" className="flex-1"><a href={`https://wa.me/${open.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-4 w-4" /> Reply on WhatsApp</a></Button>
              <Button asChild variant="outline" className="flex-1"><a href={`tel:${open.phone.replace(/\s/g, "")}`}><Phone className="h-4 w-4" /> Call</a></Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
