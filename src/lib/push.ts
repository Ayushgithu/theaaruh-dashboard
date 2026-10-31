import webpush from "web-push";
import { connectDB } from "./db";
import { PushSubModel } from "@/models/PushSub";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (+ VAPID_SUBJECT, e.g. mailto:you@brand.com). Generate: npx web-push generate-vapid-keys */
export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export async function subscriberCount() { await connectDB(); return PushSubModel.countDocuments({}); }

export async function sendToAll(msg: { title: string; body: string; url?: string; image?: string }) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  await connectDB();
  const subs: any[] = await PushSubModel.find({}).lean();
  const payload = JSON.stringify(msg);
  const dead: string[] = [];
  let sent = 0, failed = 0;
  for (let i = 0; i < subs.length; i += 25) {
    await Promise.all(subs.slice(i, i + 25).map(async (s) => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60 * 24 }); sent++; }
      catch (e: any) { failed++; if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint); }
    }));
  }
  if (dead.length) await PushSubModel.deleteMany({ endpoint: { $in: dead } }); // the customer uninstalled / blocked: stop trying
  return { sent, failed, removed: dead.length, total: subs.length };
}
