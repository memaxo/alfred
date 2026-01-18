/**
 * Qwen3-VL-Embedding Provider
 * Multimodal embedding provider supporting text, images, and video
 */

import { join } from "node:path";
import { type Subprocess, spawn } from "bun";
import {
  type EmbeddingInput,
  type EmbeddingModelConfig,
  type EmbeddingProvider,
  MODEL_CONFIGS,
  MODEL_IDS,
} from "../registry.js";

type QwenRequest = {
  id: string;
  type: "embed" | "ping";
  payload: {
    inputs?: Array<{
      type: "text" | "image" | "mixed";
      text?: string;
      image_url?: string;
    }>;
  };
};

type QwenResponse = {
  id: string;
  type: "embed_response" | "pong" | "error" | "status" | "ready";
  payload: {
    embeddings?: number[][];
    error?: string;
    message?: string;
  };
};

/**
 * Qwen3-VL-Embedding provider implementation
 * Uses Python subprocess for model inference
 */
export class QwenProvider implements EmbeddingProvider {
  readonly config: EmbeddingModelConfig;

  private process: Subprocess | null = null;
  private initialized = false;
  private readonly requestTimeout: number;
  private readonly pendingRequests = new Map<
    string,
    { resolve: (v: number[][]) => void; reject: (e: Error) => void }
  >();
  private readyPromise: Promise<void> | null = null;
  private readyResolver: (() => void) | null = null;
  private lineBuffer = "";

  constructor(options: { requestTimeout?: number } = {}) {
    this.config = MODEL_CONFIGS[MODEL_IDS.QWEN3_VL_2B];
    this.requestTimeout = options.requestTimeout ?? 60_000; // 60s default (multimodal can be slower)
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const pythonPath = this.resolvePythonExecutable();
    const embedDir = join(import.meta.dir, "../..");
    const scriptPath = join(embedDir, "scripts/qwen_server.py");

    const env: Record<string, string> = {
      ...process.env,
      EMBED_MODEL: this.config.name,
      EMBED_DEVICE: process.env.EMBED_DEVICE ?? "auto",
      EMBED_DIMENSIONS: String(this.config.dimensions),
    };

    const cmd = [pythonPath, scriptPath];

    this.process = spawn(cmd, {
      cwd: embedDir,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
      env,
    });

    this.setupEventHandlers();
    await this.waitForReady();
    this.initialized = true;
  }

  private resolvePythonExecutable(): string {
    const embedDir = join(import.meta.dir, "../..");
    const venvPython = join(embedDir, ".venv/bin/python");

    // Check if UV venv exists
    const venvExists = Bun.file(venvPython).size > 0;
    if (venvExists) {
      return venvPython;
    }

    // Fallback to system python
    return process.env.PYTHON_PATH ?? "python3";
  }

  private setupEventHandlers(): void {
    const stdout = this.process?.stdout;
    if (!stdout || typeof stdout === "number") {
      return;
    }

    const decoder = new TextDecoder();
    const stream = stdout as ReadableStream<Uint8Array>;

    (async () => {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          this.lineBuffer += decoder.decode(value, { stream: true });
          const lines = this.lineBuffer.split("\n");
          this.lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.trim()) {
              this.handleMessage(line.trim());
            }
          }
        }
      } catch {
        // Process ended
      }
    })();
  }

  private handleMessage(line: string): void {
    let response: QwenResponse;
    try {
      response = JSON.parse(line);
    } catch {
      return;
    }

    if (response.type === "ready") {
      this.readyResolver?.();
      return;
    }

    if (response.type === "status") {
      return;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.type === "error") {
      pending.reject(new Error(response.payload.error ?? "Unknown error"));
    } else if (response.type === "embed_response") {
      pending.resolve(response.payload.embeddings ?? []);
    }
  }

  private async waitForReady(timeoutMs = 300_000): Promise<void> {
    // Longer timeout for multimodal model loading
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolver = resolve;

      setTimeout(() => {
        if (this.readyResolver) {
          this.readyResolver = null;
          reject(new Error("Worker ready timeout - Qwen model failed to load"));
        }
      }, timeoutMs);
    });

    return this.readyPromise;
  }

  async embed(input: EmbeddingInput): Promise<number[]> {
    const embeddings = await this.embedMany([input]);
    const embedding = embeddings[0];

    if (!embedding) {
      throw new Error("Failed to generate embedding");
    }

    return embedding;
  }

  async embedMany(inputs: EmbeddingInput[]): Promise<number[][]> {
    if (!(this.initialized && this.process?.stdin)) {
      throw new Error("Provider not initialized - call initialize() first");
    }

    const reqId = crypto.randomUUID();

    const payload = inputs.map((input) => {
      switch (input.type) {
        case "text":
          return { type: "text" as const, text: input.content };
        case "image":
          return { type: "image" as const, image_url: input.url };
        case "mixed":
          return {
            type: "mixed" as const,
            text: input.text,
            image_url: input.imageUrl,
          };
      }
    });

    const request: QwenRequest = {
      id: reqId,
      type: "embed",
      payload: { inputs: payload },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error("Embedding request timeout"));
      }, this.requestTimeout);

      this.pendingRequests.set(reqId, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      const stdin = this.process?.stdin;
      if (stdin && typeof stdin !== "number") {
        stdin.write(`${JSON.stringify(request)}\n`);
      }
    });
  }

  isHealthy(): boolean {
    return this.initialized && this.process !== null;
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.initialized = false;
    this.pendingRequests.clear();
  }
}

/**
 * Create a Qwen provider instance
 */
export function createQwenProvider(options?: {
  requestTimeout?: number;
}): QwenProvider {
  return new QwenProvider(options);
}
