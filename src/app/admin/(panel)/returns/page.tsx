import { connectDB } from "@/lib/db";
import { ReturnModel } from "@/models/ReturnRequest";
import { ReturnsAdmin } from "@/components/admin/returns-admin";
import { toReturn } from "@/lib/repo-returns";
import { shiprocketConfigured } from "@/lib/shiprocket";
import { razorpayConfigured } from "@/lib/razorpay";
import { getRules } from "@/lib/settings";

export const metadata = { title: "Returns" };
export const dynamic = "force-dynamic";

export default async function AdminReturnsPage() {
  await connectDB();
  const docs = await ReturnModel.find({}).sort({ createdAt: -1 }).limit(300).lean();
  const rules = await getRules();
  return <ReturnsAdmin initial={docs.map(toReturn)} shiprocket={shiprocketConfigured()} online={razorpayConfigured()} wallet={{ bonus: rules.wallet.enabled ? rules.wallet.bonusPercent : 0 }} />;
}
