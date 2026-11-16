import { z } from "zod";

export const collectionInput = z.object({
  name: z.string().trim().min(2, "Enter a name for this collection").max(40, "Keep the name under 40 characters"),
  description: z.string().trim().max(200, "Keep the description under 200 characters").default(""),
  image: z.string().regex(/^\/api\/images\/[a-f0-9]{24}$/, "Invalid image").optional().nullable(),
  products: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(500).default([]),
  active: z.boolean().default(true),
});