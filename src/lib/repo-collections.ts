import { connectDB } from "./db";
import { CollectionModel } from "@/models/Collection";
import type { CollectionItem } from "./collection-types";


type Doc = Record<string, any>;

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "collection";

const toItem = (d: Doc): CollectionItem => ({
  id: String(d._id), name: d.name, slug: d.slug, description: d.description ?? "", image: d.image || undefined,
  products: (d.products ?? []).map(String), active: !!d.active, order: d.order ?? 0,
});

export async function getCollectionItems(): Promise<CollectionItem[]> {
  await connectDB();
  const docs = (await CollectionModel.find({}).sort({ order: 1, createdAt: 1 }).lean()) as Doc[];
  return docs.map(toItem);
}

/** A slug nobody else uses (adds -2, -3… when taken). A collection keeps its slug when renamed, so links keep working. */
export async function uniqueCollectionSlug(name: string): Promise<string> {
  await connectDB();
  const base = slugify(name);
  for (let i = 1; i < 200; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await CollectionModel.exists({ slug }))) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function nextCollectionOrder(): Promise<number> {
  await connectDB();
  const last = (await CollectionModel.findOne({}).sort({ order: -1 }).select("order").lean()) as Doc | null;
  return (last?.order ?? -1) + 1;
}