import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { BannerModel } from "@/models/Banner";
import { bannerInput } from "@/lib/validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/images";
import { z } from "zod";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Banner not found.", 404);
  await connectDB();
  const doc = await BannerModel.findById(id);
  if (!doc) throw new HttpError("Banner not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  // Quick toggle sends only { active }; the edit form sends the full banner.
  const partial = z.object({ active: z.boolean() }).safeParse(body);
  if (partial.success && Object.keys(body).length === 1) {
    doc.active = partial.data.active;
  } else {
    const v = bannerInput.parse(body);
    if (doc.image && doc.image !== v.image) await deleteImages([doc.image]);
    doc.set({ ...v, image: v.image ?? undefined });
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
