import "@/test/dom";
import { describe, expect, it } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDebounce } from "../use-debounce";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("useDebounce", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(
      ({ v, ms }: { v: string; ms: number }) => useDebounce(v, ms),
      { initialProps: { v: "a", ms: 25 } }
    );

    expect(result.current).toBe("a");
  });

  it("updates the debounced value after delay", async () => {
    const { result, rerender } = renderHook(
      ({ v, ms }: { v: string; ms: number }) => useDebounce(v, ms),
      { initialProps: { v: "a", ms: 25 } }
    );

    act(() => {
      rerender({ v: "b", ms: 25 });
    });

    // Still old value immediately
    expect(result.current).toBe("a");

    await waitFor(() => {
      expect(result.current).toBe("b");
    });
  });

  it("resets delay if value changes again before it elapses", async () => {
    const { result, rerender } = renderHook(
      ({ v, ms }: { v: string; ms: number }) => useDebounce(v, ms),
      { initialProps: { v: "a", ms: 30 } }
    );

    act(() => {
      rerender({ v: "b", ms: 30 });
    });

    // Change again before 30ms elapses
    await act(async () => {
      await sleep(15);
    });

    act(() => {
      rerender({ v: "c", ms: 30 });
    });

    // Should not settle to "b"
    await act(async () => {
      await sleep(25);
    });
    expect(result.current).not.toBe("b");

    await waitFor(() => {
      expect(result.current).toBe("c");
    });
  });
});
