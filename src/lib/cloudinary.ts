import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { HttpError } from "./api-helpers";
import { cloudinaryPublicId } from "./video-shared";

/** Set CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD_NAME) or the three CLOUDINARY_* variables. */
export const cloudinaryConfigured = () =>
  !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));

let ready = false;
function client() {
  if (!cloudinaryConfigured()) throw new HttpError("Media storage is not set up yet.", 503);
  if (!ready) {
    if (!process.env.CLOUDINARY_URL) cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    else cloudinary.config({ secure: true }); // picks up CLOUDINARY_URL by itself
    ready = true;
  }
  return cloudinary;
}

export const cloudinaryFolder = () => process.env.CLOUDINARY_FOLDER || "store";

/** Uploads a buffer to Cloudinary and resolves with its result (secure_url, public_id, bytes, …). */
export function uploadToCloudinary(buffer: Buffer, resourceType: "image" | "video"): Promise<UploadApiResponse> {
  const c = client();
  return new Promise((resolve, reject) => {
    const stream = c.uploader.upload_stream({ folder: `${cloudinaryFolder()}/${resourceType}s`, resource_type: resourceType }, (err, res) => (err || !res ? reject(err ?? new Error("Empty Cloudinary response")) : resolve(res)));
    stream.end(buffer);
  });
}

export async function deleteFromCloudinary(publicId: string, resourceType: "image" | "video") {
  await client().uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}

/**
 * Deletes a video from Cloudinary so unused files do not fill your storage.
 * Without Cloudinary configuration, the file remains in the Cloudinary library for manual cleanup.
 */
export async function deleteCloudinaryVideo(src: string): Promise<void> {
  const id = cloudinaryPublicId(src);
  if (!id || !cloudinaryConfigured()) return;
  try {
    await deleteFromCloudinary(id, "video");
  } catch (e) {
    console.error("[cloudinary] could not delete", e); // never block the owner's action because of this
  }
}
