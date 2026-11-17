import { ReviewAdmin } from "@/components/admin/review-admin";
import { getAdminReviews } from "@/lib/repo-reviews";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  return <ReviewAdmin initial={await getAdminReviews()} />;
}