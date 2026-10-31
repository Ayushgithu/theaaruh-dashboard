import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { productInput } from "@/lib/validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { fieldsFromInput } from "@/lib/product-write";
import { deleteImages } from "@/lib/images";
import { toProduct } from "@/lib/repo";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Product not found.", 404);
  await connectDB();
  const doc = await ProductModel.findById(id);
  if (!doc) throw new HttpError("Product not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const v = productInput.parse(await readJson(req));
  const colorImgs = (c: { images?: string[] }[] | undefined) => (c ?? []).flatMap((x) => x.images ?? []);
  const keep = new Set([...v.images, ...colorImgs(v.colors)]);
  const removed = [...(doc.images as string[]), ...colorImgs(doc.colors)].filter((u) => !keep.has(u));
  doc.set({ ...fieldsFromInput(v), mrp: v.mrp && v.mrp > v.price ? v.mrp : undefined });
  await doc.save();
  await deleteImages(removed);
  return ok(toProduct(doc.toObject()));
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  await deleteImages([...(doc.images as string[]), ...((doc.colors ?? []) as { images?: string[] }[]).flatMap((c) => c.images ?? [])]);
  await doc.deleteOne();
  return ok({ ok: true });
});
