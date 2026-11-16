import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { VideoModel } from "@/models/Video";
import { videoInput } from "@/lib/video-validation";
import { deleteVideoFile, resolveVideo } from "@/lib/repo-videos";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/images";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Video not found.", 404);
  await connectDB();
  const doc = await VideoModel.findById(id);
  if (!doc) throw new HttpError("Video not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  const quick = z.object({ active: z.boolean() }).safeParse(body); // show/hide switch
  let result: { kind?: string; src?: string } = {};
  if (quick.success && Object.keys(body as object).length === 1) doc.active = quick.data.active;
  else {
    const v = videoInput.parse(body);
    const { kind, src } = await resolveVideo(v.source, v.poster);
    if (doc.src !== src) await deleteVideoFile(doc.src);
    if (doc.poster && doc.poster !== v.poster) await deleteImages([doc.poster]);
    doc.set({ title: v.title, kind, src, poster: v.poster ?? "", products: v.products, active: v.active });
    result = { kind, src };
  }
  await doc.save();
  return ok({ ok: true, ...result });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  await deleteVideoFile(doc.src);
  await deleteImages([doc.poster]);
  await doc.deleteOne();
  return ok({ ok: true });
});