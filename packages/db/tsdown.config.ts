import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  clean: true,
  // Disable tsdown's dts generation - use tsc -b separately for accurate types
  // tsdown's bundler was truncating Drizzle schema column types
  dts: false,
});
