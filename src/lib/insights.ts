import { connectDB } from "./db";
import { OrderModel } from "@/models/Order";
import { ReturnModel } from "@/models/ReturnRequest";


export interface DayPoint { date: string; label: string; revenue: number; orders: number }
export interface Bar { label: string; value: number; extra?: string }
export interface Insights {
  days: number;
  totals: { revenue: number; orders: number; units: number; avgOrder: number; cancelled: number; returnRate: number; returnedUnits: number };
  daily: DayPoint[]; sizes: Bar[]; colors: Bar[]; products: Bar[]; payments: Bar[];
  returnReasons: Bar[]; returnProducts: Bar[]; returnSizes: Bar[]; returnTypes: Bar[];
}

const IST = 5.5 * 3600_000;
const ymd = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);

/** One bar for each of the last `days` days (IST), with zeros for days without orders. */
export function fillDays(rows: { _id: string; revenue: number; orders: number }[], days: number, now = Date.now()): DayPoint[] {
  const map = new Map(rows.map((r) => [r._id, r]));
  return Array.from({ length: days }, (_, k) => {
    const date = ymd(now - (days - 1 - k) * 86_400_000);
    const r = map.get(date);
    return { date, label: new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), revenue: r?.revenue ?? 0, orders: r?.orders ?? 0 };
  });
}
const bars = (rows: any[], n = 8): Bar[] => rows.slice(0, n).map((r) => ({ label: String(r._id ?? "—"), value: r.value, extra: r.extra }));

export async function getInsights(days: number, now = Date.now()): Promise<Insights> {
  await connectDB();
  const since = new Date(now - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIst = new Date(+new Date(ymd(now - (days - 1) * 86_400_000) + "T00:00:00Z") - IST);
  const live = { createdAt: { $gte: sinceIst }, status: { $nin: ["pending_payment", "cancelled"] } };
  const unwind = [{ $match: live }, { $unwind: "$items" }];

  const [daily, pay, sizes, colors, products, totals, cancelled, rReason, rProduct, rSize, rType, rUnits] = await Promise.all([
    OrderModel.aggregate([{ $match: live }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]),
    OrderModel.aggregate([{ $match: live }, { $group: { _id: "$payment.method", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    OrderModel.aggregate([...unwind, { $group: { _id: { $ifNull: ["$items.size", "—"] }, value: { $sum: "$items.quantity" } } }, { $sort: { value: -1 } }]),
    OrderModel.aggregate([...unwind, { $match: { "items.color": { $nin: [null, ""] } } }, { $group: { _id: "$items.color", value: { $sum: "$items.quantity" } } }, { $sort: { value: -1 } }]),
    OrderModel.aggregate([...unwind, { $group: { _id: "$items.name", value: { $sum: "$items.quantity" }, rev: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } }, { $sort: { value: -1 } }, { $limit: 8 }]),
    OrderModel.aggregate([{ $match: live }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 }, units: { $sum: { $sum: "$items.quantity" } } } }]),
    OrderModel.countDocuments({ createdAt: { $gte: sinceIst }, status: "cancelled" }),
    ReturnModel.aggregate([{ $match: { createdAt: { $gte: sinceIst }, status: { $ne: "cancelled" } } }, { $group: { _id: "$reason", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    ReturnModel.aggregate([{ $match: { createdAt: { $gte: sinceIst }, status: { $ne: "cancelled" } } }, { $unwind: "$items" }, { $group: { _id: "$items.name", value: { $sum: "$items.quantity" } } }, { $sort: { value: -1 } }]),
    ReturnModel.aggregate([{ $match: { createdAt: { $gte: sinceIst }, status: { $ne: "cancelled" } } }, { $unwind: "$items" }, { $group: { _id: { $ifNull: ["$items.size", "—"] }, value: { $sum: "$items.quantity" } } }, { $sort: { value: -1 } }]),
    ReturnModel.aggregate([{ $match: { createdAt: { $gte: sinceIst }, status: { $ne: "cancelled" } } }, { $group: { _id: "$type", value: { $sum: 1 } } }]),
    ReturnModel.aggregate([{ $match: { createdAt: { $gte: sinceIst }, status: { $ne: "cancelled" } } }, { $unwind: "$items" }, { $group: { _id: null, units: { $sum: "$items.quantity" } } }]),
  ]);

  const t = totals[0] ?? { revenue: 0, orders: 0, units: 0 };
  const returnedUnits = rUnits[0]?.units ?? 0;
  return {
    days,
    totals: { revenue: t.revenue, orders: t.orders, units: t.units, avgOrder: t.orders ? Math.round(t.revenue / t.orders) : 0, cancelled, returnedUnits, returnRate: t.units ? Math.round((returnedUnits / t.units) * 1000) / 10 : 0 },
    daily: fillDays(daily, days, now),
    sizes: bars(sizes, 10), colors: bars(colors), payments: bars(pay).map((b) => ({ ...b, label: b.label === "cod" ? "Cash on delivery" : b.label === "razorpay" ? "Paid online" : b.label })),
    products: products.slice(0, 8).map((p: any) => ({ label: p._id, value: p.value, extra: `₹${Math.round(p.rev).toLocaleString("en-IN")}` })),
    returnReasons: bars(rReason), returnProducts: bars(rProduct, 6), returnSizes: bars(rSize), returnTypes: bars(rType).map((b) => ({ ...b, label: b.label === "exchange" ? "Exchange" : "Return" })),
  };
}
