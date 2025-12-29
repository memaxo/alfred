/**
 * ALFRED TUI AgentFS Subscription
 *
 * The AgentFS panels are UI-only and must remain usable even when:
 * - the API server is offline
 * - the AgentFS SDK is unavailable
 *
 * This subscription is intentionally lightweight and currently uses
 * mock/polled data shape. It can be upgraded to use real endpoints later.
 */

export type DirEntry = {
  name: string;
  ino: number;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
};

export type ToolCallInfo = {
  id: number;
  name: string;
  started_at: number;
  completed_at: number;
  duration_ms: number;
  error?: string;
  parameters?: unknown;
  result?: unknown;
};

export type KVEntry = {
  key: string;
  value: unknown;
  created_at?: number;
  updated_at?: number;
};

export type AgentFSSubscriptionState = {
  runId: string | null;
  dbPath: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  entries: DirEntry[];
  toolCalls: ToolCallInfo[];
  kvStore: KVEntry[];
};

export type AgentFSSubscriptionCallback = (
  state: AgentFSSubscriptionState
) => void;
export type AgentFSUnsubscribe = () => void;

class AgentFSSubscription {
  private state: AgentFSSubscriptionState = {
    runId: null,
    dbPath: null,
    isConnected: false,
    isLoading: false,
    error: null,
    entries: [],
    toolCalls: [],
    kvStore: [],
  };

  private readonly subs = new Set<AgentFSSubscriptionCallback>();
  private poll: ReturnType<typeof setInterval> | null = null;

  subscribe(cb: AgentFSSubscriptionCallback): AgentFSUnsubscribe {
    this.subs.add(cb);
    cb({ ...this.state });
    return () => {
      this.subs.delete(cb);
    };
  }

  connect(runId: string, dbPath: string): AgentFSUnsubscribe {
    this.setState((prev) => ({
      ...prev,
      runId,
      dbPath,
      isConnected: true,
      isLoading: true,
      error: null,
    }));

    this.stopPolling();
    this.poll = setInterval(() => {
      this.refresh();
    }, 3000);
    this.poll.unref?.();
    this.refresh();

    return () => this.disconnect();
  }

  disconnect(): void {
    this.stopPolling();
    this.setState((prev) => ({
      ...prev,
      runId: null,
      dbPath: null,
      isConnected: false,
      isLoading: false,
      error: null,
      entries: [],
      toolCalls: [],
      kvStore: [],
    }));
  }

  private stopPolling(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  private setState(
    update: (prev: AgentFSSubscriptionState) => AgentFSSubscriptionState
  ): void {
    this.state = update(this.state);
    for (const cb of this.subs) {
      try {
        cb({ ...this.state });
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  private refresh(): void {
    const runId = this.state.runId;
    const dbPath = this.state.dbPath;
    if (!(runId && dbPath)) {
      return;
    }

    // Mock data for now. This can be replaced with API calls later.
    const now = Math.floor(Date.now() / 1000);
    this.setState((prev) => ({
      ...prev,
      isLoading: false,
      error: null,
      entries: [
        { name: ".agent", ino: 1, isDirectory: true, mtime: now - 3600 },
        {
          name: "README.md",
          ino: 2,
          isDirectory: false,
          size: 2048,
          mtime: now - 120,
        },
      ],
      toolCalls: [
        {
          id: 1,
          name: "read_file",
          started_at: now - 10,
          completed_at: now - 9,
          duration_ms: 120,
        },
      ],
      kvStore: [{ key: "runId", value: runId, updated_at: now }],
    }));
  }
}

export function createAgentFSSubscription(): AgentFSSubscription {
  return new AgentFSSubscription();
}
