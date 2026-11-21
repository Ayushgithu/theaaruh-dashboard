import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { EnquiryModel } from "@/models/Enquiry";
import { adminRoute } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export interface AdminNotification {
  id: string;
  kind: "order" | "enquiry";
  title: string;
  body: string;
  href: string;
  at: string;
}

const DAYS = 7;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Latest store activity for the dashboard bell: new orders and customer enquiries. */
export const GET = adminRoute(async () => {
  await connectDB();
  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000);

  const [orders, enquiries] = await Promise.all([
    OrderModel.find({
      status: { $nin: ["pending_payment", "cancelled"] },
      $or: [{ createdAt: { $gte: since } }, { "payment.paidAt": { $gte: since } }],
    }).sort({ createdAt: -1 }).limit(20).lean(),
    EnquiryModel.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  const items: AdminNotification[] = [

    ...(orders as any[]).map((o): AdminNotification => ({
      id: `order:${o._id}`,
      kind: "order",
      title: `New order ${o.orderNumber}`,
      body: `${o.customer?.name ?? "Customer"} · ${rupees(o.total)} · ${o.payment?.method === "cod" ? "Cash on delivery" : "Paid online"}`,
      href: "/admin/orders",
      // an online order counts from the moment it was paid, not from when the checkout started
      at: new Date(o.payment?.paidAt ?? o.createdAt).toISOString(),
    })),

    ...(enquiries as any[]).map((e): AdminNotification => ({
      id: `enquiry:${e._id}`,
      kind: "enquiry",
      title: `New enquiry · ${e.source}`,
      body: `${e.name} · ${String(e.message ?? "").slice(0, 70)}`,
      href: "/admin/enquiries",
      at: new Date(e.createdAt).toISOString(),
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 25);

  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
});