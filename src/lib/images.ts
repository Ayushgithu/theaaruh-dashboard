import sharp from "sharp";
import { connectDB } from "./db";
import { ImageModel } from "@/models/Image";
import { HttpError } from "./api-helpers";
import { cloudinaryConfigured, deleteFromCloudinary, uploadToCloudinary } from "./cloudinary";

/* eslint-disable @typescript-eslint/no-explicit-any */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const URL_RE = /^\/api\/(?:images|videos)\/([a-f0-9]{24})$/;

/**
 * Validates and resizes an image (max 1600px, WebP), uploads it to Cloudinary, saves the Cloudinary details
 * in MongoDB and returns the URL the site uses (/api/images/<id>). Without Cloudinary keys it stores the bytes in MongoDB instead.
 */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new HttpError("Each photo must be smaller than 8 MB.", 413);
  const input = Buffer.from(await file.arrayBuffer());
  let out: Buffer;
  try {
    out = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw new HttpError(`"${file.name}" is not a valid image.`, 400);
  }
  if (!cloudinaryConfigured()) {
    await connectDB();
    const doc = await ImageModel.create({ data: out, contentType: "image/webp", size: out.length, resourceType: "image" });
    return `/api/images/${doc._id}`;
  }
  let up;
  try { up = await uploadToCloudinary(out, "image"); }
  catch (e) { console.error("[cloudinary] image upload failed:", e); throw new HttpError("Could not upload the photo. Please try again.", 502); }
  await connectDB();
  try {
    const doc = await ImageModel.create({ url: up.secure_url, publicId: up.public_id, contentType: "image/webp", size: up.bytes, width: up.width, height: up.height, resourceType: "image" });
    return `/api/images/${doc._id}`;
  } catch (e) {
    await deleteFromCloudinary(up.public_id, "image").catch(() => {}); // do not leave an orphan file behind
    throw e;
  }
}

/** Uploads a video to Cloudinary, saves its details in MongoDB and returns /api/videos/<id>. Needs Cloudinary. */
export async function saveVideo(file: File): Promise<string> {
  if (!cloudinaryConfigured()) throw new HttpError("Video upload needs Cloudinary. Add the CLOUDINARY_* settings, or paste a video link instead.", 503);
  if (!file.type.startsWith("video/")) throw new HttpError(`"${file.name}" is not a video.`, 400);
  if (file.size > MAX_VIDEO_BYTES) throw new HttpError("Each video must be smaller than 50 MB.", 413);
  let up;
  try { up = await uploadToCloudinary(Buffer.from(await file.arrayBuffer()), "video"); }
  catch (e) { console.error("[cloudinary] video upload failed:", e); throw new HttpError("Could not upload the video. Please try again.", 502); }
  await connectDB();
  try {
    const doc = await ImageModel.create({ url: up.secure_url, publicId: up.public_id, contentType: file.type, size: up.bytes, width: up.width, height: up.height, duration: up.duration, resourceType: "video" });
    return `/api/videos/${doc._id}`;
  } catch (e) {
    await deleteFromCloudinary(up.public_id, "video").catch(() => {});
    throw e;
  }
}

/** Removes the records (and the Cloudinary files) behind these media URLs. */
export async function deleteImages(urls: (string | undefined | null)[]) {
  const ids = urls.map((u) => (u ? URL_RE.exec(u)?.[1] : undefined)).filter(Boolean) as string[];
  if (!ids.length) return;
  await connectDB();
  const docs: any[] = await ImageModel.find({ _id: { $in: ids }, publicId: { $exists: true } }).select("publicId resourceType").lean();
  await Promise.all(docs.map((d) => deleteFromCloudinary(d.publicId, d.resourceType === "video" ? "video" : "image").catch((e) => console.error("[cloudinary] delete failed:", e))));
  await ImageModel.deleteMany({ _id: { $in: ids } });
}
