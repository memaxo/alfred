/**
 * Package Auto-Discovery
 *
 * Discovers ALFRED packages and loads their CLI manifests.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { CliManifest, PackageInfo, RegisteredPackage } from "./manifest";
import { isValidManifest } from "./manifest";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Packages to exclude from discovery */
const EXCLUDED_PACKAGES = new Set([
  "test-kit", // Testing utilities
  "tsconfig", // TypeScript config
  "util", // Shared utilities (deprecated)
]);

/** Possible manifest export paths */
const MANIFEST_PATHS = ["src/manifest.ts", "src/cli.ts", "manifest.ts"];

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Discover all ALFRED packages in the workspace
 */
export async function discoverPackages(
  packagesDir: string
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  try {
    const entries = await readdir(packagesDir);

    for (const entry of entries) {
      // Skip excluded packages
      if (EXCLUDED_PACKAGES.has(entry)) {
        continue;
      }

      const packagePath = join(packagesDir, entry);
      const packageJsonPath = join(packagePath, "package.json");

      try {
        // Check if it's a directory with package.json
        const stats = await stat(packagePath);
        if (!stats.isDirectory()) {
          continue;
        }

        const packageJsonStats = await stat(packageJsonPath);
        if (!packageJsonStats.isFile()) {
          continue;
        }

        // Read package.json
        const packageJsonFile = Bun.file(packageJsonPath);
        const packageJson = (await packageJsonFile.json()) as {
          name?: string;
          version?: string;
        };

        if (!(packageJson.name && packageJson.version)) {
          continue;
        }

        // Check if manifest exists
        const hasManifest = await checkManifestExists(packagePath);

        packages.push({
          name: packageJson.name,
          version: packageJson.version,
          path: packagePath,
          hasManifest,
        });
      } catch {}
    }
  } catch (error) {
    throw new Error(`Failed to discover packages: ${(error as Error).message}`);
  }

  return packages;
}

/**
 * Check if a package has a manifest file
 */
async function checkManifestExists(packagePath: string): Promise<boolean> {
  for (const manifestPath of MANIFEST_PATHS) {
    try {
      const fullPath = join(packagePath, manifestPath);
      const stats = await stat(fullPath);
      if (stats.isFile()) {
        return true;
      }
    } catch {
      // Continue to next path
    }
  }
  return false;
}

/**
 * Load a package's manifest
 */
export async function loadManifest(
  packagePath: string
): Promise<CliManifest | null> {
  for (const manifestPath of MANIFEST_PATHS) {
    try {
      const fullPath = join(packagePath, manifestPath);

      // Check if file exists first
      const stats = await stat(fullPath);
      if (!stats.isFile()) {
        continue;
      }

      // Dynamic import the manifest
      const module = (await import(fullPath)) as {
        manifest?: unknown;
        default?: unknown;
      };

      // Try named export first, then default
      const manifest = module.manifest ?? module.default;

      if (isValidManifest(manifest)) {
        return manifest;
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Load all manifests from discovered packages
 */
export async function loadAllManifests(
  packages: PackageInfo[]
): Promise<RegisteredPackage[]> {
  const registered: RegisteredPackage[] = [];

  for (const pkg of packages) {
    if (!pkg.hasManifest) {
      continue;
    }

    const manifest = await loadManifest(pkg.path);
    if (manifest) {
      registered.push({
        ...pkg,
        manifest,
        loadedAt: new Date(),
      });
    }
  }

  return registered;
}

// ─── Workspace Detection ──────────────────────────────────────────────────────

/**
 * Find the packages directory in the workspace
 */
export async function findPackagesDir(): Promise<string | null> {
  // Start from current directory and walk up
  let currentDir = process.cwd();
  const root = "/";

  while (currentDir !== root) {
    const packagesDir = join(currentDir, "packages");
    try {
      const stats = await stat(packagesDir);
      if (stats.isDirectory()) {
        return packagesDir;
      }
    } catch {
      // Continue to parent
    }
    currentDir = join(currentDir, "..");
  }

  return null;
}

// ─── Full Discovery Flow ──────────────────────────────────────────────────────

/**
 * Discover and load all package manifests
 */
export async function discoverAndLoadManifests(): Promise<RegisteredPackage[]> {
  const packagesDir = await findPackagesDir();
  if (!packagesDir) {
    throw new Error(
      "Could not find packages directory. Are you in the ALFRED workspace?"
    );
  }

  const packages = await discoverPackages(packagesDir);
  return loadAllManifests(packages);
}
