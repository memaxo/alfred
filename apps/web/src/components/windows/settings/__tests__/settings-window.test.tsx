/**
 * Tests for SettingsWindow component
 *
 * Tests the window wrapper for consolidated settings desktop app.
 */

import "@/test/dom";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render } from "@testing-library/react";

let mockLOD = "full";

// Apply mocks before importing component
mock.module("@/components/windows/shared", () => ({
  useLOD: () => mockLOD,
  TinyDot: ({ color, shadow }: any) => (
    <div className={`${color} ${shadow}`} data-testid="tiny-dot" />
  ),
  SmallCard: ({ label }: any) => <div data-testid="small-card">{label}</div>,
  WindowFrame: ({ children, title, width, windowType }: any) => (
    <div
      data-testid="window-frame"
      data-width={width}
      data-window-type={windowType}
    >
      <div data-testid="window-title">{title}</div>
      <div data-testid="window-content">{children}</div>
    </div>
  ),
}));

mock.module("@/components/apps/settings", () => ({
  SettingsApp: () => <div data-testid="settings-app" />,
}));

import { SettingsWindow } from "../settings-window";

const createNodeProps = (overrides?: any) => ({
  id: "test-settings-window",
  data: { type: "settings" as const, viewMode: "full" as const },
  selected: false,
  ...overrides,
});

describe("SettingsWindow", () => {
  beforeEach(() => {
    mockLOD = "full";
  });

  afterEach(() => {
    cleanup();
  });

  describe("LOD Rendering", () => {
    it("renders TinyDot at tiny LOD", () => {
      mockLOD = "tiny";

      const { getByTestId } = render(
        <SettingsWindow {...(createNodeProps() as any)} />
      );

      const dot = getByTestId("tiny-dot");
      expect(dot).toBeTruthy();
      expect(dot.className).toContain("bg-slate-500");
      expect(dot.className).toContain("shadow-slate-500/50");
    });

    it("renders SmallCard at small LOD", () => {
      mockLOD = "small";

      const { getByTestId, getByText } = render(
        <SettingsWindow {...(createNodeProps() as any)} />
      );

      expect(getByTestId("small-card")).toBeTruthy();
      expect(getByText("Settings")).toBeTruthy();
    });

    it("renders WindowFrame at full LOD", () => {
      mockLOD = "full";

      const { getByTestId } = render(
        <SettingsWindow {...(createNodeProps() as any)} />
      );

      expect(getByTestId("window-frame")).toBeTruthy();
      expect(getByTestId("window-title").textContent).toBe("Settings");
    });
  });

  describe("Window Configuration", () => {
    it("uses full width when viewMode is full", () => {
      const { getByTestId } = render(
        <SettingsWindow
          {...(createNodeProps({
            data: { type: "settings", viewMode: "full" },
          }) as any)}
        />
      );

      const frame = getByTestId("window-frame");
      expect(frame.getAttribute("data-width")).toBe("800");
    });

    it("uses compact width when viewMode is compact", () => {
      const { getByTestId } = render(
        <SettingsWindow
          {...(createNodeProps({
            data: { type: "settings", viewMode: "compact" },
          }) as any)}
        />
      );

      const frame = getByTestId("window-frame");
      expect(frame.getAttribute("data-width")).toBe("600");
    });

    it("defaults to full viewMode when data is invalid", () => {
      const { getByTestId } = render(
        <SettingsWindow
          {...(createNodeProps({ data: { invalid: "data" } }) as any)}
        />
      );

      const frame = getByTestId("window-frame");
      expect(frame.getAttribute("data-width")).toBe("800");
    });

    it("sets correct window type", () => {
      const { getByTestId } = render(
        <SettingsWindow {...(createNodeProps() as any)} />
      );

      const frame = getByTestId("window-frame");
      expect(frame.getAttribute("data-window-type")).toBe("settings");
    });
  });

  describe("Content Integration", () => {
    it("renders SettingsApp inside window", () => {
      const { getByTestId } = render(
        <SettingsWindow {...(createNodeProps() as any)} />
      );

      const content = getByTestId("window-content");
      expect(content).toBeTruthy();
      expect(getByTestId("settings-app")).toBeTruthy();
    });
  });

  describe("Schema Validation", () => {
    it("handles missing viewMode with default", () => {
      const { getByTestId } = render(
        <SettingsWindow
          {...(createNodeProps({ data: { type: "settings" } }) as any)}
        />
      );

      const frame = getByTestId("window-frame");
      expect(frame.getAttribute("data-width")).toBe("800");
    });

    it("handles optional label field", () => {
      const { getByTestId } = render(
        <SettingsWindow
          {...(createNodeProps({
            data: { type: "settings", label: "Custom Label", viewMode: "full" },
          }) as any)}
        />
      );

      expect(getByTestId("window-frame")).toBeTruthy();
    });

    it("handles maximized viewMode", () => {
      const { getByTestId } = render(
        <SettingsWindow
          {...(createNodeProps({
            data: { type: "settings", viewMode: "maximized" },
          }) as any)}
        />
      );

      const frame = getByTestId("window-frame");
      // Maximized uses full width
      expect(frame.getAttribute("data-width")).toBe("800");
    });
  });
});
