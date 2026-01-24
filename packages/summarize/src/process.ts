/**
 * Summarize Process Management
 * Manages individual Python compression worker process with IPC
 */

import { type Subprocess, spawn } from "bun";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type {
  CompressRequest,
  CompressResponse,
  ProcessHealth,
  SummarizeConfig,
} from "./types.js";

export class SummarizeProcess {
  private process: Subprocess | null = null;
  private readonly config: SummarizeConfig;
  private startTime = 0;
  private requestCount = 0;
  private errorCount = 0;
  private lastPing: number | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;
  private readonly pendingRequests = new Map<
    string,
    (response: CompressResponse) => void
  >();
  private readonly requestTimeout: number;
  private readyPromise: Promise<void> | null = null;
  private readyResolver: (() => void) | null = null;

  constructor(config: SummarizeConfig = {}) {
    this.config = config;
    this.requestTimeout = config.requestTimeout ?? 120_000; // 2 min default (model loading is slow)
  }

  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    const pythonPath = this.resolvePythonExecutable();
    const summarizeDir = join(import.meta.dir, "..");
    const scriptPath = join(summarizeDir, "python/server.py");

    const env: Record<string, string> = {
      ...process.env,
      SUMMARIZE_MODEL:
        this.config.modelName ?? "Qwen/Qwen2.5-Coder-0.5B-Instruct",
      SUMMARIZE_DEVICE: this.config.device ?? "auto",
      SUMMARIZE_LOG_LEVEL: this.config.logLevel ?? "INFO",
    };

    const cmd =
      pythonPath === "uv"
        ? ["uv", "run", "python", scriptPath]
        : [pythonPath, scriptPath];

    this.process = spawn(cmd, {
      cwd: summarizeDir, // UV needs to be in package dir to find .venv
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env,
    });

    this.startTime = Date.now();
    this.setupEventHandlers();

    // Wait for ready signal (model loading can take time)
    await this.waitForReady();

    // Start health checks after worker is ready
    this.startHealthCheck();
  }

  private resolvePythonExecutable(): string {
    // Priority: UV run > venv Python > system Python
    if (process.env.SUMMARIZE_PYTHON_PATH) {
      return process.env.SUMMARIZE_PYTHON_PATH;
    }

    // Check for UV
    try {
      const uvCheck = Bun.spawnSync(["which", "uv"]);
      if (uvCheck.exitCode === 0) {
        return "uv";
      }
    } catch {
      // UV not available
    }

    // Check for venv
    const venvPath = join(import.meta.dir, "../.venv/bin/python");
    if (Bun.file(venvPath).size > 0) {
      return venvPath;
    }

    // Fall back to system Python
    return "python3";
  }

  private setupEventHandlers(): void {
    if (!this.process) {
      return;
    }

    // Handle stdout (IPC responses)
    if (this.process.stdout && typeof this.process.stdout !== "number") {
      this.startReading();
    }

    // Handle stderr (errors)
    if (this.process.stderr && typeof this.process.stderr !== "number") {
      const stderr = this.process.stderr;
      (async () => {
        const reader = stderr.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          // Consume stream but ignore content (goes to logs)
          decoder.decode(value);
        }
      })();
    }
  }

  private async startReading(): Promise<void> {
    if (!this.process?.stdout || typeof this.process.stdout === "number") {
      return;
    }

    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          const response: CompressResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (_error) {
          // Ignore invalid JSON (e.g., log lines)
        }
      }
    }
  }

  private handleResponse(response: CompressResponse): void {
    // Handle ready signal
    if (response.type === "ready") {
      if (this.readyResolver) {
        this.readyResolver();
        this.readyResolver = null;
      }
      return;
    }

    // Handle pong
    if (response.type === "pong") {
      const resolver = this.pendingRequests.get(response.id);
      if (resolver) {
        resolver(response);
        this.pendingRequests.delete(response.id);
      }
      return;
    }

    const resolver = this.pendingRequests.get(response.id);
    if (resolver) {
      resolver(response);
      this.pendingRequests.delete(response.id);
    }
  }

  compress(
    text: string,
    options: {
      instruction?: string;
      targetRatio?: number;
      targetTokens?: number;
      useFineGrained?: boolean;
    } = {}
  ): Promise<{
    compressedText: string;
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
  }> {
    if (!this.process) {
      throw new Error("Process not started");
    }

    const reqId = randomUUID();
    const request: CompressRequest = {
      id: reqId,
      type: "compress",
      payload: {
        text,
        instruction: options.instruction ?? "Summarize the following text.",
        target_ratio: options.targetRatio ?? 0.5,
        target_tokens: options.targetTokens ?? -1,
        use_fine_grained: options.useFineGrained ?? false,
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        this.errorCount++;
        reject(new Error("Request timeout"));
      }, this.requestTimeout);

      this.pendingRequests.set(reqId, (response) => {
        clearTimeout(timeout);
        this.requestCount++;

        if (response.type === "error") {
          this.errorCount++;
          reject(new Error(response.payload.error ?? "Unknown error"));
        } else {
          resolve({
            compressedText: response.payload.compressed_text ?? "",
            originalTokens: response.payload.original_tokens ?? 0,
            compressedTokens: response.payload.compressed_tokens ?? 0,
            compressionRatio: response.payload.compression_ratio ?? 1.0,
          });
        }
      });

      // Send request
      if (!this.process?.stdin || typeof this.process.stdin === "number") {
        reject(new Error("Process stdin not available"));
        return;
      }

      const line = `${JSON.stringify(request)}\n`;
      this.process.stdin.write(line);
    });
  }

  chunk(
    text: string,
    options: { method?: string; k?: number } = {}
  ): Promise<{
    chunks: string[];
    spikeIndices: number[];
    perplexities: number[];
  }> {
    if (!this.process) {
      throw new Error("Process not started");
    }

    const reqId = randomUUID();
    const request: CompressRequest = {
      id: reqId,
      type: "chunk",
      payload: {
        text,
        method: options.method ?? "std",
        k: options.k ?? 0.2,
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        this.errorCount++;
        reject(new Error("Request timeout"));
      }, this.requestTimeout);

      this.pendingRequests.set(reqId, (response) => {
        clearTimeout(timeout);
        this.requestCount++;

        if (response.type === "error") {
          this.errorCount++;
          reject(new Error(response.payload.error ?? "Unknown error"));
        } else {
          resolve({
            chunks: response.payload.chunks ?? [],
            spikeIndices: response.payload.spike_indices ?? [],
            perplexities: response.payload.perplexities ?? [],
          });
        }
      });

      if (!this.process?.stdin || typeof this.process.stdin === "number") {
        reject(new Error("Process stdin not available"));
        return;
      }

      const line = `${JSON.stringify(request)}\n`;
      this.process.stdin.write(line);
    });
  }

  ami(context: string, instruction: string): Promise<number> {
    if (!this.process) {
      throw new Error("Process not started");
    }

    const reqId = randomUUID();
    const request: CompressRequest = {
      id: reqId,
      type: "ami",
      payload: {
        context,
        instruction,
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        this.errorCount++;
        reject(new Error("Request timeout"));
      }, this.requestTimeout);

      this.pendingRequests.set(reqId, (response) => {
        clearTimeout(timeout);
        this.requestCount++;

        if (response.type === "error") {
          this.errorCount++;
          reject(new Error(response.payload.error ?? "Unknown error"));
        } else {
          resolve(response.payload.ami_score ?? 0);
        }
      });

      if (!this.process?.stdin || typeof this.process.stdin === "number") {
        reject(new Error("Process stdin not available"));
        return;
      }

      const line = `${JSON.stringify(request)}\n`;
      this.process.stdin.write(line);
    });
  }

  private async waitForReady(timeoutMs = 300_000): Promise<void> {
    // 5 minute timeout for first-time model loading
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolver = resolve;

      setTimeout(() => {
        if (this.readyResolver) {
          this.readyResolver = null;
          reject(
            new Error(
              "Worker ready timeout - model failed to load (check logs)"
            )
          );
        }
      }, timeoutMs);
    });

    await this.readyPromise;
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.ping();
        this.lastPing = Date.now();
      } catch (_error) {
        // Ping failed
      }
    }, 30_000); // Check every 30 seconds
    this.healthCheckInterval.unref();
  }

  private ping(): Promise<void> {
    const reqId = randomUUID();
    const request: CompressRequest = {
      id: reqId,
      type: "ping",
      payload: {},
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error("Ping timeout"));
      }, 5000);

      this.pendingRequests.set(reqId, (response) => {
        clearTimeout(timeout);
        if (response.payload?.status === "pong") {
          resolve();
        } else {
          reject(new Error("Invalid ping response"));
        }
      });

      if (!this.process?.stdin || typeof this.process.stdin === "number") {
        reject(new Error("Process stdin not available"));
        return;
      }

      const line = `${JSON.stringify(request)}\n`;
      this.process.stdin.write(line);
    });
  }

  getHealth(): ProcessHealth {
    return {
      isHealthy: this.lastPing !== null && Date.now() - this.lastPing < 60_000,
      lastPing: this.lastPing,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      uptime: Date.now() - this.startTime,
      status:
        this.errorCount > 5
          ? "error"
          : this.pendingRequests.size > 0
            ? "busy"
            : "idle",
      lastActive: this.lastPing ?? 0,
    };
  }

  shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return Promise.resolve();
    }
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    return Promise.resolve();
  }
}
