import type { Subprocess } from "bun";

export interface IPCRequest {
  id: string;
  type: string;
  payload?: unknown;
}

export interface IPCResponse {
  id: string;
  type: "status" | "transcript" | "audio" | "error" | "ping" | "shutdown";
  payload?: unknown;
}

export interface IPCBridgeOptions {
  requestTimeout?: number;
}

export class IPCBridge {
  private pendingRequests = new Map<
    string,
    {
      resolve: (response: IPCResponse) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private requestTimeout: number;

  constructor(options: IPCBridgeOptions = {}) {
    this.requestTimeout = options.requestTimeout ?? 10_000;
  }

  createRequest(type: string, payload?: unknown): IPCRequest {
    return {
      id: crypto.randomUUID(),
      type,
      payload,
    };
  }

  async sendRequest(
    process: Subprocess,
    request: IPCRequest,
    timeoutMs?: number
  ): Promise<IPCResponse> {
    return new Promise((resolve, reject) => {
      const timeout = timeoutMs ?? this.requestTimeout;
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout: ${request.type}`));
      }, timeout);

      this.pendingRequests.set(request.id, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timeout: timeoutId,
      });

      // Send request to process
      // Bun's Subprocess.stdin is FileSink when stdin: "pipe"
      if (!process.stdin || typeof process.stdin === "number") {
        reject(new Error("Process stdin not available"));
        return;
      }

      const requestJson = JSON.stringify(request) + "\n";
      process.stdin.write(requestJson);
    });
  }

  handleResponse(response: IPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.type === "error") {
        const errorMessage =
          (response.payload as { message?: string })?.message ??
          "Unknown error";
        pending.reject(new Error(errorMessage));
      } else {
        pending.resolve(response);
      }
    }
  }

  cancelAll(): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Request cancelled: ${id}`));
    }
    this.pendingRequests.clear();
  }
}
