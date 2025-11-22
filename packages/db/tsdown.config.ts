import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  clean: true,
  dts: {
    transformer: "typescript",
  },
});
