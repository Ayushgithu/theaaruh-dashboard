import { SlideAdmin } from "@/components/admin/slide-admin";
import { getSlides } from "@/lib/repo-carousel";

export const metadata = { title: "Hero carousel" };
export const dynamic = "force-dynamic";

export default async function AdminSlidesPage() {
  return <SlideAdmin initial={await getSlides()} />;
}
