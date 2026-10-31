import { connectDB } from "@/lib/db";
import { BannerModel } from "@/models/Banner";
import { bannerInput } from "@/lib/validation";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const v = bannerInput.parse(await readJson(req));
  await connectDB();
  const doc = await BannerModel.create({ ...v, image: v.image ?? undefined });
  return ok({ id: String(doc._id) }, 201);
});
