import type { Banner, ColorOpt, Product, SizeStock } from "./types";

/* Sample catalogue used ONLY by the seed script (npm run seed) so a fresh store does not look empty.
   Delete these from Admin → Clothing whenever you add your own pieces. The live website reads everything from MongoDB. */

const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const SIZES: SizeStock[] = [{ label: "S", qty: 4 }, { label: "M", qty: 6 }, { label: "L", qty: 6 }, { label: "XL", qty: 3 }, { label: "XXL", qty: 2 }];
const palette: Record<string, ColorOpt> = {
  maroon: { name: "Maroon", hex: "#8c1d40" }, green: { name: "Bottle Green", hex: "#166534" }, mustard: { name: "Mustard", hex: "#c99a1e" },
  navy: { name: "Navy", hex: "#1e3a5f" }, pink: { name: "Rose Pink", hex: "#d6577e" }, ivory: { name: "Ivory", hex: "#f3ead9" }, teal: { name: "Teal", hex: "#0f766e" },
};

interface Row { name: string; category: string; price: number; mrp: number; hue: number; colors: string[]; fabric: string; fit: string; occasion: string; badges?: string[]; featured?: boolean; sizes?: SizeStock[]; views: number; age: number }

const rows: Row[] = [
  { name: "Maroon Anarkali Suit Set", category: "Suit Sets", price: 2499, mrp: 3499, hue: 340, colors: ["maroon", "green"], fabric: "Pure cotton", fit: "A-line", occasion: "Festive", badges: ["Best Seller"], featured: true, views: 420, age: 3 },
  { name: "Mustard Straight Suit Set", category: "Suit Sets", price: 1899, mrp: 2699, hue: 45, colors: ["mustard", "navy"], fabric: "Rayon", fit: "Straight", occasion: "Casual", featured: true, views: 310, age: 6 },
  { name: "Bottle Green Palazzo Suit", category: "Suit Sets", price: 2199, mrp: 2999, hue: 150, colors: ["green"], fabric: "Georgette", fit: "Relaxed", occasion: "Festive", badges: ["Trending"], views: 280, age: 9 },
  { name: "Rose Pink Chanderi Saree", category: "Sarees", price: 3299, mrp: 4599, hue: 340, colors: ["pink", "ivory"], fabric: "Chanderi silk blend", fit: "Free drape", occasion: "Wedding", badges: ["Best Seller"], featured: true, sizes: [{ label: "Free Size", qty: 8 }], views: 390, age: 4 },
  { name: "Ivory Kota Doria Saree", category: "Sarees", price: 2799, mrp: 3799, hue: 40, colors: ["ivory", "teal"], fabric: "Kota Doria", fit: "Free drape", occasion: "Festive", sizes: [{ label: "Free Size", qty: 5 }], views: 190, age: 12 },
  { name: "Navy Printed Co-ord Set", category: "Co-ord Sets", price: 1599, mrp: 2299, hue: 220, colors: ["navy", "pink"], fabric: "Cotton blend", fit: "Relaxed", occasion: "Casual", badges: ["New"], featured: true, views: 260, age: 1 },
  { name: "Teal Block-Print Co-ord", category: "Co-ord Sets", price: 1799, mrp: 2499, hue: 175, colors: ["teal", "mustard"], fabric: "Pure cotton", fit: "Regular", occasion: "Casual", badges: ["New"], views: 150, age: 2 },
  { name: "Pink Tiered Maxi Dress", category: "Dresses", price: 2099, mrp: 2899, hue: 335, colors: ["pink", "maroon"], fabric: "Rayon crepe", fit: "Flared", occasion: "Party", badges: ["Trending"], views: 340, age: 5 },
  { name: "Ivory Chikankari Kurti", category: "Kurtis", price: 1299, mrp: 1899, hue: 38, colors: ["ivory"], fabric: "Cotton", fit: "Straight", occasion: "Daily wear", views: 210, age: 8 },
  { name: "Maroon Embroidered Kurti", category: "Kurtis", price: 1399, mrp: 1999, hue: 345, colors: ["maroon", "navy"], fabric: "Cotton silk", fit: "A-line", occasion: "Festive", badges: ["Deal"], featured: true, views: 230, age: 7 },
  { name: "Green Cotton Night Suit", category: "Co-ord Sets", price: 999, mrp: 1499, hue: 140, colors: ["green", "pink"], fabric: "Soft cotton", fit: "Relaxed", occasion: "Loungewear", badges: ["Deal"], views: 120, age: 15 },
  { name: "Mustard Gotta Patti Lehenga", category: "Lehengas", price: 5999, mrp: 8499, hue: 48, colors: ["mustard", "maroon"], fabric: "Art silk", fit: "Flared", occasion: "Wedding", sizes: [{ label: "S", qty: 2 }, { label: "M", qty: 2 }, { label: "L", qty: 1 }], views: 175, age: 10 },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const products: Product[] = rows.map((r, i) => ({
  id: `cl-${String(i + 1).padStart(3, "0")}`, slug: slugify(r.name), type: "clothing", name: r.name, brand: "", price: r.price, mrp: r.mrp,
  condition: "New", stock: "in-stock", category: r.category, tags: [],
  specs: { Fabric: r.fabric }, highlights: [`${r.fabric} fabric`, `${r.fit} fit`, `Perfect for ${r.occasion.toLowerCase()}`],
  included: [], conditionNotes: [],
  description: `${r.name} in soft, breathable ${r.fabric.toLowerCase()}. A ${r.fit.toLowerCase()} silhouette that is easy to carry all day — styled for ${r.occasion.toLowerCase()} moments. Replace this sample text with your own description.`,
  warranty: "", featured: !!r.featured, views: r.views, createdAt: day(r.age),
  art: { kind: "cloth", tone: "silver", hue: r.hue },
  sizes: r.sizes ?? SIZES, colors: r.colors.map((c) => palette[c]), fabric: r.fabric, fit: r.fit, occasion: r.occasion,
  washCare: "Hand wash separately in cold water. Do not bleach. Dry in shade. Iron on low heat.", badges: r.badges ?? [],
}));

export const banners: Banner[] = [
  { id: "bn-1", title: "Festive edit — up to 40% off", subtitle: "Suit sets, sarees and lehengas for every celebration.", cta: "Shop the sale", href: "/shop?sort=discount", theme: "blue", active: true },
];
