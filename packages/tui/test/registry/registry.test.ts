import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PackageRegistry } from "../../src/registry";
import type { CliManifest } from "../../src/registry/manifest";

describe("PackageRegistry", () => {
  let registry: PackageRegistry;

  beforeEach(() => {
    registry = new PackageRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe("register", () => {
    test("registers a package", () => {
      const manifest: CliManifest = {
        name: "@alfred/test",
        version: "1.0.0",
        description: "Test package",
      };

      registry.register(manifest);

      expect(registry.get("@alfred/test")).toBeDefined();
      expect(registry.get("@alfred/test")?.manifest).toEqual(manifest);
    });

    test("overwrites existing package", () => {
      const manifest1: CliManifest = {
        name: "@alfred/test",
        version: "1.0.0",
        description: "First version",
      };

      const manifest2: CliManifest = {
        name: "@alfred/test",
        version: "2.0.0",
        description: "Second version",
      };

      registry.register(manifest1);
      registry.register(manifest2);

      expect(registry.get("@alfred/test")?.manifest.version).toBe("2.0.0");
    });
  });

  describe("getAll", () => {
    test("returns all registered packages", () => {
      registry.register({
        name: "@alfred/a",
        version: "1.0.0",
        description: "Package A",
      });

      registry.register({
        name: "@alfred/b",
        version: "1.0.0",
        description: "Package B",
      });

      const all = registry.getAll();
      expect(all.length).toBe(2);
      expect(all.map((p) => p.name).sort()).toEqual(["@alfred/a", "@alfred/b"]);
    });
  });

  describe("getAllCommands", () => {
    test("aggregates commands from all packages", () => {
      registry.register({
        name: "@alfred/a",
        version: "1.0.0",
        description: "Package A",
        commands: [
          { name: "cmd-a", description: "Command A", handler: async () => {} },
        ],
      });

      registry.register({
        name: "@alfred/b",
        version: "1.0.0",
        description: "Package B",
        commands: [
          { name: "cmd-b", description: "Command B", handler: async () => {} },
        ],
      });

      const commands = registry.getAllCommands();
      expect(commands.length).toBe(2);
      expect(commands.map((c) => c.name).sort()).toEqual(["cmd-a", "cmd-b"]);
    });

    test("includes package name", () => {
      registry.register({
        name: "@alfred/test",
        version: "1.0.0",
        description: "Test",
        commands: [
          { name: "cmd", description: "Command", handler: async () => {} },
        ],
      });

      const commands = registry.getAllCommands();
      expect(commands[0]?.package).toBe("@alfred/test");
    });
  });

  describe("getAllPanels", () => {
    test("aggregates panels from all packages", () => {
      registry.register({
        name: "@alfred/a",
        version: "1.0.0",
        description: "Package A",
        panels: [{ id: "panel-a", name: "Panel A", factory: async () => ({}) }],
      });

      registry.register({
        name: "@alfred/b",
        version: "1.0.0",
        description: "Package B",
        panels: [{ id: "panel-b", name: "Panel B", factory: async () => ({}) }],
      });

      const panels = registry.getAllPanels();
      expect(panels.length).toBe(2);
      expect(panels.map((p) => p.id).sort()).toEqual(["panel-a", "panel-b"]);
    });
  });

  describe("findCommand", () => {
    beforeEach(() => {
      registry.register({
        name: "@alfred/voice",
        version: "1.0.0",
        description: "Voice",
        commands: [
          {
            name: "test-stt",
            description: "Test STT",
            handler: async () => {},
          },
        ],
      });

      registry.register({
        name: "@alfred/db",
        version: "1.0.0",
        description: "Database",
        commands: [
          {
            name: "migrate",
            description: "Run migrations",
            handler: async () => {},
          },
        ],
      });
    });

    test("finds command by name", () => {
      const cmd = registry.findCommand("test-stt");
      expect(cmd?.name).toBe("test-stt");
      expect(cmd?.package).toBe("@alfred/voice");
    });

    test("finds command with package prefix", () => {
      const cmd = registry.findCommand("voice:test-stt");
      expect(cmd?.name).toBe("test-stt");
      expect(cmd?.package).toBe("@alfred/voice");
    });

    test("returns undefined for unknown command", () => {
      const cmd = registry.findCommand("unknown");
      expect(cmd).toBeUndefined();
    });
  });

  describe("checkHealth", () => {
    test("runs health checks for all packages", async () => {
      registry.register({
        name: "@alfred/healthy",
        version: "1.0.0",
        description: "Healthy package",
        healthCheck: async () => ({ status: "healthy" }),
      });

      registry.register({
        name: "@alfred/unhealthy",
        version: "1.0.0",
        description: "Unhealthy package",
        healthCheck: async () => ({
          status: "unhealthy",
          message: "Something wrong",
        }),
      });

      const results = await registry.checkHealth();

      expect(results.get("@alfred/healthy")?.status).toBe("healthy");
      expect(results.get("@alfred/unhealthy")?.status).toBe("unhealthy");
      expect(results.get("@alfred/unhealthy")?.message).toBe("Something wrong");
    });

    test("handles health check errors", async () => {
      registry.register({
        name: "@alfred/error",
        version: "1.0.0",
        description: "Error package",
        healthCheck: () => {
          throw new Error("Health check failed");
        },
      });

      const results = await registry.checkHealth();

      expect(results.get("@alfred/error")?.status).toBe("unhealthy");
      expect(results.get("@alfred/error")?.message).toBe("Health check failed");
    });

    test("defaults to healthy for packages without health check", async () => {
      registry.register({
        name: "@alfred/nocheck",
        version: "1.0.0",
        description: "No health check",
      });

      const results = await registry.checkHealth();

      expect(results.get("@alfred/nocheck")?.status).toBe("healthy");
      expect(results.get("@alfred/nocheck")?.message).toBe("No check");
    });

    test("includes latency in health results", async () => {
      registry.register({
        name: "@alfred/test",
        version: "1.0.0",
        description: "Test",
        healthCheck: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { status: "healthy" };
        },
      });

      const results = await registry.checkHealth();

      expect(results.get("@alfred/test")?.latencyMs).toBeGreaterThan(0);
    });
  });

  describe("getSortedByDependencies", () => {
    test("sorts packages by dependencies", () => {
      registry.register({
        name: "@alfred/api",
        version: "1.0.0",
        description: "API",
        dependencies: ["@alfred/db"],
      });

      registry.register({
        name: "@alfred/db",
        version: "1.0.0",
        description: "Database",
      });

      registry.register({
        name: "@alfred/web",
        version: "1.0.0",
        description: "Web",
        dependencies: ["@alfred/api"],
      });

      const sorted = registry.getSortedByDependencies();
      const names = sorted.map((p) => p.name);

      // db should come before api, api before web
      expect(names.indexOf("@alfred/db")).toBeLessThan(
        names.indexOf("@alfred/api")
      );
      expect(names.indexOf("@alfred/api")).toBeLessThan(
        names.indexOf("@alfred/web")
      );
    });

    test("handles circular dependencies gracefully", () => {
      registry.register({
        name: "@alfred/a",
        version: "1.0.0",
        description: "A",
        dependencies: ["@alfred/b"],
      });

      registry.register({
        name: "@alfred/b",
        version: "1.0.0",
        description: "B",
        dependencies: ["@alfred/a"],
      });

      // Should not throw
      const sorted = registry.getSortedByDependencies();
      expect(sorted.length).toBe(2);
    });
  });

  describe("clear", () => {
    test("removes all packages", () => {
      registry.register({
        name: "@alfred/test",
        version: "1.0.0",
        description: "Test",
      });

      expect(registry.getAll().length).toBe(1);

      registry.clear();

      expect(registry.getAll().length).toBe(0);
    });
  });
});
