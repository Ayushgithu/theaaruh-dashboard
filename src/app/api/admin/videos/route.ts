import { connectDB } from "@/lib/db";
import { VideoModel } from "@/models/Video";
import { videoInput } from "@/lib/video-validation";
import { nextVideoOrder, resolveVideo } from "@/lib/repo-videos";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const v = videoInput.parse(await readJson(req));
  const { kind, src } = await resolveVideo(v.source, v.poster);
  await connectDB();
  const doc = await VideoModel.create({ title: v.title, kind, src, poster: v.poster ?? "", products: v.products, active: v.active, order: await nextVideoOrder() });
  return ok({ id: String(doc._id), kind, src }, 201);
});