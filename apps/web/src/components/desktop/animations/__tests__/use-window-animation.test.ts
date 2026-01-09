import "@/test/dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ANIMATION_CONFIG } from "../config";
import { useWindowAnimation } from "../use-window-animation";

describe("useWindowAnimation", () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;

    // Save original
    originalMatchMedia = window.matchMedia;

    // Default: no reduced motion preference
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    });

    // Mock requestAnimationFrame
    spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });

    spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    // Mock performance.now
    const time = 0;
    spyOn(performance, "now").mockImplementation(() => time);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    mock.restore();
  });

  const flushAnimationFrame = (time: number) => {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(time));
  };

  describe("spawn animation", () => {
    it("starts with spawning state and initial styles", () => {
      const { result } = renderHook(() => useWindowAnimation());

      expect(result.current.animationState).toBe("spawning");
      expect(result.current.styles.opacity).toBe(0);
      expect(result.current.isAnimating).toBe(true);
    });

    it("animates to idle state after spawn duration", async () => {
      const { result } = renderHook(() => useWindowAnimation());

      // Advance through animation
      act(() => {
        flushAnimationFrame(0);
        flushAnimationFrame(ANIMATION_CONFIG.duration.spawn / 2);
        flushAnimationFrame(ANIMATION_CONFIG.duration.spawn + 1);
      });

      await waitFor(() => {
        expect(result.current.animationState).toBe("idle");
        expect(result.current.styles.opacity).toBe(1);
        expect(result.current.isAnimating).toBe(false);
      });
    });

    it("skips animation when prefers-reduced-motion is true", () => {
      // Set reduced motion preference
      window.matchMedia = (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      });

      const { result } = renderHook(() => useWindowAnimation());

      expect(result.current.animationState).toBe("idle");
      expect(result.current.styles.opacity).toBe(1);
      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe("close animation", () => {
    it("calls onCloseComplete after close animation", async () => {
      const onCloseComplete = mock(() => {});

      const { result } = renderHook(() =>
        useWindowAnimation({ onCloseComplete })
      );

      // Complete spawn animation first
      act(() => {
        flushAnimationFrame(0);
        flushAnimationFrame(ANIMATION_CONFIG.duration.spawn + 1);
      });

      // Trigger close
      act(() => {
        result.current.animateClose();
      });

      expect(result.current.animationState).toBe("closing");

      // Complete close animation
      act(() => {
        flushAnimationFrame(0);
        flushAnimationFrame(ANIMATION_CONFIG.duration.close + 1);
      });

      await waitFor(() => {
        expect(onCloseComplete).toHaveBeenCalled();
      });
    });

    it("immediately calls onCloseComplete when reduced motion is preferred", () => {
      // Set reduced motion preference
      window.matchMedia = (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      });

      const onCloseComplete = mock(() => {});

      const { result } = renderHook(() =>
        useWindowAnimation({ onCloseComplete })
      );

      act(() => {
        result.current.animateClose();
      });

      expect(onCloseComplete).toHaveBeenCalled();
    });
  });

  describe("tile animation", () => {
    it("sets tiling state temporarily", () => {
      const { result } = renderHook(() => useWindowAnimation());

      // Complete spawn
      act(() => {
        flushAnimationFrame(0);
        flushAnimationFrame(ANIMATION_CONFIG.duration.spawn + 1);
      });

      act(() => {
        result.current.startTileAnimation();
      });

      expect(result.current.animationState).toBe("tiling");
    });

    it("skips tile animation when reduced motion is preferred", () => {
      // Set reduced motion preference
      window.matchMedia = (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      });

      const { result } = renderHook(() => useWindowAnimation());

      act(() => {
        result.current.startTileAnimation();
      });

      expect(result.current.animationState).toBe("idle");
    });
  });

  describe("resize animation", () => {
    it("sets resizing state on start", () => {
      const { result } = renderHook(() => useWindowAnimation());

      // Complete spawn
      act(() => {
        flushAnimationFrame(0);
        flushAnimationFrame(ANIMATION_CONFIG.duration.spawn + 1);
      });

      act(() => {
        result.current.startResizeAnimation();
      });

      expect(result.current.animationState).toBe("resizing");
    });

    it("returns to idle on end resize", () => {
      const { result } = renderHook(() => useWindowAnimation());

      // Complete spawn
      act(() => {
        flushAnimationFrame(0);
        flushAnimationFrame(ANIMATION_CONFIG.duration.spawn + 1);
      });

      act(() => {
        result.current.startResizeAnimation();
      });

      act(() => {
        result.current.endResizeAnimation();
      });

      expect(result.current.animationState).toBe("idle");
    });

    it("skips resize animation when reduced motion is preferred", () => {
      // Set reduced motion preference
      window.matchMedia = (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      });

      const { result } = renderHook(() => useWindowAnimation());

      act(() => {
        result.current.startResizeAnimation();
      });

      expect(result.current.animationState).toBe("idle");
    });
  });

  describe("styles output", () => {
    it("returns transform string with translate and scale", () => {
      const { result } = renderHook(() => useWindowAnimation());

      expect(result.current.styles.transform).toMatch(
        /translate\(.+\) scale\(.+\)/
      );
    });

    it("sets willChange to auto when idle", async () => {
      const { result } = renderHook(() => useWindowAnimation());

      // Complete spawn
      act(() => {
        flushAnimationFrame(0);
        flushAnimationFrame(ANIMATION_CONFIG.duration.spawn + 1);
      });

      await waitFor(() => {
        expect(result.current.styles.willChange).toBe("auto");
      });
    });

    it("sets willChange to transform, opacity when animating", () => {
      const { result } = renderHook(() => useWindowAnimation());

      expect(result.current.styles.willChange).toBe("transform, opacity");
    });
  });
});
