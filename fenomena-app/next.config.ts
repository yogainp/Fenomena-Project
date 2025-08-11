import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure consistent port usage
  env: {
    PORT: '3000',
  },
  // Disable ESLint during build for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Webpack configuration for serverless Chrome
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  },
};

export default nextConfig;
