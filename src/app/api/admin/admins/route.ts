import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { AdminModel } from "@/models/Admin";
import { newAdminSchema } from "@/lib/validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req) => {
  const v = newAdminSchema.parse(await readJson(req));
  await connectDB();
  if (await AdminModel.exists({ email: v.email.toLowerCase() })) throw new HttpError("An admin with this email already exists.", 409);
  const doc = await AdminModel.create({ name: v.name, email: v.email, passwordHash: await bcrypt.hash(v.password, 10) });
  return ok({ id: String(doc._id), name: doc.name, email: doc.email }, 201);
});
