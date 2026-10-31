import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { SlideModel } from "@/models/Slide";
import { slideInput } from "@/lib/carousel-validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/images";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Slide not found.", 404);
  await connectDB();
  const doc = await SlideModel.findById(id);
  if (!doc) throw new HttpError("Slide not found.", 404);
  return doc;
};
const urls = (...u: (string | null | undefined)[]) => u.filter((x): x is string => !!x);

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  const partial = z.object({ active: z.boolean() }).safeParse(body); // quick show/hide toggle
  if (partial.success && Object.keys(body as object).length === 1) {
    doc.active = partial.data.active;
  } else {
    const v = slideInput.parse(body);
    const gone = urls(doc.image !== v.image ? doc.image : null, doc.mobileImage && doc.mobileImage !== v.mobileImage ? doc.mobileImage : null);
    if (gone.length) await deleteImages(gone);
    doc.set({ ...v, mobileImage: v.mobileImage || undefined });
  }
  await doc.save();
  return ok({ ok: true });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  const files = urls(doc.image, doc.mobileImage);
  if (files.length) await deleteImages(files);
  await doc.deleteOne();
  return ok({ ok: true });
});
