import { SettingsAdmin } from "@/components/admin/settings-admin";
import { getAdmins } from "@/lib/repo";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [admins, me] = await Promise.all([getAdmins(), getSession()]);
  return <SettingsAdmin initial={admins} meId={me?.id ?? ""} />;
}
