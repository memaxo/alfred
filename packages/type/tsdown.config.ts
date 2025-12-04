import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/**/*.ts",
  sourcemap: false,
  dts: true,
});
