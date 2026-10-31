import { EnquiryAdmin } from "@/components/admin/enquiry-admin";
import { getEnquiries } from "@/lib/repo";

export const metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

export default async function AdminEnquiriesPage() {
  return <EnquiryAdmin initial={await getEnquiries()} />;
}
