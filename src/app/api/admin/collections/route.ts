import { connectDB } from "@/lib/db";
import { CollectionModel } from "@/models/Collection";
import { collectionInput } from "@/lib/collection-validation";
import { nextCollectionOrder, uniqueCollectionSlug } from "@/lib/repo-collections";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const v = collectionInput.parse(await readJson(req));
  await connectDB();
  const slug = await uniqueCollectionSlug(v.name);
  const doc = await CollectionModel.create({ ...v, image: v.image ?? "", slug, order: await nextCollectionOrder() });
  return ok({ id: String(doc._id), slug }, 201);
});