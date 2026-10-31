import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";
import { fieldsFromInput, uniqueSlug } from "@/lib/product-write";
import { BULK_MAX, rowToProduct } from "@/lib/bulk";

const body = z.object({ rows: z.array(z.record(z.string(), z.string())).min(1, "The file has no products.").max(BULK_MAX, `Upload at most ${BULK_MAX} products at a time.`) });

/** Adds many products at once. Every row is validated again here; bad rows are reported, good rows are saved. */
export const POST = adminRoute(async (req) => {
  const { rows } = body.parse(await readJson(req));
  await connectDB();
  const created: string[] = [];
  const failed: { row: number; name: string; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rowToProduct(rows[i]);
    const input = r.input;
    if (!input) { failed.push({ row: i + 2, name: rows[i].name ?? "", error: r.error ?? "Invalid row" }); continue; }
    try {
      await ProductModel.create({ ...fieldsFromInput(input), slug: await uniqueSlug(input.name), views: 0 });
      created.push(input.name);
    } catch (e) { failed.push({ row: i + 2, name: input.name, error: e instanceof Error ? e.message : "Could not save" }); }
  }
  return ok({ created: created.length, failed }, created.length ? 201 : 200);
});
