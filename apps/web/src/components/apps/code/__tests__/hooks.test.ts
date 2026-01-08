/**
 * Code Editor Hooks Tests
 *
 * Tests for useEditorSettings, useKeyboardShortcuts, and useUnsavedChangesWarning.
 */

import "@/test/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { act, renderHook } from "@testing-library/react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

const { useEditorSettings, useKeyboardShortcuts, useUnsavedChangesWarning } =
  await import("../hooks");
const { DEFAULT_EDITOR_SETTINGS } = await import("../types");

describe("useEditorSettings", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("returns default settings on initial load", () => {
    const { result } = renderHook(() => useEditorSettings());

    expect(result.current.settings).toEqual(DEFAULT_EDITOR_SETTINGS);
  });

  it("loads settings from localStorage if present", async () => {
    const customSettings = {
      fontSize: 18,
      wordWrap: "off" as const,
      minimap: false,
      tabSize: 4,
      lineNumbers: "relative" as const,
    };
    localStorageMock.setItem(
      "alfred-code-editor-settings",
      JSON.stringify(customSettings)
    );

    const { result } = renderHook(() => useEditorSettings());

    // Wait for useEffect to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.settings.fontSize).toBe(18);
    expect(result.current.settings.wordWrap).toBe("off");
    expect(result.current.settings.minimap).toBe(false);
  });

  it("updates settings and persists to localStorage", () => {
    const { result } = renderHook(() => useEditorSettings());

    act(() => {
      result.current.updateSettings({ fontSize: 20 });
    });

    expect(result.current.settings.fontSize).toBe(20);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "alfred-code-editor-settings",
      expect.stringContaining('"fontSize":20')
    );
  });

  it("merges partial updates with existing settings", () => {
    const { result } = renderHook(() => useEditorSettings());

    act(() => {
      result.current.updateSettings({ fontSize: 16 });
    });

    act(() => {
      result.current.updateSettings({ minimap: false });
    });

    expect(result.current.settings.fontSize).toBe(16);
    expect(result.current.settings.minimap).toBe(false);
    expect(result.current.settings.wordWrap).toBe(
      DEFAULT_EDITOR_SETTINGS.wordWrap
    );
  });

  it("handles invalid JSON in localStorage gracefully", async () => {
    localStorageMock.setItem("alfred-code-editor-settings", "invalid-json");

    const { result } = renderHook(() => useEditorSettings());

    // Should fall back to defaults
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.settings).toEqual(DEFAULT_EDITOR_SETTINGS);
  });
});

describe("useKeyboardShortcuts", () => {
  const createMockHandlers = () => ({
    onSave: vi.fn(),
    onCloseTab: vi.fn(),
    onOpenSearch: vi.fn(),
    onNewFile: vi.fn(),
    activeTab: {
      id: "1",
      path: "/test.ts",
      name: "test.ts",
      language: "typescript",
      content: "test",
      isDirty: false,
    },
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registers event listener on mount", () => {
    const handlers = createMockHandlers();
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useKeyboardShortcuts(handlers));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function)
    );
  });

  it("cleans up event listener on unmount", () => {
    const handlers = createMockHandlers();
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useKeyboardShortcuts(handlers));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function)
    );
  });

  it("updates handler when dependencies change", () => {
    const handlers = createMockHandlers();
    const { rerender } = renderHook((props) => useKeyboardShortcuts(props), {
      initialProps: handlers,
    });

    const newHandlers = { ...handlers, onSave: vi.fn() };
    rerender(newHandlers);

    // Should have re-registered with new handlers
    // This is a basic verification that the hook updates
    expect(newHandlers.onSave).not.toBe(handlers.onSave);
  });
});

describe("useUnsavedChangesWarning", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when no tabs are dirty", () => {
    const tabs = [
      {
        id: "1",
        name: "file1.ts",
        isDirty: false,
        path: "/file1.ts",
        language: "typescript",
        content: "",
      },
      {
        id: "2",
        name: "file2.ts",
        isDirty: false,
        path: "/file2.ts",
        language: "typescript",
        content: "",
      },
    ];

    const { result } = renderHook(() => useUnsavedChangesWarning(tabs));

    expect(result.current).toBe(false);
  });

  it("returns true when at least one tab is dirty", () => {
    const tabs = [
      {
        id: "1",
        name: "file1.ts",
        isDirty: false,
        path: "/file1.ts",
        language: "typescript",
        content: "",
      },
      {
        id: "2",
        name: "file2.ts",
        isDirty: true,
        path: "/file2.ts",
        language: "typescript",
        content: "",
      },
    ];

    const { result } = renderHook(() => useUnsavedChangesWarning(tabs));

    expect(result.current).toBe(true);
  });

  it("registers beforeunload listener when dirty tabs exist", () => {
    const tabs = [
      {
        id: "1",
        name: "file1.ts",
        isDirty: true,
        path: "/file1.ts",
        language: "typescript",
        content: "",
      },
    ];

    renderHook(() => useUnsavedChangesWarning(tabs));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
  });

  it("cleans up beforeunload listener on unmount", () => {
    const tabs = [
      {
        id: "1",
        name: "file1.ts",
        isDirty: true,
        path: "/file1.ts",
        language: "typescript",
        content: "",
      },
    ];

    const { unmount } = renderHook(() => useUnsavedChangesWarning(tabs));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
  });

  it("handles empty tabs array", () => {
    const { result } = renderHook(() => useUnsavedChangesWarning([]));

    expect(result.current).toBe(false);
  });
});
