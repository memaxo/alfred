import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/dom.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.tsbuild/**",
        "**/*.test.tsx",
        "**/*.spec.tsx",
        "**/test/**",
        "**/__tests__/**",
        "**/routeTree.gen.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    include: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});

