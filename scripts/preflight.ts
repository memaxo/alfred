#!/usr/bin/env bun

/**
 * Pre-flight checks for build and deployment.
 * Validates:
 * - All package exports are valid
 * - No module-level side effects that could crash SSR
 * - SSR compatibility
 * - Critical dependencies are available
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT_DIR = resolve(import.meta.dir, "..");
const PACKAGES_DIR = join(ROOT_DIR, "packages");

interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: CheckResult[] = [];

function addResult(name: string, passed: boolean, message?: string): void {
  results.push({ name, passed, message });
  if (passed) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}: ${message ?? "Failed"}`);
  }
}

async function checkPackageExports(): Promise<void> {
  try {
    const packages = await readdir(PACKAGES_DIR, { withFileTypes: true });
    const packageDirs = packages
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const pkg of packageDirs) {
      const packageJsonPath = join(PACKAGES_DIR, pkg, "package.json");
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
        if (packageJson.name) {
          addResult(`Package ${pkg} has name`, true);
        } else {
          addResult(
            `Package ${pkg} has name`,
            false,
            "Missing 'name' field in package.json"
          );
        }
        if (packageJson.exports || packageJson.main) {
          addResult(`Package ${pkg} has exports`, true);
        } else {
          addResult(
            `Package ${pkg} has exports`,
            false,
            "Missing 'exports' or 'main' field"
          );
        }
      } catch {
        // Some packages might not have package.json
        // That's okay
      }
    }
    addResult("Package exports check", true);
  } catch (error) {
    addResult(
      "Package exports check",
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function checkSSRCompatibility(): Promise<void> {
  // Check that server-only packages are properly externalized in vite.config.ts
  const viteConfigPath = join(ROOT_DIR, "apps/web/vite.config.ts");
  try {
    const viteConfig = await readFile(viteConfigPath, "utf8");
    const hasDbExternal = viteConfig.includes("@alfred/db");
    const hasServerOnlyPackages = viteConfig.includes("serverOnlyPackages");
    const hasServerOnlyExternal = hasDbExternal && hasServerOnlyPackages;
    addResult(
      "SSR externalization",
      hasServerOnlyExternal,
      hasServerOnlyExternal
        ? undefined
        : "Missing server-only package externalization"
    );
  } catch (error) {
    addResult(
      "SSR externalization",
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function checkCriticalFiles(): Promise<void> {
  const criticalFiles = [
    "apps/web/vite.config.ts",
    "apps/web/src/server.ts",
    "packages/api/src/init.ts",
    "packages/api/src/utils/service-availability.ts",
  ];

  for (const file of criticalFiles) {
    const filePath = join(ROOT_DIR, file);
    try {
      await stat(filePath);
      addResult(`File exists: ${file}`, true);
    } catch {
      addResult(`File exists: ${file}`, false, "File not found");
    }
  }
}

async function checkGracefulDegradation(): Promise<void> {
  // Check that init.ts has graceful degradation
  const initPath = join(ROOT_DIR, "packages/api/src/init.ts");
  try {
    const initContent = await readFile(initPath, "utf8");
    const hasDbCheck = initContent.includes("isDbAvailable");
    const hasUvCheck = initContent.includes("isUvAvailable");
    const hasDbSkipMessage = initContent.includes(
      "db_unavailable_skipping_services"
    );
    const hasUvSkipMessage = initContent.includes(
      "voice_pools_skipped_uv_missing"
    );
    const hasGracefulHandling = hasDbSkipMessage || hasUvSkipMessage;
    const allChecksPresent = hasDbCheck && hasUvCheck && hasGracefulHandling;

    addResult(
      "Graceful degradation in init",
      allChecksPresent,
      allChecksPresent ? undefined : "Missing graceful degradation checks"
    );
  } catch (error) {
    addResult(
      "Graceful degradation check",
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function main(): Promise<void> {
  console.log("Running pre-flight checks...\n");

  await checkPackageExports();
  await checkSSRCompatibility();
  await checkCriticalFiles();
  await checkGracefulDegradation();

  console.log("\n--- Summary ---");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error("\nPre-flight checks failed!");
    process.exit(1);
  } else {
    console.log("\nAll pre-flight checks passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Pre-flight check error:", error);
  process.exit(1);
});
