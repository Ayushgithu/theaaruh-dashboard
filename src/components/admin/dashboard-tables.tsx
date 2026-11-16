import Link from "next/link";
import type { Order, Product } from "@/lib/types";
import { formatPrice, timeAgo } from "@/lib/utils";
import { OrderStatusBadge, PaymentBadge } from "@/components/shared/order-ui";
import { StockBadge } from "@/components/ui/badge";

export type RecentCustomer = { id: string; name: string; email: string; phone: string; createdAt: string };

/* Same pattern as the full admin pages: a table from md up, stacked cards on phones. */
const wrap = "hidden overflow-x-auto rounded-sm border border-line bg-card shadow-card md:block";
const head = "bg-surface text-left text-xs font-semibold text-body";
const th = "px-4 py-3";
const cardCls = "rounded-sm border border-line bg-card p-4 shadow-card";
const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Section({ title, href, linkLabel = "View all", children }: { title: string; href: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-primary hover:underline">{linkLabel}</Link>
      </div>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="rounded-sm border border-dashed border-line bg-card px-4 py-8 text-center text-sm">{text}</p>;

export function RecentOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <Section title="Recent orders" href="/admin/orders">
      {orders.length === 0 ? <Empty text="No orders yet. They appear here as soon as customers buy." /> : (
        <>
          <div className={wrap}>
            <table className="w-full min-w-[560px] text-sm">
              <thead className={head}><tr><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Total</th><th className={th}>Payment</th><th className={th}>Status</th><th className={th}>Placed</th></tr></thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3 font-semibold text-ink"><Link href="/admin/orders" className="hover:underline">{o.orderNumber}</Link></td>
                    <td className="px-4 py-3"><p className="font-medium text-ink">{o.customer.name}</p><p className="text-xs">{o.customer.phone}</p></td>
                    <td className="px-4 py-3 font-semibold text-ink">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3"><PaymentBadge order={o} /></td>
                    <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3">{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href="/admin/orders" className={`block ${cardCls}`}>
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold text-ink">{o.orderNumber}</p><OrderStatusBadge status={o.status} /></div>
                  <p className="mt-1 text-sm">{o.customer.name} · {formatPrice(o.total)}</p>
                  <p className="mt-1 line-clamp-1 text-xs">{o.items.map((i) => i.name).join(", ")}</p>
                  <p className="mt-2 text-xs">{timeAgo(o.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

export function RecentCustomersTable({ customers }: { customers: RecentCustomer[] }) {
  return (
    <Section title="New customers" href="/admin/customers">
      {customers.length === 0 ? <Empty text="Customers appear here after they create an account." /> : (
        <>
          <div className={wrap}>
            <table className="w-full min-w-[420px] text-sm">
              <thead className={head}><tr><th className={th}>Customer</th><th className={th}>Phone</th><th className={th}>Joined</th></tr></thead>
              <tbody className="divide-y divide-line">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3"><p className="font-semibold text-ink">{c.name}</p><p className="max-w-[14rem] truncate text-xs">{c.email}</p></td>
                    <td className="px-4 py-3">{c.phone}</td>
                    <td className="whitespace-nowrap px-4 py-3">{date(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {customers.map((c) => (
              <li key={c.id} className={cardCls}>
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="truncate text-sm">{c.email} · {c.phone}</p>
                <p className="mt-2 text-xs">Joined {date(c.createdAt)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

export function LowStockTable({ products }: { products: Product[] }) {
  if (products.length === 0) return null; // nothing to restock: don't take up space
  return (
    <Section title="Running low" href="/admin/clothing" linkLabel="Manage stock">
      <div className={wrap}>
        <table className="w-full min-w-[420px] text-sm">
          <thead className={head}><tr><th className={th}>Product</th><th className={th}>Price</th><th className={th}>Stock</th></tr></thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3"><p className="font-semibold text-ink">{p.name}</p><p className="text-xs">{p.category}</p></td>
                <td className="px-4 py-3 font-semibold text-ink">{formatPrice(p.price)}</td>
                <td className="px-4 py-3"><StockBadge stock="low" count={p.quantity} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {products.map((p) => (
          <li key={p.id} className={`${cardCls} flex items-center justify-between gap-3`}>
            <div className="min-w-0"><p className="truncate font-semibold text-ink">{p.name}</p><p className="text-xs">{formatPrice(p.price)} · {p.category}</p></div>
            <StockBadge stock="low" count={p.quantity} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
