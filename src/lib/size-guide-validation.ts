import { z } from "zod";

export const sizeGuideInput = z.object({
  name: z.string().trim().min(2, "Enter a name for this chart").max(40),
  unit: z.string().trim().max(20).default("inches"),
  columns: z.array(z.string().trim().min(1, "Every column needs a heading").max(24)).min(2, "Add at least 2 columns").max(8),
  rows: z.array(z.array(z.string().trim().max(24))).min(1, "Add at least one row").max(40),
  tips: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  active: z.boolean().default(true),
}).refine((v) => v.rows.every((r) => r.length === v.columns.length), { path: ["rows"], message: "Every row needs a value for each column" });