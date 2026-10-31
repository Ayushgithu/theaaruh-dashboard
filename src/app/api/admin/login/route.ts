import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { AdminModel } from "@/models/Admin";
import { loginSchema } from "@/lib/validation";
import { createSession } from "@/lib/auth";
import { fail, ok, publicRoute, readJson } from "@/lib/api-helpers";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.n8Fz1hQ3eYQ7tW3o5mR5r0qVYb3K";

export const POST = publicRoute(async (req) => {
  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Enter your email and password.", 400);
  const v = parsed.data;
  const email = v.email.toLowerCase();
  if (!rateLimit(`login:${clientIp(req)}:${email}`, 8, 15 * 60_000)) return fail("Too many attempts. Please wait 15 minutes and try again.", 429);

  await connectDB();
  const admin = await AdminModel.findOne({ email });
  const good = await bcrypt.compare(v.password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !good) return fail("Incorrect email or password.", 401);

  await createSession({ id: String(admin._id), email: admin.email, name: admin.name });
  return ok({ ok: true });
});
