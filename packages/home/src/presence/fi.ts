export interface FiCfg {
  baseUrl: string;
  authToken: string;
  timeoutMs?: number;
}

export type FiError =
  | { kind: "auth"; status: 401 | 403; message: string; endpoint: string }
  | { kind: "notfound"; status: 404; message: string; endpoint: string }
  | { kind: "server"; status: number; message: string; endpoint: string }
  | { kind: "timeout"; message: string; endpoint: string }
  | { kind: "network"; message: string; endpoint: string; cause?: unknown };

export class Fi {
  private readonly cfg: Required<FiCfg>;

  constructor(cfg: FiCfg) {
    this.cfg = {
      baseUrl: cfg.baseUrl.replace(/\/$/, ""),
      authToken: cfg.authToken,
      timeoutMs: cfg.timeoutMs ?? 5000,
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.request<unknown>("GET", "/");
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const endpoint = path.startsWith("/") ? path : `/${path}`;
    const url = `${this.cfg.baseUrl}${endpoint}`;

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.cfg.authToken}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });

      if (!resp.ok) {
        throw this.makeError(
          resp.status === 401 || resp.status === 403
            ? "auth"
            : (resp.status === 404
              ? "notfound"
              : "server"),
          resp.status,
          resp.statusText || `HTTP ${resp.status}`,
          endpoint
        );
      }

      const text = await resp.text();
      return text && text.trim().length > 0
        ? (JSON.parse(text) as T)
        : (undefined as T);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" ||
          error.name === "AbortError" ||
          error.message.includes("Timeout"))
      ) {
        throw this.makeError("timeout", 0, "Request timeout", endpoint);
      }
      if (error instanceof Error && error.name === "TypeError") {
        throw this.makeError("network", 0, error.message, endpoint, error);
      }
      throw error;
    }
  }

  private makeError(
    kind: FiError["kind"],
    status: number,
    message: string,
    endpoint: string,
    cause?: unknown
  ): FiError {
    switch (kind) {
      case "auth": {
        return { kind: "auth", status: status as 401 | 403, message, endpoint };
      }
      case "notfound": {
        return { kind: "notfound", status: 404, message, endpoint };
      }
      case "timeout": {
        return { kind: "timeout", message, endpoint };
      }
      case "network": {
        return { kind: "network", message, endpoint, cause };
      }
      default: {
        return { kind: "server", status, message, endpoint };
      }
    }
  }
}
