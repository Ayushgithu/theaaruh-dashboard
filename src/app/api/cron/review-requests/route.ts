import { runAutoReviewRequests } from "@/lib/review-requests";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
 * Without CRON_SECRET set, nobody can run it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await runAutoReviewRequests());
  } catch (e) {
    console.error("[cron] review requests failed:", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}