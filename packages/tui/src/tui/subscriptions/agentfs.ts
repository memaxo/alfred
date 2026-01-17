/**
 * ALFRED TUI AgentFS Subscription
 *
 * The AgentFS panels are UI-only and must remain usable even when:
 * - the API server is offline
 * - the AgentFS SDK is unavailable
 *
 * This subscription is intentionally lightweight and supports:
 * - snapshot (initial state)
 * - stream (live updates via tRPC subscription)
 * - mock fallback when auth / SDK / runtime wiring is unavailable
 */

import type { AgentFSStreamCursor, AgentFSStreamEvent } from "@alfred/type";

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
  started_at: number; // Unix timestamp (seconds)
  completed_at: number; // Unix timestamp (seconds)
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
  private unsubscribeStream: (() => void) | null = null;
  private cursor: AgentFSStreamCursor | null = null;
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

    this.disconnectStreamOnly();
    void this.connectAsync({ runId, dbPath, seq });

    return () => this.disconnect();
  }

  disconnect(): void {
    this.seq++;
    this.disconnectStreamOnly();
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

  private disconnectStreamOnly(): void {
    if (this.unsubscribeStream) {
      try {
        this.unsubscribeStream();
      } catch {
        // ignore
      } finally {
        this.unsubscribeStream = null;
      }
    }
    this.cursor = null;
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
      const { appRouter } = await import("@alfred/api/router");
      const { createCliContext } = await import("../../cli/context");
      const ctx = await createCliContext();
      if (seq !== this.seq) {
        return;
      }
      const caller = appRouter.createCaller({
        ...ctx,
        policy: { obligations: [] },
      });

      const snapshot = await caller.agentfs.snapshot({
        runId,
        dbPath,
        dir: "/workspace",
      });
      if (seq !== this.seq) {
        return;
      }

      this.cursor = snapshot.cursor;
      this.setState((prev) => ({
        ...prev,
        isConnected: true,
        isLoading: false,
        error: null,
        entries: snapshot.entries as DirEntry[],
        toolCalls: (snapshot.toolCalls as any[]).map((c) => ({
          id: c.id,
          name: c.name,
          started_at: c.startedAt,
          completed_at: c.completedAt,
          duration_ms: c.durationMs,
          error: c.error ?? undefined,
          parameters: c.parameters,
          result: c.result,
        })),
        kvStore: (snapshot.kvStore as any[]).map((e) => ({
          key: e.key,
          value: e.value,
          created_at: e.createdAt,
          updated_at: e.updatedAt,
        })),
      }));

      const subscription = await caller.agentfs.stream({
        runId,
        dbPath,
        dir: "/workspace",
        cursor: this.cursor ?? undefined,
        pollMs: 500,
      });
      if (seq !== this.seq) {
        return;
      }

      const inner = subscription.subscribe({
        next: (event: AgentFSStreamEvent) => {
          if (seq !== this.seq) {
            return;
          }
          if (event.type === "data") {
            this.cursor = event.cursor;
            this.setState((prev) => ({
              ...prev,
              isConnected: true,
              isLoading: false,
              error: null,
              entries: event.entries ?? prev.entries,
              toolCalls: event.toolCalls
                ? mergeToolCalls(prev.toolCalls, event.toolCalls)
                : prev.toolCalls,
              kvStore: event.kvStore
                ? event.kvStore.map((e) => ({
                    key: e.key,
                    value: e.value,
                    created_at: e.createdAt,
                    updated_at: e.updatedAt,
                  }))
                : prev.kvStore,
            }));
            return;
          }

          if (event.type === "error") {
            this.setState((prev) => ({
              ...prev,
              isLoading: false,
              error: event.message,
            }));
          }
        },
        error: (err) => {
          if (seq !== this.seq) {
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          this.setState((prev) => ({
            ...prev,
            isLoading: false,
            error: msg,
          }));
        },
      });

      if (seq === this.seq) {
        this.unsubscribeStream = () => inner.unsubscribe();
      } else {
        inner.unsubscribe();
      }
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

function mergeToolCalls(
  prev: ToolCallInfo[],
  incoming: Array<{
    id: number;
    name: string;
    startedAt: number;
    completedAt: number;
    durationMs: number;
    error?: string | null;
    parameters?: unknown;
    result?: unknown;
  }>
): ToolCallInfo[] {
  const seen = new Set(prev.map((c) => c.id));
  const next = [...prev];
  for (const c of incoming) {
    if (seen.has(c.id)) {
      continue;
    }
    seen.add(c.id);
    next.push({
      id: c.id,
      name: c.name,
      started_at: c.startedAt,
      completed_at: c.completedAt,
      duration_ms: c.durationMs,
      error: c.error ?? undefined,
      parameters: c.parameters,
      result: c.result,
    });
  }
  next.sort((a, b) => a.id - b.id);
  return next;
}
