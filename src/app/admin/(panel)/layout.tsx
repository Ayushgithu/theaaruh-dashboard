import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login"); // server-side check: no admin page is ever sent to a signed-out visitor
  return <AdminShell admin={{ name: session.name, email: session.email }}>{children}</AdminShell>;
}
