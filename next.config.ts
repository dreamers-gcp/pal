import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  /** Ensures landing-page animations resolve in all Next/Turbopack bundling paths. */
  transpilePackages: ["framer-motion"],
};

export default nextConfig;
