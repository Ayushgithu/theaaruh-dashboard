import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { fail, ok, publicRoute } from "@/lib/api-helpers";
import { markOrderPaid } from "@/lib/orders";
import { notifyOrder } from "@/lib/order-notify";
import { verifyWebhookSignature } from "@/lib/razorpay";


/**
 * Razorpay Dashboard → Settings → Webhooks → Add: URL = https://YOUR-DASHBOARD/api/razorpay/webhook,
 * secret = RAZORPAY_WEBHOOK_SECRET, events = payment.captured, order.paid, payment.failed.
 *
 * This is the safety net for shoppers who pay but close the tab before the browser confirmation reaches us.
 * markOrderPaid() is idempotent, so it is harmless when the browser already confirmed the payment.
 */
export const POST = publicRoute(async (req) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return fail("Webhook is not configured.", 503);
  const raw = await req.text(); // the signature is computed over the exact raw body
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) return fail("Invalid signature", 401);

  let event: any;
  try { event = JSON.parse(raw); } catch { return fail("Invalid request body.", 400); }
  const type = String(event?.event ?? "");
  if (type !== "payment.captured" && type !== "order.paid") return ok({ ok: true, ignored: true }); // failed attempts: the order simply expires if never paid

  const payment = event?.payload?.payment?.entity;
  const rzpOrderId = String(payment?.order_id ?? event?.payload?.order?.entity?.id ?? "");
  const paymentId = String(payment?.id ?? "");
  if (!rzpOrderId || !paymentId) return ok({ ok: true, ignored: true });

  await connectDB();
  const order: any = await OrderModel.findOne({ "payment.razorpayOrderId": rzpOrderId });
  if (!order) return ok({ ok: true, ignored: true }); // not one of ours (or created by another app on the same account)

  // The amount charged must match what this order asked for: full amount for online orders, the advance for COD.
  const expected = order.payment?.method === "cod" ? order.payment?.advance?.amount : order.total - (order.walletUsed ?? 0);
  if (typeof payment?.amount === "number" && payment.amount !== expected * 100) {
    console.error(`[razorpay-webhook] amount mismatch for ${order.orderNumber}: got ${payment.amount}, expected ${expected * 100}`);
    return ok({ ok: true, ignored: true, reason: "amount-mismatch" }); // 200 so Razorpay does not retry; needs a human to look
  }

  const first = await markOrderPaid(String(order._id), paymentId);
  if (first) {
    const fresh: any = await OrderModel.findById(order._id);
    if (fresh) notifyOrder(fresh.payment?.method === "cod" ? "placed" : "paid", fresh);
  }
  return ok({ ok: true, order: order.orderNumber, updated: first });
});
