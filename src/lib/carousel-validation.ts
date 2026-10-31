import { z } from "zod";

const link = z.string().trim().max(300).refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), "Use a page path such as /shop or a full https:// link");

export const slideInput = z.object({
  title: z.string().trim().min(2, "Enter a name for this slide").max(120),
  href: link.default(""),
  image: z.string().trim().min(1, "Add the main image"),
  mobileImage: z.string().trim().nullish(),
  active: z.boolean().default(true),
});

export const brandInput = z.object({
  name: z.string().trim().min(1, "Enter the brand name").max(60),
  logo: z.string().trim().nullish(),
  href: link.default(""),
  active: z.boolean().default(true),
});

export const reorderInput = z.object({ ids: z.array(z.string()).min(1).max(200) });
