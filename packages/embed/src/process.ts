/**
 * Embedding Process Management
 * Manages individual Python embedding worker process with IPC
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { type Subprocess, spawn } from "bun";
import type {
  EmbedConfig,
  EmbedRequest,
  EmbedResponse,
  ProcessHealth,
} from "./types";

export class EmbedProcess {
  private process: Subprocess | null = null;
  private readonly config: EmbedConfig;
  private startTime = 0;
  private requestCount = 0;
  private errorCount = 0;
  private lastPing: number | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;
  private readonly pendingRequests = new Map<
    string,
    (response: EmbedResponse) => void
  >();
  private readonly requestTimeout: number;
  private readyPromise: Promise<void> | null = null;
  private readyResolver: (() => void) | null = null;

  constructor(config: EmbedConfig = {}) {
    this.config = config;
    this.requestTimeout = config.requestTimeout ?? 30_000; // 30s default (model loading is slow)
  }

  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    const pythonPath = this.resolvePythonExecutable();
    const embedDir = join(import.meta.dir, "..");
    const scriptPath = join(embedDir, "scripts/embed_server.py");

    const env: Record<string, string> = {
      ...process.env,
      EMBED_MODEL:
        this.config.modelName ?? "tencent/KaLM-Embedding-Gemma3-12B-2511",
      EMBED_DEVICE: this.config.device ?? "auto",
      EMBED_QUANTIZATION:
        process.env.EMBED_QUANTIZATION ??
        (process.env.NODE_ENV !== "production" ? "4bit" : "none"),
    };

    const cmd =
      pythonPath === "uv"
        ? ["uv", "run", "python", scriptPath]
        : [pythonPath, scriptPath];

    this.process = spawn(cmd, {
      cwd: embedDir, // Important: UV needs to be in package dir to find .venv
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
    if (process.env.EMBED_PYTHON_PATH) {
      return process.env.EMBED_PYTHON_PATH;
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
          // Consume stream but ignore content
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
          const response: EmbedResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (_error) {}
      }
    }
  }

  private handleResponse(response: EmbedResponse): void {
    // Handle ready signal
    if (response.type === "ready") {
      if (this.readyResolver) {
        this.readyResolver();
        this.readyResolver = null;
      }
      return;
    }

    // Log status messages
    if (response.type === "status") {
      return;
    }

    const resolver = this.pendingRequests.get(response.id);
    if (resolver) {
      resolver(response);
      this.pendingRequests.delete(response.id);
    }
  }

  sendRequest(texts: string[]): Promise<number[][]> {
    if (!this.process) {
      throw new Error("Process not started");
    }

    const reqId = randomUUID();
    const request: EmbedRequest = {
      id: reqId,
      type: "embed",
      payload: { texts },
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
          resolve(response.payload.embeddings ?? []);
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

  private async waitForReady(timeoutMs = 180_000): Promise<void> {
    // Create promise that resolves when "ready" message is received
    // Timeout is generous because first-time model loading includes:
    // 1. Downloading model files from HuggingFace cache
    // 2. Loading 7GB model into memory
    // 3. Initializing sentence-transformers
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolver = resolve;

      // Timeout if model doesn't load in time
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
      } catch (_error) {}
    }, 30_000); // Check every 30 seconds
  }

  private ping(): Promise<void> {
    const reqId = randomUUID();
    const request: EmbedRequest = {
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
        if (response.type === "pong") {
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
