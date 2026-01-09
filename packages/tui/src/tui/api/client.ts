/**
 * ALFRED TUI API Client
 *
 * tRPC client wrapper for TUI modes.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ApiClientOptions = {
  baseUrl?: string;
};

export type ApiError = {
  code: string;
  message: string;
};

export type ApiResult<T> = {
  data?: T;
  error?: ApiError;
};

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
  } catch (err) {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error",
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

  // ─── Workflow ──────────────────────────────────────────────────────────────

  async startWorkflow(
    requirement: string,
    auto: "read" | "low" = "read"
  ): Promise<
    ApiResult<{
      runId: string;
      status: string;
      plan?: unknown;
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/workflow.start`;
    return await fetchJson(url, {
      method: "POST",
      body: JSON.stringify({
        requirement,
        auto,
      }),
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
      runs: Array<{
        id: string;
        status: string;
        requirement: string;
        createdAt: string;
      }>;
    }>
  > {
    const url = `${this.baseUrl}/api/trpc/workflow.list?input=${encodeURIComponent(
      JSON.stringify({ limit })
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
      containers: Array<{
        id: string;
        name: string;
        image: string;
        status: "running" | "paused" | "exited";
      }>;
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
      logs: Array<{
        timestamp: string;
        level: "debug" | "info" | "warn" | "error";
        message: string;
      }>;
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
