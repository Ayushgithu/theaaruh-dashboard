import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { CouponModel } from "@/models/Coupon";
import { couponInput } from "@/lib/coupon-validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Coupon not found.", 404);
  await connectDB();
  const doc = await CouponModel.findById(id);
  if (!doc) throw new HttpError("Coupon not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  const quick = z.object({ active: z.boolean().optional(), visible: z.boolean().optional() }).strict().safeParse(body); // the two switches
  if (quick.success) doc.set(quick.data);
  else {
    const v = couponInput.parse(body);
    doc.set({ ...v, code: doc.code }); // the code never changes, so past orders keep pointing at it
  }
  await doc.save();
  return ok({ ok: true });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  await doc.deleteOne();
  return ok({ ok: true });
});