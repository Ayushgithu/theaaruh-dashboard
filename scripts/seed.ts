/* Sets up a fresh database.
 *   npm run seed         -> creates the first admin + sample products/banners (only if the collections are empty)
 *   npm run seed:admin   -> creates ONLY the admin (use this for a real, empty store)
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME and MONGODB_URI from .env.local */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { AdminModel } from "../src/models/Admin";
import { ProductModel } from "../src/models/Product";
import { BannerModel } from "../src/models/Banner";
import { AnnouncementModel } from "../src/models/Announcement";
import { banners, products } from "../src/lib/seed-data";

const adminOnly = process.argv.includes("--admin-only");

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!uri) throw new Error("MONGODB_URI is missing in .env.local");
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local first");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB");

  if (await AdminModel.exists({ email })) {
    console.log(`Admin ${email} already exists (password unchanged)`);
  } else {
    await AdminModel.create({ name: process.env.ADMIN_NAME || "Store owner", email, passwordHash: await bcrypt.hash(password, 10) });
    console.log(`Created admin ${email}`);
  }

  if (!adminOnly) {
    if ((await ProductModel.countDocuments()) === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await ProductModel.insertMany(products.map(({ id, createdAt, ...p }) => ({ ...p, quantity: (p.sizes ?? []).reduce((n, s) => n + s.qty, 0), createdAt: new Date(createdAt) })));
      console.log(`Inserted ${products.length} sample products`);
    } else console.log("Products already exist, skipping sample products");

    if ((await BannerModel.countDocuments()) === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await BannerModel.insertMany(banners.map(({ id, ...b }) => b));
      console.log(`Inserted ${banners.length} sample banners`);
    } else console.log("Banners already exist, skipping sample banners");

    if ((await AnnouncementModel.countDocuments()) === 0) {
      await AnnouncementModel.insertMany([
        { text: "🚚 Free delivery on orders above ₹999", active: true },
        { text: "✨ New festive collection is live", href: "/shop?sort=new", active: true },
        { text: "💬 Chat with us on WhatsApp for sizing help", active: true },
      ]);
      console.log("Inserted 3 sample top-bar messages");
    } else console.log("Top-bar messages already exist, skipping");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
