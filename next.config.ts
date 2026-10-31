import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    // The dashboard has no landing page of its own: the root address opens the panel
    // (which sends signed-out visitors to /login).
    return [{ source: "/", destination: "/admin", permanent: false }];
  },
};

export default nextConfig;
