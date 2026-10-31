import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { AdminModel } from "@/models/Admin";
import { resetSchema } from "@/lib/validation";
import { fail, ok, publicRoute, readJson } from "@/lib/api-helpers";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sha256 } from "@/lib/tokens";

export const POST = publicRoute(async (req) => {
  if (!rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000)) return fail("Too many attempts. Please try again in a few minutes.", 429);

  const body = await readJson(req);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    const weak = parsed.error.issues.find((i) => i.path[0] === "password");
    return fail(weak ? weak.message : "This reset link is invalid or has expired. Please request a new one.", 400);
  }
  const { email, token, password } = parsed.data;

  await connectDB();
  const admin = await AdminModel.findOne({
    email: email.toLowerCase(),
    resetTokenHash: sha256(token),
    resetExpires: { $gt: new Date() },
  }).select("+resetTokenHash +resetExpires");
  if (!admin) return fail("This reset link is invalid or has expired. Please request a new one.", 400);

  admin.passwordHash = await bcrypt.hash(password, 10);
  admin.resetTokenHash = undefined; // single use
  admin.resetExpires = undefined;
  await admin.save();
  return ok({ ok: true });
});
