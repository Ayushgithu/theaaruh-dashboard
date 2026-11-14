import { SizeGuideAdmin } from "@/components/admin/size-guide-admin";
import { getSizeGuideItems } from "@/lib/repo-size-guides";

export const metadata = { title: "Size guides" };
export const dynamic = "force-dynamic";

export default async function AdminSizeGuidesPage() {
  return <SizeGuideAdmin initial={await getSizeGuideItems()} />;
}