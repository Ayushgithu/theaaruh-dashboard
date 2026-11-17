import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ImageModel } from "@/models/Image";


/** Asks Cloudinary for the best format and quality for each browser (f_auto,q_auto). */
const optimized = (url: string, kind: "image" | "video") => url.replace(`/${kind}/upload/`, `/${kind}/upload/f_auto,q_auto/`);

/** Looks the media record up in MongoDB and shows it: redirects to its Cloudinary URL, or serves the stored bytes (older records). */
export async function mediaResponse(id: string, kind: "image" | "video") {
  if (!mongoose.isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDB();
  const doc: any = await ImageModel.findById(id);
  if (!doc || (doc.resourceType ?? "image") !== kind) return new Response("Not found", { status: 404 });
  const cache = "public, max-age=31536000, immutable"; // a media id never changes content
  if (doc.url) return new Response(null, { status: 302, headers: { Location: optimized(doc.url, kind), "Cache-Control": cache } });
  if (!doc.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(doc.data), { headers: { "Content-Type": doc.contentType ?? "image/webp", "Cache-Control": cache } });
}
