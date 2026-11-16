import { VideoAdmin } from "@/components/admin/video-admin";
import { getVideoItems, getVideoSection } from "@/lib/repo-videos";
import { getProducts } from "@/lib/repo";

export const metadata = { title: "Videos" };
export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const [items, section, products] = await Promise.all([getVideoItems(), getVideoSection(), getProducts("clothing")]);
  const pick = products.map((p) => ({ id: p.id, name: p.name, image: p.images?.[0], price: p.price, category: p.category }));
  return <VideoAdmin initial={items} section={section} products={pick} />;
}