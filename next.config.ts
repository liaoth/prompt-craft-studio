import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
