/**
 * ALFRED Package Registry
 *
 * Central registry for CLI/TUI package integration.
 * Discovers packages, loads manifests, and provides unified access
 * to commands, panels, and health checks.
 */

import {
  discoverAndLoadManifests,
  discoverPackages,
  findPackagesDir,
  loadManifest,
} from "./discover";
import type {
  CliManifest,
  CommandDef,
  HealthStatus,
  PackageInfo,
  RegisteredPackage,
  ShortcutDef,
  SubscriptionDef,
  TuiPanelDef,
} from "./manifest";

// Re-export types
export type {
  CliManifest,
  CommandDef,
  HealthStatus,
  PackageInfo,
  RegisteredPackage,
  ShortcutDef,
  SubscriptionDef,
  TuiPanelDef,
};

export { isValidManifest } from "./manifest";

// ─── Package Registry ─────────────────────────────────────────────────────────

/**
 * Central registry for ALFRED package manifests
 */
export class PackageRegistry {
  private packages: Map<string, RegisteredPackage> = new Map();
  private initialized = false;

  /**
   * Initialize the registry by discovering packages
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const registered = await discoverAndLoadManifests();

    for (const pkg of registered) {
      this.packages.set(pkg.name, pkg);
    }

    this.initialized = true;
  }

  /**
   * Register a package manually (for testing or dynamic registration)
   */
  register(manifest: CliManifest, path = ""): void {
    this.packages.set(manifest.name, {
      name: manifest.name,
      version: manifest.version,
      path,
      hasManifest: true,
      manifest,
      loadedAt: new Date(),
    });
  }

  /**
   * Get a registered package by name
   */
  get(name: string): RegisteredPackage | undefined {
    return this.packages.get(name);
  }

  /**
   * Get all registered packages
   */
  getAll(): RegisteredPackage[] {
    return Array.from(this.packages.values());
  }

  /**
   * Get all registered commands across packages
   */
  getAllCommands(): Array<CommandDef & { package: string }> {
    const commands: Array<CommandDef & { package: string }> = [];

    for (const [packageName, pkg] of this.packages) {
      for (const cmd of pkg.manifest.commands ?? []) {
        commands.push({ ...cmd, package: packageName });
      }
    }

    return commands;
  }

  /**
   * Get all registered TUI panels across packages
   */
  getAllPanels(): Array<TuiPanelDef & { package: string }> {
    const panels: Array<TuiPanelDef & { package: string }> = [];

    for (const [packageName, pkg] of this.packages) {
      for (const panel of pkg.manifest.panels ?? []) {
        panels.push({ ...panel, package: packageName });
      }
    }

    return panels;
  }

  /**
   * Get all registered shortcuts across packages
   */
  getAllShortcuts(): Array<ShortcutDef & { package: string }> {
    const shortcuts: Array<ShortcutDef & { package: string }> = [];

    for (const [packageName, pkg] of this.packages) {
      for (const shortcut of pkg.manifest.shortcuts ?? []) {
        shortcuts.push({ ...shortcut, package: packageName });
      }
    }

    return shortcuts;
  }

  /**
   * Get all registered subscriptions across packages
   */
  getAllSubscriptions(): Array<SubscriptionDef & { package: string }> {
    const subscriptions: Array<SubscriptionDef & { package: string }> = [];

    for (const [packageName, pkg] of this.packages) {
      for (const sub of pkg.manifest.subscriptions ?? []) {
        subscriptions.push({ ...sub, package: packageName });
      }
    }

    return subscriptions;
  }

  /**
   * Run health checks for all packages
   */
  async checkHealth(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    for (const [packageName, pkg] of this.packages) {
      if (pkg.manifest.healthCheck) {
        try {
          const start = performance.now();
          const status = await pkg.manifest.healthCheck();
          status.latencyMs = performance.now() - start;
          results.set(packageName, status);
        } catch (error) {
          results.set(packageName, {
            status: "unhealthy",
            message: (error as Error).message,
          });
        }
      } else {
        // No health check = assume healthy
        results.set(packageName, { status: "healthy", message: "No check" });
      }
    }

    return results;
  }

  /**
   * Find a command by name (with optional package prefix)
   */
  findCommand(name: string): (CommandDef & { package: string }) | undefined {
    // Check if name includes package prefix (e.g., "voice:test-stt")
    if (name.includes(":")) {
      const [pkgShort, cmdName] = name.split(":", 2);
      const packageName = `@alfred/${pkgShort}`;
      const pkg = this.packages.get(packageName);
      return pkg?.manifest.commands?.find((c) => c.name === cmdName)
        ? {
            ...pkg.manifest.commands.find((c) => c.name === cmdName)!,
            package: packageName,
          }
        : undefined;
    }

    // Search all packages for command name
    for (const [packageName, pkg] of this.packages) {
      const cmd = pkg.manifest.commands?.find((c) => c.name === name);
      if (cmd) {
        return { ...cmd, package: packageName };
      }
    }

    return;
  }

  /**
   * Get packages sorted by dependency order
   */
  getSortedByDependencies(): RegisteredPackage[] {
    const sorted: RegisteredPackage[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) {
        return;
      }
      if (visiting.has(name)) {
        // Circular dependency - skip
        return;
      }

      visiting.add(name);
      const pkg = this.packages.get(name);

      if (pkg) {
        for (const dep of pkg.manifest.dependencies ?? []) {
          visit(dep);
        }
        sorted.push(pkg);
      }

      visiting.delete(name);
      visited.add(name);
    };

    for (const name of this.packages.keys()) {
      visit(name);
    }

    return sorted;
  }

  /**
   * Clear the registry
   */
  clear(): void {
    this.packages.clear();
    this.initialized = false;
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

let globalRegistry: PackageRegistry | null = null;

/**
 * Get the global package registry instance
 */
export function getRegistry(): PackageRegistry {
  if (!globalRegistry) {
    globalRegistry = new PackageRegistry();
  }
  return globalRegistry;
}

/**
 * Initialize the global registry
 */
export async function initializeRegistry(): Promise<PackageRegistry> {
  const registry = getRegistry();
  await registry.initialize();
  return registry;
}

// ─── Discovery Utilities ──────────────────────────────────────────────────────

export { discoverPackages, findPackagesDir, loadManifest };
