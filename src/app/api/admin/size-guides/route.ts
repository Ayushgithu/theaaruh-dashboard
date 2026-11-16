import { connectDB } from "@/lib/db";
import { SizeGuideModel } from "@/models/SizeGuide";
import { sizeGuideInput } from "@/lib/size-guide-validation";
import { getSizeGuideItems, nextGuideOrder, uniqueGuideSlug } from "@/lib/repo-size-guides";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

/** List (used by the product form to show the "Size guide" tick boxes). */
export const GET = adminRoute(async () => ok({ guides: (await getSizeGuideItems()).map(({ name, slug, active }) => ({ name, slug, active })) }));

export const POST = adminRoute(async (req) => {
  const v = sizeGuideInput.parse(await readJson(req));
  await connectDB();
  const slug = await uniqueGuideSlug(v.name);
  const doc = await SizeGuideModel.create({ ...v, slug, order: await nextGuideOrder() });
  return ok({ id: String(doc._id), slug }, 201);
});