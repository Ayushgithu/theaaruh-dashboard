import { connectDB } from "@/lib/db";
import { CouponModel } from "@/models/Coupon";
import { couponInput } from "@/lib/coupon-validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const v = couponInput.parse(await readJson(req));
  await connectDB();
  if (await CouponModel.exists({ code: v.code })) throw new HttpError("A coupon with this code already exists.", 409);
  const doc = await CouponModel.create(v);
  return ok({ id: String(doc._id) }, 201);
});