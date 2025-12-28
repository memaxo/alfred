/**
 * ALFRED TUI Workflow Subscription
 *
 * Subscribes to workflow events via tRPC subscription.
 */

import type { SubscriptionManager } from "./manager";

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
  useMockData?: boolean;
};

export function setupWorkflowSubscription(
  options: WorkflowSubscriptionOptions
): void {
  const {
    manager,
    store,
    useMockData = true, // TODO: Switch to false when ready
  } = options;

  if (useMockData) {
    // Use polling with mock data for demo
    manager.addPolling({
      id: "workflow",
      fetch: async () => mockWorkflowEvent(),
      onData: (event) => store.handleEvent(event),
      onError: (_error) => {},
      interval: 5000, // Less frequent for workflows
      immediate: false, // Don't trigger immediately
    });
  } else {
    // Use real tRPC subscription
    // TODO: Implement when ready
    void manager.addSubscription({
      id: "workflow",
      start: () => {
        // const client = getTrpcClient();
        // const subscription = client.workflow.stream.subscribe();
        // return {
        //   unsubscribe: () => subscription.unsubscribe(),
        //   onData: (cb) => subscription.subscribe({ next: cb }),
        //   onError: (cb) => subscription.subscribe({ error: cb }),
        // };

        // Mock implementation
        let callback: ((event: WorkflowEvent) => void) | null = null;
        const interval = setInterval(() => {
          if (callback) {
            callback(mockWorkflowEvent());
          }
        }, 5000);

        return Promise.resolve({
          unsubscribe: () => clearInterval(interval),
          onData: (cb: (event: WorkflowEvent) => void) => {
            callback = cb;
          },
          onError: () => {},
        });
      },
      onData: (event) => store.handleEvent(event as WorkflowEvent),
      onError: (_error) => {},
    });
  }
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
