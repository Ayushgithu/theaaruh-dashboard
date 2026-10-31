import { connectDB } from "@/lib/db";
import { ReturnModel } from "@/models/ReturnRequest";
import { adminRoute, ok } from "@/lib/api-helpers";
import { toReturn } from "@/lib/repo-returns";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (req) => {
  const status = new URL(req.url).searchParams.get("status");
  await connectDB();
  const docs = await ReturnModel.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(300).lean();
  return ok({ returns: docs.map(toReturn) });
});
