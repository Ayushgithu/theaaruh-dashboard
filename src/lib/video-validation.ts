import { z } from "zod";

const id24 = z.string().regex(/^[a-f0-9]{24}$/);

export const videoInput = z.object({
  title: z.string().trim().max(60, "Keep the title under 60 characters").default(""),
  source: z.string().trim().min(1, "Upload a video or paste a link").max(600),
  poster: z.string().regex(/^\/api\/images\/[a-f0-9]{24}$/, "Invalid image").optional().nullable(),
  products: z.array(id24).max(4, "Pick up to 4 products").default([]),
  active: z.boolean().default(true),
});

export const videoSectionInput = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(2, "Enter a heading").max(40, "Keep the heading under 40 characters"),
  subtitle: z.string().trim().max(120, "Keep the line under 120 characters").default(""),
});