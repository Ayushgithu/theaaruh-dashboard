import { connectDB } from "@/lib/db";
import { BrandModel } from "@/models/Brand";
import { brandInput } from "@/lib/carousel-validation";
import { nextOrder } from "@/lib/repo-carousel";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const v = brandInput.parse(await readJson(req));
  await connectDB();
  const doc = await BrandModel.create({ ...v, logo: v.logo || undefined, order: await nextOrder(BrandModel) });
  return ok({ id: String(doc._id) }, 201);
});
