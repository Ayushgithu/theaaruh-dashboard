import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { AdminModel } from "@/models/Admin";
import { passwordSchema } from "@/lib/validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";

export const POST = adminRoute(async (req, _ctx, session) => {
  const v = passwordSchema.parse(await readJson(req));
  await connectDB();
  const admin = await AdminModel.findById(session.id);
  if (!admin || !(await bcrypt.compare(v.current, admin.passwordHash))) throw new HttpError("Your current password is incorrect.", 400);
  admin.passwordHash = await bcrypt.hash(v.next, 10);
  await admin.save();
  return ok({ ok: true });
});
