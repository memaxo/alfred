import "@/test/dom";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useDesktopStore } from "@/store/desktop";
import { useFocusGravity } from "../use-focus-gravity";

// Mock the store
mock.module("@/store/desktop", () => ({
  useDesktopStore: mock(() => null),
}));

describe("useFocusGravity", () => {
  beforeEach(() => {
    (useDesktopStore as unknown as ReturnType<typeof mock>).mockReset();
  });

  it("returns full opacity when no window is focused", () => {
    (useDesktopStore as unknown as ReturnType<typeof mock>).mockReturnValue(
      null
    );
    const { result } = renderHook(() => useFocusGravity("win-1", false));

    expect(result.current.opacity).toBe(1);
    expect(result.current.blur).toBe(0);
    expect(result.current.scale).toBe(1);
  });

  it("returns full opacity when the window itself is focused", () => {
    (useDesktopStore as unknown as ReturnType<typeof mock>).mockReturnValue(
      "win-1"
    );
    const { result } = renderHook(() => useFocusGravity("win-1", true));

    expect(result.current.opacity).toBe(1);
    expect(result.current.blur).toBe(0);
    expect(result.current.scale).toBe(1);
  });

  it("returns dimmed styles when another window is focused", () => {
    (useDesktopStore as unknown as ReturnType<typeof mock>).mockReturnValue(
      "win-2"
    );
    const { result } = renderHook(() => useFocusGravity("win-1", false));

    expect(result.current.opacity).toBe(0.6);
    expect(result.current.blur).toBe(2);
    expect(result.current.scale).toBe(0.98);
  });
});
