import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a build-time marker Next resolves itself; it isn't
      // a real installed package, so importing a server module under vitest
      // fails on it. Stubbed to an empty module so server-side logic stays
      // unit-testable. It doesn't weaken the guard — that's enforced by the
      // Next build, not at test time.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
});
