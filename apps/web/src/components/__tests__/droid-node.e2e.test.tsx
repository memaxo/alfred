import React from "react";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, waitFor } from "../../test/testing-library";
import { useMindscapeStore } from "@/store/mindscape";

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

mock.module("@/lib/droid/stream-client", () => ({
  subscribeToDroidStream: (options: any) => subscribeMock(options),
}));

mock.module("@/lib/token", () => ({
  getToolToken: (...args: unknown[]) => getToolTokenMock(...args),
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
    getToolTokenMock.mockReset();
    subscribeMock.mockReset();
    resumeTriggerMock.mockReset();
    resumeCloseMock.mockReset();
    latestSubscription = null;
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
    await view.findByText(/running/i);

    // Complete
    latestSubscription.onEvent?.({ type: "exit", code: 0 });
    await view.findByText(/completed/i);
  });
});
