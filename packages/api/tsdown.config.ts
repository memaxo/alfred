import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/**/*.ts",
  sourcemap: false,
  dts: true,
  // Externalize browser-only packages that can't be bundled for Node.js
  external: [
    "@alfred/cortex",
    /^@alfred\/cortex\/.*/,
  ],
});
