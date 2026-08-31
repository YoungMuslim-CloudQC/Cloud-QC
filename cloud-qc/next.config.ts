import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client"],
  // This app is a subdirectory; pin the workspace root so Next doesn't pick up
  // a stray lockfile from the parent folder.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
