import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { z } from "zod";

import * as fumadocsConfig from "./fumadocs.config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

// TanStack Start currently uses Zod v3-style ZodFunction APIs (`args`/`returns`).
// Our workspace uses Zod v4, so add a small compat shim before importing TanStack.
function installZodFunctionCompat(): void {
  const g = globalThis as unknown as { __alfredZodFnCompat?: boolean };
  if (g.__alfredZodFnCompat) {
    return;
  }
  g.__alfredZodFnCompat = true;

  const fn = z.function();
  const proto = Object.getPrototypeOf(fn) as Record<string, unknown> | null;
  if (!proto || typeof proto !== "object") {
    return;
  }

  if (typeof proto.args !== "function") {
    Object.defineProperty(proto, "args", {
      value(this: { input?: (a: unknown) => unknown }, args: unknown) {
        if (typeof this.input !== "function") {
          throw new TypeError("zod_function_missing_input");
        }
        return this.input(args);
      },
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }

  if (typeof proto.returns !== "function") {
    Object.defineProperty(proto, "returns", {
      value(this: { output?: (a: unknown) => unknown }, out: unknown) {
        if (typeof this.output !== "function") {
          throw new TypeError("zod_function_missing_output");
        }
        return this.output(out);
      },
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
}

/**
 * Extract build-time constants for Vite define configuration
 */
function getBuildConstants(): Record<string, string> {
  const constants: Record<string, string> = {};

  // Get version from package.json
  try {
    const rootPackageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8")
    );
    constants.BUILD_VERSION = JSON.stringify(rootPackageJson.version || "dev");
  } catch {
    constants.BUILD_VERSION = JSON.stringify("dev");
  }

  // Try git describe for version
  try {
    const gitVersion = execSync("git describe --tags --always", {
      encoding: "utf8",
      cwd: resolve(__dirname, "../.."),
    }).trim();
    if (gitVersion) {
      constants.BUILD_VERSION = JSON.stringify(gitVersion);
    }
  } catch {
    // Ignore git errors
  }

  // Build timestamp
  constants.BUILD_TIME = JSON.stringify(new Date().toISOString());

  // Git commit
  try {
    const gitCommit = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      cwd: resolve(__dirname, "../.."),
    }).trim();
    constants.GIT_COMMIT = JSON.stringify(gitCommit);
  } catch {
    constants.GIT_COMMIT = JSON.stringify("unknown");
  }

  // Git branch
  try {
    const gitBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      cwd: resolve(__dirname, "../.."),
    }).trim();
    constants.GIT_BRANCH = JSON.stringify(gitBranch);
  } catch {
    constants.GIT_BRANCH = JSON.stringify("unknown");
  }

  // NODE_ENV
  constants.NODE_ENV = JSON.stringify(process.env.NODE_ENV || "development");

  // WebGPU Gating
  constants["import.meta.env.VITE_MINDSCAPE_WEBGPU"] = JSON.stringify(
    process.env.VITE_MINDSCAPE_WEBGPU || "1"
  );

  return constants;
}

const serverOnlyRegex = [
  /^@alfred\/agent(?:\/.*)?$/,
  /^@alfred\/api(?:\/.*)?$/,
  /^@alfred\/auth(?:\/.*)?$/,
  /^@alfred\/cognitive(?:\/.*)?$/,
  /^@alfred\/metrics(?:\/.*)?$/,
  /^@alfred\/policy(?:\/.*)?$/,
  /^@alfred\/db(?:\/.*)?$/,
  /^@alfred\/rerank(?:\/.*)?$/,
  /^@alfred\/runtime(?:\/.*)?$/,
  /^@alfred\/voice(?:\/.*)?$/,
];
const serverOnlyPackages = [
  "@alfred/agent",
  "@alfred/api",
  "@alfred/auth",
  "@alfred/cognitive",
  "@alfred/metrics",
  "@alfred/policy",
  "@alfred/db",
  "@alfred/rerank",
  "@alfred/runtime",
  "@alfred/voice",
];

// Browser-only packages that use WebGPU/Canvas APIs - must be externalized from SSR
const browserOnlyRegex = [/^@alfred\/cortex(?:\/.*)?$/];
const browserOnlyPackages = ["@alfred/cortex"];
const serverOnlyDeps = [
  "bun",
  "bun:sqlite",
  "prom-client",
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
  "node:module",
  "stream",
  "fs",
  // better-auth subpath exports don't resolve correctly on Linux runners
  "better-auth",
  "@better-auth/expo",
  "@better-auth/passkey",
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
    transformed = transformed.replaceAll(
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
    transformed = `import { useEffectEvent } from '@radix-ui/react-use-effect-event';\n${transformed}`;

    return { code: transformed, map: null };
  },
};

export default defineConfig(async () => {
  installZodFunctionCompat();
  const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");

  return {
    define: {
      ...getBuildConstants(),
    },
    server: isTestMode
      ? {
          hmr: false,
          watch: {
            // Prevent external processes (formatters/agents) from triggering HMR during e2e.
            ignored: ["**/*"],
          },
        }
      : undefined,
    optimizeDeps: {
      exclude: [
        "@alfred/agent",
        "@alfred/api",
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
      ] as unknown as string[],
      noExternal: [/^fumadocs-mdx:collections\/.*/, "fumadocs-mdx"],
    },
    build: {
      // Enable tree shaking and minification
      minify: "esbuild" as const,
      target: "esnext",
      rollupOptions: {
        external: [...serverOnlyDeps, ...serverOnlyRegex],
        onwarn: (warning: any, warn: any) => {
          // Unused external imports are harmless but noisy in build logs.
          if (warning.code === "UNUSED_EXTERNAL_IMPORT") {
            return;
          }
          warn(warning);
        },
        output: {
          // Enable tree shaking for better dead code elimination
          // Conservative manualChunks to avoid circular dependencies that break CSS manifest plugin
          manualChunks: (id: string) => {
            // Only split truly independent, large libraries to avoid circular chunk dependencies
            // Tree shaking still works via sideEffects configuration in package.json files
            // Shiki (syntax highlighting) - largest bundle, completely independent
            if (id.includes("node_modules") && id.includes("shiki")) {
              return "shiki-vendor";
            }
            // All other vendors stay together to avoid circular deps
            // Vite's default chunking will still optimize
          },
        },
      },
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 20_000,
    },
    resolve: {
      conditions: ["bun", "module", "import", "default"],
      alias: {
        ...(isTestMode
          ? {
              "prom-client": resolve(__dirname, "./src/stubs/prom-client.ts"),
            }
          : {}),
        "@alfred/db/repo": resolve(__dirname, "../../packages/db/src/repo"),
        "@alfred/db/schema": resolve(__dirname, "../../packages/db/src/schema"),
        "@alfred/db/metrics": resolve(
          __dirname,
          "../../packages/db/src/metrics.ts"
        ),
        "@alfred/db/client": resolve(
          __dirname,
          "../../packages/db/src/client.ts"
        ),
        "@alfred/db/testing": resolve(
          __dirname,
          "../../packages/db/src/testing.ts"
        ),
        "@alfred/rerank": resolve(
          __dirname,
          "../../packages/rerank/src/index.ts"
        ),
        "@alfred/rerank/cohere": resolve(
          __dirname,
          "../../packages/rerank/src/cohere.ts"
        ),
        "node-pty": resolve(__dirname, "./src/stubs/node-pty.ts"),
      },
    },
    plugins: [
      fumadocsVirtualPlugin,
      useEffectEventShimPlugin,
      tsconfigPaths({
        // `turbo -F web dev` runs with cwd at repo root. Without an explicit root,
        // vite-tsconfig-paths may traverse unrelated tsconfig files in the monorepo
        // (e.g. under `vendor/`), producing noisy tsconfck parse errors.
        root: __dirname,
        projects: [resolve(__dirname, "tsconfig.json")],
        ignoreConfigErrors: true,
      }),
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
  };
});
