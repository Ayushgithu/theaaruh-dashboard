import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { ReturnModel } from "@/models/ReturnRequest";
import { fail, ok, publicRoute, readJson } from "@/lib/api-helpers";
import { parseCourierDate } from "@/lib/shiprocket";
import { applyTrackingEvents } from "@/lib/tracking-sync";
import { notifyOrder } from "@/lib/order-notify";


/**
 * Shiprocket → Settings → API → Webhooks: URL = https://YOUR-DASHBOARD/api/shiprocket/webhook, and a token of your choice
 * (the same value as SHIPROCKET_WEBHOOK_TOKEN). Every courier scan then updates the order and the customer's tracking page.
 */
export const POST = publicRoute(async (req) => {
  const token = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!token) return fail("Webhook is not configured.", 503);
  if (req.headers.get("x-api-key") !== token) return fail("Unauthorized", 401);
  const b: any = await readJson(req);
  const awb = String(b.awb ?? "").trim();
  const statusText = String(b.current_status ?? b.shipment_status ?? "").trim();
  if (!awb || !statusText) return ok({ ok: true, ignored: true });

  await connectDB();
  const at = parseCourierDate(b.current_timestamp);
  const events = [{ status: statusText, at, location: b.scans?.[0]?.location || undefined, note: b.scans?.[0]?.activity || undefined }];

  const order = await OrderModel.findOne({ "tracking.number": awb });
  if (order) {
    const send = applyTrackingEvents(order, events, statusText);
    await order.save();
    if (send) notifyOrder(send, order);
    return ok({ ok: true, order: order.orderNumber });
  }

  // a reverse pickup (customer → you): note it on the return request, and mark it received when the courier delivers it to the warehouse
  const ret = await ReturnModel.findOne({ "pickup.awb": awb });
  if (ret) {
    ret.timeline.push({ status: ret.status, at, note: `Courier: ${statusText}`, by: "Shiprocket" });
    if (/\bDELIVERED\b/i.test(statusText) && ["approved", "pickup_scheduled"].includes(ret.status)) { ret.status = "received"; ret.timeline.push({ status: "received", at, note: "Item reached the warehouse (courier update)", by: "Shiprocket" }); }
    await ret.save();
  }
  return ok({ ok: true });
});
