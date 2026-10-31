import { ProductAdmin } from "@/components/admin/product-admin";
import { getProducts } from "@/lib/repo";

export const metadata = { title: "Clothing" };
export const dynamic = "force-dynamic";

export default async function AdminClothingPage() {
  return <ProductAdmin type="clothing" initial={await getProducts("clothing")} />;
}
