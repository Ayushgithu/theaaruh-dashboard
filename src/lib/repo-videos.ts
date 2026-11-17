import { connectDB } from "./db";
import { VideoModel } from "@/models/Video";
import { SettingModel } from "@/models/Setting";
import { HttpError } from "./api-helpers";
import { parseVideoLink, type VideoKind } from "./video-shared";
import { deleteCloudinaryVideo } from "./cloudinary";
import { DEFAULT_VIDEO_SECTION, type VideoItem, type VideoSection } from "./video-types";


type Doc = Record<string, any>;

const toItem = (d: Doc): VideoItem => ({
  id: String(d._id), title: d.title ?? "", kind: d.kind, src: d.src, poster: d.poster || undefined,
  products: (d.products ?? []).map(String), active: !!d.active, order: d.order ?? 0,
});

export async function getVideoItems(): Promise<VideoItem[]> {
  await connectDB();
  const docs = (await VideoModel.find({}).sort({ order: 1, createdAt: 1 }).lean()) as Doc[];
  return docs.map(toItem);
}

export async function nextVideoOrder(): Promise<number> {
  await connectDB();
  const last = (await VideoModel.findOne({}).sort({ order: -1 }).select("order").lean()) as Doc | null;
  return (last?.order ?? -1) + 1;
}

export async function getVideoSection(): Promise<VideoSection> {
  await connectDB();
  const doc = (await SettingModel.findOne({ key: "videos" }).lean()) as Doc | null;
  return { ...DEFAULT_VIDEO_SECTION, ...(doc?.data ?? {}) };
}

export async function saveVideoSection(s: VideoSection): Promise<VideoSection> {
  await connectDB();
  await SettingModel.updateOne({ key: "videos" }, { $set: { data: s } }, { upsert: true });
  return s;
}

/** Turns what the owner gave (an uploaded Cloudinary video or a pasted link) into the kind + src we store. */
export async function resolveVideo(source: string, poster?: string | null): Promise<{ kind: VideoKind; src: string }> {
  const link = parseVideoLink(source);
  if (!link) throw new HttpError("That link is not supported. Use a YouTube / Shorts link, an Instagram reel link, a Cloudinary video link, or a direct https .mp4 link.", 400);
  if (link.kind === "instagram" && !poster) throw new HttpError("Add a cover photo for Instagram reels (Instagram does not share one).", 400);
  return link;
}

/** Removes an uploaded video from Cloudinary (only when the server keys are set). Links have nothing to remove. */
export async function deleteVideoFile(src?: string | null) {
  if (src) await deleteCloudinaryVideo(src);
}