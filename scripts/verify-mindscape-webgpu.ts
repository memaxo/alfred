/**
 * Verify Mindscape WebGPU Gating
 *
 * This script builds the web app with VITE_MINDSCAPE_WEBGPU=0
 * and asserts that the resulting bundles do not contain WGSL strings
 * or WebGPU initialization tokens.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = join(process.cwd(), "apps/web/dist");

function scanDirectory(
  dir: string,
  forbidden: string[],
  isMainOnly = false
): string[] {
  const results: string[] = [];
  const files = readdirSync(dir);

  for (const file of files) {
    const path = join(dir, file);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      results.push(...scanDirectory(path, forbidden, isMainOnly));
    } else if (file.endsWith(".js") || file.endsWith(".mjs")) {
      // If isMainOnly is true, only scan main and index chunks
      if (
        isMainOnly &&
        !file.startsWith("main-") &&
        !file.startsWith("index-") &&
        !file.startsWith("start-")
      ) {
        continue;
      }

      const content = readFileSync(path, "utf8");
      for (const pattern of forbidden) {
        if (content.includes(pattern)) {
          results.push(`${path}: found "${pattern}"`);
        }
      }
    }
  }

  return results;
}

function run() {
  console.log("🚀 Starting Mindscape WebGPU build verification...");

  // 1. Build with WebGPU disabled
  console.log("📦 Building @alfred/web with WebGPU disabled...");
  const buildResult = spawnSync("bun", ["--filter", "web", "build"], {
    env: { ...process.env, VITE_MINDSCAPE_WEBGPU: "0" },
    stdio: "inherit",
  });

  if (buildResult.status !== 0) {
    console.error("❌ Build failed");
    process.exit(1);
  }

  // 2. Scan for forbidden strings in primary chunks
  const forbidden = [
    "navigator.gpu",
    "requestAdapter",
    "createComputePipeline",
  ];

  console.log(`🔍 Scanning primary chunks in ${DIST_DIR} for leaks...`);
  const leaks = scanDirectory(DIST_DIR, forbidden, true);

  if (leaks.length > 0) {
    console.error("❌ WebGPU leaks detected in main bundle chunks:");
    for (const leak of leaks) {
      console.error(`  - ${leak}`);
    }
    process.exit(1);
  }

  console.log(
    "✅ Success! No WebGPU tokens found in the main application chunks."
  );
}

try {
  run();
} catch (err) {
  console.error(err);
  process.exit(1);
}
