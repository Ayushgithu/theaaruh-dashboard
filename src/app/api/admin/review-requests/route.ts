import { z } from "zod";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";
import { markReviewRequested, saveReviewRequestSettings, sendReviewRequestEmail } from "@/lib/review-requests";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";

const id = z.string().refine((v) => mongoose.isValidObjectId(v), "Order not found.");

/** Send one review request by email now, or note that the owner sent it by WhatsApp. */
export const POST = adminRoute(async (req) => {
  const v = z.object({ orderId: id, via: z.enum(["email", "whatsapp"]) }).parse(await readJson(req));
  await connectDB();
  if (v.via === "email") await sendReviewRequestEmail(v.orderId, "email");
  else await markReviewRequested(v.orderId, "whatsapp");
  return ok({ ok: true });
});

/** Saves the automatic-email switch and how many days after delivery it goes out. */
export const PUT = adminRoute(async (req) => {
  const v = z.object({ autoEmail: z.boolean(), afterDays: z.coerce.number().int().min(1).max(30) }).parse(await readJson(req));
  return ok(await saveReviewRequestSettings(v));
});