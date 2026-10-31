import { connectDB } from "@/lib/db";
import { SlideModel } from "@/models/Slide";
import { slideInput } from "@/lib/carousel-validation";
import { nextOrder } from "@/lib/repo-carousel";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const v = slideInput.parse(await readJson(req));
  await connectDB();
  const doc = await SlideModel.create({ ...v, mobileImage: v.mobileImage || undefined, order: await nextOrder(SlideModel) });
  return ok({ id: String(doc._id) }, 201);
});
