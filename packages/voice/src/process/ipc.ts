import type { Subprocess } from "bun";

export type IPCRequest = {
  id: string;
  type: string;
  payload?: unknown;
};

export type IPCResponse = {
  id: string;
  type: "status" | "transcript" | "audio" | "error" | "ping" | "shutdown";
  payload?: unknown;
};

export type IPCBridgeOptions = {
  requestTimeout?: number;
};

export class Bridge {
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (response: IPCResponse) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
      onPartial?: (response: IPCResponse) => void;
    }
  >();
  private readonly requestTimeout: number;

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
    timeoutMs?: number,
    onPartial?: (response: IPCResponse) => void
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
        onPartial,
      });

      // Send request to process
      // Bun's Subprocess.stdin is FileSink when stdin: "pipe"
      if (!process.stdin || typeof process.stdin === "number") {
        reject(new Error("Process stdin not available"));
        return;
      }

      const requestJson = `${JSON.stringify(request)}\n`;
      process.stdin.write(requestJson);
    });
  }

  handleResponse(response: IPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      if (response.type === "error") {
        this.pendingRequests.delete(response.id);
        const errorMessage =
          (response.payload as { message?: string })?.message ??
          "Unknown error";
        pending.reject(new Error(errorMessage));
        return;
      }

      // Check for partial response (streaming)
      const isFinal = (response.payload as { isFinal?: boolean })?.isFinal;

      if (isFinal === false && pending.onPartial) {
        // Reset timeout on activity
        pending.timeout.refresh();
        pending.onPartial(response);
      } else {
        // Final response or no streaming handler
        this.pendingRequests.delete(response.id);
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
