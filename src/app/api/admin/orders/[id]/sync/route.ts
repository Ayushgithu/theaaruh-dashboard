import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { HttpError, adminRoute, ok } from "@/lib/api-helpers";
import { trackAwb } from "@/lib/shiprocket";
import { applyTrackingEvents } from "@/lib/tracking-sync";
import { notifyOrder } from "@/lib/order-notify";
import { toOrder } from "@/lib/repo-shop";

/** Pulls the latest scans from the courier (the webhook does this automatically; this is the manual refresh). */
export const POST = adminRoute(async (_req, { params }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Order not found.", 404);
  await connectDB();
  const order = await OrderModel.findById(id);
  if (!order?.tracking?.number) throw new HttpError("This order has no tracking number yet.", 400);
  const t = await trackAwb(order.tracking.number);
  const send = applyTrackingEvents(order, t.events.map((e) => ({ status: e.status, at: new Date(e.at), location: e.location, note: e.note })), t.status);
  await order.save();
  if (send) notifyOrder(send, order);
  return ok({ order: toOrder(order.toObject()), status: t.status });
});
