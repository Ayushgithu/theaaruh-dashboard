import { IndianRupee, Percent, ShoppingBag, Shirt } from "lucide-react";
import type { Bar, Insights } from "@/lib/insights";
import { formatPrice } from "@/lib/utils";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-card p-5 shadow-card"><h2 className="text-base">{title}</h2>{hint && <p className="mt-0.5 text-xs">{hint}</p>}<div className="mt-4">{children}</div></section>;
}

export function BarList({ rows, unit = "" }: { rows: Bar[]; unit?: string }) {
  if (!rows.length) return <p className="text-sm">No data in this period yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-medium text-ink">{r.label}</span><span className="shrink-0">{r.value}{unit}{r.extra ? ` · ${r.extra}` : ""}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-primary-soft" role="img" aria-label={`${r.label}: ${r.value}`}><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function InsightsView({ data: d }: { data: Insights }) {
  const max = Math.max(1, ...d.daily.map((x) => x.revenue));
  const stats = [
    { label: "Revenue", value: formatPrice(d.totals.revenue), note: `${d.totals.orders} orders · avg ${formatPrice(d.totals.avgOrder)}`, Icon: IndianRupee },
    { label: "Pieces sold", value: String(d.totals.units), note: `${d.totals.cancelled} orders cancelled`, Icon: Shirt },
    { label: "Orders", value: String(d.totals.orders), note: `last ${d.days} days`, Icon: ShoppingBag },
    { label: "Return rate", value: `${d.totals.returnRate}%`, note: `${d.totals.returnedUnits} pieces came back`, Icon: Percent },
  ];
  const topSize = d.sizes[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, Icon }) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">{label}</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-faint text-primary"><Icon className="h-5 w-5" /></span></div>
            <p className="mt-3 text-2xl font-bold text-ink">{value}</p><p className="mt-1 text-xs">{note}</p>
          </div>
        ))}
      </div>

      <Card title="Sales per day" hint="Revenue from paid and confirmed orders">
        <div className="flex h-44 items-end gap-[3px]" role="img" aria-label="Daily revenue chart">
          {d.daily.map((x) => (
            <div key={x.date} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t bg-primary/80 transition group-hover:bg-primary" style={{ height: `${Math.max(x.revenue ? 4 : 1, (x.revenue / max) * 100)}%` }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-card group-hover:block">{x.label}: {formatPrice(x.revenue)} · {x.orders} orders</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px]"><span>{d.daily[0]?.label}</span><span>{d.daily.at(-1)?.label}</span></div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Best-selling sizes" hint={topSize ? `Size ${topSize.label} sells the most — stitch more of it.` : "Which size customers buy most"}><BarList rows={d.sizes} unit=" pcs" /></Card>
        <Card title="Best-selling products"><BarList rows={d.products} unit=" pcs" /></Card>
        <Card title="Popular colours"><BarList rows={d.colors} unit=" pcs" /></Card>
        <Card title="How customers pay"><BarList rows={d.payments} unit=" orders" /></Card>
      </div>

      <h2 className="pt-2 text-xl">Returns &amp; exchanges</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Why things come back" hint="Fix the biggest reason first — size charts, photos or quality."><BarList rows={d.returnReasons} /></Card>
        <Card title="Products returned most"><BarList rows={d.returnProducts} unit=" pcs" /></Card>
        <Card title="Sizes returned most" hint="If one size keeps coming back, check its measurements."><BarList rows={d.returnSizes} unit=" pcs" /></Card>
        <Card title="Return or exchange?"><BarList rows={d.returnTypes} unit=" requests" /></Card>
      </div>
    </div>
  );
}
