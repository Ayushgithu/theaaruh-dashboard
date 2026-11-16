import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { CollectionModel } from "@/models/Collection";
import { collectionInput } from "@/lib/collection-validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/images";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Collection not found.", 404);
  await connectDB();
  const doc = await CollectionModel.findById(id);
  if (!doc) throw new HttpError("Collection not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  const quick = z.object({ active: z.boolean() }).safeParse(body); // show/hide switch
  if (quick.success && Object.keys(body as object).length === 1) doc.active = quick.data.active;
  else {
    const v = collectionInput.parse(body);
    if (doc.image && doc.image !== v.image) await deleteImages([doc.image]);
    doc.set({ ...v, image: v.image ?? "" }); // the slug stays the same, so links keep working
  }
  await doc.save();
  return ok({ ok: true });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  await deleteImages([doc.image]);
  await doc.deleteOne();
  return ok({ ok: true });
});