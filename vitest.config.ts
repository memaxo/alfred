import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.tsbuild/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/test/**",
        "**/__tests__/**",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});

