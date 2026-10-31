import { after } from "next/server";
import { connectDB } from "@/lib/db";
import { AdminModel } from "@/models/Admin";
import { forgotSchema } from "@/lib/validation";
import { fail, ok, publicRoute, readJson } from "@/lib/api-helpers";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { newResetToken, sha256 } from "@/lib/tokens";

/** Base URL for the emailed link. Never taken from request headers in production (prevents reset-link poisoning). */
function baseUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return new URL(req.url).origin;
  return null;
}

export const POST = publicRoute(async (req) => {
  const parsed = forgotSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Enter a valid email address.", 400);
  const email = parsed.data.email.toLowerCase();

  if (!rateLimit(`forgot-ip:${clientIp(req)}`, 5, 15 * 60_000) || !rateLimit(`forgot-email:${email}`, 3, 15 * 60_000)) {
    return fail("Too many requests. Please try again in a few minutes.", 429);
  }

  await connectDB();
  const admin = await AdminModel.findOne({ email });
  if (admin) {
    const token = newResetToken();
    admin.resetTokenHash = sha256(token);
    admin.resetExpires = new Date(Date.now() + 60 * 60_000); // 1 hour
    await admin.save();

    const base = baseUrl(req);
    if (!base) {
      console.error("[forgot-password] NEXT_PUBLIC_DASHBOARD_URL is not set; cannot build the reset link.");
    } else {
      const link = `${base}/login?mode=reset&token=${token}&email=${encodeURIComponent(email)}`;
      // Sent after the response, so the reply time is the same whether or not the email exists.
      after(async () => {
        try { await sendPasswordResetEmail({ to: admin.email, name: admin.name, link }); }
        catch (e) { console.error("[forgot-password] email failed:", e instanceof Error ? e.message : e); }
      });
    }
  }
  // Same answer for existing and unknown emails, so nobody can discover which emails are admins.
  return ok({ ok: true });
});
