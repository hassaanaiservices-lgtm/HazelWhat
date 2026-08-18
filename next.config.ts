import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
