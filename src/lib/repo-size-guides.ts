import { connectDB } from "./db";
import { SizeGuideModel } from "@/models/SizeGuide";
import { DEFAULT_SIZE_GUIDES } from "./size-guide-defaults";
import type { SizeGuideItem } from "./size-guide-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "guide";

const toItem = (d: Doc): SizeGuideItem => ({
  id: String(d._id), name: d.name, slug: d.slug, unit: d.unit ?? "inches",
  columns: (d.columns ?? []).map(String), rows: (d.rows ?? []).map((r: unknown[]) => r.map(String)), tips: (d.tips ?? []).map(String),
  active: !!d.active, order: d.order ?? 0,
});

/** All size guides. The first time, the two starter charts (Women, Kids) are saved so the owner can edit them. */
export async function getSizeGuideItems(): Promise<SizeGuideItem[]> {
  await connectDB();
  if ((await SizeGuideModel.estimatedDocumentCount()) === 0) {
    try {
      await SizeGuideModel.insertMany(DEFAULT_SIZE_GUIDES.map((g, order) => ({ ...g, active: true, order })), { ordered: false });
    } catch { /* two requests seeding at once: the unique slug keeps it to one copy */ }
  }
  const docs = (await SizeGuideModel.find({}).sort({ order: 1, createdAt: 1 }).lean()) as Doc[];
  return docs.map(toItem);
}

/** A slug nobody else uses (adds -2, -3… when taken). A guide keeps its slug when renamed, because products refer to it. */
export async function uniqueGuideSlug(name: string): Promise<string> {
  await connectDB();
  const base = slugify(name);
  for (let i = 1; i < 200; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await SizeGuideModel.exists({ slug }))) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function nextGuideOrder(): Promise<number> {
  await connectDB();
  const last = (await SizeGuideModel.findOne({}).sort({ order: -1 }).select("order").lean()) as Doc | null;
  return (last?.order ?? -1) + 1;
}