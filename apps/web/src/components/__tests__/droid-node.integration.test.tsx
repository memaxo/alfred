import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type React from "react";
import { useMindscapeStore } from "@/store/mindscape";
import { act, render, waitFor } from "../../test/testing-library";

type Harness = {
  subscribeImpl: ((options: any) => { unsubscribe: () => void }) | null;
  subscribe: (options: any) => { unsubscribe: () => void };
};

type HarnessGlobal = {
  __droidStreamTestHarness__?: Harness;
};

const subscribeMock = mock((options: any) => {
  latestSubscription = options;
  return {
    unsubscribe: mock(() => {}),
  };
});
let latestSubscription: any = null;
const getToolTokenMock = mock(() => Promise.resolve("mock-token"));
const resumePromptMock = mock(() => {});
const resumeCloseMock = mock(() => {});
const trpcProxyMock = {
  droid: {
    stream: {
      subscribe: () => ({
        subscribe: () => ({ unsubscribe() {} }),
      }),
    },
  },
};

const harness: Harness = {
  subscribeImpl: null,
  subscribe(options: any) {
    const impl =
      harness.subscribeImpl ?? ((input: any) => subscribeMock(input));
    return impl(options);
  },
};

function setHarnessSubscribe(
  implementation: (options: any) => { unsubscribe: () => void }
) {
  harness.subscribeImpl = implementation;
}

function resetHarness() {
  harness.subscribeImpl = null;
}

function debugLog(...args: unknown[]) {
  if (process.env.DEBUG_DROID_TEST === "1") {
    // eslint-disable-next-line no-console
    console.info("[droid-node-integration]", ...args);
  }
}

mock.module("@/lib/token", () => ({
  getToolToken: (...args: unknown[]) => getToolTokenMock(...args),
}));

mock.module("@/lib/trpc-client", () => ({
  createBrowserTrpcProxyClient: () => trpcProxyMock,
}));

mock.module("@/hooks/use-biometric-resume", () => ({
  useObligationResume: () => ({
    isOpen: false,
    pending: null,
    target: "droid",
    prompt: resumePromptMock,
    close: resumeCloseMock,
  }),
}));

mock.module("@/components/biometric-challenge-dialog", () => ({
  ObligationChallengeDialog: () => null,
}));

mock.module("@/components/mindscape/nodes/mindscape-node", () => ({
  MindscapeNode: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

mock.module("@/components/mindscape/lod", () => ({
  useLOD: () => "full",
  useNodeFocus: () => ({ isDimmed: false, isFocused: false }),
}));

const { DroidNode } = await import("../mindscape/nodes/droid-node");

describe("DroidNode", () => {
  beforeEach(() => {
    getToolTokenMock.mockClear();
    subscribeMock.mockClear();
    resumePromptMock.mockClear();
    resumeCloseMock.mockClear();
    latestSubscription = null;
    resetHarness();
    (globalThis as HarnessGlobal).__droidStreamTestHarness__ = harness;
    if (typeof window !== "undefined") {
      (window as unknown as HarnessGlobal).__droidStreamTestHarness__ = harness;
    }
    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [],
      edges: [],
      focusedNodeId: null,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    }));
  });

  afterEach(() => {
    (globalThis as HarnessGlobal).__droidStreamTestHarness__ = undefined;
    if (typeof window !== "undefined") {
      (window as unknown as HarnessGlobal).__droidStreamTestHarness__ =
        undefined;
    }
  });

  it("streams output and handles biometric obligations", async () => {
    setHarnessSubscribe((options: any) => {
      debugLog("subscription start", options.input);
      return subscribeMock(options);
    });
    const nodeId = "droid-test";
    const nodeData = {
      type: "droid" as const,
      label: "Droid Exec",
      prompt: "list files",
      status: "idle",
      auto: "low" as const,
      out: "text" as const,
    };

    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: nodeId,
          type: "droid",
          position: { x: 0, y: 0 },
          data: nodeData,
        },
      ],
    }));

    const view = render(
      <DroidNode data={nodeData} id={nodeId} selected={false} />
    );

    await waitFor(() => {
      expect((globalThis as any).__droidTestHooks__?.[nodeId]).toBeDefined();
    });

    const hooks = (globalThis as any).__droidTestHooks__;
    expect(typeof hooks[nodeId].run).toBe("function");
    await act(async () => {
      await hooks[nodeId].run();
    });

    await waitFor(() => {
      expect(getToolTokenMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });
    expect(getToolTokenMock).toHaveBeenCalledWith(["droid.exec"], "low");

    // Stream stdout
    latestSubscription.onEvent?.({ type: "stdout", data: "hello" });
    await view.findByText(/hello/);

    // Obligation arrives
    latestSubscription.onObligation?.({
      runId: "run-biometric",
      obligations: [
        {
          type: "biometric",
          reason: "biometric_required",
          metadata: { code: "requireBio" },
        },
      ],
    });
    debugLog("obligation received", latestSubscription ? "active" : "missing");
    await waitFor(() => {
      expect(resumePromptMock).toHaveBeenCalled();
    });
    await view.findByText(/Awaiting biometric/i);

    // Resume
    latestSubscription.onResume?.({ runId: "run-biometric" });
    await view.findByText(/Biometric check satisfied/i);

    // Complete
    latestSubscription.onEvent?.({ type: "exit", code: 0 });
    await view.findByText(/Process exited with code 0/i);
  });

  it("surfaces stream errors and halts further output", async () => {
    const nodeId = "droid-error";
    const nodeData = {
      type: "droid" as const,
      label: "Droid Exec",
      prompt: "fail please",
      status: "idle",
      auto: "low" as const,
      out: "text" as const,
    };

    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: nodeId,
          type: "droid",
          position: { x: 0, y: 0 },
          data: nodeData,
        },
      ],
    }));

    setHarnessSubscribe((options: any) => {
      setTimeout(() => {
        options.onEvent?.({ type: "stdout", data: "boot" });
        options.onError?.(new Error("boom"));
      }, 0);
      return subscribeMock(options);
    });

    render(<DroidNode data={nodeData} id={nodeId} selected={false} />);

    await waitFor(() => {
      expect((globalThis as any).__droidTestHooks__?.[nodeId]).toBeDefined();
    });

    await act(async () => {
      await (globalThis as any).__droidTestHooks__[nodeId].run();
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain("boot");
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain("Error: boom");
    });
  });
});
