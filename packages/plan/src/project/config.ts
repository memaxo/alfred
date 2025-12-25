// packages/plan/src/project/config.ts
import path from "node:path";
import type { PackageManager, ProjectConfig, ProjectFramework } from "./types.js";

/**
 * Detect project configuration from workspace files
 */
export async function detectConfig(workspace: string): Promise<ProjectConfig> {
  const config: ProjectConfig = {};

  // Detect Package Manager
  config.packageManager = await detectPackageManager(workspace);

  // Detect TypeScript
  const tsConfigPath = path.join(workspace, "tsconfig.json");
  config.hasTypeScript = await Bun.file(tsConfigPath).exists();

  // Detect Monorepo
  const turboPath = path.join(workspace, "turbo.json");
  const pnpmWorkspacePath = path.join(workspace, "pnpm-workspace.yaml");
  config.isMonorepo = 
    (await Bun.file(turboPath).exists()) || 
    (await Bun.file(pnpmWorkspacePath).exists());

  // Detect Framework from package.json
  const pkgPath = path.join(workspace, "package.json");
  if (await Bun.file(pkgPath).exists()) {
    try {
      const pkg = await Bun.file(pkgPath).json();
      config.framework = detectFramework(pkg);
    } catch {
      config.framework = "unknown";
    }
  }

  return config;
}

/**
 * Detect framework from package.json dependencies
 */
export function detectFramework(pkg: any): ProjectFramework {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps.next) return "nextjs";
  if (deps["@tanstack/react-router"] || deps["@tanstack/start"]) return "tanstack";
  if (deps.expo || deps["react-native"]) return "expo";
  if (deps.react) return "react";
  if (deps.hono) return "hono";
  if (deps.express) return "express";
  if (deps.fastify) return "fastify";

  return "unknown";
}

/**
 * Detect package manager from lockfiles
 */
export async function detectPackageManager(
  workspace: string
): Promise<PackageManager> {
  if (await Bun.file(path.join(workspace, "bun.lock")).exists() || 
      await Bun.file(path.join(workspace, "bun.lockb")).exists()) return "bun";
  if (await Bun.file(path.join(workspace, "pnpm-lock.yaml")).exists()) return "pnpm";
  if (await Bun.file(path.join(workspace, "yarn.lock")).exists()) return "yarn";
  
  return "npm"; // Default
}
