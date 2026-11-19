import { connectDB } from "./db";
import { CouponModel } from "@/models/Coupon";
import { OrderModel } from "@/models/Order";
import { CollectionModel } from "@/models/Collection";
import { UserModel } from "@/models/User";
import type { AdminCoupon, PickCollection, PickCustomer } from "./coupon-types";

type Doc = Record<string, any>;

/** Every coupon (newest first) with how many orders used it. Cancelled orders do not count. */
export async function getAdminCoupons(): Promise<AdminCoupon[]> {
  await connectDB();
  const [docs, usage] = await Promise.all([
    CouponModel.find({}).sort({ createdAt: -1 }).limit(500).lean() as Promise<Doc[]>,
    OrderModel.aggregate([
      { $match: { "coupon.code": { $exists: true, $ne: null }, status: { $ne: "cancelled" } } },
      { $group: { _id: "$coupon.code", used: { $sum: 1 }, saved: { $sum: "$discount" } } },
    ]) as Promise<Doc[]>,
  ]);
  const by = new Map(usage.map((u) => [String(u._id), u]));
  return docs.map((d) => ({
    id: String(d._id), code: d.code, title: d.title ?? "", description: d.description ?? "", type: d.type, value: d.value ?? 0,
    maxDiscount: d.maxDiscount ?? 0, minOrder: d.minOrder ?? 0,
    startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : undefined, endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : undefined,
    usageLimit: d.usageLimit ?? 0, perCustomer: d.perCustomer ?? 0, firstOrderOnly: !!d.firstOrderOnly,
    scope: d.scope ?? "all", products: (d.products ?? []).map(String), collections: (d.collections ?? []).map(String),
    excludeSale: !!d.excludeSale, payWith: d.payWith ?? "any", audience: d.audience ?? "everyone", customers: (d.customers ?? []).map(String),
    active: !!d.active, visible: d.visible !== false,
    used: by.get(d.code)?.used ?? 0, saved: by.get(d.code)?.saved ?? 0, createdAt: new Date(d.createdAt).toISOString(),
  }));
}

export async function getPickCollections(): Promise<PickCollection[]> {
  await connectDB();
  const docs = (await CollectionModel.find({}).sort({ order: 1, createdAt: 1 }).select("name").lean()) as Doc[];
  return docs.map((d) => ({ id: String(d._id), name: d.name }));
}

/** Real customers (not guests) for the "only these customers" picker. */
export async function getPickCustomers(): Promise<PickCustomer[]> {
  await connectDB();
  const docs = (await UserModel.find({ guest: { $ne: true } }).sort({ createdAt: -1 }).limit(1000).select("name email phone").lean()) as Doc[];
  return docs.map((d) => ({ id: String(d._id), name: d.name ?? "", email: d.email ?? "", phone: d.phone ?? "" }));
}