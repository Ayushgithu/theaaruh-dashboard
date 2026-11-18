import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ReviewModel } from "@/models/Review";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { deleteReviewPhotos, recalcRating } from "@/lib/repo-reviews";

const patch = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  featured: z.boolean().optional(),
  reply: z.string().trim().max(600, "Keep the reply under 600 characters").optional(), // "" removes the reply
});

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Review not found.", 404);
  await connectDB();
  const doc = await ReviewModel.findById(id);
  if (!doc) throw new HttpError("Review not found.", 404);
  return doc;
};

/** Approve / reject, feature on the home page, or reply publicly. */
export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const v = patch.parse(await readJson(req));
  if (v.status) doc.status = v.status;
  if (v.featured !== undefined) doc.featured = v.featured;
  if (doc.status !== "approved") doc.featured = false; // only approved reviews can be shown on the home page
  if (v.reply !== undefined) doc.reply = v.reply ? { text: v.reply, at: new Date() } : undefined;
  await doc.save();
  await recalcRating(doc.product);
  return ok({ ok: true, status: doc.status, featured: doc.featured });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  const photos: string[] = [...(doc.photos ?? []), ...(doc.avatar ? [doc.avatar] : [])];
  const product = doc.product;
  await doc.deleteOne();
  await recalcRating(product);
  await deleteReviewPhotos(photos);
  return ok({ ok: true });
});