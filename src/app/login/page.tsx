import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminLoginScreen } from "@/components/admin/login-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/admin"); // already signed in
  return <AdminLoginScreen />;
}
