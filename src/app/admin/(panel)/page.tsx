import Link from "next/link";
import { Eye, IndianRupee, Inbox, Package, ShoppingBag, ShoppingCart, TrendingUp } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/shell";
import { StatusBadge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { getDashboard } from "@/lib/repo";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
  const total = d.laptops + d.accessories;
  const max = Math.max(1, ...d.weekly);
  const best = d.top[0];

  const stats = [
    { label: "Total products", value: String(total), note: `${d.laptops} clothing, ${d.accessories} accessories`, Icon: Package },
    { label: "Enquiries this month", value: String(d.thisMonth), note: `${d.fresh} waiting for a reply`, Icon: Inbox },
    { label: "Most viewed product", value: best ? best.name : "No views yet", note: best ? `${best.views.toLocaleString("en-IN")} views` : "Views appear as customers browse", Icon: TrendingUp, small: true },
  ];

  const shopStats = [
    { label: "Revenue this month", value: formatPrice(d.shop.revenue), note: `${d.shop.ordersThisMonth} orders`, Icon: IndianRupee, href: "/admin/orders" },
    { label: "Orders to process", value: String(d.shop.toProcess), note: "placed or confirmed", Icon: ShoppingBag, href: "/admin/orders" },
    { label: "Active carts", value: String(d.shop.activeCarts), note: `${d.shop.customers} customers`, Icon: ShoppingCart, href: "/admin/carts" },
  ];

  return (
    <>
      <AutoRefresh every={20000} />
      <AdminPageHeader title="Dashboard" description="A quick look at how the store is doing." />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shopStats.map(({ label, value, note, Icon, href }) => (
          <Link key={label} href={href} className="rounded-2xl border border-line bg-card p-5 shadow-card transition hover:border-primary/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-faint text-primary"><Icon className="h-5 w-5" /></span>
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
            <p className="mt-1 text-sm">{note}</p>
          </Link>
        ))}
      </div>
      {d.shop.lowStock > 0 && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {d.shop.lowStock} product{d.shop.lowStock > 1 ? "s are" : " is"} running low (3 or fewer units left). <Link href="/admin/clothing" className="underline">Check stock</Link>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, value, note, Icon, small }) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-faint text-primary"><Icon className="h-5 w-5" /></span>
            </div>
            <p className={small ? "mt-3 line-clamp-2 text-lg font-bold leading-snug text-ink" : "mt-3 text-3xl font-extrabold tracking-tight text-ink"}>{value}</p>
            <p className="mt-1 text-sm">{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent enquiries</h2>
            <Link href="/admin/enquiries" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          {d.recent.length === 0 ? (
            <p className="py-8 text-center text-sm">No enquiries yet. They will appear here as customers contact you.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {d.recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{e.name}</p>
                    <p className="truncate text-sm">{e.message}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <h2 className="text-base font-semibold">Enquiries per week</h2>
            <div className="mt-5 flex h-32 items-end gap-2" role="img" aria-label={`Enquiries over the last 7 weeks: ${d.weekly.join(", ")}`}>
              {d.weekly.map((v, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <div className="w-full rounded-t-lg bg-primary/80" style={{ height: `${Math.max((v / max) * 100, v ? 6 : 2)}%`, opacity: v ? 1 : 0.25 }} title={`${v}`} />
                  <span className="text-xs">W{i + 1}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <h2 className="text-base font-semibold">Top viewed</h2>
            {d.top.length === 0 ? (
              <p className="py-4 text-sm">Add products to see them here.</p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {d.top.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{p.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{p.views.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
