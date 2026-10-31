import { StoreRulesAdmin } from "@/components/admin/store-rules-admin";
import { getRules } from "@/lib/settings";

export const metadata = { title: "Store rules" };
export const dynamic = "force-dynamic";

export default async function StoreRulesPage() {
  return <StoreRulesAdmin initial={await getRules(true)} />;
}
