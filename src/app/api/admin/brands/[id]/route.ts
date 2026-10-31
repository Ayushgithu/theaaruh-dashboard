import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { BrandModel } from "@/models/Brand";
import { brandInput } from "@/lib/carousel-validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/images";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Brand not found.", 404);
  await connectDB();
  const doc = await BrandModel.findById(id);
  if (!doc) throw new HttpError("Brand not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  const partial = z.object({ active: z.boolean() }).safeParse(body);
  if (partial.success && Object.keys(body as object).length === 1) {
    doc.active = partial.data.active;
  } else {
    const v = brandInput.parse(body);
    if (doc.logo && doc.logo !== v.logo) await deleteImages([doc.logo]);
    doc.set({ ...v, logo: v.logo || undefined });
  }
  await doc.save();
  return ok({ ok: true });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  if (doc.logo) await deleteImages([doc.logo]);
  await doc.deleteOne();
  return ok({ ok: true });
});
