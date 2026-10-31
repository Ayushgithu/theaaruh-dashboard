import { ProductAdmin } from "@/components/admin/product-admin";
import { getProducts } from "@/lib/repo";

export const metadata = { title: "Accessories" };
export const dynamic = "force-dynamic";

export default async function AdminAccessoriesPage() {
  return <ProductAdmin type="accessory" initial={await getProducts("accessory")} />;
}
