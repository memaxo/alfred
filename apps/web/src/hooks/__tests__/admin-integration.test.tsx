import "@/test/dom";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "bun:test";

import { useDesktopStore } from "@/store/desktop";

import { useDesktopDeeplinks } from "../use-desktop-deeplinks";

describe("Admin Integration (Deep Linking)", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      focusedWindowId: null,
    });
  });

  it("spawns the admin window via search params", () => {
    const spawnWindowSpy = vi.fn().mockReturnValue("admin-123");
    const focusWindowSpy = vi.fn();
    useDesktopStore.setState({
      spawnWindow: spawnWindowSpy,
      focusWindow: focusWindowSpy,
    });

    renderHook(() => useDesktopDeeplinks({ spawn: "admin" }));

    expect(spawnWindowSpy).toHaveBeenCalledWith("admin");
    expect(focusWindowSpy).toHaveBeenCalledWith("admin-123");
  });

  it("spawns the metrics window via search params", () => {
    const spawnWindowSpy = vi.fn().mockReturnValue("metrics-123");
    const focusWindowSpy = vi.fn();
    useDesktopStore.setState({
      spawnWindow: spawnWindowSpy,
      focusWindow: focusWindowSpy,
    });

    renderHook(() => useDesktopDeeplinks({ spawn: "metrics" }));

    expect(spawnWindowSpy).toHaveBeenCalledWith("metrics");
    expect(focusWindowSpy).toHaveBeenCalledWith("metrics-123");
  });
});
