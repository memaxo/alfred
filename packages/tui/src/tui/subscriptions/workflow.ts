/**
 * ALFRED TUI Workflow Subscription
 *
 * Subscribes to workflow events via tRPC subscription.
 */

import type { SubscriptionManager } from "./manager";

import { getApiClient } from "../api/client";
import { addPollingWithFallback, type DataMode } from "./mode";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkflowStatus =
  | "pending"
  | "planning"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type Workflow = {
  id: string;
  name: string;
  status: WorkflowStatus;
  progress: number; // 0-1
  startedAt?: number;
  completedAt?: number;
  error?: string;
  subtasks?: WorkflowSubtask[];
};

export type WorkflowSubtask = {
  id: string;
  name: string;
  status: WorkflowStatus;
  agentId?: string;
};

export type WorkflowEvent = {
  type:
    | "started"
    | "progress"
    | "subtask"
    | "completed"
    | "failed"
    | "cancelled";
  workflow: Workflow;
  timestamp: number;
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

function mockWorkflowEvent(): WorkflowEvent {
  const types: WorkflowEvent["type"][] = ["started", "progress", "completed"];
  const type = types[Math.floor(Math.random() * types.length)] ?? "progress";

  return {
    type,
    workflow: {
      id: `wf-${Math.random().toString(36).slice(2, 8)}`,
      name: "Background task",
      status: type === "completed" ? "completed" : "executing",
      progress: type === "completed" ? 1 : Math.random(),
      startedAt: Date.now() - 5000,
      completedAt: type === "completed" ? Date.now() : undefined,
    },
    timestamp: Date.now(),
  };
}

// ─── Workflow Store ──────────────────────────────────────────────────────────

export class WorkflowStore {
  private readonly workflows = new Map<string, Workflow>();
  private history: Workflow[] = [];
  private readonly maxHistory = 10;
  private readonly listeners: Set<
    (workflows: Workflow[], event?: WorkflowEvent) => void
  > = new Set();

  getActive(): Workflow[] {
    return Array.from(this.workflows.values()).filter(
      (w) =>
        w.status === "pending" ||
        w.status === "planning" ||
        w.status === "executing"
    );
  }

  getPending(): Workflow[] {
    return Array.from(this.workflows.values()).filter(
      (w) => w.status === "pending"
    );
  }

  getHistory(): Workflow[] {
    return [...this.history];
  }

  getAll(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  get(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  handleEvent(event: WorkflowEvent): void {
    const { workflow } = event;

    switch (event.type) {
      case "started":
      case "progress":
      case "subtask":
        this.workflows.set(workflow.id, workflow);
        break;

      case "completed":
      case "failed":
      case "cancelled":
        this.workflows.delete(workflow.id);
        this.history.unshift(workflow);
        if (this.history.length > this.maxHistory) {
          this.history = this.history.slice(0, this.maxHistory);
        }
        break;
    }

    this.notify(event);
  }

  subscribe(
    listener: (workflows: Workflow[], event?: WorkflowEvent) => void
  ): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getAll());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event?: WorkflowEvent): void {
    const workflows = this.getAll();
    for (const listener of this.listeners) {
      try {
        listener(workflows, event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  clear(): void {
    this.workflows.clear();
    this.notify();
  }
}

// ─── Workflow Subscription Setup ─────────────────────────────────────────────

export type WorkflowSubscriptionOptions = {
  manager: SubscriptionManager;
  store: WorkflowStore;
  mode?: DataMode;
};

export function setupWorkflowSubscription(
  options: WorkflowSubscriptionOptions
): void {
  const { manager, store, mode } = options;

  const prevStatusByRun = new Map<string, WorkflowStatus>();

  addPollingWithFallback({
    manager,
    id: "workflow",
    mode,
    interval: 5000,
    immediate: false,
    maxFailures: 3,
    fetchMock: async () => [mockWorkflowEvent()],
    fetchLive: async () => {
      const client = getApiClient();
      const result = await client.listWorkflows(25);
      if (result.error || !result.data) {
        const code = result.error?.code;
        const msg = result.error?.message ?? "";
        const isAuth = code === "HTTP_ERROR" && /HTTP (401|403)\b/.test(msg);
        if (code === "NETWORK_ERROR" || isAuth) {
          throw new Error("tui_live_unavailable");
        }
        throw new Error("tui_workflow_fetch_failed");
      }

      const now = Date.now();
      const events: WorkflowEvent[] = [];
      for (const run of result.data.runs) {
        const statusRaw = run.status;
        const status: WorkflowStatus =
          statusRaw === "pending" ||
          statusRaw === "planning" ||
          statusRaw === "executing" ||
          statusRaw === "completed" ||
          statusRaw === "failed" ||
          statusRaw === "cancelled"
            ? statusRaw
            : "pending";

        const prev = prevStatusByRun.get(run.id);
        prevStatusByRun.set(run.id, status);

        const eventType: WorkflowEvent["type"] =
          status === "completed"
            ? "completed"
            : status === "failed"
              ? "failed"
              : status === "cancelled"
                ? "cancelled"
                : prev
                  ? "progress"
                  : "started";

        const startedAt = Number.isFinite(Date.parse(run.createdAt))
          ? Date.parse(run.createdAt)
          : undefined;

        const progress =
          status === "completed"
            ? 1
            : status === "executing"
              ? 0.5
              : status === "planning"
                ? 0.25
                : 0;

        events.push({
          type: eventType,
          workflow: {
            id: run.id,
            name: run.requirement,
            status,
            progress,
            startedAt,
          },
          timestamp: now,
        });
      }

      return events.length > 0 ? events : [mockWorkflowEvent()];
    },
    onData: (events) => {
      for (const event of events) {
        store.handleEvent(event);
      }
    },
    onError: (_error) => {},
  });
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createWorkflowStore(): WorkflowStore {
  return new WorkflowStore();
}

// ─── Mock Workflows Factory ───────────────────────────────────────────────────

export type MockWorkflow = {
  runId: string;
  intent: string;
  status: "pending" | "executing" | "completed" | "failed";
  phase?: string;
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  queuedAt?: Date;
  duration?: number;
};

export function createMockWorkflows(): MockWorkflow[] {
  return [
    {
      runId: "run_001",
      intent: "Deploy to staging",
      status: "executing",
      phase: "act",
      progress: 0.6,
      startedAt: new Date(Date.now() - 60_000),
    },
    {
      runId: "run_002",
      intent: "Review PR #123",
      status: "pending",
      queuedAt: new Date(Date.now() - 30_000),
    },
    {
      runId: "run_003",
      intent: "Run test suite",
      status: "completed",
      startedAt: new Date(Date.now() - 120_000),
      completedAt: new Date(Date.now() - 60_000),
      duration: 60_000,
    },
    {
      runId: "run_004",
      intent: "Update dependencies",
      status: "failed",
      startedAt: new Date(Date.now() - 180_000),
      failedAt: new Date(Date.now() - 150_000),
      error: "Policy denied: requires approval",
    },
    {
      runId: "run_005",
      intent: "Analyze codebase",
      status: "executing",
      phase: "think",
      progress: 0.3,
      startedAt: new Date(Date.now() - 45_000),
    },
  ];
}
