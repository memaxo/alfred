import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/**/*.ts", "assistant/src/**/*.ts"],
  format: ["esm"],
  clean: true,
  dts: {
    transformer: "typescript",
  },
});
