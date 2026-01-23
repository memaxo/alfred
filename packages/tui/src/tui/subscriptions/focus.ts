/**
 * ALFRED TUI Focus Subscription
 *
 * Minimal Concierge Focus polling for TUI panels.
 */

import type { ApiResult } from "../api/client";
import { getApiClient } from "../api/client";
import type { SubscriptionManager } from "./manager";
import { addPollingWithFallback, type DataMode } from "./mode";

export type FocusBoardState = {
  focusSet: { id: string; title: string | null; wipLimit: number } | null;
  commitments: Array<{
    id: string;
    title: string;
    lane: string;
    status: string;
    priority: number;
    workflowRunId: string | null;
  }>;
  attention: Array<{
    id: string;
    kind: string;
    title: string | null;
    urgency: string;
    workflowRunId: string | null;
  }>;
  delta: Array<{
    id: string;
    scope: string;
    summaryText: string;
    createdAt: string;
  }>;
  timestamp: number;
};

function mockFocusState(): FocusBoardState {
  return {
    focusSet: {
      id: "mock",
      title: "Mock Focus",
      wipLimit: 5,
    },
    commitments: [
      {
        id: "c1",
        title: "Ship Concierge Focus",
        lane: "spotlight",
        status: "active",
        priority: 1,
        workflowRunId: null,
      },
    ],
    attention: [
      {
        id: "a1",
        kind: "pipeline_suspend:clarification",
        title: "Clarification needed",
        urgency: "high",
        workflowRunId: null,
      },
    ],
    delta: [
      {
        id: "d1",
        scope: "workflow_run",
        summaryText: "Workflow completed.",
        createdAt: new Date().toISOString(),
      },
    ],
    timestamp: Date.now(),
  };
}

export class FocusStore {
  private state: FocusBoardState | null = null;
  private readonly listeners: Set<(state: FocusBoardState) => void> = new Set();

  getState(): FocusBoardState | null {
    return this.state;
  }

  update(next: FocusBoardState): void {
    this.state = next;
    this.notify();
  }

  subscribe(listener: (state: FocusBoardState) => void): () => void {
    this.listeners.add(listener);
    if (this.state) {
      listener(this.state);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (!this.state) {
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

export type FocusSubscriptionOptions = {
  manager: SubscriptionManager;
  store: FocusStore;
  pollingInterval?: number;
  mode?: DataMode;
};

export function setupFocusSubscription(
  options: FocusSubscriptionOptions
): void {
  const { manager, store, pollingInterval = 5000, mode } = options;

  addPollingWithFallback({
    manager,
    id: "focus",
    mode,
    interval: pollingInterval,
    immediate: true,
    maxFailures: 3,
    fetchMock: async () => mockFocusState(),
    fetchLive: async () => {
      const client = getApiClient();

      const active = await client.getFocusActive();
      if (active.error) {
        const code = active.error.code;
        const msg = active.error.message ?? "";
        const isAuth = code === "HTTP_ERROR" && /HTTP (401|403)\b/.test(msg);
        if (code === "NETWORK_ERROR" || isAuth) {
          throw new Error("tui_live_unavailable");
        }
        throw new Error("tui_focus_fetch_failed");
      }

      const focusSet = active.data
        ? {
            id: active.data.id,
            title: active.data.title ?? null,
            wipLimit: active.data.wipLimit,
          }
        : null;

      const [commitments, attention, delta] = await Promise.all([
        focusSet
          ? client.listFocusCommitments(focusSet.id, 10)
          : Promise.resolve<ApiResult<FocusBoardState["commitments"]>>({
              data: [],
            }),
        client.listAttentionOpen(10),
        client.listDelta(10),
      ]);

      for (const res of [commitments, attention, delta]) {
        if (res.error) {
          const code = res.error.code;
          const msg = res.error.message ?? "";
          const isAuth = code === "HTTP_ERROR" && /HTTP (401|403)\b/.test(msg);
          if (code === "NETWORK_ERROR" || isAuth) {
            throw new Error("tui_live_unavailable");
          }
          throw new Error("tui_focus_fetch_failed");
        }
      }

      return {
        focusSet,
        commitments: commitments.data ?? [],
        attention: attention.data ?? [],
        delta: delta.data ?? [],
        timestamp: Date.now(),
      };
    },
    onData: (state) => store.update(state),
    onError: (_error) => {},
  });
}

export function createFocusStore(): FocusStore {
  return new FocusStore();
}
