import { z } from "zod";
import { connectDB } from "./db";
import { ReturnModel } from "@/models/ReturnRequest";
import { OrderModel } from "@/models/Order";
import { ProductModel } from "@/models/Product";
import { HttpError } from "./api-helpers";
import { putBack } from "./orders";
import { razorpay, razorpayConfigured } from "./razorpay";
import { getRules } from "./settings";
import { createReturnPickup } from "./shiprocket";
import { creditWallet } from "./wallet";
import { UserModel } from "@/models/User";
import { notifyReturn } from "./return-notify";
import { toReturn } from "./repo-returns";
import type { ReturnRequest } from "./types";


export const returnActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("reject"), note: z.string().trim().min(3, "Tell the customer why").max(300) }),
  z.object({ action: z.literal("pickup"), carrier: z.string().trim().max(60).optional(), awb: z.string().trim().min(3, "Enter the tracking number").max(60), url: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("shiprocket_pickup") }),
  z.object({ action: z.literal("received"), restock: z.boolean().default(true) }),
  z.object({ action: z.literal("refund"), amount: z.coerce.number().int().min(1).max(1_000_000), method: z.enum(["razorpay", "manual", "wallet"]), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("exchange_ship"), carrier: z.string().trim().max(60).optional(), awb: z.string().trim().max(60).optional(), url: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("note"), note: z.string().trim().max(500) }),
]);
export type ReturnAction = z.infer<typeof returnActionSchema>;

const FLOW: Record<string, string[]> = {
  approve: ["requested"], reject: ["requested", "approved"], pickup: ["approved"], shiprocket_pickup: ["approved"],
  received: ["approved", "pickup_scheduled"], refund: ["approved", "pickup_scheduled", "received"], exchange_ship: ["approved", "pickup_scheduled", "received"], note: [],
};

/** Money that can still be refunded for an order: its total minus what earlier return refunds already paid out. */
export async function refundableLeft(orderId: string, total: number, excludeId?: string) {
  const prior: any[] = await ReturnModel.find({ order: orderId, status: "refunded", ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).select("refund").lean();
  return Math.max(0, total - prior.reduce((n, p) => n + (p.refund?.amount ?? 0), 0));
}

export async function applyReturnAction(id: string, a: ReturnAction, adminName: string): Promise<ReturnRequest> {
  await connectDB();
  const doc: any = await ReturnModel.findById(id);
  if (!doc) throw new HttpError("Return request not found.", 404);
  if (FLOW[a.action].length && !FLOW[a.action].includes(doc.status)) throw new HttpError(`This request is "${doc.status.replace("_", " ")}", so it cannot be changed with "${a.action.replace("_", " ")}".`, 409);
  if (a.action === "refund" && doc.type !== "return") throw new HttpError("Exchanges are not refunded. Mark the replacement as shipped instead.", 400);
  if (a.action === "exchange_ship" && doc.type !== "exchange") throw new HttpError("Only exchange requests have a replacement to ship.", 400);
  const at = new Date();
  const push = (status: string, note?: string) => doc.timeline.push({ status, at, note, by: adminName });
  let email: "approved" | "rejected" | "received" | "refunded" | "exchange_shipped" | null = null;

  switch (a.action) {
    case "approve": doc.status = "approved"; push("approved", a.note || "Request approved"); doc.adminNote = a.note || doc.adminNote; email = "approved"; break;
    case "reject": doc.status = "rejected"; doc.adminNote = a.note; push("rejected", a.note); email = "rejected"; break;
    case "note": doc.adminNote = a.note; push(doc.status, `Note: ${a.note}`); break;
    case "pickup": doc.pickup = { carrier: a.carrier, awb: a.awb, url: a.url }; doc.status = "pickup_scheduled"; push("pickup_scheduled", `Pickup arranged${a.carrier ? ` with ${a.carrier}` : ""} (${a.awb})`); email = "approved"; break;
    case "shiprocket_pickup": {
      const order: any = await OrderModel.findById(doc.order).select("address").lean();
      if (!order) throw new HttpError("The original order no longer exists.", 404);
      const rules = await getRules();
      const p = await createReturnPickup({ number: doc.number, customer: doc.customer, pickup: order.address, items: doc.items.map((i: any) => ({ name: i.name, slug: i.slug, size: i.size, quantity: i.quantity, price: i.price })) }, rules.shipment);
      doc.pickup = { carrier: p.courier, awb: p.awb, url: p.awb ? `https://shiprocket.co/tracking/${p.awb}` : undefined, shiprocketOrderId: p.orderId, shipmentId: p.shipmentId };
      doc.status = "pickup_scheduled"; push("pickup_scheduled", `Reverse pickup booked with Shiprocket${p.awb ? ` (${p.awb})` : " — assign a courier in Shiprocket"}`); email = "approved"; break;
    }
    case "received":
      if (a.restock && !doc.restocked) { for (const i of doc.items) await putBack(String(i.product), i.quantity, i.size || undefined); doc.restocked = true; }
      doc.status = "received"; push("received", a.restock ? "Item received and put back in stock" : "Item received (not restocked)"); email = "received"; break;
    case "refund": {
      const order: any = await OrderModel.findById(doc.order).select("total payment").lean();
      if (!order) throw new HttpError("The original order no longer exists.", 404);
      const left = await refundableLeft(String(doc.order), order.total, String(doc._id));
      if (a.amount > left) throw new HttpError(`You can refund at most ₹${left} for this order (the rest was refunded already).`, 400);
      let refundId: string | undefined;
      let bonus = 0;
      if (a.method === "wallet") {
        const rules = await getRules();
        if (!rules.wallet.enabled) throw new HttpError("The wallet is switched off in Store rules.", 400);
        const u: any = await UserModel.findById(doc.user).select("guest").lean();
        if (!u || u.guest) throw new HttpError("Guest shoppers do not have a wallet. Refund them manually or through Razorpay.", 400);
        bonus = Math.floor((a.amount * rules.wallet.bonusPercent) / 100);
        await creditWallet(String(doc.user), a.amount, { type: "refund", note: `Refund for ${doc.number}`, order: String(doc.order), returnRequest: String(doc._id), by: adminName });
        if (bonus > 0) await creditWallet(String(doc.user), bonus, { type: "bonus", note: `${rules.wallet.bonusPercent}% bonus on ${doc.number}`, order: String(doc.order), returnRequest: String(doc._id), by: adminName });
      }
      if (a.method === "razorpay") {
        const paymentId = order.payment?.method === "razorpay" && order.payment?.status === "paid" ? order.payment.razorpayPaymentId : order.payment?.advance?.status === "paid" ? order.payment.advance.razorpayPaymentId : null;
        if (!paymentId || !razorpayConfigured()) throw new HttpError("This order was not paid online, so it cannot be refunded through Razorpay. Choose “Refunded manually” and pay the customer by UPI/bank transfer.", 400);
        try { refundId = (await razorpay().payments.refund(paymentId, { amount: a.amount * 100, speed: "normal", notes: { return: doc.number } }) as any).id; }
        catch (e: any) { throw new HttpError(`Razorpay could not process the refund: ${e?.error?.description ?? "payment provider error"}.`, 502); }
      }
      doc.refund = { amount: a.amount, bonus: bonus || undefined, method: a.method, refundId, note: a.note, at };
      doc.status = "refunded"; push("refunded", a.method === "wallet" ? `₹${a.amount + bonus} added to the customer's wallet${bonus ? ` (₹${bonus} bonus)` : ""}` : `₹${a.amount} refunded${a.method === "manual" ? " manually" : " via Razorpay"}`); email = "refunded"; break;
    }
    case "exchange_ship": {
      const it = doc.items[0];
      const size = doc.exchangeTo?.size;
      if (size) {
        const r = await ProductModel.updateOne({ _id: it.product, sizes: { $elemMatch: { label: size, qty: { $gte: it.quantity } } } }, { $inc: { "sizes.$.qty": -it.quantity, quantity: -it.quantity } });
        if (r.modifiedCount !== 1) throw new HttpError(`Size ${size} of "${it.name}" is out of stock, so the replacement cannot be shipped.`, 409);
      }
      doc.exchangeShipment = { carrier: a.carrier, awb: a.awb, url: a.url };
      doc.status = "exchange_shipped"; push("exchange_shipped", `Replacement shipped${size ? ` (size ${size})` : ""}`); email = "exchange_shipped"; break;
    }
  }
  await doc.save();
  const rr = toReturn(doc.toObject());
  if (email) notifyReturn(email, rr);
  return rr;
}
