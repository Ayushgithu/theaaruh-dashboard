import { CouponAdmin } from "@/components/admin/coupon-admin";
import { getAdminCoupons, getPickCollections, getPickCustomers } from "@/lib/repo-coupons";
import { getProducts } from "@/lib/repo";

export const metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const [coupons, collections, products, customers] = await Promise.all([getAdminCoupons(), getPickCollections(), getProducts("clothing"), getPickCustomers()]);
  const pick = products.map((p) => ({ id: p.id, name: p.name, image: p.images?.[0], price: p.price, category: p.category }));
  return <CouponAdmin initial={coupons} collections={collections} products={pick} customers={customers} />;
}