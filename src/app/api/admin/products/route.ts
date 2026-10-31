import { connectDB } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { productInput } from "@/lib/validation";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";
import { fieldsFromInput, uniqueSlug } from "@/lib/product-write";
import { toProduct } from "@/lib/repo";

export const POST = adminRoute(async (req) => {
  const v = productInput.parse(await readJson(req));
  await connectDB();
  const doc = await ProductModel.create({ ...fieldsFromInput(v), slug: await uniqueSlug(v.name), views: 0 });
  return ok(toProduct(doc.toObject()), 201);
});
