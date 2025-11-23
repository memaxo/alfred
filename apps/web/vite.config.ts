import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const serverOnlyRegex = [
  /^@alfred\/agent(?:\/.*)?$/,
  /^@alfred\/policy(?:\/.*)?$/,
  /^@alfred\/db(?:\/.*)?$/,
];
const serverOnlyPackages = ["@alfred/agent", "@alfred/policy", "@alfred/db"];
const serverOnlyDeps = [
  "bun", 
  "bun:sqlite",
  "node:stream",
  "node:fs", 
  "node:path",
  "node:util",
  "node:crypto",
  "node:buffer",
  "node:url",
  "node:net",
  "node:http",
  "node:https",
  "node:zlib",
  "node:tls",
  "node:os",
  "node:process",
  "node:child_process",
  "stream",
  "fs",
  "path",
  "util",
  "crypto",
  "buffer",
  "url",
  "net",
  "http",
  "https",
  "zlib",
  "tls",
  "os",
  "process",
  "child_process",
  "onnxruntime-node",
];

const tanstackHeadScriptsStub = {
  name: "tanstack-head-scripts-stub",
  resolveId(id: string) {
    if (id === "tanstack-start-injected-head-scripts:v") {
      return id;
    }
  },
  load(id: string) {
    if (id === "tanstack-start-injected-head-scripts:v") {
      return "export const scripts = [];";
    }
  },
};

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@alfred/agent",
      "@alfred/agent/preference/prompt",
      "@alfred/policy",
      "@alfred/db",
      ...serverOnlyDeps,
    ],
  },
  ssr: {
    external: [...serverOnlyDeps, ...serverOnlyPackages, ...serverOnlyRegex],
    noExternal: [],
    resolve: {
      alias: {
        "node-pty": resolve(__dirname, "./src/stubs/node-pty.ts"),
      },
    },
  },
  build: {
    rollupOptions: {
      external: [...serverOnlyDeps, ...serverOnlyRegex],
    },
  },
  resolve: {
    conditions: ["bun", "module", "import", "default"],
    alias: {
      "node-pty": resolve(__dirname, "./src/stubs/node-pty.ts"),
    },
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    // tanstackHeadScriptsStub, // Removed to potentially fix preamble injection
    tanstackStart({
      prerender: {
        enabled: false,
        autoStaticPathsDiscovery: true,
        crawlLinks: true,
      },
    }),
    viteReact(),
  ],
});
