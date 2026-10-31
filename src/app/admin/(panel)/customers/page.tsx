import { CustomersAdmin } from "@/components/admin/customers-admin";
import { getCustomers } from "@/lib/repo-shop";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  return <CustomersAdmin initial={await getCustomers()} />;
}
