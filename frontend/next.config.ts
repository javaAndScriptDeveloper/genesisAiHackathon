import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://platform-backend:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
