import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": join(rootDir, "src"),
    },
  },
});
