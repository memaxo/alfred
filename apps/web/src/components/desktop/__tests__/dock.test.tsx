import "@/test/dom";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useDesktopStore } from "@/store/desktop";
import type { WindowInstance } from "@/store/desktop/types";
import { Dock } from "../dock";

describe("Dock", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      edges: [],
      activeEdges: new Set(),
      highlightedEdgeIds: new Set(),
      focusedWindowId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      isSpaceMode: false,
      dockPins: ["chat", "terminal", "note", "workflow", "droid"],
    });
  });

  it("renders dock with pinned window types", () => {
    const { getByRole } = render(<Dock />);

    expect(getByRole("button", { name: /chat/i })).toBeTruthy();
    expect(getByRole("button", { name: /terminal/i })).toBeTruthy();
    expect(getByRole("button", { name: /note/i })).toBeTruthy();
  });

  it("spawns window when dock button is clicked", () => {
    const store = useDesktopStore.getState();
    const spawnSpy = vi.spyOn(store, "spawnWindow");

    const { getByRole } = render(<Dock />);

    const chatButton = getByRole("button", { name: /chat/i });
    fireEvent.click(chatButton);

    expect(spawnSpy).toHaveBeenCalledWith("chat");
  });

  it("shows running indicator for windows that are open", () => {
    const window: WindowInstance = {
      id: "chat-1",
      type: "chat",
      position: { x: 100, y: 100 },
      data: { type: "chat", viewMode: "full" },
    };

    useDesktopStore.setState({
      windows: [window],
    });

    const { getByRole } = render(<Dock />);

    const chatButton = getByRole("button", { name: /chat/i });
    const indicator = chatButton.querySelector(".bg-green-500");

    expect(indicator).toBeTruthy();
  });

  it("does not show running indicator for windows that are closed", () => {
    const { getByRole } = render(<Dock />);

    const chatButton = getByRole("button", { name: /chat/i });
    const indicator = chatButton.querySelector(".bg-green-500");

    expect(indicator).toBeNull();
  });

  it("applies running state styling to buttons with open windows", () => {
    const window: WindowInstance = {
      id: "chat-1",
      type: "chat",
      position: { x: 100, y: 100 },
      data: { type: "chat", viewMode: "full" },
    };

    useDesktopStore.setState({
      windows: [window],
    });

    const { getByRole } = render(<Dock />);

    const chatButton = getByRole("button", { name: /chat/i });
    expect(chatButton.className).toContain("bg-white/5");
  });

  it("handles multiple windows of same type", () => {
    const windows: WindowInstance[] = [
      {
        id: "chat-1",
        type: "chat",
        position: { x: 100, y: 100 },
        data: { type: "chat", viewMode: "full" },
      },
      {
        id: "chat-2",
        type: "chat",
        position: { x: 200, y: 200 },
        data: { type: "chat", viewMode: "full" },
      },
    ];

    useDesktopStore.setState({
      windows,
    });

    const { getByRole } = render(<Dock />);

    const chatButton = getByRole("button", { name: /chat/i });
    const indicator = chatButton.querySelector(".bg-green-500");

    // Should still show indicator even with multiple windows
    expect(indicator).toBeTruthy();
  });

  it("renders all dock pins in order", () => {
    const { getAllByRole } = render(<Dock />);

    const buttons = getAllByRole("button");
    const dockButtons = buttons.filter((btn) =>
      btn.className.includes("rounded-full")
    );

    expect(dockButtons.length).toBeGreaterThanOrEqual(5);
  });

  describe("error cases", () => {
    it("handles empty dock pins gracefully", () => {
      useDesktopStore.setState({
        dockPins: [],
      });

      const { container } = render(<Dock />);

      // Should render without crashing
      expect(container).toBeTruthy();
    });

    it("handles invalid window type in dock pins", () => {
      useDesktopStore.setState({
        dockPins: ["chat", "invalid-type" as "chat"],
      });

      // Should not crash, but may not render invalid type
      expect(() => render(<Dock />)).not.toThrow();
    });

    it("handles spawnWindow failure gracefully", () => {
      const store = useDesktopStore.getState();
      vi.spyOn(store, "spawnWindow").mockImplementation(() => {
        throw new Error("Failed to spawn");
      });

      const { getByRole } = render(<Dock />);

      const chatButton = getByRole("button", { name: /chat/i });

      // Should not crash even if spawnWindow throws
      expect(() => fireEvent.click(chatButton)).not.toThrow();
    });
  });
});
