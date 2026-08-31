import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client"],
  // This app is a subdirectory; pin the workspace root so Next doesn't pick up
  // a stray lockfile from the parent folder.
  turbopack: { root: path.resolve(__dirname) },
  // Allow loading the dev server over the LAN (e.g. testing on a phone).
  // Without this, Next 16 blocks /_next/static chunks for non-localhost hosts,
  // which breaks all client-side interactivity (ratings, map, etc.).
  allowedDevOrigins: ["192.168.1.160"],
};

export default nextConfig;
