/**
 * ALFRED CarPlay Sync
 *
 * Real-time synchronization with backend via tRPC subscriptions.
 * Falls back to polling when subscriptions unavailable.
 */

import NetInfo from "@react-native-community/netinfo";
import * as carPlayApi from "./api";
import { useCarPlayStore } from "./store";
import type {
  CarPlayEvent,
  Escalation,
  EscalationPriority,
  EscalationReason,
  WorkflowState,
} from "./types";

const POLL_INTERVAL_MS = 30_000; // 30 second fallback polling
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

type SyncManagerState = {
  isSubscribed: boolean;
  pollTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  unsubscribeNetInfo: (() => void) | null;
};

class CarPlaySyncManager {
  private readonly state: SyncManagerState = {
    isSubscribed: false,
    pollTimer: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    unsubscribeNetInfo: null,
  };

  private subscriptionCleanup: (() => void) | null = null;

  async start(): Promise<void> {
    const store = useCarPlayStore.getState();

    // Subscribe to network changes
    this.state.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      this.handleNetworkChange(state.isConnected ?? false);
    });

    // Check initial network state
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      store.setConnectionStatus("offline");
      return;
    }

    store.setConnectionStatus("reconnecting");

    // Try to establish subscription, fall back to polling
    await this.connect();
  }

  stop(): void {
    this.cleanup();

    if (this.state.unsubscribeNetInfo) {
      this.state.unsubscribeNetInfo();
      this.state.unsubscribeNetInfo = null;
    }

    useCarPlayStore.getState().setConnectionStatus("disconnected");
  }

  private async connect(): Promise<void> {
    const store = useCarPlayStore.getState();

    try {
      // Attempt subscription-based sync first
      const subscribed = await this.trySubscribe();

      if (subscribed) {
        this.state.isSubscribed = true;
        this.state.reconnectAttempts = 0;
        store.setConnectionStatus("connected");

        // Initial data fetch
        await this.fetchInitialData();
      } else {
        // Fall back to polling
        this.startPolling();
        store.setConnectionStatus("connected");
      }

      store.setLastSyncAt(Date.now());
    } catch (_error) {
      this.scheduleReconnect();
    }
  }

  private async trySubscribe(): Promise<boolean> {
    // Note: tRPC subscriptions require special setup in React Native
    // For now, return false to use polling
    // TODO: Implement WebSocket subscription when backend supports it
    return false;
  }

  private startPolling(): void {
    if (this.state.pollTimer) {
      return;
    }

    // Initial fetch
    void this.poll();

    // Set up interval
    this.state.pollTimer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.state.pollTimer) {
      clearInterval(this.state.pollTimer);
      this.state.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    const store = useCarPlayStore.getState();

    try {
      // Fetch all data in parallel
      const [workflows, plans, prs, reviewCount] = await Promise.all([
        carPlayApi.listWorkflows({ limit: 20 }),
        carPlayApi.listPendingPlans(),
        carPlayApi.listPullRequests({ state: "open", limit: 20 }),
        carPlayApi.getPendingReviewCount(),
      ]);

      // Update store
      store.setWorkflows(workflows);
      store.setPendingPlans(plans);
      store.setPullRequests(prs.filter((pr) => pr.isAgentCreated));

      // Fetch reviews if count > 0
      if (reviewCount > 0) {
        const reviews = await carPlayApi.listReviews({ limit: 20 });
        store.setReviews(reviews);
      } else {
        store.setReviews([]);
      }

      store.setLastSyncAt(Date.now());
      store.setConnectionStatus("connected");
    } catch (_error) {
      // Don't change connection status on poll failure - may be temporary
    }
  }

  private async fetchInitialData(): Promise<void> {
    await this.poll();
  }

  private scheduleReconnect(): void {
    if (this.state.reconnectTimer) {
      return;
    }

    const store = useCarPlayStore.getState();
    store.setConnectionStatus("reconnecting");

    // Exponential backoff
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.state.reconnectAttempts,
      RECONNECT_MAX_MS
    );

    this.state.reconnectTimer = setTimeout(() => {
      this.state.reconnectTimer = null;
      this.state.reconnectAttempts++;
      void this.connect();
    }, delay);
  }

  private handleNetworkChange(isConnected: boolean): void {
    const store = useCarPlayStore.getState();

    if (!isConnected) {
      store.setConnectionStatus("offline");
      this.cleanup();
    } else if (store.connectionStatus === "offline") {
      store.setConnectionStatus("reconnecting");
      this.state.reconnectAttempts = 0;
      void this.connect();
    }
  }

  private cleanup(): void {
    this.stopPolling();

    if (this.state.reconnectTimer) {
      clearTimeout(this.state.reconnectTimer);
      this.state.reconnectTimer = null;
    }

    if (this.subscriptionCleanup) {
      this.subscriptionCleanup();
      this.subscriptionCleanup = null;
    }

    this.state.isSubscribed = false;
  }

  // Process events from subscription stream
  handleStreamEvent(event: CarPlayEvent): void {
    const store = useCarPlayStore.getState();

    switch (event.type) {
      case "workflow:started":
      case "workflow:updated": {
        const data = event.data as {
          kind: "workflow";
          runId: string;
          status: string;
          progress?: number;
          currentTask?: string;
        };
        if (data.kind === "workflow") {
          store.updateWorkflow(data.runId, {
            status: data.status as WorkflowState["status"],
            progress: data.progress,
            currentTask: data.currentTask,
          });
        }
        break;
      }

      case "workflow:completed":
      case "workflow:failed": {
        const data = event.data as {
          kind: "workflow";
          runId: string;
          status: string;
          summary?: string;
        };
        if (data.kind === "workflow") {
          store.updateWorkflow(data.runId, {
            status: data.status as WorkflowState["status"],
            progress: event.type === "workflow:completed" ? 100 : 0,
          });
        }
        break;
      }

      case "escalation:created": {
        const data = event.data as {
          kind: "escalation";
          escalation: Escalation;
        };
        if (data.kind === "escalation") {
          store.addEscalation(data.escalation);
        }
        break;
      }

      case "escalation:resolved": {
        const data = event.data as {
          kind: "escalation";
          escalation: { id: string };
        };
        if (data.kind === "escalation") {
          store.removeEscalation(data.escalation.id);
        }
        break;
      }

      case "pr:ready": {
        const data = event.data as {
          kind: "pr";
          pullRequest: import("./types").PullRequest;
        };
        if (data.kind === "pr") {
          const { pullRequests } = store;
          const exists = pullRequests.some(
            (pr) => pr.id === data.pullRequest.id
          );
          if (!exists) {
            store.setPullRequests([...pullRequests, data.pullRequest]);
          }
        }
        break;
      }

      case "pr:merged": {
        const data = event.data as { kind: "pr"; pullRequest: { id: string } };
        if (data.kind === "pr") {
          store.removePullRequest(data.pullRequest.id);
        }
        break;
      }

      case "plan:ready": {
        const data = event.data as {
          kind: "plan";
          plan: import("./types").ExecPlan;
        };
        if (data.kind === "plan") {
          store.addPendingPlan(data.plan);
        }
        break;
      }

      case "plan:approved":
      case "plan:rejected": {
        const data = event.data as { kind: "plan"; plan: { id: string } };
        if (data.kind === "plan") {
          store.removePendingPlan(data.plan.id);
        }
        break;
      }

      case "agent:spawn":
      case "agent:complete":
      case "agent:progress": {
        const data = event.data as {
          kind: "agent";
          workflowId: string;
          progress?: number;
        };
        if (data.kind === "agent" && data.workflowId) {
          // Update workflow progress if agent provides it
          if (typeof data.progress === "number") {
            store.updateWorkflow(data.workflowId, { progress: data.progress });
          }
        }
        break;
      }
    }

    store.setLastSyncAt(Date.now());
  }

  // Force refresh all data
  async refresh(): Promise<void> {
    await this.poll();
  }

  // Check if connected
  isConnected(): boolean {
    const { connectionStatus } = useCarPlayStore.getState();
    return connectionStatus === "connected";
  }
}

// Export singleton
export const carPlaySync = new CarPlaySyncManager();

// Map pipeline events to CarPlay events
export function mapPipelineEventToCarPlayEvent(pipelineEvent: {
  type: string;
  timestamp: number;
  runId?: string;
  requirement?: string;
  stage?: string;
  agentId?: string;
  taskId?: string;
  outcome?: string;
  summary?: string;
  error?: string;
  reason?: string;
  details?: string;
  suggestions?: string[];
  severity?: string;
}): CarPlayEvent | null {
  const { type, timestamp } = pipelineEvent;

  switch (type) {
    case "pipeline:start":
      return {
        type: "workflow:started",
        timestamp,
        data: {
          kind: "workflow",
          runId: pipelineEvent.runId ?? "",
          status: "running",
        },
      };

    case "pipeline:complete":
      return {
        type: "workflow:completed",
        timestamp,
        data: {
          kind: "workflow",
          runId: pipelineEvent.runId ?? "",
          status: "completed",
          summary: pipelineEvent.summary,
        },
      };

    case "pipeline:failed":
      return {
        type: "workflow:failed",
        timestamp,
        data: {
          kind: "workflow",
          runId: pipelineEvent.runId ?? "",
          status: "failed",
          error: pipelineEvent.error,
        },
      };

    case "pipeline:suspend":
      return {
        type: "workflow:suspended",
        timestamp,
        data: {
          kind: "workflow",
          runId: pipelineEvent.runId ?? "",
          status: "suspended",
        },
      };

    case "agent:spawn":
      return {
        type: "agent:spawn",
        timestamp,
        data: {
          kind: "agent",
          agentId: pipelineEvent.agentId ?? "",
          workflowId: pipelineEvent.runId ?? "",
          taskId: pipelineEvent.taskId,
          status: "spawned",
        },
      };

    case "agent:complete":
      return {
        type: "agent:complete",
        timestamp,
        data: {
          kind: "agent",
          agentId: pipelineEvent.agentId ?? "",
          workflowId: pipelineEvent.runId ?? "",
          status: "complete",
          outcome: pipelineEvent.outcome,
        },
      };

    case "agent:escalate-request":
      return {
        type: "escalation:created",
        timestamp,
        data: {
          kind: "escalation",
          escalation: {
            id: `esc-${Date.now()}`,
            workflowId: pipelineEvent.runId ?? "",
            workflowName: pipelineEvent.requirement ?? "Unknown",
            agentId: pipelineEvent.agentId,
            reason: (pipelineEvent.reason ?? "other") as EscalationReason,
            question: pipelineEvent.details ?? "Agent needs assistance",
            details: pipelineEvent.details ?? "",
            options: [
              { id: "resolve", label: "Resolve", action: "approve" },
              { id: "defer", label: "Defer", action: "defer" },
            ],
            suggestions: pipelineEvent.suggestions,
            priority: mapSeverityToPriority(pipelineEvent.severity),
            severity: (pipelineEvent.severity ?? "blocking") as
              | "warning"
              | "blocking",
            createdAt: timestamp,
          },
        },
      };

    default:
      return null;
  }
}

function mapSeverityToPriority(severity?: string): EscalationPriority {
  if (severity === "blocking") {
    return "high";
  }
  if (severity === "warning") {
    return "normal";
  }
  return "normal";
}
