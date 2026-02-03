/**
 * ALFRED TUI AgentFS Subscription
 *
 * The AgentFS panels are UI-only and must remain usable even when:
 * - the API server is offline
 * - the AgentFS SDK is unavailable
 *
 * This subscription is intentionally lightweight and supports:
 * - snapshot (initial state)
 * - polling (live-ish updates via repeated snapshot calls)
 * - mock fallback when auth / SDK / runtime wiring is unavailable
 */

import { getApiClient } from "../api/client";

export interface DirEntry {
  name: string;
  ino: number;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
}

export interface ToolCallInfo {
  id: number;
  name: string;
  started_at: number; // Unix timestamp (seconds)
  completed_at: number; // Unix timestamp (seconds)
  duration_ms: number;
  error?: string;
  parameters?: unknown;
  result?: unknown;
}

export interface KVEntry {
  key: string;
  value: unknown;
  created_at?: number;
  updated_at?: number;
}

export interface AgentFSSubscriptionState {
  runId: string | null;
  dbPath: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  entries: DirEntry[];
  toolCalls: ToolCallInfo[];
  kvStore: KVEntry[];
}

export type AgentFSSubscriptionCallback = (
  state: AgentFSSubscriptionState
) => void;
export type AgentFSUnsubscribe = () => void;

export class AgentFSSubscription {
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
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;

  subscribe(cb: AgentFSSubscriptionCallback): AgentFSUnsubscribe {
    this.subs.add(cb);
    cb({ ...this.state });
    return () => {
      this.subs.delete(cb);
    };
  }

  connect(runId: string, dbPath: string): AgentFSUnsubscribe {
    const seq = ++this.seq;
    this.setState((prev) => ({
      ...prev,
      runId,
      dbPath,
      isConnected: true,
      isLoading: true,
      error: null,
    }));

    this.stopPolling();
    void this.connectAsync({ runId, dbPath, seq });

    return () => this.disconnect();
  }

  disconnect(): void {
    this.seq++;
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
    if (!this.pollTimer) {
      return;
    }
    try {
      clearInterval(this.pollTimer);
    } finally {
      this.pollTimer = null;
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

  private async connectAsync(args: {
    runId: string;
    dbPath: string;
    seq: number;
  }): Promise<void> {
    const { runId, dbPath, seq } = args;

    // If user explicitly wants mock data, keep the panels usable.
    if (process.env.ALFRED_TUI_USE_AGENTFS_MOCK === "true") {
      if (seq === this.seq) {
        this.applyMock(runId, dbPath);
      }
      return;
    }

    try {
      const client = getApiClient();

      const fetchOnce = async () => {
        const { data, error } = await client.agentfsSnapshot({
          dbPath,
          dir: "/workspace",
          runId,
        });
        if (seq !== this.seq) {
          return;
        }
        if (error || !data) {
          throw new Error(error?.message ?? "agentfs_snapshot_failed");
        }

        const toolCalls = (data.toolCalls as any[])
          .map((c) => ({
            id: c.id,
            name: c.name,
            started_at: c.startedAt,
            completed_at: c.completedAt,
            duration_ms: c.durationMs,
            error: c.error ?? undefined,
            parameters: c.parameters,
            result: c.result,
          }))
          .sort((a, b) => a.id - b.id);

        this.setState((prev) => ({
          ...prev,
          isConnected: true,
          isLoading: false,
          error: null,
          entries: data.entries as DirEntry[],
          toolCalls,
          kvStore: (data.kvStore as any[]).map((e) => ({
            key: e.key,
            value: e.value,
            created_at: e.createdAt,
            updated_at: e.updatedAt,
          })),
        }));
      };

      await fetchOnce();
      if (seq !== this.seq) {
        return;
      }

      const t = setInterval(() => {
        void fetchOnce().catch((error) => {
          if (seq !== this.seq) {
            return;
          }
          const msg = error instanceof Error ? error.message : String(error);
          this.setState((prev) => ({
            ...prev,
            isConnected: false,
            isLoading: false,
            error: msg,
          }));
        });
      }, 1000);
      (t as unknown as { unref?: () => void }).unref?.();
      this.pollTimer = t;
    } catch (error) {
      // Fallback to mock when anything goes wrong (auth not set up, SDK missing, etc.)
      const msg = error instanceof Error ? error.message : String(error);
      if (seq === this.seq) {
        this.setState((prev) => ({
          ...prev,
          isConnected: false,
          isLoading: false,
          error: msg,
        }));
        this.applyMock(runId, dbPath);
      }
    }
  }

  private applyMock(runId: string, dbPath: string): void {
    const now = Math.floor(Date.now() / 1000);
    this.setState((prev) => ({
      ...prev,
      runId,
      dbPath,
      isConnected: false,
      isLoading: false,
      error: prev.error,
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
