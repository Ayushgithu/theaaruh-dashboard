import type { Metadata } from "next";

import { brandName } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s | ${brandName} Admin` },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root min-h-dvh bg-surface">{children}</div>;
}
