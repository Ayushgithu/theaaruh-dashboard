import { z } from "zod";

const objId = z.string().regex(/^[a-f0-9]{24}$/);
const when = z.string().nullable().optional().transform((v) => (v ? new Date(v) : null)).refine((d) => d === null || !Number.isNaN(+d), "Invalid date");

export const couponInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "Code must be 3–20 letters or numbers, no spaces (e.g. FESTIVE10)"),
  title: z.string().trim().max(60, "Keep the title under 60 characters").default(""),
  description: z.string().trim().max(160, "Keep the small print under 160 characters").default(""),
  type: z.enum(["percent", "flat", "shipping"]),
  value: z.coerce.number().int().min(0).max(1_000_000).default(0),
  maxDiscount: z.coerce.number().int().min(0).max(1_000_000).default(0),
  minOrder: z.coerce.number().int().min(0).max(10_000_000).default(0),
  startsAt: when,
  endsAt: when,
  usageLimit: z.coerce.number().int().min(0).max(1_000_000).default(0),
  perCustomer: z.coerce.number().int().min(0).max(1000).default(0),
  firstOrderOnly: z.boolean().default(false),
  scope: z.enum(["all", "products", "collections"]).default("all"),
  products: z.array(objId).max(1000).default([]),
  collections: z.array(objId).max(200).default([]),
  active: z.boolean().default(true),
  visible: z.boolean().default(true),
}).superRefine((v, ctx) => {
  const bad = (message: string, path: string) => ctx.addIssue({ code: "custom", message, path: [path] });
  if (v.type === "percent" && (v.value < 1 || v.value > 100)) bad("Percent off must be between 1 and 100", "value");
  if (v.type === "flat" && v.value < 1) bad("Enter the rupees to take off", "value");
  if (v.scope === "products" && !v.products.length) bad("Pick at least one product, or choose “All products”", "products");
  if (v.scope === "collections" && !v.collections.length) bad("Pick at least one collection, or choose “All products”", "collections");
  if (v.startsAt && v.endsAt && +v.endsAt <= +v.startsAt) bad("The end must be after the start", "endsAt");
});