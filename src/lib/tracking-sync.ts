import { mapCourierStatus } from "./shiprocket";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CourierEvent { status: string; at: Date; location?: string; note?: string }

/** Adds new scan events to the order and moves its status forward (shipped / delivered). Returns which customer email to send, if any. */
export function applyTrackingEvents(order: any, events: CourierEvent[], currentStatusText: string): "shipped" | "delivered" | null {
  const key = (e: { status?: string; at: Date | string }) => `${e.status}|${new Date(e.at).toISOString().slice(0, 16)}`;
  const seen = new Set<string>((order.trackingEvents ?? []).map(key));
  for (const e of events) if (!seen.has(key(e))) { order.trackingEvents.push({ status: e.status, at: e.at, location: e.location, note: e.note }); seen.add(key(e)); }
  order.trackingEvents.sort((a: any, b: any) => +new Date(a.at) - +new Date(b.at));

  const mapped = mapCourierStatus(currentStatusText);
  const now = new Date();
  if (mapped === "delivered" && ["placed", "confirmed", "shipped"].includes(order.status)) {
    if (order.status !== "shipped") order.timeline.push({ status: "shipped", at: now, note: "Picked up by the courier" });
    order.status = "delivered";
    order.deliveredAt = events.length ? new Date(Math.max(...events.map((e) => +e.at))) : now;
    if (order.payment?.method === "cod") { order.payment.status = "paid"; order.payment.paidAt = now; }
    order.timeline.push({ status: "delivered", at: now, note: "Delivered (courier update)" });
    return "delivered";
  }
  if (mapped === "shipped" && ["placed", "confirmed"].includes(order.status)) {
    order.status = "shipped";
    order.timeline.push({ status: "shipped", at: now, note: "Picked up by the courier" });
    return "shipped";
  }
  return null;
}
