// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";


vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/order-notify", () => ({ notifyOrder: vi.fn() }));
vi.mock("@/lib/orders", () => ({ cancelOrder: vi.fn() }));
vi.mock("@/models/Order", () => ({ OrderModel: { findById: vi.fn() } }));

import { getSession } from "@/lib/auth";
import { notifyOrder } from "@/lib/order-notify";
import { cancelOrder } from "@/lib/orders";
import { OrderModel } from "@/models/Order";
import { PATCH } from "@/app/api/admin/orders/[id]/route";
import { ID, ctx, jsonReq } from "./utils";

const Order = OrderModel as any;
const doc = (over: any = {}) => ({
  _id: ID, orderNumber: "LC-1", status: "confirmed", total: 5000, items: [], payment: { method: "razorpay", status: "paid" }, timeline: [] as any[], save: vi.fn(),
  toObject() { return { _id: ID, orderNumber: "LC-1", status: this.status, total: 5000, items: [], payment: this.payment, tracking: this.tracking, timeline: this.timeline, user: "u1", customer: {}, address: {} }; },
  ...over,
});
const patch = (body: unknown, id = ID) => PATCH(jsonReq(`/api/admin/orders/${id}`, "PATCH", body), ctx({ id }));

beforeEach(() => vi.mocked(getSession).mockResolvedValue({ id: "a1", email: "o@shop.com", name: "Owner" }));

describe("PATCH /api/admin/orders/:id", () => {
  it("moves an order forward and writes the timeline", async () => {
    const o = doc({ status: "placed", payment: { method: "cod", status: "pending" } });
    Order.findById.mockResolvedValue(o);
    const res = await patch({ status: "confirmed", note: "Called the customer" });
    expect(res.status).toBe(200);
    expect(o.status).toBe("confirmed");
    expect(o.timeline[0]).toMatchObject({ status: "confirmed", note: "Called the customer" });
    expect((await res.json()).order.status).toBe("confirmed");
  });

  it("shipping needs a tracking number, which is saved and emailed to the customer", async () => {
    const o = doc();
    Order.findById.mockResolvedValue(o);
    expect((await patch({ status: "shipped" })).status).toBe(400);
    expect(o.status).toBe("confirmed");
    const res = await patch({ status: "shipped", carrier: "Delhivery", trackingNumber: "DLV123" });
    expect(res.status).toBe(200);
    expect((o as any).tracking).toEqual({ carrier: "Delhivery", number: "DLV123" });
    expect(notifyOrder).toHaveBeenCalledWith("shipped", o);
  });

  it("delivering a Cash on Delivery order records that the cash was collected", async () => {
    const o = doc({ status: "shipped", payment: { method: "cod", status: "pending" } });
    Order.findById.mockResolvedValue(o);
    await patch({ status: "delivered" });
    expect(o.payment.status).toBe("paid");
    expect(notifyOrder).toHaveBeenCalledWith("delivered", o);
  });

  it("does not allow impossible jumps", async () => {
    Order.findById.mockResolvedValue(doc({ status: "placed" }));
    expect((await patch({ status: "delivered" })).status).toBe(400);
    Order.findById.mockResolvedValue(doc({ status: "delivered" }));
    expect((await patch({ status: "shipped", trackingNumber: "X" })).status).toBe(400);
  });

  it("cancelling goes through the refund + restock logic", async () => {
    vi.mocked(cancelOrder).mockResolvedValue(doc({ status: "cancelled", payment: { method: "razorpay", status: "refunded" } }) as any);
    const res = await patch({ status: "cancelled", note: "Out of stock" });
    expect(cancelOrder).toHaveBeenCalledWith(ID, { by: "admin", note: "Out of stock" });
    expect((await res.json()).order.status).toBe("cancelled");
    expect(notifyOrder).toHaveBeenCalledWith("cancelled", expect.anything());
  });

  it("rejects unknown statuses, bad ids and missing orders", async () => {
    expect((await patch({ status: "pending_payment" })).status).toBe(400);
    expect((await patch({ status: "confirmed" }, "bad")).status).toBe(404);
    Order.findById.mockResolvedValue(null);
    expect((await patch({ status: "confirmed" })).status).toBe(404);
  });
});
