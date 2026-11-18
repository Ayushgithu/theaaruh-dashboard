import { connectDB } from "./db";
import { OrderModel } from "@/models/Order";
import { ReviewModel } from "@/models/Review";
import { SettingModel } from "@/models/Setting";
import "@/models/User"; // registers the model used by populate("user")
import { HttpError } from "./api-helpers";
import { sendEmail } from "./email";
import { brandName } from "./brand";
import type { ReviewRequestRow, ReviewRequestSettings } from "./review-request-types";

const KEY = "review-requests";
const DAY = 86_400_000;
const LOOKBACK_DAYS = 60; // older deliveries are not worth asking about
const DEFAULTS: ReviewRequestSettings = { autoEmail: false, afterDays: 3 };

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The page where the customer writes the review; ?review=1 opens the form straight away. */
export const reviewLink = (slug: string) => `${siteUrl()}/product/${slug}?review=1#reviews`;

export async function getReviewRequestSettings(): Promise<ReviewRequestSettings> {
  await connectDB();
  const d: any = await SettingModel.findOne({ key: KEY }).lean();
  const afterDays = Number(d?.data?.afterDays);
  return { autoEmail: !!d?.data?.autoEmail, afterDays: Number.isFinite(afterDays) ? Math.min(30, Math.max(1, Math.round(afterDays))) : DEFAULTS.afterDays };
}

export async function saveReviewRequestSettings(s: ReviewRequestSettings) {
  await connectDB();
  const clean = { autoEmail: !!s.autoEmail, afterDays: Math.min(30, Math.max(1, Math.round(s.afterDays || DEFAULTS.afterDays))) };
  await SettingModel.updateOne({ key: KEY }, { $set: { data: clean } }, { upsert: true });
  return clean;
}

/**
 * Delivered orders (last 60 days) of real accounts that still have products the customer has not reviewed.
 * Guests are skipped because only signed-in customers can write a review.
 */
export async function getReviewRequestRows(afterDays: number): Promise<ReviewRequestRow[]> {
  await connectDB();
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY);
  const orders: any[] = await OrderModel.find({ status: "delivered", $or: [{ deliveredAt: { $gte: since } }, { deliveredAt: { $exists: false }, updatedAt: { $gte: since } }] })
    .sort({ deliveredAt: -1, updatedAt: -1 }).limit(300).populate("user", "guest email").lean();
  const real = orders.filter((o) => o.user && !o.user.guest);
  if (!real.length) return [];
  const reviewed = await ReviewModel.find({ user: { $in: real.map((o) => o.user._id) } }).select("user product").lean() as any[];
  const done = new Set(reviewed.map((r) => `${r.user}|${r.product}`));
  const rows: ReviewRequestRow[] = [];
  for (const o of real) {
    const seen = new Set<string>();
    const items = (o.items ?? []).filter((i: any) => {
      const pid = String(i.product);
      if (!i.slug || seen.has(pid) || done.has(`${o.user._id}|${pid}`)) return false;
      seen.add(pid);
      return true;
    }).map((i: any) => ({ productId: String(i.product), name: i.name, slug: i.slug, image: i.image || undefined }));
    if (!items.length) continue;
    const delivered = new Date(o.deliveredAt ?? o.updatedAt);
    const customerName = o.customer?.name || "there";
    rows.push({
      whatsapp: whatsappText({ customerName, items }),
      orderId: String(o._id), orderNumber: o.orderNumber, customerName,
      email: o.customer?.email || o.user.email || "", phone: o.customer?.phone || "",
      deliveredAt: delivered.toISOString(), dueAt: new Date(+delivered + afterDays * DAY).toISOString(),
      items, requested: o.reviewRequest?.at ? { at: new Date(o.reviewRequest.at).toISOString(), via: o.reviewRequest.via ?? "email" } : undefined,
    });
  }
  return rows;
}

function emailContent(row: Pick<ReviewRequestRow, "customerName" | "orderNumber" | "items">) {
  const items = row.items.slice(0, 4);
  const first = row.customerName.split(/\s+/)[0] || "there";
  const subject = `How did you like your ${brandName} order? (${row.orderNumber})`;
  const text = `Hi ${first},\n\nThank you for shopping with ${brandName}! We hope you love your order ${row.orderNumber}.\n\nIt takes just a minute to tell us (and other shoppers) how it looks and fits. You can even add a photo:\n\n${items.map((i) => `${i.name}: ${reviewLink(i.slug)}`).join("\n")}\n\nThank you!\n${brandName}`;
  const buttons = items.map((i) => `<tr><td style="padding:6px 0;font-size:14px">${esc(i.name)}</td><td align="right" style="padding:6px 0"><a href="${esc(reviewLink(i.slug))}" style="display:inline-block;background:#8c1d40;color:#fff;text-decoration:none;font-weight:600;font-size:13px;padding:9px 16px;border-radius:10px">Write a review</a></td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><tr><td style="padding:32px">
    <p style="margin:0 0 4px;font-size:18px;font-weight:800">${esc(brandName)}</p>
    <h1 style="margin:20px 0 8px;font-size:20px">How did you like it? ⭐</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">Hi ${esc(first)}, thank you for shopping with us! It takes just a minute to tell us and other shoppers how your order ${esc(row.orderNumber)} looks and fits. You can even add a photo.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">${buttons}</table>
    <p style="margin:20px 0 0;font-size:13px;color:#64748b">Thank you for your time. Your review helps other customers choose with confidence.</p>
  </td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** The ready-to-send WhatsApp text (the dashboard opens WhatsApp with it). */
export function whatsappText(row: Pick<ReviewRequestRow, "customerName" | "items">) {
  const first = row.customerName.split(/\s+/)[0] || "there";
  const links = row.items.slice(0, 3).map((i) => `${i.name}: ${reviewLink(i.slug)}`).join("\n");
  return `Hi ${first}! Thank you for shopping with ${brandName} 💛\nWe hope you love your order. Could you share a quick review (you can add a photo too)? It takes a minute and helps us a lot:\n\n${links}`;
}

async function load(orderId: string) {
  await connectDB();
  const order: any = await OrderModel.findById(orderId);
  if (!order) throw new HttpError("Order not found.", 404);
  return order;
}

const rowOf = async (orderId: string): Promise<ReviewRequestRow | undefined> => (await getReviewRequestRows(await getReviewRequestSettings().then((s) => s.afterDays))).find((r) => r.orderId === orderId);

/** Emails the review request and remembers that it was sent. Throws when email is not set up or the customer has no email. */
export async function sendReviewRequestEmail(orderId: string, via: "email" | "auto" = "email") {
  const row = await rowOf(orderId);
  if (!row) throw new HttpError("This order has nothing left to review (already reviewed, a guest order, or too old).", 400);
  if (!/^\S+@\S+\.\S+$/.test(row.email)) throw new HttpError("This customer has no email address.", 400);
  const sent = await sendEmail({ to: row.email, ...emailContent(row) });
  if (!sent) throw new HttpError("Email is not set up (RESEND_API_KEY is missing).", 503);
  await OrderModel.updateOne({ _id: orderId }, { $set: { reviewRequest: { at: new Date(), via } } });
}

/** The owner pressed the WhatsApp button: just remember that it was asked. */
export async function markReviewRequested(orderId: string, via: "whatsapp") {
  const order = await load(orderId);
  order.reviewRequest = { at: new Date(), via };
  await order.save();
}

/** Daily job: emails everyone whose request is due and who was not asked yet. Does nothing while "automatic email" is off. */
export async function runAutoReviewRequests(limit = 40) {
  const s = await getReviewRequestSettings();
  if (!s.autoEmail) return { enabled: false, sent: 0, failed: 0 };
  const due = (await getReviewRequestRows(s.afterDays)).filter((r) => !r.requested && +new Date(r.dueAt) <= Date.now() && /^\S+@\S+\.\S+$/.test(r.email)).slice(0, limit);
  let sent = 0, failed = 0;
  for (const r of due) {
    try { await sendReviewRequestEmail(r.orderId, "auto"); sent++; }
    catch (e) { failed++; console.error("[review-request] failed for", r.orderNumber, e instanceof Error ? e.message : e); if (e instanceof HttpError && e.status === 503) break; }
  }
  return { enabled: true, sent, failed };
}