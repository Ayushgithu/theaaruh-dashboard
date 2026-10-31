import { connectDB } from "@/lib/db";
import { BrandModel } from "@/models/Brand";
import { reorderInput } from "@/lib/carousel-validation";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const { ids } = reorderInput.parse(await readJson(req));
  await connectDB();
  await BrandModel.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  return ok({ ok: true });
});
