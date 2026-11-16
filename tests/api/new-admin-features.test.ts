// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";


vi.mock("@/lib/auth", () => ({ getSession: vi.fn(), createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
const box = vi.hoisted(() => ({ rules: null as any, saved: null as any }));
vi.mock("@/lib/settings", () => ({ getRules: async () => box.rules, saveRules: async (r: any) => { box.saved = r; return r; } }));
vi.mock("@/lib/return-notify", () => ({ notifyReturn: vi.fn() }));
vi.mock("@/lib/order-notify", () => ({ notifyOrder: vi.fn() }));
vi.mock("@/lib/orders", () => ({ putBack: vi.fn(), markOrderPaid: vi.fn() }));
const rp = vi.hoisted(() => ({ refund: vi.fn() }));
vi.mock("@/lib/razorpay", async (orig) => ({ ...(await orig<typeof import("@/lib/razorpay")>()), razorpayConfigured: () => true, razorpay: () => ({ payments: { refund: rp.refund } }) }));
vi.mock("@/models/ReturnRequest", () => ({ ReturnModel: { findById: vi.fn(), find: vi.fn(), findOne: vi.fn() } }));
vi.mock("@/models/Order", () => ({ OrderModel: { findById: vi.fn(), findOne: vi.fn() } }));
vi.mock("@/models/Product", () => ({ ProductModel: { updateOne: vi.fn(), create: vi.fn(), exists: vi.fn() } }));
const sr = vi.hoisted(() => ({ ship: vi.fn(), pickup: vi.fn() }));
vi.mock("@/lib/shiprocket", async (orig) => ({ ...(await orig<typeof import("@/lib/shiprocket")>()), shipOrder: sr.ship, createReturnPickup: sr.pickup, shiprocketConfigured: () => true }));

import { getSession } from "@/lib/auth";
import { putBack } from "@/lib/orders";
import { notifyReturn } from "@/lib/return-notify";
import { notifyOrder } from "@/lib/order-notify";
import { ReturnModel } from "@/models/ReturnRequest";
import { OrderModel } from "@/models/Order";
import { ProductModel } from "@/models/Product";
import { mergeRules } from "@/lib/rules";
import { GET as rulesGet, PUT as rulesPut } from "@/app/api/admin/store-rules/route";
import { POST as returnAction } from "@/app/api/admin/returns/[id]/route";
import { POST as shipRoute } from "@/app/api/admin/orders/[id]/ship/route";
import { POST as webhook } from "@/app/api/shiprocket/webhook/route";
import { POST as bulk } from "@/app/api/admin/products/bulk/route";
import { ID, ctx, jsonReq } from "./utils";

const Return = ReturnModel as any, Order = OrderModel as any, Product = ProductModel as any;
const admin = { id: "a1", email: "o@s.com", name: "Owner" };

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(admin);
  box.rules = mergeRules(null);
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(admin);
});

/* ------------------------------------------------------------ store rules */
const validRules = () => JSON.parse(JSON.stringify(mergeRules(null)));
describe("store rules API", () => {
  it("is admin-only", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);
    expect((await rulesGet(jsonReq("/x", "GET"), ctx())).status).toBe(401);
    expect((await rulesPut(jsonReq("/x", "PUT", validRules()), ctx())).status).toBe(401);
  });
  it("saves valid rules and fills in defaults", async () => {
    const body = validRules(); body.cod.advance = 150; body.cod.blockedPincodes = ["7941", "110001*"]; body.returns.returnDays = 10;
    const res = await rulesPut(jsonReq("/x", "PUT", body), ctx());
    expect(res.status).toBe(200);
    expect(box.saved.cod).toMatchObject({ advance: 150, blockedPincodes: ["7941", "110001*"] });
    expect(box.saved.returns.returnDays).toBe(10);
  });
  it("rejects bad pincodes, empty reason lists and impossible size ranges", async () => {
    let b = validRules(); b.cod.blockedPincodes = ["abc"];
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(400);
    b = validRules(); b.returns.reasons = [];
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(400);
    b = validRules(); b.sizeAdvisor.rows[0].minHeight = 170; b.sizeAdvisor.rows[0].maxHeight = 150;
    const r = await rulesPut(jsonReq("/x", "PUT", b), ctx());
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/minimum/);
  });
  it("a sale countdown needs a future end time", async () => {
    const b = validRules(); b.saleTimer = { ...b.saleTimer, active: true, endsAt: new Date(Date.now() - 1000).toISOString() };
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(400);
    b.saleTimer.endsAt = new Date(Date.now() + 86_400_000).toISOString();
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(200);
  });
});

/* ------------------------------------------------------------ returns: admin actions */
const retDoc = (over: any = {}) => {
  const d: any = {
    _id: ID, number: "RT-1", order: "o1", orderNumber: "OD-1", user: "u1", customer: { name: "Ravi", email: "r@x.com", phone: "9876543210" }, type: "return", reason: "Size is too small", photos: [],
    items: [{ index: 0, product: "p1", slug: "suit", name: "Suit", size: "M", price: 1000, quantity: 2 }], status: "requested", timeline: [] as any[], restocked: false, ...over,
  };
  d.save = vi.fn(); d.toObject = () => ({ ...d, createdAt: new Date() });
  return d;
};
const act = (body: any) => returnAction(jsonReq(`/api/admin/returns/${ID}`, "POST", body), ctx({ id: ID }));

describe("return request actions", () => {
  it("approve → emails the customer and logs who did it", async () => {
    const d = retDoc(); Return.findById.mockResolvedValue(d);
    const res = await act({ action: "approve" });
    expect(res.status).toBe(200);
    expect(d.status).toBe("approved");
    expect(d.timeline.at(-1)).toMatchObject({ status: "approved", by: "Owner" });
    expect(notifyReturn).toHaveBeenCalledWith("approved", expect.anything());
  });
  it("reject needs a reason for the customer", async () => {
    Return.findById.mockResolvedValue(retDoc());
    expect((await act({ action: "reject" })).status).toBe(400);
    const d = retDoc(); Return.findById.mockResolvedValue(d);
    expect((await act({ action: "reject", note: "Item was worn" })).status).toBe(200);
    expect(d).toMatchObject({ status: "rejected", adminNote: "Item was worn" });
  });
  it("steps cannot be skipped (can't refund a request that is only 'requested')", async () => {
    Return.findById.mockResolvedValue(retDoc());
    const res = await act({ action: "refund", amount: 1000, method: "manual" });
    expect(res.status).toBe(409);
  });
  it("received puts the pieces back into the right size, unless the owner unticks it", async () => {
    const d = retDoc({ status: "approved" }); Return.findById.mockResolvedValue(d);
    await act({ action: "received", restock: true });
    expect(putBack).toHaveBeenCalledWith("p1", 2, "M");
    expect(d).toMatchObject({ status: "received", restocked: true });
    vi.mocked(putBack).mockClear();
    const d2 = retDoc({ status: "approved" }); Return.findById.mockResolvedValue(d2);
    await act({ action: "received", restock: false });
    expect(putBack).not.toHaveBeenCalled();
  });
  describe("refund", () => {
    const setup = (order: any, prior: any[] = []) => {
      Order.findById.mockReturnValue({ select: () => ({ lean: async () => order }) });
      Return.find.mockReturnValue({ select: () => ({ lean: async () => prior }) });
    };
    const paid = { total: 2500, payment: { method: "razorpay", status: "paid", razorpayPaymentId: "pay_1" } };
    it("online orders are refunded through Razorpay, in paise", async () => {
      setup(paid); const d = retDoc({ status: "received" }); Return.findById.mockResolvedValue(d);
      rp.refund.mockResolvedValue({ id: "rfnd_1" });
      expect((await act({ action: "refund", amount: 2000, method: "razorpay" })).status).toBe(200);
      expect(rp.refund).toHaveBeenCalledWith("pay_1", expect.objectContaining({ amount: 200000 }));
      expect(d).toMatchObject({ status: "refunded", refund: expect.objectContaining({ amount: 2000, method: "razorpay", refundId: "rfnd_1" }) });
    });
    it("cannot refund more than the order total minus earlier refunds", async () => {
      setup(paid, [{ refund: { amount: 1000 } }]); Return.findById.mockResolvedValue(retDoc({ status: "received" }));
      const res = await act({ action: "refund", amount: 2000, method: "razorpay" });
      expect(res.status).toBe(400);
      expect(rp.refund).not.toHaveBeenCalled();
    });
    it("a COD order cannot be refunded online, but can be recorded as refunded manually", async () => {
      setup({ total: 2000, payment: { method: "cod", status: "paid" } }); Return.findById.mockResolvedValue(retDoc({ status: "received" }));
      expect((await act({ action: "refund", amount: 1000, method: "razorpay" })).status).toBe(400);
      const d = retDoc({ status: "received" }); Return.findById.mockResolvedValue(d);
      expect((await act({ action: "refund", amount: 1000, method: "manual", note: "UPI ref 123" })).status).toBe(200);
      expect(d.refund).toMatchObject({ method: "manual", note: "UPI ref 123" });
    });
    it("a failed Razorpay refund keeps the request open", async () => {
      setup(paid); const d = retDoc({ status: "received" }); Return.findById.mockResolvedValue(d);
      rp.refund.mockRejectedValue({ error: { description: "Insufficient balance" } });
      const res = await act({ action: "refund", amount: 1000, method: "razorpay" });
      expect(res.status).toBe(502);
      expect(d.status).toBe("received");
    });
    it("exchanges are not refunded", async () => {
      setup(paid); Return.findById.mockResolvedValue(retDoc({ status: "received", type: "exchange" }));
      expect((await act({ action: "refund", amount: 100, method: "manual" })).status).toBe(400);
    });
  });
  describe("exchange shipping", () => {
    it("takes the replacement size out of stock and records the shipment", async () => {
      const d = retDoc({ status: "received", type: "exchange", exchangeTo: { size: "L" } }); Return.findById.mockResolvedValue(d);
      Product.updateOne.mockResolvedValue({ modifiedCount: 1 });
      expect((await act({ action: "exchange_ship", carrier: "Delhivery", awb: "AWB9" })).status).toBe(200);
      expect(Product.updateOne).toHaveBeenCalledWith({ _id: "p1", sizes: { $elemMatch: { label: "L", qty: { $gte: 2 } } } }, { $inc: { "sizes.$.qty": -2, quantity: -2 } });
      expect(d).toMatchObject({ status: "exchange_shipped", exchangeShipment: { carrier: "Delhivery", awb: "AWB9" } });
    });
    it("refuses when the new size sold out meanwhile", async () => {
      const d = retDoc({ status: "approved", type: "exchange", exchangeTo: { size: "L" } }); Return.findById.mockResolvedValue(d);
      Product.updateOne.mockResolvedValue({ modifiedCount: 0 });
      expect((await act({ action: "exchange_ship" })).status).toBe(409);
      expect(d.status).toBe("approved");
    });
  });
  it("books a Shiprocket reverse pickup", async () => {
    const d = retDoc({ status: "approved" }); Return.findById.mockResolvedValue(d);
    Order.findById.mockReturnValue({ select: () => ({ lean: async () => ({ address: { name: "Ravi", phone: "9876543210", line1: "x", city: "Pune", state: "MH", pincode: "411001" } }) }) });
    sr.pickup.mockResolvedValue({ orderId: "1", shipmentId: "2", awb: "AWB77", courier: "Xpressbees" });
    expect((await act({ action: "shiprocket_pickup" })).status).toBe(200);
    expect(d).toMatchObject({ status: "pickup_scheduled", pickup: expect.objectContaining({ awb: "AWB77", carrier: "Xpressbees" }) });
  });
});

/* ------------------------------------------------------------ Shiprocket one-click ship */
describe("POST /api/admin/orders/:id/ship", () => {
  const orderDoc = (over: any = {}) => { const d: any = { _id: ID, orderNumber: "OD-1", status: "confirmed", createdAt: new Date(), customer: { name: "Ravi", email: "r@x.com", phone: "9876543210" }, address: { name: "Ravi", phone: "9876543210", line1: "x", city: "Pune", state: "MH", pincode: "411001" }, items: [{ name: "Suit", slug: "suit", size: "M", quantity: 1, price: 1000 }], total: 1079, subtotal: 1000, shipping: 79, payment: { method: "cod", status: "pending", advance: { amount: 100, status: "paid" } }, timeline: [] as any[], ...over }; d.save = vi.fn(); d.toObject = () => d; return d; };
  it("creates the shipment, saves AWB + label, marks shipped and emails the customer; COD advance is deducted", async () => {
    const d = orderDoc(); Order.findById.mockResolvedValue(d);
    sr.ship.mockResolvedValue({ orderId: "11", shipmentId: "22", awb: "AWB1", courier: "Delhivery", labelUrl: "https://l/1.pdf", warnings: [] });
    const res = await shipRoute(jsonReq("/x", "POST", {}), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(sr.ship.mock.calls[0][0]).toMatchObject({ paymentMethod: "cod", advancePaid: 100, total: 1079 });
    expect(d.status).toBe("shipped");
    expect(d.tracking).toMatchObject({ carrier: "Delhivery", number: "AWB1", labelUrl: "https://l/1.pdf", shiprocketOrderId: "11" });
    expect(notifyOrder).toHaveBeenCalledWith("shipped", d);
  });
  it("won't ship twice or ship cancelled / unpaid orders", async () => {
    Order.findById.mockResolvedValue(orderDoc({ tracking: { shiprocketOrderId: "9" } }));
    expect((await shipRoute(jsonReq("/x", "POST", {}), ctx({ id: ID }))).status).toBe(409);
    Order.findById.mockResolvedValue(orderDoc({ status: "pending_payment" }));
    expect((await shipRoute(jsonReq("/x", "POST", {}), ctx({ id: ID }))).status).toBe(400);
    expect(sr.ship).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------ Shiprocket webhook */
describe("POST /api/shiprocket/webhook", () => {
  const hook = (body: any, key?: string) => webhook(jsonReq("/api/shiprocket/webhook", "POST", body, key ? { "x-api-key": key } : {}), ctx());
  const od = (over: any = {}) => { const d: any = { orderNumber: "OD-1", status: "shipped", payment: { method: "cod", status: "pending" }, timeline: [] as any[], trackingEvents: [] as any[], ...over }; d.save = vi.fn(); return d; };
  beforeEach(() => { vi.stubEnv("SHIPROCKET_WEBHOOK_TOKEN", "tok123"); });
  it("rejects calls without the secret token (and when none is configured)", async () => {
    expect((await hook({ awb: "A", current_status: "DELIVERED" })).status).toBe(401);
    expect((await hook({ awb: "A", current_status: "DELIVERED" }, "wrong")).status).toBe(401);
    vi.stubEnv("SHIPROCKET_WEBHOOK_TOKEN", "");
    expect((await hook({ awb: "A" }, "x")).status).toBe(503);
  });
  it("DELIVERED marks the order delivered, starts the return window and collects COD", async () => {
    const d = od(); Order.findOne.mockResolvedValue(d);
    const res = await hook({ awb: "AWB1", current_status: "DELIVERED", current_timestamp: "23 05 2026 11:43:52", scans: [{ location: "Pune", activity: "Delivered" }] }, "tok123");
    expect(res.status).toBe(200);
    expect(d.status).toBe("delivered");
    expect(d.deliveredAt).toBeInstanceOf(Date);
    expect(d.payment.status).toBe("paid");
    expect(d.trackingEvents[0]).toMatchObject({ status: "DELIVERED", location: "Pune" });
    expect(notifyOrder).toHaveBeenCalledWith("delivered", d);
  });
  it("RTO / undelivered updates are logged but never mark the order delivered", async () => {
    const d = od(); Order.findOne.mockResolvedValue(d);
    await hook({ awb: "AWB1", current_status: "RTO DELIVERED" }, "tok123");
    expect(d.status).toBe("shipped");
    expect(d.trackingEvents).toHaveLength(1);
  });
  it("repeated identical scans are not duplicated", async () => {
    const d = od(); Order.findOne.mockResolvedValue(d);
    const body = { awb: "AWB1", current_status: "IN TRANSIT", current_timestamp: "23 05 2026 11:43:52" };
    await hook(body, "tok123"); await hook(body, "tok123");
    expect(d.trackingEvents).toHaveLength(1);
  });
  it("a delivered reverse-pickup marks the return as received", async () => {
    Order.findOne.mockResolvedValue(null);
    const r = retDoc({ status: "pickup_scheduled" }); Return.findOne.mockResolvedValue(r);
    await hook({ awb: "AWB77", current_status: "DELIVERED" }, "tok123");
    expect(r.status).toBe("received");
  });
});

/* ------------------------------------------------------------ bulk upload */
describe("POST /api/admin/products/bulk", () => {
  beforeEach(() => { Product.exists.mockResolvedValue(null); Product.create.mockImplementation(async (d: any) => d); });
  it("saves valid rows and reports the bad ones by spreadsheet row number", async () => {
    const rows = [
      { name: "Maroon Suit", category: "Suit Sets", price: "2499", mrp: "3499", sizes: "S:2,M:3", colors: "Maroon:#8c1d40,Green", description: "A nice soft suit set.", returnable: "no", badges: "New|Trending" },
      { name: "", category: "Kurtis", price: "999", sizes: "M", description: "No name here at all." },
      { name: "Cheap Kurti", category: "Kurtis", price: "abc", sizes: "M", description: "Price is not a number." },
    ];
    const res = await bulk(jsonReq("/api/admin/products/bulk", "POST", { rows }), ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.failed.map((f: any) => f.row)).toEqual([3, 4]);
    expect(Product.create.mock.calls[0][0]).toMatchObject({ name: "Maroon Suit", slug: "maroon-suit", quantity: 5, returnable: false, exchangeable: true, badges: ["New", "Trending"], mrp: 3499 });
    expect(Product.create.mock.calls[0][0].sizes).toEqual([{ label: "S", qty: 2 }, { label: "M", qty: 3 }]);
    expect(Product.create.mock.calls[0][0].colors).toEqual([{ name: "Maroon", hex: "#8c1d40", images: [] }, { name: "Green", hex: undefined, images: [] }]);
  });
  it("is admin-only and limited in size", async () => {
    expect((await bulk(jsonReq("/x", "POST", { rows: [] }), ctx())).status).toBe(400);
    expect((await bulk(jsonReq("/x", "POST", { rows: Array.from({ length: 201 }, () => ({ name: "x" })) }), ctx())).status).toBe(400);
    vi.mocked(getSession).mockResolvedValue(null as any);
    expect((await bulk(jsonReq("/x", "POST", { rows: [{ name: "x" }] }), ctx())).status).toBe(401);
  });
});

/* ------------------------------------------------------------ Razorpay webhook */
describe("POST /api/razorpay/webhook", async () => {
  const crypto = await import("node:crypto");
  const { POST: rzpHook } = await import("@/app/api/razorpay/webhook/route");
  const { markOrderPaid } = await import("@/lib/orders");
  const sign = (b: string) => crypto.createHmac("sha256", "whsec").update(b).digest("hex");
  const call = (body: any, sig?: string) => { const raw = JSON.stringify(body); return rzpHook(jsonReq("/api/razorpay/webhook", "POST", raw, { "x-razorpay-signature": sig ?? sign(raw) }), ctx()); };
  const captured = (amount = 100000) => ({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount } } } });
  beforeEach(() => { vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec"); (markOrderPaid as any).mockReset?.(); });
  it("rejects a bad signature", async () => { expect((await call(captured(), "bad")).status).toBe(401); });
  it("rejects when no secret is configured", async () => { vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", ""); expect((await call(captured())).status).toBe(503); });
  it("ignores unrelated events", async () => { expect(await (await call({ event: "payment.failed" })).json()).toMatchObject({ ignored: true }); });
  it("ignores a payment whose amount does not match the order", async () => {
    Order.findOne.mockResolvedValue({ _id: "o1", orderNumber: "OD-1", total: 1000, walletUsed: 0, payment: { method: "razorpay" } });
    expect(await (await call(captured(5))).json()).toMatchObject({ reason: "amount-mismatch" });
    expect(markOrderPaid).not.toHaveBeenCalled();
  });
  it("marks a matching order paid and emails the customer", async () => {
    const o = { _id: "o1", orderNumber: "OD-1", total: 1000, walletUsed: 0, payment: { method: "razorpay" } };
    Order.findOne.mockResolvedValue(o); Order.findById.mockResolvedValue(o);
    (markOrderPaid as any).mockResolvedValue(true);
    expect(await (await call(captured())).json()).toMatchObject({ updated: true });
    expect(markOrderPaid).toHaveBeenCalledWith("o1", "pay_1");
    expect(notifyOrder).toHaveBeenCalledWith("paid", o);
  });
});
