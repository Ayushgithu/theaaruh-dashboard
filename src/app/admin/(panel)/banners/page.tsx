import { BannerAdmin } from "@/components/admin/banner-admin";
import { getBanners } from "@/lib/repo";

export const metadata = { title: "Banners" };
export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  return <BannerAdmin initial={await getBanners()} />;
}
