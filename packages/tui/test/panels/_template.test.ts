import { beforeEach, describe, expect, test } from "bun:test";
import type { BasePanel } from "../../src/tui/panels/base";

/**
 * Reusable test suite for all TUI panels.
 * Tests common BasePanel behavior and lifecycle hooks.
 */
export function testPanelBehavior(
  name: string,
  createPanel: () => BasePanel,
  createMockState: () => unknown
) {
  describe(`${name}Panel`, () => {
    let panel: BasePanel;

    beforeEach(() => {
      panel = createPanel();
    });

    test("has required properties", () => {
      expect(panel.id).toBeDefined();
      expect(typeof panel.id).toBe("string");
      expect(panel.label).toBeDefined();
      expect(typeof panel.label).toBe("string");
    });

    test("renders without crashing with mock data", () => {
      panel.init?.();
      const state = createMockState();
      const rendered = panel.render({
        state,
        width: 80,
        height: 24,
        focused: false,
      });
      expect(rendered).toBeDefined();
    });

    test("handles null state gracefully", () => {
      const rendered = panel.render({
        state: null,
        width: 80,
        height: 24,
        focused: false,
      });
      expect(rendered).toBeDefined();
      // Should not throw
    });

    test("handles undefined state gracefully", () => {
      const rendered = panel.render({
        state: undefined,
        width: 80,
        height: 24,
        focused: false,
      });
      expect(rendered).toBeDefined();
      // Should not throw
    });

    test("subscription returns cleanup function", () => {
      const unsub = panel.subscribe();
      expect(unsub).toBeInstanceOf(Function);
      expect(() => unsub()).not.toThrow();
    });

    test("handles resize without crashing", () => {
      panel.onResize?.(120, 40);
      panel.onResize?.(60, 20);
      panel.onResize?.(200, 60);
      // Should not throw
    });

    test("handles focus/blur without crashing", () => {
      panel.onFocus?.();
      panel.onBlur?.();
      panel.onFocus?.();
      // Should not throw
    });

    test("renders at different terminal sizes", () => {
      const sizes = [
        { width: 60, height: 20 }, // Narrow
        { width: 80, height: 24 }, // Standard
        { width: 120, height: 40 }, // Wide
        { width: 200, height: 60 }, // Very wide
      ];

      for (const size of sizes) {
        const rendered = panel.render({
          state: createMockState(),
          ...size,
          focused: false,
        });
        expect(rendered).toBeDefined();
      }
    });

    test("render output is string or array", () => {
      const rendered = panel.render({
        state: createMockState(),
        width: 80,
        height: 24,
        focused: false,
      });
      const isValid =
        typeof rendered === "string" ||
        (Array.isArray(rendered) &&
          rendered.every((line) => typeof line === "string"));
      expect(isValid).toBe(true);
    });
  });
}
