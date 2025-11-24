import React from "react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, waitFor } from "../../test/testing-library";
import { useMindscapeStore } from "@/store/mindscape";

type HarnessGlobal = {
  __droidStreamTestHarness__?: {
    subscribe: (options: any) => { unsubscribe: () => void };
  };
};

const subscribeMock = mock((options: any) => {
  latestSubscription = options;
  return {
    unsubscribe: mock(() => {}),
  };
});
let latestSubscription: any = null;
const getToolTokenMock = mock(() => Promise.resolve("mock-token"));
const resumeTriggerMock = mock(() => Promise.resolve());
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

mock.module("@/lib/token", () => ({
  getToolToken: (...args: unknown[]) => getToolTokenMock(...args),
}));

mock.module("@/lib/trpc-client", () => ({
  createBrowserTrpcProxyClient: () => trpcProxyMock,
}));

mock.module("@/hooks/use-biometric-resume", () => ({
  useBiometricResume: () => ({
    isOpen: false,
    pendingRunId: null,
    trigger: resumeTriggerMock,
    close: resumeCloseMock,
  }),
}));

mock.module("@/components/biometric-challenge-dialog", () => ({
  BiometricChallengeDialog: () => null,
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
    resumeTriggerMock.mockClear();
    resumeCloseMock.mockClear();
    latestSubscription = null;
    const harness = {
      subscribe: (options: any) => subscribeMock(options),
    };
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
    delete (globalThis as HarnessGlobal).__droidStreamTestHarness__;
    if (typeof window !== "undefined") {
      delete (window as unknown as HarnessGlobal).__droidStreamTestHarness__;
    }
  });

  it("streams output and handles biometric obligations", async () => {
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
      obligations: ["biometric"],
    });
    await waitFor(() => {
      expect(resumeTriggerMock).toHaveBeenCalled();
    });
    await view.findByText(/Awaiting biometric/i);

    // Resume
    latestSubscription.onResume?.({ runId: "run-biometric" });
    await view.findByText(/Biometric check satisfied/i);

    // Complete
    latestSubscription.onEvent?.({ type: "exit", code: 0 });
    await view.findByText(/Process exited with code 0/i);
  });
});
