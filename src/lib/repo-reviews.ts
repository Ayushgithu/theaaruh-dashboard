import mongoose from "mongoose";
import { connectDB } from "./db";
import { ReviewModel } from "@/models/Review";
import { ProductModel } from "@/models/Product";
import "@/models/User"; // registers the model used by populate("user")
import { cloudinaryConfigured, deleteFromCloudinary } from "./cloudinary";
import type { AdminReview } from "./review-types";

/** Every review (newest first) with the product's name and the customer's email, for Dashboard → Reviews. */
export async function getAdminReviews(): Promise<AdminReview[]> {
  await connectDB();
  const docs: any[] = await ReviewModel.find().sort({ createdAt: -1 }).limit(1000).populate("user", "email name").lean();
  const ids = [...new Set(docs.map((d) => String(d.product)))];
  const products: any[] = await ProductModel.find({ _id: { $in: ids } }).select("name images").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return docs.map((d) => {
    const p = byId.get(String(d.product));
    return {
      id: String(d._id),
      productId: String(d.product),
      productName: p?.name ?? "Deleted product",
      productImage: p?.images?.[0],
      customerName: d.name || d.user?.name || "Customer",
      customerEmail: d.user?.email ?? "",
      rating: d.rating,
      title: d.title ?? "",
      text: d.text,
      fit: d.fit ?? "",
      sizeBought: d.sizeBought ?? "",
      photos: d.photos ?? [],
      verified: !!d.verified,
      status: d.status,
      featured: !!d.featured,
      reply: d.reply?.text || undefined,
      createdAt: new Date(d.createdAt).toISOString(),
    };
  });
}

/** Re-counts a product's approved reviews so the stars on the shop and product page stay correct. */
export async function recalcRating(productId: unknown) {
  if (!mongoose.isValidObjectId(String(productId))) return;
  const [agg] = await ReviewModel.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: "approved" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await ProductModel.updateOne({ _id: productId }, { $set: { ratingAvg: agg ? Math.round(agg.avg * 100) / 100 : 0, ratingCount: agg?.count ?? 0 } });
}

/** The id of an uploaded review photo inside Cloudinary (needed to delete it): .../image/upload/[transforms/]v123/store/reviews/abc.webp → store/reviews/abc */
export function cloudinaryImageId(url: string): string | null {
  const m = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(.+)$/.exec(url.split("?")[0]);
  if (!m) return null;
  const parts = m[1].split("/");
  const v = parts.findIndex((p) => /^v\d+$/.test(p));
  const rest = v >= 0 ? parts.slice(v + 1) : parts;
  return rest.length ? rest.join("/").replace(/\.[a-z0-9]+$/i, "") : null;
}

/** Removes review photos from Cloudinary. Never blocks the owner's action if Cloudinary is unreachable. */
export async function deleteReviewPhotos(urls: string[]) {
  if (!cloudinaryConfigured()) return;
  await Promise.all(urls.map(async (u) => {
    const id = cloudinaryImageId(u);
    if (!id) return;
    try { await deleteFromCloudinary(id, "image"); } catch (e) { console.error("[cloudinary] could not delete review photo", e); }
  }));
}