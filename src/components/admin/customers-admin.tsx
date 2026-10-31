"use client";
import * as React from "react";
import { Loader2, Search, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { postJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/drawer";
import type { Customer } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { Field, Input } from "@/components/ui/form";
import { AdminPageHeader } from "./shell";

export function CustomersAdmin({ initial }: { initial: Customer[] }) {
  const [rows, setRows] = React.useState(initial);
  const [q, setQ] = React.useState("");
  const [adj, setAdj] = React.useState<Customer | null>(null);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const adjust = async (sign: 1 | -1) => {
    if (!adj) return;
    setBusy(true);
    try {
      const { balance } = await postJson<{ balance: number }>(`/api/admin/customers/${adj.id}/wallet`, { amount: sign * Number(amount), note });
      setRows((c) => c.map((x) => (x.id === adj.id ? { ...x, wallet: balance } : x)));
      toast.success(sign > 0 ? "Credit added" : "Credit removed", { description: `${adj.name}'s wallet is now ${formatPrice(balance)}.` });
      setAdj(null); setAmount(""); setNote("");
    } catch (e) { toast.error("Could not change the wallet", { description: e instanceof Error ? e.message : "Please try again." }); }
    setBusy(false);
  };
  const list = rows.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <AdminPageHeader title="Customers" description={`${rows.length} registered ${rows.length === 1 ? "customer" : "customers"}`} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" className="pl-10" aria-label="Search customers" />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-faint text-primary"><Users className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">{rows.length === 0 ? "No customers yet" : "Nothing matches your search"}</h2>
          <p className="mt-1 text-sm">{rows.length === 0 ? "Customers appear here after they create an account." : "Try a different name or number."}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card shadow-card md:block">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-surface text-left text-xs font-semibold text-body"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Spent</th><th className="px-4 py-3">Cart</th><th className="px-4 py-3">Wallet</th></tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3"><p className="font-semibold text-ink">{c.name}</p><p className="text-xs">{c.email}</p></td>
                    <td className="px-4 py-3">{c.phone}</td>
                    <td className="whitespace-nowrap px-4 py-3">{date(c.createdAt)}</td>
                    <td className="px-4 py-3">{c.orders}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{formatPrice(c.spent)}</td>
                    <td className="px-4 py-3">{c.carts ? <span className="rounded-full bg-primary-faint px-2.5 py-1 text-xs font-semibold text-primary">Has items</span> : "—"}</td>
                    <td className="px-4 py-3"><span className="font-semibold text-ink">{formatPrice(c.wallet)}</span> <Button variant="ghost" size="sm" aria-label={`Adjust wallet of ${c.name}`} onClick={() => setAdj(c)}><Wallet className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {list.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-card p-4 shadow-card">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-sm">{c.email} · {c.phone}</p>
                <p className="mt-2 text-xs">{c.orders} order(s) · {formatPrice(c.spent)} · joined {date(c.createdAt)}</p>
                <p className="mt-1 flex items-center gap-2 text-xs">Wallet {formatPrice(c.wallet)} <Button variant="ghost" size="sm" aria-label={`Adjust wallet of ${c.name}`} onClick={() => setAdj(c)}><Wallet className="h-4 w-4" /></Button></p>
              </li>
            ))}
          </ul>
        </>
      )}
      <Dialog open={!!adj} onClose={() => setAdj(null)} title={adj ? `Wallet · ${adj.name}` : ""}>
        {adj && (
          <div className="space-y-4">
            <p className="text-sm">Current balance: <strong className="text-ink">{formatPrice(adj.wallet)}</strong>. Use this to gift credit (a sorry gift, a festival bonus) or to correct a mistake. Every change is recorded in the customer's wallet history.</p>
            <Field label="Amount (₹)"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} aria-label="Amount" /></Field>
            <Field label="Reason (the customer can see it)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Festival gift" aria-label="Reason" /></Field>
            <div className="flex flex-wrap gap-2"><Button disabled={busy || !Number(amount) || note.trim().length < 3} onClick={() => adjust(1)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add credit</Button><Button variant="dangerSoft" disabled={busy || !Number(amount) || note.trim().length < 3} onClick={() => adjust(-1)}>Remove credit</Button></div>
          </div>
        )}
      </Dialog>
    </>
  );
}
