import "@/test/dom";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { useLayoutSync, useSavedLayout } from "@/hooks/use-layout-sync";
import { layoutSyncService } from "@/lib/mindscape/layout-sync";

// Mock auth client with controllable session
let currentSession: any = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: { id: "session-123" },
};

mock.module("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: currentSession }),
  },
}));

// Mock tRPC with controllable data
let mockGetPreferencesData: any[] = [];
const mockSetPreference = mock(() => Promise.resolve({}));
const mockGetPreferences = mock(() => Promise.resolve(mockGetPreferencesData));

mock.module("@/utils/trpc", () => ({
  trpc: {
    user: {
      setPreference: {
        useMutation: () => ({
          mutateAsync: mockSetPreference,
        }),
      },
      getPreferences: {
        useQuery: (_input: unknown, options?: { enabled?: boolean }) => {
          // Trigger the mock call for tracking
          mockGetPreferences();
          return {
            data: options?.enabled !== false ? mockGetPreferencesData : null,
            isLoading: false,
            isError: false,
          };
        },
      },
    },
  },
}));

// Mock React Flow store
const mockNodeInternals = new Map();

mock.module("@xyflow/react", () => ({
  useStore: () => new Map(mockNodeInternals),
}));

// Mock requestIdleCallback
global.requestIdleCallback = ((callback: () => void) => {
  Promise.resolve().then(() => callback());
  return 1;
}) as any;

describe("useLayoutSync", () => {
  let initSpy: any;
  let queueUpdateSpy: any;
  let forceSyncSpy: any;
  let destroySpy: any;

  beforeEach(() => {
    mockSetPreference.mockClear();
    mockGetPreferences.mockClear();
    mockNodeInternals.clear();
    mockGetPreferencesData = [];
    currentSession = {
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
      session: { id: "session-123" },
    };
    
    // Clear service state
    layoutSyncService.destroy();
    
    // Setup spies
    initSpy = spyOn(layoutSyncService, "init");
    queueUpdateSpy = spyOn(layoutSyncService, "queueUpdate");
    forceSyncSpy = spyOn(layoutSyncService, "forceSync");
    destroySpy = spyOn(layoutSyncService, "destroy");
  });

  afterEach(() => {
    initSpy.mockRestore();
    queueUpdateSpy.mockRestore();
    forceSyncSpy.mockRestore();
    destroySpy.mockRestore();
    layoutSyncService.destroy();
  });

  it("initializes service on mount with userId", async () => {
    renderHook(() => useLayoutSync());

    await waitFor(
      () => {
        expect(initSpy).toHaveBeenCalledWith(
          "user-123",
          expect.objectContaining({
            setPreference: expect.any(Function),
            getPreferences: expect.any(Function),
          })
        );
      },
      { timeout: 1000 }
    );
  });

  it("does not initialize without userId", async () => {
    currentSession = null;

    renderHook(() => useLayoutSync());

    // Give it a moment to potentially run
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(initSpy).not.toHaveBeenCalled();
  });

  it("queues updates when node positions change", async () => {
    const { rerender } = renderHook(() => useLayoutSync());

    // Wait for initialization
    await waitFor(
      () => {
        expect(mockGetPreferences).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    // Simulate node position change
    mockNodeInternals.set("node-1", {
      id: "node-1",
      position: { x: 10, y: 20 },
    });

    rerender();

    await waitFor(
      () => {
        expect(queueUpdateSpy).toHaveBeenCalledWith("node-1", { x: 10, y: 20 });
      },
      { timeout: 1000 }
    );
  });

  it("detects position changes for existing nodes", async () => {
    const { rerender } = renderHook(() => useLayoutSync());

    await waitFor(
      () => {
        expect(mockGetPreferences).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    // Initial node
    mockNodeInternals.set("node-1", {
      id: "node-1",
      position: { x: 10, y: 20 },
    });
    rerender();

    // Position changed
    mockNodeInternals.set("node-1", {
      id: "node-1",
      position: { x: 30, y: 40 },
    });
    rerender();

    await waitFor(
      () => {
        expect(queueUpdateSpy).toHaveBeenCalledWith("node-1", { x: 30, y: 40 });
      },
      { timeout: 1000 }
    );
  });

  it("syncs on page visibility change", async () => {
    renderHook(() => useLayoutSync());

    await waitFor(
      () => {
        expect(mockGetPreferences).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    // Simulate tab hidden
    Object.defineProperty(document, "hidden", {
      writable: true,
      value: true,
      configurable: true,
    });
    
    // Use window.Event from JSDOM
    const event = new (window as any).Event("visibilitychange");
    document.dispatchEvent(event);

    await waitFor(
      () => {
        expect(forceSyncSpy).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it("syncs on page unload", async () => {
    renderHook(() => useLayoutSync());

    await waitFor(
      () => {
        expect(mockGetPreferences).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    // Simulate page unload
    const event = new (window as any).Event("beforeunload");
    window.dispatchEvent(event);

    await waitFor(
      () => {
        expect(forceSyncSpy).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it("cleans up on unmount", async () => {
    const { unmount } = renderHook(() => useLayoutSync());

    await waitFor(
      () => {
        expect(mockGetPreferences).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    unmount();

    // Should attempt force sync before cleanup
    await waitFor(
      () => {
        expect(forceSyncSpy).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it("handles multiple rapid position changes", async () => {
    const { rerender } = renderHook(() => useLayoutSync());

    await waitFor(
      () => {
        expect(mockGetPreferences).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    // Rapid position changes
    for (let i = 0; i < 5; i++) {
      mockNodeInternals.set("node-1", {
        id: "node-1",
        position: { x: i * 10, y: i * 20 },
      });
      rerender();
    }

    // We expect at least 5 calls, but let's be flexible if there are extra renders
    await waitFor(
      () => {
        expect(queueUpdateSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
      },
      { timeout: 1000 }
    );
  });
});

describe("useSavedLayout", () => {
  beforeEach(() => {
    mockGetPreferences.mockClear();
    mockGetPreferencesData = [];
    currentSession = {
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
      session: { id: "session-123" },
    };
  });

  it("loads saved layout from database", async () => {
    const savedLayout = [
      { id: "node-1", position: { x: 100, y: 200 } },
      { id: "node-2", position: { x: 300, y: 400 } },
    ];

    mockGetPreferencesData = [
      {
        key: "mindscape:layout",
        value: {
          nodes: savedLayout,
          version: "v2",
          updatedAt: Date.now(),
        },
      },
    ];

    const { result } = renderHook(() => useSavedLayout());

    await waitFor(
      () => {
        expect(result.current).toEqual(savedLayout);
      },
      { timeout: 1000 }
    );
  });

  it("returns null when no saved layout exists", async () => {
    mockGetPreferencesData = [];

    const { result } = renderHook(() => useSavedLayout());

    await waitFor(() => {
      expect(result.current).toBeNull();
    });
  });

  it("handles invalid layout data gracefully", async () => {
    mockGetPreferencesData = [
      {
        key: "mindscape:layout",
        value: "invalid-data",
      },
    ];

    const { result } = renderHook(() => useSavedLayout());

    await waitFor(
      () => {
        expect(result.current).toBeNull();
      },
      { timeout: 1000 }
    );
  });

  it("does not load layout without userId", async () => {
    currentSession = null;

    const { result } = renderHook(() => useSavedLayout());

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBeNull();
  });
});
