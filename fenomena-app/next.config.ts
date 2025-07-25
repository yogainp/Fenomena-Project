import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure consistent port usage
  env: {
    PORT: '3000',
  },
};

export default nextConfig;
