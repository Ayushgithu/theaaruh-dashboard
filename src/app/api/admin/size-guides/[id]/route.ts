import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { SizeGuideModel } from "@/models/SizeGuide";
import { ProductModel } from "@/models/Product";
import { sizeGuideInput } from "@/lib/size-guide-validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Size guide not found.", 404);
  await connectDB();
  const doc = await SizeGuideModel.findById(id);
  if (!doc) throw new HttpError("Size guide not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  const quick = z.object({ active: z.boolean() }).safeParse(body); // show/hide switch
  if (quick.success && Object.keys(body as object).length === 1) doc.active = quick.data.active;
  else doc.set(sizeGuideInput.parse(body)); // the slug stays the same, products refer to it
  await doc.save();
  return ok({ ok: true });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  await ProductModel.updateMany({ sizeGuides: doc.slug }, { $pull: { sizeGuides: doc.slug } }); // untick it everywhere
  await doc.deleteOne();
  return ok({ ok: true });
});