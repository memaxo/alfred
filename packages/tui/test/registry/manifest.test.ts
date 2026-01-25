import { describe, expect, test } from "bun:test";

import {
  type CliManifest,
  type CommandDef,
  isValidManifest,
  type TuiPanelDef,
} from "../../src/registry/manifest";

describe("CliManifest", () => {
  describe("isValidManifest", () => {
    test("validates correct manifest", () => {
      const manifest: CliManifest = {
        name: "@alfred/test",
        version: "1.0.0",
        description: "Test package",
      };

      expect(isValidManifest(manifest)).toBe(true);
    });

    test("rejects null", () => {
      expect(isValidManifest(null)).toBe(false);
    });

    test("rejects undefined", () => {
      expect(isValidManifest()).toBe(false);
    });

    test("rejects non-object", () => {
      expect(isValidManifest("string")).toBe(false);
      expect(isValidManifest(123)).toBe(false);
      expect(isValidManifest([])).toBe(false);
    });

    test("rejects missing name", () => {
      expect(
        isValidManifest({
          version: "1.0.0",
          description: "Test",
        })
      ).toBe(false);
    });

    test("rejects missing version", () => {
      expect(
        isValidManifest({
          name: "@alfred/test",
          description: "Test",
        })
      ).toBe(false);
    });

    test("rejects missing description", () => {
      expect(
        isValidManifest({
          name: "@alfred/test",
          version: "1.0.0",
        })
      ).toBe(false);
    });
  });

  describe("CommandDef", () => {
    test("defines command structure", () => {
      const command: CommandDef = {
        name: "test-cmd",
        description: "Test command",
        handler: async () => {},
      };

      expect(command.name).toBe("test-cmd");
      expect(command.description).toBe("Test command");
      expect(typeof command.handler).toBe("function");
    });

    test("supports optional fields", () => {
      const command: CommandDef = {
        name: "test",
        description: "Test",
        handler: async () => {},
        category: "testing",
        requiresAuth: true,
        requiresBiometric: false,
      };

      expect(command.category).toBe("testing");
      expect(command.requiresAuth).toBe(true);
      expect(command.requiresBiometric).toBe(false);
    });
  });

  describe("TuiPanelDef", () => {
    test("defines panel structure", () => {
      const panel: TuiPanelDef = {
        id: "test-panel",
        name: "Test Panel",
        factory: async () => ({}),
      };

      expect(panel.id).toBe("test-panel");
      expect(panel.name).toBe("Test Panel");
      expect(typeof panel.factory).toBe("function");
    });

    test("supports optional fields", () => {
      const panel: TuiPanelDef = {
        id: "test",
        name: "Test",
        description: "A test panel",
        shortcut: "t",
        category: "monitoring",
        defaultVisible: true,
        factory: async () => ({}),
      };

      expect(panel.description).toBe("A test panel");
      expect(panel.shortcut).toBe("t");
      expect(panel.category).toBe("monitoring");
      expect(panel.defaultVisible).toBe(true);
    });
  });
});
