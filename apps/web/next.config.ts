import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bulk inventory imports can carry many thousands of rows.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
