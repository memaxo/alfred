import "@/test/dom";
import { beforeEach, describe, expect, it } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useDesktopStore } from "@/store/desktop";
import type { WindowGroup, WindowInstance } from "@/store/desktop/types.new";
import { WindowGroupChrome } from "../group";

describe("WindowGroupChrome", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      groups: [],
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
    id: string,
    type: string,
    groupId?: string
  ): WindowInstance => ({
    id,
    type: type as WindowInstance["type"],
    bounds: { x: 100, y: 100, width: 400, height: 300 },
    data: {
      type: type as WindowInstance["type"],
      viewMode: "full",
      label: type,
    },
    state: "normal",
    isTiled: false,
    zIndex: 1,
    isFocused: false,
    minSize: { width: 200, height: 150 },
    resizable: true,
    groupId,
    createdAt: Date.now(),
    lastFocusedAt: Date.now(),
  });

  const createGroup = (
    id: string,
    windowIds: string[],
    overrides?: Partial<WindowGroup>
  ): WindowGroup => ({
    id,
    windowIds,
    activeWindowId: windowIds[0] ?? "",
    bounds: { x: 100, y: 100, width: 500, height: 400 },
    state: "normal",
    zIndex: 10,
    isFocused: false,
    createdAt: Date.now(),
    ...overrides,
  });

  it("renders group with tabs for each window", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"]);

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { getByRole, getAllByRole } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const tabs = getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(getByRole("tablist")).toBeTruthy();
  });

  it("renders active window content", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"], { activeWindowId: "w1" });

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { getByText } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    expect(getByText("Active: w1")).toBeTruthy();
  });

  it("switches active tab when tab is clicked", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"], { activeWindowId: "w1" });

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { getAllByRole, rerender } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const tabs = getAllByRole("tab");
    fireEvent.click(tabs[1]);

    rerender(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    expect(useDesktopStore.getState().groups[0].activeWindowId).toBe("w2");
  });

  it("removes window from group when tab close is clicked", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const w3 = createWindow("w3", "settings", "group1");
    const group = createGroup("group1", ["w1", "w2", "w3"]);

    useDesktopStore.setState({
      windows: [w1, w2, w3],
      groups: [group],
    });

    const { getAllByLabelText } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const closeButtons = getAllByLabelText(/close/i);
    fireEvent.click(closeButtons[2]);

    const updatedGroup = useDesktopStore.getState().groups[0];
    expect(updatedGroup.windowIds).not.toContain("w3");
    expect(updatedGroup.windowIds).toHaveLength(2);
  });

  it("dissolves group when removing second-to-last window", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"]);

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { getAllByLabelText } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const closeButtons = getAllByLabelText(/close/i);
    fireEvent.click(closeButtons[1]);

    expect(useDesktopStore.getState().groups).toHaveLength(0);
  });

  it("applies focused styling when group is focused", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"], { isFocused: true });

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { container } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const chrome = container.querySelector('[data-group-id="group1"]');
    expect(chrome?.className).toContain("border-biolum/50");
  });

  it("applies unfocused styling when group is not focused", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"], { isFocused: false });

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { container } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const chrome = container.querySelector('[data-group-id="group1"]');
    expect(chrome?.className).toContain("border-white/10");
  });

  it("focuses group when clicked", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"], { isFocused: false });

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { container } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const chrome = container.querySelector('[data-group-id="group1"]');
    if (chrome) {
      fireEvent.mouseDown(chrome);
    }

    expect(useDesktopStore.getState().groups[0].isFocused).toBe(true);
  });

  it("highlights active tab", () => {
    const w1 = createWindow("w1", "chat", "group1");
    const w2 = createWindow("w2", "terminal", "group1");
    const group = createGroup("group1", ["w1", "w2"], { activeWindowId: "w1" });

    useDesktopStore.setState({
      windows: [w1, w2],
      groups: [group],
    });

    const { getAllByRole } = render(
      <WindowGroupChrome groupId="group1">
        {(activeId) => <div>Active: {activeId}</div>}
      </WindowGroupChrome>
    );

    const tabs = getAllByRole("tab");
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  describe("error cases", () => {
    it("returns null when group does not exist", () => {
      useDesktopStore.setState({ windows: [], groups: [] });

      const { container } = render(
        <WindowGroupChrome groupId="non-existent">
          {(activeId) => <div>Active: {activeId}</div>}
        </WindowGroupChrome>
      );

      expect(container.firstChild).toBeNull();
    });

    it("returns null when group has no windows", () => {
      const group = createGroup("group1", []);

      useDesktopStore.setState({
        windows: [],
        groups: [group],
      });

      const { container } = render(
        <WindowGroupChrome groupId="group1">
          {(activeId) => <div>Active: {activeId}</div>}
        </WindowGroupChrome>
      );

      expect(container.firstChild).toBeNull();
    });

    it("handles group removal during render", () => {
      const w1 = createWindow("w1", "chat", "group1");
      const w2 = createWindow("w2", "terminal", "group1");
      const group = createGroup("group1", ["w1", "w2"]);

      useDesktopStore.setState({
        windows: [w1, w2],
        groups: [group],
      });

      const { rerender, container } = render(
        <WindowGroupChrome groupId="group1">
          {(activeId) => <div>Active: {activeId}</div>}
        </WindowGroupChrome>
      );

      useDesktopStore.setState({ groups: [] });

      rerender(
        <WindowGroupChrome groupId="group1">
          {(activeId) => <div>Active: {activeId}</div>}
        </WindowGroupChrome>
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("positioning", () => {
    it("positions group using bounds", () => {
      const w1 = createWindow("w1", "chat", "group1");
      const w2 = createWindow("w2", "terminal", "group1");
      const group = createGroup("group1", ["w1", "w2"], {
        bounds: { x: 200, y: 150, width: 600, height: 500 },
      });

      useDesktopStore.setState({
        windows: [w1, w2],
        groups: [group],
      });

      const { container } = render(
        <WindowGroupChrome groupId="group1">
          {(activeId) => <div>Active: {activeId}</div>}
        </WindowGroupChrome>
      );

      const chrome = container.querySelector(
        '[data-group-id="group1"]'
      ) as HTMLElement;
      expect(chrome.style.left).toBe("200px");
      expect(chrome.style.top).toBe("150px");
      expect(chrome.style.width).toBe("600px");
      expect(chrome.style.height).toBe("500px");
    });

    it("uses desktop area bounds when maximized", () => {
      const w1 = createWindow("w1", "chat", "group1");
      const w2 = createWindow("w2", "terminal", "group1");
      const group = createGroup("group1", ["w1", "w2"], {
        state: "maximized",
        bounds: { x: 200, y: 150, width: 600, height: 500 },
      });

      useDesktopStore.setState({
        windows: [w1, w2],
        groups: [group],
        desktopArea: { x: 0, y: 32, width: 1920, height: 1000 },
      });

      const { container } = render(
        <WindowGroupChrome groupId="group1">
          {(activeId) => <div>Active: {activeId}</div>}
        </WindowGroupChrome>
      );

      const chrome = container.querySelector(
        '[data-group-id="group1"]'
      ) as HTMLElement;
      expect(chrome.style.left).toBe("0px");
      expect(chrome.style.top).toBe("32px");
      expect(chrome.style.width).toBe("1920px");
      expect(chrome.style.height).toBe("1000px");
    });

    it("applies zIndex from group", () => {
      const w1 = createWindow("w1", "chat", "group1");
      const w2 = createWindow("w2", "terminal", "group1");
      const group = createGroup("group1", ["w1", "w2"], { zIndex: 42 });

      useDesktopStore.setState({
        windows: [w1, w2],
        groups: [group],
      });

      const { container } = render(
        <WindowGroupChrome groupId="group1">
          {(activeId) => <div>Active: {activeId}</div>}
        </WindowGroupChrome>
      );

      const chrome = container.querySelector(
        '[data-group-id="group1"]'
      ) as HTMLElement;
      expect(chrome.style.zIndex).toBe("42");
    });
  });
});
