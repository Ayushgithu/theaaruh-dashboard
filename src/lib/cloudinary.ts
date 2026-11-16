import { createHash } from "node:crypto";
import { cloudinaryPublicId } from "./video-shared";

/**
 * Deletes a video from Cloudinary so unused files do not fill your storage.
 * Needs CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (server only). Without them it quietly does nothing and the
 * file just stays in your Cloudinary library, where you can delete it by hand.
 */
export async function deleteCloudinaryVideo(src: string): Promise<void> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  const id = cloudinaryPublicId(src);
  if (!cloud || !key || !secret || !id) return;
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1").update(`invalidate=true&public_id=${id}&timestamp=${timestamp}${secret}`).digest("hex");
    const body = new URLSearchParams({ public_id: id, timestamp: String(timestamp), api_key: key, signature, invalidate: "true" });
    await fetch(`https://api.cloudinary.com/v1_1/${cloud}/video/destroy`, { method: "POST", body });
  } catch (e) {
    console.error("[cloudinary] could not delete", e); // never block the owner's action because of this
  }
}