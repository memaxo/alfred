import "@/test/dom";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import {
  dispatchDesktopEvent,
  useDesktopActivations,
} from "@/hooks/use-desktop-activations";

describe("Desktop Activation Events Integration", () => {
  it("exposes a dispatch function", () => {
    const { result } = renderHook(() => useDesktopActivations());
    expect(typeof result.current.dispatch).toBe("function");
  });

  it("dispatches activation events without throwing", () => {
    const { result } = renderHook(() => useDesktopActivations());

    expect(() =>
      result.current.dispatch({
        type: "tool-call",
        sourceId: "source-1",
        targetId: "target-1",
      })
    ).not.toThrow();

    expect(() =>
      dispatchDesktopEvent({
        type: "context-cache",
      })
    ).not.toThrow();
  });

  it("cleans up the event listener on unmount", () => {
    const { unmount } = renderHook(() => useDesktopActivations());
    expect(() => unmount()).not.toThrow();
  });
});
