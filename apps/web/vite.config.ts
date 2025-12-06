import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import * as fumadocsConfig from "./fumadocs.config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const serverOnlyRegex = [
  /^@alfred\/agent(?:\/.*)?$/,
  /^@alfred\/policy(?:\/.*)?$/,
  /^@alfred\/db(?:\/.*)?$/,
];
const serverOnlyPackages = ["@alfred/agent", "@alfred/policy", "@alfred/db"];

// Browser-only packages that use WebGPU/Canvas APIs - must be externalized from SSR
const browserOnlyRegex = [/^@alfred\/cortex(?:\/.*)?$/];
const browserOnlyPackages = ["@alfred/cortex"];
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

/**
 * FIX: Provide fallback for fumadocs virtual modules in SSR
 * fumadocs-mdx uses virtual modules (fumadocs-mdx:collections/*) that may not resolve in SSR.
 * This plugin redirects them to the generated .source/ files.
 */
const fumadocsVirtualPlugin = {
  name: "fumadocs-virtual-fallback",
  resolveId(id: string) {
    if (id === "fumadocs-mdx:collections/browser") {
      return resolve(__dirname, ".source/browser.ts");
    }
    if (id === "fumadocs-mdx:collections/server") {
      return resolve(__dirname, ".source/server.ts");
    }
    return;
  },
};

/**
 * FIX: Transform fumadocs-ui useEffectEvent imports
 * fumadocs-ui@16.x imports useEffectEvent from 'react' which doesn't exist in React 19.1.0 stable.
 * This plugin transforms those imports to use @radix-ui/react-use-effect-event's polyfill instead.
 */
const useEffectEventShimPlugin = {
  name: "useEffectEvent-shim",
  transform(code: string, id: string) {
    // Only transform fumadocs files that import useEffectEvent from react
    if (!(id.includes("fumadocs") && code.includes("useEffectEvent"))) {
      return;
    }

    // Check if this file imports useEffectEvent from react
    const hasDirectReactImport =
      /import\s*\{[^}]*useEffectEvent[^}]*\}\s*from\s*['"]react['"]/.test(code);
    if (!hasDirectReactImport) {
      return;
    }

    let transformed = code;

    // Remove useEffectEvent from the react import
    transformed = transformed.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]react['"]/g,
      (_match, imports) => {
        const importList = imports
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => s && s !== "useEffectEvent");
        if (importList.length === 0) {
          return "";
        }
        return `import { ${importList.join(", ")} } from 'react'`;
      }
    );

    // Add the useEffectEvent import from radix-ui at the top
    if (transformed.includes("'use client'")) {
      transformed = transformed.replace(
        "'use client';",
        "'use client';\nimport { useEffectEvent } from '@radix-ui/react-use-effect-event';"
      );
    } else {
      transformed = `import { useEffectEvent } from '@radix-ui/react-use-effect-event';\n${transformed}`;
    }

    return { code: transformed, map: null };
  },
};

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@alfred/agent",
      "@alfred/agent/preference/prompt",
      "@alfred/policy",
      "@alfred/db",
      "fumadocs-mdx:collections/browser",
      "fumadocs-mdx:collections/server",
      ...serverOnlyDeps,
    ],
  },
  ssr: {
    external: [
      ...serverOnlyDeps,
      ...serverOnlyPackages,
      ...serverOnlyRegex,
      // Browser-only packages (WebGPU) - externalize from SSR
      ...browserOnlyPackages,
      ...browserOnlyRegex,
    ],
    noExternal: [/^fumadocs-mdx:collections\/.*/, "fumadocs-mdx"],
    resolve: {
      alias: {
        "node-pty": resolve(__dirname, "./src/stubs/node-pty.ts"),
      },
    },
  },
  build: {
    // Enable tree shaking and minification
    minify: "esbuild",
    target: "esnext",
    rollupOptions: {
      external: [...serverOnlyDeps, ...serverOnlyRegex],
      output: {
        // Enable tree shaking for better dead code elimination
        // Conservative manualChunks to avoid circular dependencies that break CSS manifest plugin
        manualChunks: (id) => {
          // Only split truly independent, large libraries to avoid circular chunk dependencies
          // Tree shaking still works via sideEffects configuration in package.json files
          if (id.includes("node_modules")) {
            // Shiki (syntax highlighting) - largest bundle, completely independent
            if (id.includes("shiki")) {
              return "shiki-vendor";
            }
            // All other vendors stay together to avoid circular deps
            // Vite's default chunking will still optimize
          }
          return undefined;
        },
      },
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    conditions: ["bun", "module", "import", "default"],
    alias: {
      "node-pty": resolve(__dirname, "./src/stubs/node-pty.ts"),
    },
  },
  plugins: [
    fumadocsVirtualPlugin,
    useEffectEventShimPlugin,
    tsconfigPaths(),
    tailwindcss(),
    mdx(fumadocsConfig),
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
