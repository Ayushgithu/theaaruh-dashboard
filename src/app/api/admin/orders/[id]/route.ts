import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { adminOrderUpdateSchema } from "@/lib/validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { cancelOrder } from "@/lib/orders";
import { canTransition } from "@/lib/order-flow";
import { notifyOrder } from "@/lib/order-notify";
import { toOrder } from "@/lib/repo-shop";

export const PATCH = adminRoute(async (req, { params }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Order not found.", 404);
  const v = adminOrderUpdateSchema.parse(await readJson(req));
  await connectDB();

  if (v.status === "cancelled") {
    const cancelled = await cancelOrder(id, { by: "admin", note: v.note });
    notifyOrder("cancelled", cancelled);
    return ok({ order: toOrder(cancelled.toObject()) });
  }

  const order = await OrderModel.findById(id);
  if (!order) throw new HttpError("Order not found.", 404);
  if (!canTransition(order.status, v.status)) throw new HttpError(`An order that is "${order.status.replace("_", " ")}" cannot be changed to "${v.status}".`, 400);

  if (v.status === "shipped") {
    if (!v.trackingNumber) throw new HttpError("Enter the tracking number before marking the order as shipped.", 400);
    order.tracking = { ...(order.tracking?.toObject?.() ?? {}), carrier: v.carrier ?? "", number: v.trackingNumber, url: v.trackingUrl || undefined };
  }
  if (v.status === "delivered" && order.payment.method === "cod") {
    order.payment.status = "paid"; // cash collected on delivery
    order.payment.paidAt = new Date();
  }
  if (v.status === "delivered") order.deliveredAt = new Date(); // starts the return / exchange window
  order.status = v.status;
  order.timeline.push({ status: v.status, at: new Date(), note: v.note });
  await order.save();

  if (v.status === "shipped" || v.status === "delivered") notifyOrder(v.status, order);
  return ok({ order: toOrder(order.toObject()) });
});
