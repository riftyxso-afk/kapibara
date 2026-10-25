import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@kapibara/core": source("./packages/core/src/index.ts"),
      "@kapibara/policy": source("./packages/policy/src/index.ts"),
      "@kapibara/scanners": source("./packages/scanners/src/index.ts"),
      "@kapibara/mcp": source("./packages/mcp/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/*/tests/**/*.test.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/cli.ts"],
    },
  },
});
