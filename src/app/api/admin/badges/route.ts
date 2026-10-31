import { connectDB } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { CartModel } from "@/models/Cart";
import { EnquiryModel } from "@/models/Enquiry";
import { ReturnModel } from "@/models/ReturnRequest";
import { adminRoute } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * Counts for the red dots on the admin sidebar. The browser sends, per section, the server time it last looked at that page
 * (?orders=…&carts=…&enquiries=…); we count what arrived after that. A section without a value counts as 0.
 * `now` is returned so the browser stores server time, never its own clock.
 */
export const GET = adminRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const since = (k: string) => { const n = Number(q.get(k)); return Number.isFinite(n) && n > 0 ? new Date(n) : null; };
  const [so, sc, se, sr] = [since("orders"), since("carts"), since("enquiries"), since("returns")];

  await connectDB();
  const [orders, carts, enquiries, returns] = await Promise.all([
    so ? OrderModel.countDocuments({
      status: { $nin: ["pending_payment", "cancelled"] },
      // an online order counts from the moment it was paid
      $or: [{ createdAt: { $gt: so } }, { "payment.paidAt": { $gt: so } }],
    }) : 0,
    // carts where something was ADDED since (removing items does not light the dot)
    sc ? CartModel.countDocuments({ "items.addedAt": { $gt: sc } }) : 0,
    se ? EnquiryModel.countDocuments({ createdAt: { $gt: se } }) : 0,
    sr ? ReturnModel.countDocuments({ createdAt: { $gt: sr } }) : 0,
  ]);

  return Response.json({ now: Date.now(), counts: { orders, carts, enquiries, returns } }, { headers: { "Cache-Control": "no-store" } });
});
