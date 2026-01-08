import "@/test/dom";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useDesktopStore } from "@/store/desktop";
import type { WindowInstance } from "@/store/desktop/types.new";
import { WindowChrome } from "../chrome";

describe("WindowChrome", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      focusedWindowId: null,
      isSpaceMode: false,
      mode: "desktop",
      desktopArea: { x: 0, y: 32, width: 1920, height: 1000 },
      pinnedApps: ["chat", "terminal", "agents", "workflow", "settings"],
      zIndexCounter: 0,
      config: {
        layout: "float",
        gap: 8,
        mainRatio: 0.6,
        respectMinSize: true,
      },
      zones: [],
      activeTilePreview: null,
    });
  });

  const createWindow = (
    overrides?: Partial<WindowInstance>
  ): WindowInstance => ({
    id: "test-window",
    type: "chat",
    bounds: { x: 100, y: 100, width: 400, height: 300 },
    data: { type: "chat", viewMode: "full" },
    state: "normal",
    isTiled: false,
    zIndex: 1,
    isFocused: false,
    minSize: { width: 200, height: 150 },
    resizable: true,
    createdAt: Date.now(),
    lastFocusedAt: Date.now(),
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
    const closeSpy = vi.spyOn(store, "closeWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const closeButton = getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(closeSpy).toHaveBeenCalledWith("test-window");
  });

  it("minimizes window when minimize button is clicked", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const minimizeSpy = vi.spyOn(store, "minimizeWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const minimizeButton = getByRole("button", { name: /minimize/i });
    fireEvent.click(minimizeButton);

    expect(minimizeSpy).toHaveBeenCalledWith("test-window");
  });

  it("maximizes window when maximize button is clicked", () => {
    const window = createWindow();
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const maximizeSpy = vi.spyOn(store, "maximizeWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const maximizeButton = getByRole("button", { name: /maximize/i });
    fireEvent.click(maximizeButton);

    expect(maximizeSpy).toHaveBeenCalledWith("test-window");
  });

  it("restores window when maximize button is clicked on maximized window", () => {
    const window = createWindow({
      state: "maximized",
    });
    useDesktopStore.setState({ windows: [window] });
    const store = useDesktopStore.getState();
    const restoreSpy = vi.spyOn(store, "restoreWindow");

    const { getByRole } = render(
      <WindowChrome isFocused={false} windowId="test-window" />
    );

    const restoreButton = getByRole("button", { name: /restore/i });
    fireEvent.click(restoreButton);

    expect(restoreSpy).toHaveBeenCalledWith("test-window");
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
      state: "maximized",
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

    it("handles missing bounds gracefully", () => {
      const window: WindowInstance = {
        id: "test-window",
        type: "chat",
        bounds: undefined as unknown as {
          x: number;
          y: number;
          width: number;
          height: number;
        },
        data: { type: "chat", viewMode: "full" },
        state: "normal",
        isTiled: false,
        zIndex: 1,
        isFocused: false,
        minSize: { width: 200, height: 150 },
        resizable: true,
        createdAt: Date.now(),
        lastFocusedAt: Date.now(),
      };
      useDesktopStore.setState({ windows: [window] });

      const { container } = render(
        <WindowChrome isFocused={false} windowId="test-window" />
      );

      // Should render with default bounds instead of crashing
      const chrome = container.querySelector('[data-window-id="test-window"]');
      expect(chrome).toBeTruthy();
    });

    it("handles missing data gracefully", () => {
      const window: WindowInstance = {
        id: "test-window",
        type: "chat",
        bounds: { x: 100, y: 100, width: 400, height: 300 },
        data: undefined as unknown as { type: "chat"; viewMode: "full" },
        state: "normal",
        isTiled: false,
        zIndex: 1,
        isFocused: false,
        minSize: { width: 200, height: 150 },
        resizable: true,
        createdAt: Date.now(),
        lastFocusedAt: Date.now(),
      };
      useDesktopStore.setState({ windows: [window] });

      const { getByText } = render(
        <WindowChrome isFocused={false} windowId="test-window" />
      );

      // Should render with fallback title instead of crashing
      expect(getByText("Window")).toBeTruthy();
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
