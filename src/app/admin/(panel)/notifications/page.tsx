import { NotificationsAdmin } from "@/components/admin/notifications-admin";
import { pushConfigured, subscriberCount } from "@/lib/push";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const configured = pushConfigured();
  return <NotificationsAdmin configured={configured} subscribers={configured ? await subscriberCount().catch(() => 0) : 0} />;
}
