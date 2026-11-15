import { ProductModel } from "@/models/Product";
import type { ProductInput } from "./validation";
import { artFor } from "./repo";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "product";

export async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await ProductModel.exists({ slug }); i++) slug = `${base}-${i}`;
  return slug;
}

/** Maps validated dashboard input to database fields (stock status, card highlights, etc). */
export function fieldsFromInput(v: ProductInput) {
  const units = v.sizes.length ? v.sizes.reduce((n, s) => n + s.qty, 0) : v.units ?? 0; // with sizes, the total is their sum
  const stock = units === 0 ? "out" : units <= 3 ? "low" : "in-stock";
  return {
    quantity: units,
    sizes: v.sizes,
    kidSizes: v.kidSizes,
    colors: v.colors,
    fabric: v.fabric,
    washCare: v.washCare,
    sizeGuides: v.sizeGuides,
    fit: v.fit,
    occasion: v.occasion,
    badges: v.badges,
    videoUrl: v.videoUrl,
    returnable: v.returnable,
    exchangeable: v.exchangeable,
    type: v.type,
    name: v.name,
    brand: v.brand,
    category: v.category,
    price: v.price,
    mrp: v.mrp && v.mrp > v.price ? v.mrp : undefined,
    condition: v.condition,
    stock,
    stockCount: stock === "low" ? units : undefined,
    featured: v.featured,
    tags: v.tags,
    specs: v.specs,
    highlights: v.highlights.length ? v.highlights : Object.values(v.specs).slice(0, 3),
    ramGb: v.type === "laptop" ? v.ramGb : undefined,
    cpu: v.type === "laptop" ? v.cpu || undefined : undefined,
    screenIn: v.type === "laptop" ? v.screenIn : undefined,
    included: v.included,
    conditionNotes: v.conditionNotes,
    description: v.description,
    warranty: v.warranty,
    images: v.images,
    art: artFor({ type: v.type, brand: v.brand, category: v.category, tags: v.tags, name: v.name }),
  };
}