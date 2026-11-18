import { ReviewsHub } from "@/components/admin/reviews-hub";
import { getAdminReviews } from "@/lib/repo-reviews";
import { getReviewRequestRows, getReviewRequestSettings } from "@/lib/review-requests";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const settings = await getReviewRequestSettings();
  const [reviews, requests] = await Promise.all([getAdminReviews(), getReviewRequestRows(settings.afterDays).catch(() => [])]);
  return <ReviewsHub reviews={reviews} requests={requests} settings={settings} />;
}