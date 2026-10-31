// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("@/lib/auth", () => ({ getSession: vi.fn(), createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
const box = vi.hoisted(() => ({ rules: null as any }));
vi.mock("@/lib/settings", () => ({ getRules: async () => box.rules, saveRules: async (r: any) => r }));
vi.mock("@/lib/return-notify", () => ({ notifyReturn: vi.fn() }));
vi.mock("@/lib/orders", () => ({ putBack: vi.fn() }));
const w = vi.hoisted(() => ({ credit: vi.fn(async () => 1000), debit: vi.fn(async () => true) }));
vi.mock("@/lib/wallet", () => ({ creditWallet: w.credit, debitWallet: w.debit }));
vi.mock("@/lib/razorpay", () => ({ razorpayConfigured: () => true, razorpay: () => ({ payments: { refund: vi.fn() } }) }));
vi.mock("@/models/ReturnRequest", () => ({ ReturnModel: { findById: vi.fn(), find: vi.fn() } }));
vi.mock("@/models/Order", () => ({ OrderModel: { findById: vi.fn() } }));
vi.mock("@/models/Product", () => ({ ProductModel: { updateOne: vi.fn() } }));
vi.mock("@/models/User", () => ({ UserModel: { findById: vi.fn() } }));

import { getSession } from "@/lib/auth";
import { ReturnModel } from "@/models/ReturnRequest";
import { OrderModel } from "@/models/Order";
import { UserModel } from "@/models/User";
import { mergeRules } from "@/lib/rules";
import { POST as returnAction } from "@/app/api/admin/returns/[id]/route";
import { POST as walletAdjust } from "@/app/api/admin/customers/[id]/wallet/route";
import { PUT as rulesPut } from "@/app/api/admin/store-rules/route";
import { ID, ctx, jsonReq } from "./utils";

const Return = ReturnModel as any, Order = OrderModel as any, User = UserModel as any;
const admin = { id: "a1", email: "o@s.com", name: "Owner" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(admin);
  box.rules = mergeRules({ wallet: { enabled: true, bonusPercent: 5 } } as any);
  w.credit.mockResolvedValue(1000); w.debit.mockResolvedValue(true);
});

const retDoc = (over: any = {}) => { const d: any = { _id: ID, number: "RT-1", order: "o1", orderNumber: "OD-1", user: "u1", customer: { name: "Ravi", email: "r@x.com", phone: "9876543210" }, type: "return", reason: "x", photos: [], items: [{ index: 0, product: "p1", name: "Suit", size: "M", price: 1000, quantity: 2 }], status: "received", timeline: [] as any[], ...over }; d.save = vi.fn(); d.toObject = () => ({ ...d, createdAt: new Date() }); return d; };
const refund = (body: any) => returnAction(jsonReq(`/api/admin/returns/${ID}`, "POST", { action: "refund", ...body }), ctx({ id: ID }));
const order = (o: any = {}) => { Order.findById.mockReturnValue({ select: () => ({ lean: async () => ({ total: 2500, payment: { method: "cod", status: "paid" }, ...o }) }) }); Return.find.mockReturnValue({ select: () => ({ lean: async () => [] }) }); };

describe("refund to the wallet", () => {
  it("credits the amount plus the owner's bonus % as two history entries", async () => {
    order(); const d = retDoc(); Return.findById.mockResolvedValue(d); User.findById.mockReturnValue({ select: () => ({ lean: async () => ({ guest: false }) }) });
    const res = await refund({ amount: 2000, method: "wallet" });
    expect(res.status).toBe(200);
    expect(w.credit).toHaveBeenNthCalledWith(1, "u1", 2000, expect.objectContaining({ type: "refund", by: "Owner" }));
    expect(w.credit).toHaveBeenNthCalledWith(2, "u1", 100, expect.objectContaining({ type: "bonus" })); // 5% of 2000
    expect(d).toMatchObject({ status: "refunded", refund: { amount: 2000, bonus: 100, method: "wallet" } });
  });
  it("no bonus entry when the bonus is 0%", async () => {
    box.rules = mergeRules({ wallet: { enabled: true, bonusPercent: 0 } } as any);
    order(); Return.findById.mockResolvedValue(retDoc()); User.findById.mockReturnValue({ select: () => ({ lean: async () => ({ guest: false }) }) });
    await refund({ amount: 500, method: "wallet" });
    expect(w.credit).toHaveBeenCalledTimes(1);
  });
  it("is refused for guests and when the wallet is switched off", async () => {
    order(); Return.findById.mockResolvedValue(retDoc()); User.findById.mockReturnValue({ select: () => ({ lean: async () => ({ guest: true }) }) });
    expect((await refund({ amount: 500, method: "wallet" })).status).toBe(400);
    box.rules = mergeRules({ wallet: { enabled: false } } as any);
    expect((await refund({ amount: 500, method: "wallet" })).status).toBe(400);
    expect(w.credit).not.toHaveBeenCalled();
  });
  it("still cannot refund more than the order total", async () => {
    order({ total: 1000 }); Return.findById.mockResolvedValue(retDoc()); User.findById.mockReturnValue({ select: () => ({ lean: async () => ({ guest: false }) }) });
    expect((await refund({ amount: 1500, method: "wallet" })).status).toBe(400);
  });
});

describe("POST /api/admin/customers/:id/wallet", () => {
  const adj = (body: any) => walletAdjust(jsonReq("/x", "POST", body), ctx({ id: ID }));
  beforeEach(() => { User.findById.mockReturnValue({ select: () => ({ lean: async () => ({ guest: false, walletBalance: 300 }) }) }); });
  it("adds credit with a reason", async () => {
    const res = await adj({ amount: 200, note: "Festival gift" });
    expect(res.status).toBe(200);
    expect(w.credit).toHaveBeenCalledWith(ID, 200, expect.objectContaining({ type: "adjustment", note: "Festival gift", by: "Owner" }));
  });
  it("removes credit, but never below zero", async () => {
    expect((await adj({ amount: -100, note: "Correction" })).status).toBe(200);
    expect(w.debit).toHaveBeenCalledWith(ID, 100, expect.anything());
    w.debit.mockResolvedValue(false);
    expect((await adj({ amount: -900, note: "Too much" })).status).toBe(400);
  });
  it("needs a reason, a non-zero amount and a real (non-guest) customer", async () => {
    expect((await adj({ amount: 100, note: "" })).status).toBe(400);
    expect((await adj({ amount: 0, note: "nothing" })).status).toBe(400);
    User.findById.mockReturnValue({ select: () => ({ lean: async () => ({ guest: true }) }) });
    expect((await adj({ amount: 100, note: "gift" })).status).toBe(400);
  });
  it("is admin-only", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);
    expect((await adj({ amount: 100, note: "gift" })).status).toBe(401);
  });
});

describe("store rules: delivery + wallet", () => {
  const rules = () => JSON.parse(JSON.stringify(mergeRules(null)));
  it("accepts delivery time rules with area overrides", async () => {
    const b = rules(); b.delivery = { handlingDays: 0, cutoffHour: 17, transitMin: 2, transitMax: 5, sundayOff: false, overrides: [{ prefix: "11", min: 1, max: 2 }] }; b.wallet.bonusPercent = 5;
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(200);
  });
  it("rejects a bad cut-off hour, a bad area prefix and a huge bonus", async () => {
    let b = rules(); b.delivery.cutoffHour = 30;
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(400);
    b = rules(); b.delivery.overrides = [{ prefix: "abc", min: 1, max: 2 }];
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(400);
    b = rules(); b.wallet.bonusPercent = 80;
    expect((await rulesPut(jsonReq("/x", "PUT", b), ctx())).status).toBe(400);
  });
});
