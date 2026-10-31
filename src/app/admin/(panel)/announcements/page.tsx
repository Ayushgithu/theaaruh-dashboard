import { AnnouncementAdmin } from "@/components/admin/announcement-admin";
import { getAnnouncements } from "@/lib/repo";

export const metadata = { title: "Top bar" };
export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  return <AnnouncementAdmin initial={await getAnnouncements()} />;
}
