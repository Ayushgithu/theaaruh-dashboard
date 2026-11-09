import type { Metadata, Viewport } from "next";
import { ThemedToaster } from "@/components/themed-toaster";
import { themeInitScript } from "@/hooks/use-theme";
import { brandName } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s | ${brandName} Admin` },
  applicationName: `${brandName} Admin`,
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
