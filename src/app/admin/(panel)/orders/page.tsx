import { OrdersAdmin } from "@/components/admin/orders-admin";
import { getAdminOrders } from "@/lib/repo-shop";
import { releaseExpiredOrders } from "@/lib/orders";
import { shiprocketConfigured } from "@/lib/shiprocket";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await releaseExpiredOrders(); // unpaid online orders give their stock back after 30 minutes
  return <OrdersAdmin initial={await getAdminOrders()} shiprocket={shiprocketConfigured()} />;
}
