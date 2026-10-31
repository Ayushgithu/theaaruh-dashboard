import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { HttpError, adminRoute, ok } from "@/lib/api-helpers";
import { getRules } from "@/lib/settings";
import { shipOrder } from "@/lib/shiprocket";
import { notifyOrder } from "@/lib/order-notify";
import { toOrder } from "@/lib/repo-shop";

/** One click: create the shipment in Shiprocket, assign a courier + AWB, schedule pickup, save the label and tracking, mark the order shipped. */
export const POST = adminRoute(async (_req, { params }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Order not found.", 404);
  await connectDB();
  const order = await OrderModel.findById(id);
  if (!order) throw new HttpError("Order not found.", 404);
  if (!["placed", "confirmed"].includes(order.status)) throw new HttpError(`A "${order.status.replace("_", " ")}" order cannot be shipped.`, 400);
  if (order.tracking?.shiprocketOrderId) throw new HttpError("This order already has a Shiprocket shipment.", 409);

  const rules = await getRules();
  const r = await shipOrder({
    orderNumber: order.orderNumber, createdAt: order.createdAt,
    customer: { name: order.customer.name, email: order.customer.email, phone: order.customer.phone },
    address: order.address.toObject?.() ?? order.address,
    items: order.items.map((i: any) => ({ name: i.name, slug: i.slug, size: i.size, quantity: i.quantity, price: i.price })),
    total: order.total, subtotal: order.subtotal, shipping: order.shipping,
    paymentMethod: order.payment.method, advancePaid: order.payment.advance?.status === "paid" ? order.payment.advance.amount : 0,
  }, rules.shipment);

  order.tracking = { carrier: r.courier, number: r.awb, url: `https://shiprocket.co/tracking/${encodeURIComponent(r.awb)}`, labelUrl: r.labelUrl, shiprocketOrderId: r.orderId, shipmentId: r.shipmentId };
  if (order.status === "placed") order.timeline.push({ status: "confirmed", at: new Date(), note: "Confirmed" });
  order.status = "shipped";
  order.timeline.push({ status: "shipped", at: new Date(), note: `Shipped with ${r.courier || "courier"} (AWB ${r.awb})` });
  await order.save();
  notifyOrder("shipped", order);
  return ok({ order: toOrder(order.toObject()), warnings: r.warnings });
});
