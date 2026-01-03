import "@/test/dom";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useDesktopStore } from "@/store/desktop";
import type { WindowInstance } from "@/store/desktop/types";
import { WindowChrome } from "../chrome";

describe("WindowChrome", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      edges: [],
      activeEdges: new Set(),
      highlightedEdgeIds: new Set(),
      focusedWindowId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      isSpaceMode: false,
      dockPins: [],
    });
  });

  const createWindow = (
    overrides?: Partial<WindowInstance>
  ): WindowInstance => ({
    id: "test-window",
    type: "chat",
    position: { x: 100, y: 100 },
    data: { type: "chat", viewMode: "full" },
    ...overrides,
  });

  it("renders window chrome with title", () => {
    const window = createWindow({ data: { type: "chat", label: "Test Chat" } });
    useDesktopStore.setState({ windows: [window] });

    const { getByText } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    expect(getByText("Test Chat")).toBeTruthy();
  });

  it("uses window type as fallback title when label is missing", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });

    const { getByText } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    expect(getByText("chat")).toBeTruthy();
  });

  it("applies focused styling when isFocused is true", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });

    const { container } = render(
      <WindowChrome isFocused={true} windowId="test-window" />
    );

    const chrome = container.querySelector('[data-window-id="test-window"]');
    expect(chrome?.className).toContain("border-biolum/30");
  });

  it("applies unfocused styling when isFocused is false", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });

    const { container } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const chrome = container.querySelector('[data-window-id="test-window"]');
    expect(chrome?.className).toContain("border-white/10");
  });

  it("closes window when close button is clicked", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const removeSpy = vi.spyOn(store, "removeWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const closeButton = getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(removeSpy).toHaveBeenCalledWith("test-window");
  });

  it("minimizes window when minimize button is clicked", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const updateSpy = vi.spyOn(store, "updateWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const minimizeButton = getByRole("button", { name: /minimize/i });
    fireEvent.click(minimizeButton);

    expect(updateSpy).toHaveBeenCalledWith("test-window", {
      viewMode: "compact",
    });
  });

  it("maximizes window when maximize button is clicked", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const updateSpy = vi.spyOn(store, "updateWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const maximizeButton = getByRole("button", { name: /maximize/i });
    fireEvent.click(maximizeButton);

    expect(updateSpy).toHaveBeenCalledWith("test-window", {
      viewMode: "maximized",
    });
  });

  it("restores window when maximize button is clicked on maximized window", () => {
    const window = createWindow({
      data: { type: "chat", viewMode: "maximized" },
    });
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const updateSpy = vi.spyOn(store, "updateWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const restoreButton = getByRole("button", { name: /restore/i });
    fireEvent.click(restoreButton);

    expect(updateSpy).toHaveBeenCalledWith("test-window", {
      viewMode: "full",
    });
  });

  it("focuses window when clicked", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const focusSpy = vi.spyOn(store, "focusWindow");

    const { getByText } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const chrome = getByText("chat").closest("[data-window-id]");
    if (chrome) {
      fireEvent.mouseDown(chrome);
    }

    expect(focusSpy).toHaveBeenCalledWith("test-window");
  });

  it("does not focus window if already focused", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const focusSpy = vi.spyOn(store, "focusWindow");

    const { getByText } = render(
      <WindowChrome isFocused={true} windowId="test-window" />
    );

    const chrome = getByText("chat").closest("[data-window-id]");
    if (chrome) {
      fireEvent.mouseDown(chrome);
    }

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("renders children content", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });

    const { getByText } = render(
      <WindowChrome isFocused={false} windowId="test-window">
        <div>Custom content</div>
      </WindowChrome>
    );

    expect(getByText("Custom content")).toBeTruthy();
  });

  it("renders default placeholder when no children", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });

    const { getByText } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    expect(getByText("Window content")).toBeTruthy();
  });

  it("hides resize handles when maximized", () => {
    const window = createWindow({
      data: { type: "chat", viewMode: "maximized" },
    });
    useDesktopStore.setState({ windows: [window] });

    const { container } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    // ResizeHandles component should not be rendered
    const resizeHandles = container.querySelector("[data-resize-handles]");
    expect(resizeHandles).toBeNull();
  });

  describe("error cases", () => {
    it("returns null when window does not exist", () => {
      useDesktopStore.setState({ windows: [] });

      const { container } = render(
        <WindowChrome isFocused={false} windowId="non-existent" />
      );

      expect(container.firstChild).toBeNull();
    });

    it("handles missing position gracefully", () => {
      const window = createWindow({ position: undefined });
      useDesktopStore.setState({ windows: [window] });

      expect(() =>
        render(<WindowChrome isFocused={false} windowId="test-window" />)
      ).not.toThrow();
    });

    it("handles missing data gracefully", () => {
      const window: WindowInstance = {
        id: "test-window",
        type: "chat",
        position: { x: 100, y: 100 },
        data: undefined as unknown as { type: "chat"; viewMode: "full" },
      };
      useDesktopStore.setState({ windows: [window] });

      expect(() =>
        render(<WindowChrome isFocused={false} windowId="test-window" />)
      ).not.toThrow();
    });

    it("handles window removal during render", () => {
      const window = createWindow();
      useDesktopStore.setState({ windows: [window] });

      const { rerender, queryByText } = render(
        <WindowChrome isFocused={false} windowId="test-window" />
      );

      useDesktopStore.setState({ windows: [] });

      rerender(<WindowChrome isFocused={false} windowId="test-window" />);

      // Should handle gracefully
      expect(queryByText("chat")).toBeNull();
    });
  });
});
