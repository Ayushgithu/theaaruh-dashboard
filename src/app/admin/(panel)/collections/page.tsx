import { CollectionAdmin } from "@/components/admin/collection-admin";
import { getCollectionItems } from "@/lib/repo-collections";
import { getProducts } from "@/lib/repo";

export const metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const [items, products] = await Promise.all([getCollectionItems(), getProducts("clothing")]);
  const pick = products.map((p) => ({ id: p.id, name: p.name, image: p.images?.[0], price: p.price, category: p.category }));
  return <CollectionAdmin initial={items} products={pick} />;
}