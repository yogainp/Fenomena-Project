import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure consistent port usage
  env: {
    PORT: '3000',
  },
  // Note: instrumentation.ts is enabled by default in Next.js 15
  // Disable ESLint and TypeScript during build for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Output configuration for cPanel deployment
  output: 'standalone',
  // Webpack configuration for serverless Chrome
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  },
  // External packages for server components
  serverExternalPackages: ['puppeteer'],
};

export default nextConfig;
