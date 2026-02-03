/**
 * ALFRED TUI API Client
 *
 * tRPC client wrapper for TUI modes.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiClientOptions {
  baseUrl?: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResult<T> {
  data?: T;
  error?: ApiError;
}

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const { loadCredentials } = await import("../../cli/credentials");
    const creds = await loadCredentials();
    if (creds?.accessToken) {
      headers.Authorization = `Bearer ${creds.accessToken}`;
    }
  } catch {
    // No credentials
  }

  return headers;
}

async function fetchJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      let error: ApiError;
      try {
        error = JSON.parse(text);
      } catch {
        error = {
          code: "HTTP_ERROR",
          message: text || `HTTP ${response.status}`,
        };
      }
      return { error };
    }

    const data = await response.json();
    return { data: data as T };
  } catch (error) {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

// ─── API Client ──────────────────────────────────────────────────────────────

export class ApiClient {
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:3000";
  }

  // ─── Cognitive ─────────────────────────────────────────────────────────────

  async getCognitiveState(streamId = "default"): Promise<
    ApiResult<{
      state: { _: string };
      autonomy: { level: number };
      phase: string;
      ts?: number;
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/cognitive.state?input=${encodeURIComponent(
      JSON.stringify({ streamId })
    )}`;
    return await fetchJson(url);
  }

  // ─── Knowledge ─────────────────────────────────────────────────────────────

  async getKnowledgeStats(resource = "user"): Promise<
    ApiResult<{
      facts: number;
      relations: number;
      insights: number;
      patterns: number;
      totalNodes: number;
      resource: string;
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/knowledge.stats?input=${encodeURIComponent(
      JSON.stringify({ resource })
    )}`;
    return await fetchJson(url);
  }

  async listEntities(
    search?: string,
    kind?: string,
    resource = "user",
    limit = 50
  ): Promise<
    ApiResult<{
      entities: {
        id: string;
        name: string;
        type: string;
        description: string | null;
        confidence: number | null;
        createdAt: string | null;
      }[];
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/knowledge.entitiesList?input=${encodeURIComponent(
      JSON.stringify({ kind, limit, resource, search })
    )}`;
    return await fetchJson(url);
  }

  async getEntity(
    entityId: string,
    resource = "user"
  ): Promise<
    ApiResult<{
      id: string;
      name: string;
      type: string;
      description: string | null;
      facts: {
        id: string;
        predicate: string;
        object: string;
        confidence: number;
      }[];
      relations: {
        id: string;
        target: string;
        type: string;
      }[];
    } | null>
  > {
    const url = `${this.baseUrl}/api/trpc/knowledge.entityGet?input=${encodeURIComponent(
      JSON.stringify({ entityId, resource })
    )}`;
    return await fetchJson(url);
  }

  // ─── Workflow ──────────────────────────────────────────────────────────────

  async startWorkflow(
    requirement: string,
    _auto: "read" | "low" = "read"
  ): Promise<
    ApiResult<{
      runId: string;
      status: string;
      plan?: unknown;
    }>
  > {
    // Pipeline canonical: plan via phase API (init → context → plan → schedule).
    // Note: `_auto` is currently ignored by the phase.plan input schema.
    const url = `${this.baseUrl}/api/trpc/workflow.phase.plan`;
    return await fetchJson(url, {
      body: JSON.stringify({
        requirement,
      }),
      method: "POST",
    });
  }

  async getWorkflowRun(runId: string): Promise<
    ApiResult<{
      id: string;
      status: string;
      requirement: string;
      plan?: unknown;
      result?: unknown;
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/workflow.getRun?input=${encodeURIComponent(
      JSON.stringify({ runId })
    )}`;
    return await fetchJson(url);
  }

  async listWorkflows(limit = 10): Promise<
    ApiResult<{
      runs: {
        id: string;
        status: string;
        requirement: string;
        createdAt: string;
      }[];
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/workflow.list?input=${encodeURIComponent(
      JSON.stringify({ limit })
    )}`;
    return await fetchJson(url);
  }

  async cancelWorkflow(
    runId: string
  ): Promise<ApiResult<{ cancelled: boolean }>> {
    const url = `${this.baseUrl}/api/trpc/workflow.cancel`;
    return await fetchJson(url, {
      body: JSON.stringify({ runId }),
      method: "POST",
    });
  }

  async suspendWorkflow(runId: string): Promise<ApiResult<{ ok: boolean }>> {
    const url = `${this.baseUrl}/api/trpc/workflow.suspend`;
    return await fetchJson(url, {
      body: JSON.stringify({ runId }),
      method: "POST",
    });
  }

  async resumeWorkflow(runId: string): Promise<ApiResult<{ ok: boolean }>> {
    const url = `${this.baseUrl}/api/trpc/workflow.resumePipeline`;
    return await fetchJson(url, {
      body: JSON.stringify({ runId }),
      method: "POST",
    });
  }

  async executeWorkflow(
    runId: string
  ): Promise<ApiResult<{ runId: string; status: string }>> {
    const url = `${this.baseUrl}/api/trpc/workflow.phase.executeByRunId`;
    return await fetchJson(url, {
      body: JSON.stringify({ runId }),
      method: "POST",
    });
  }

  async getWorkflowEvents(
    runId: string,
    limit = 100
  ): Promise<
    ApiResult<{
      events: {
        id: string;
        eventType: string;
        eventData: unknown;
        timestamp: string;
      }[];
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/workflow.events?input=${encodeURIComponent(
      JSON.stringify({ limit, runId })
    )}`;
    return await fetchJson(url);
  }

  // ─── Focus (Concierge) ─────────────────────────────────────────────────────

  async getFocusActive(): Promise<
    ApiResult<{
      id: string;
      title: string | null;
      wipLimit: number;
      status: string;
    } | null>
  > {
    const url = `${this.baseUrl}/api/trpc/focus.active`;
    return await fetchJson(url);
  }

  async listFocusCommitments(
    focusSetId: string,
    limit = 10
  ): Promise<
    ApiResult<
      {
        id: string;
        title: string;
        lane: string;
        status: string;
        priority: number;
        workflowRunId: string | null;
      }[]
    >
  > {
    const url = `${this.baseUrl}/api/trpc/focus.commitmentList?input=${encodeURIComponent(
      JSON.stringify({ focusSetId, limit, offset: 0 })
    )}`;
    return await fetchJson(url);
  }

  async listAttentionOpen(limit = 10): Promise<
    ApiResult<
      {
        id: string;
        kind: string;
        title: string | null;
        urgency: string;
        workflowRunId: string | null;
      }[]
    >
  > {
    const url = `${this.baseUrl}/api/trpc/attention.list?input=${encodeURIComponent(
      JSON.stringify({ limit, offset: 0, status: "open" })
    )}`;
    return await fetchJson(url);
  }

  async listDelta(limit = 10): Promise<
    ApiResult<
      {
        id: string;
        scope: string;
        summaryText: string;
        createdAt: string;
      }[]
    >
  > {
    const url = `${this.baseUrl}/api/trpc/delta.list?input=${encodeURIComponent(
      JSON.stringify({ limit, offset: 0 })
    )}`;
    return await fetchJson(url);
  }

  // ─── Admin/Metrics ─────────────────────────────────────────────────────────

  async getAdminStats(): Promise<
    ApiResult<{
      workflows: { active: number; pending: number; completed: number };
      voice: { activeSessions: number };
      cognitive: { phase: string };
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/admin.getStats`;
    return await fetchJson(url);
  }

  // ─── Deploy/Docker ───────────────────────────────────────────────────────

  async listContainers(
    filter: "all" | "running" | "agent" = "running"
  ): Promise<
    ApiResult<{
      containers: {
        id: string;
        name: string;
        image: string;
        status: "running" | "paused" | "exited";
      }[];
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/deploy.containersList?input=${encodeURIComponent(
      JSON.stringify({ filter })
    )}`;
    return await fetchJson(url);
  }

  async getContainerLogs(
    containerId: string,
    tail = 200
  ): Promise<
    ApiResult<{
      logs: {
        timestamp: string;
        level: "debug" | "info" | "warn" | "error";
        message: string;
      }[];
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/deploy.containersLogs?input=${encodeURIComponent(
      JSON.stringify({ containerId, tail })
    )}`;
    return await fetchJson(url);
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

let globalClient: ApiClient | null = null;

export function getApiClient(options?: ApiClientOptions): ApiClient {
  if (!globalClient || options) {
    globalClient = new ApiClient(options);
  }
  return globalClient;
}
