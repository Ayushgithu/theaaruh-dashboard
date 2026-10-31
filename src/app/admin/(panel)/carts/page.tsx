import { CartsAdmin } from "@/components/admin/carts-admin";
import { getAdminCarts } from "@/lib/repo-shop";

export const metadata = { title: "Carts" };
export const dynamic = "force-dynamic";

export default async function AdminCartsPage() {
  return <CartsAdmin initial={await getAdminCarts()} />;
}
