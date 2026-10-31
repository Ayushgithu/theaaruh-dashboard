/* One-time migration for databases created before the shop existed:
 * gives every product a numeric `quantity` (units on hand) based on its old stock label.
 *   npm run migrate */
import mongoose from "mongoose";
import { ProductModel } from "../src/models/Product";

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in .env.local");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const old = await ProductModel.find({ quantity: { $exists: false } }).select("stock stockCount type").lean();
  for (const p of old as { _id: unknown; stock?: string; stockCount?: number; type?: string }[]) {
    const quantity = p.stock === "out" ? 0 : p.stock === "low" ? p.stockCount ?? 2 : p.type === "laptop" ? 3 : 12;
    await ProductModel.updateOne({ _id: p._id }, { $set: { quantity } });
  }
  console.log(`Updated ${old.length} products with a quantity. Edit units per product in the dashboard.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
