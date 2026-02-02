import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { create } from "zustand";

import type { FocusModeSlice } from "../focus-mode";
import type { ViewportSlice, WindowSlice } from "../types.new";
import type { WorkspaceSlice } from "../workspaces";

import { createFocusModeSlice } from "../focus-mode";
import { createViewportSliceNew } from "../viewport.new";
import { createWindowSliceNew } from "../windows.new";
import { createWorkspaceSlice } from "../workspaces";

type FocusModeTestState = WindowSlice &
  ViewportSlice &
  WorkspaceSlice &
  FocusModeSlice;

function createTestStore() {
  return create<FocusModeTestState>()((set, get, store) => ({
    ...createWindowSliceNew(set as never, get as never, store as never),
    ...createViewportSliceNew(set as never, get as never, store as never),
    ...createWorkspaceSlice(set as never, get as never, store as never),
    ...createFocusModeSlice(set as never, get as never, store as never),
  }));
}

describe("focus mode slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  afterEach(() => {
    store.getState().closeAllWindows();
  });

  it("enters focus mode: minimizes other windows and maximizes focused window", () => {
    const chatId = store.getState().openWindow("chat");
    const terminalId = store.getState().openWindow("terminal");

    store.getState().focusWindow(chatId);
    store.getState().enterFocusMode(chatId);

    expect(store.getState().isFocusMode).toBe(true);
    expect(store.getState().focusModeState?.windowId).toBe(chatId);

    const chat = store.getState().windows.find((w) => w.id === chatId);
    const terminal = store.getState().windows.find((w) => w.id === terminalId);

    expect(chat?.state).toBe("maximized");
    expect(terminal?.state).toBe("minimized");
    expect(store.getState().focusedWindowId).toBe(chatId);
  });

  it("exits focus mode: restores minimized windows and returns focus window to normal", () => {
    const chatId = store.getState().openWindow("chat");
    const terminalId = store.getState().openWindow("terminal");

    store.getState().focusWindow(chatId);
    store.getState().enterFocusMode(chatId);
    store.getState().exitFocusMode();

    expect(store.getState().isFocusMode).toBe(false);
    expect(store.getState().focusModeState).toBeNull();

    const chat = store.getState().windows.find((w) => w.id === chatId);
    const terminal = store.getState().windows.find((w) => w.id === terminalId);

    expect(chat?.state).toBe("normal");
    expect(terminal?.state).toBe("normal");
    expect(store.getState().focusedWindowId).toBe(chatId);
  });

  it("restores windows that were maximized before focus mode back to maximized", () => {
    const chatId = store.getState().openWindow("chat");
    const reviewsId = store.getState().openWindow("reviews");

    store.getState().maximizeWindow(reviewsId);
    store.getState().focusWindow(chatId);

    store.getState().enterFocusMode(chatId);
    store.getState().exitFocusMode();

    const reviews = store.getState().windows.find((w) => w.id === reviewsId);
    expect(reviews?.state).toBe("maximized");
  });
});
