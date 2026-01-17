/**
 * Embedding Pool Management
 * Manages pool of embedding worker processes with load balancing and queuing
 */

import { join } from "node:path";
import { getEmbedConfig } from "./config";
import {
  embedRequestsDropped,
  embedRequestsProcessed,
  embedRequestsQueued,
  recordBatch,
  updateQueueMetrics,
  updateWorkerMetrics,
} from "./metrics";
import { EmbedProcess } from "./process";
import { EmbedQueue, type QueueConfig, type QueueStats } from "./queue";
import type { EmbedConfig } from "./types";

export type PoolConfig = EmbedConfig & {
  /** Enable request queuing and batching (default: true) */
  enableQueue?: boolean;
  /** Queue configuration options */
  queueConfig?: QueueConfig;
  /** Number of retry attempts (default: 3) */
  retryCount?: number;
  /** Initial retry delay in ms (default: 100) */
  retryDelayMs?: number;
};

export class EmbedPool {
  private processes: EmbedProcess[] = [];
  private readonly poolSize: number;
  private currentIndex = 0;
  private readonly config: PoolConfig;
  private isInitialized = false;
  private isShuttingDown = false;
  private queue: EmbedQueue | null = null;
  private readonly enableQueue: boolean;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: PoolConfig = {}) {
    this.config = config;
    const isDev = process.env.NODE_ENV !== "production";
    this.poolSize = config.poolSize ?? (isDev ? 1 : 2);
    this.enableQueue = config.enableQueue ?? true;
  }

  /**
   * Create pool from environment variables
   */
  static fromEnv(): EmbedPool {
    const envConfig = getEmbedConfig();
    return new EmbedPool({
      modelName: envConfig.modelName,
      device: envConfig.device,
      poolSize: envConfig.poolSize,
      requestTimeout: envConfig.requestTimeout,
      enableQueue: envConfig.enableQueue,
      queueConfig: envConfig.queueConfig,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    await this.ensureDependencies();
    await this.ensureModelDownloaded();

    for (let i = 0; i < this.poolSize; i++) {
      const proc = new EmbedProcess(this.config);
      await proc.start();
      this.processes.push(proc);
    }

    // Initialize queue with load-balanced processing and metrics
    if (this.enableQueue) {
      this.queue = new EmbedQueue(
        (texts) => this.embedDirectWithMetrics(texts),
        this.config.queueConfig
      );
    }

    // Start metrics collection interval
    this.startMetricsCollection();

    this.isInitialized = true;
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    // Update metrics every 5 seconds
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000);
    this.metricsInterval.unref(); // Don't prevent process exit
  }

  /**
   * Update all metrics
   */
  private updateMetrics(): void {
    // Update queue metrics
    if (this.queue) {
      const stats = this.queue.getStats();
      updateQueueMetrics(stats, this.config.queueConfig?.maxQueueSize ?? 1000);
    }

    // Update worker metrics
    const workerHealth = this.processes.map((p) => p.getHealth());
    updateWorkerMetrics(workerHealth);
  }

  private async ensureDependencies(): Promise<void> {
    const embedDir = join(import.meta.dir, "..");
    const venvPath = join(embedDir, ".venv");
    const uvLockPath = join(embedDir, "uv.lock");

    // Check if UV is available
    let hasUV = false;
    try {
      const uvCheck = Bun.spawnSync(["which", "uv"]);
      hasUV = uvCheck.exitCode === 0;
    } catch {
      hasUV = false;
    }

    if (!hasUV) {
      return;
    }

    // Check if venv exists and has required packages
    const venvExists = await Bun.file(join(venvPath, "pyvenv.cfg")).exists();
    const lockExists = await Bun.file(uvLockPath).exists();

    if (venvExists && lockExists) {
      return;
    }

    const syncProc = Bun.spawn(["uv", "sync"], {
      cwd: embedDir,
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await syncProc.exited;
    if (exitCode !== 0) {
      throw new Error(`uv sync failed with exit code ${exitCode}`);
    }
  }

  private async ensureModelDownloaded(): Promise<void> {
    const modelName =
      this.config.modelName ?? "tencent/KaLM-Embedding-Gemma3-12B-2511";
    const modelsDir = join(import.meta.dir, "../models");
    const modelPath = join(modelsDir, modelName);

    // Check if model exists
    const configFile = Bun.file(join(modelPath, "config.json"));
    if (await configFile.exists()) {
      return;
    }

    const downloadScript = join(
      import.meta.dir,
      "../scripts/download_model.py"
    );

    // Use UV if available, otherwise system Python
    let pythonCmd = "python3";
    try {
      const uvCheck = Bun.spawnSync(["which", "uv"]);
      if (uvCheck.exitCode === 0) {
        pythonCmd = "uv";
      }
    } catch {
      // UV not available
    }

    const cmd =
      pythonCmd === "uv"
        ? ["uv", "run", "python", downloadScript]
        : [pythonCmd, downloadScript];

    const proc = Bun.spawn(cmd, {
      cwd: join(import.meta.dir, ".."),
      stdout: "inherit",
      stderr: "inherit",
      stdin: "pipe",
    });

    // Auto-answer "y" if prompted
    if (proc.stdin && typeof proc.stdin !== "number") {
      proc.stdin.write("y\n");
      proc.stdin.end();
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Model download failed with exit code ${exitCode}`);
    }
  }

  /**
   * Embed texts using queue (with batching) or direct
   */
  async embed(texts: string[], priority = 0): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new Error("Pool not initialized - call initialize() first");
    }

    if (this.isShuttingDown) {
      throw new Error("Pool is shutting down");
    }

    if (texts.length === 0) {
      return [];
    }

    // Track queued request
    embedRequestsQueued.inc();

    // Use queue if enabled for batching benefits
    if (this.queue) {
      try {
        return await this.queue.enqueue(texts, priority);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Queue full")) {
          embedRequestsDropped.inc({ reason: "queue_full" });
        }
        throw error;
      }
    }

    // Direct embedding without queue
    return this.embedDirectWithMetrics(texts);
  }

  /**
   * Direct embedding to workers (bypasses queue)
   * Uses load-aware worker selection
   */
  private async embedDirect(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Select least busy worker
    const proc = this.selectWorker();
    if (!proc) {
      throw new Error("No workers available");
    }

    return proc.sendRequest(texts);
  }

  /**
   * Direct embedding with metrics tracking
   */
  private async embedDirectWithMetrics(texts: string[]): Promise<number[][]> {
    const startTime = performance.now();

    try {
      const result = await this.embedDirect(texts);
      const processingMs = performance.now() - startTime;

      // Record batch metrics
      recordBatch(1, texts.length, processingMs, 0);
      embedRequestsProcessed.inc();

      return result;
    } catch (error) {
      embedRequestsDropped.inc({ reason: "error" });
      throw error;
    }
  }

  /**
   * Select best worker using load-aware strategy
   */
  private selectWorker(): EmbedProcess | null {
    if (this.processes.length === 0) {
      return null;
    }

    // Find worker with lowest pending requests
    let bestWorker = this.processes[0];
    let bestHealth = bestWorker?.getHealth();

    for (let i = 1; i < this.processes.length; i++) {
      const worker = this.processes[i];
      if (!worker) continue;

      const health = worker.getHealth();

      // Prefer idle workers
      if (health.status === "idle" && bestHealth?.status !== "idle") {
        bestWorker = worker;
        bestHealth = health;
        continue;
      }

      // Skip workers in error state
      if (health.status === "error") {
        continue;
      }

      // Among non-idle workers, prefer lower error count
      if (
        bestHealth?.status !== "idle" &&
        health.errorCount < (bestHealth?.errorCount ?? 0)
      ) {
        bestWorker = worker;
        bestHealth = health;
      }
    }

    // Fallback to round-robin if all workers seem equivalent
    if (!bestWorker || bestHealth?.status === "error") {
      this.currentIndex = (this.currentIndex + 1) % this.poolSize;
      return this.processes[this.currentIndex] ?? null;
    }

    return bestWorker;
  }

  /**
   * Get pool and queue health information
   */
  getHealth(): {
    index: number;
    pid?: number;
    status: "idle" | "busy" | "error" | "terminated";
    lastActive: number;
    uptime: number;
  }[] {
    return this.processes.map((proc, index) => ({
      index,
      ...proc.getHealth(),
    }));
  }

  /**
   * Get queue statistics (if queue is enabled)
   */
  getQueueStats(): QueueStats | null {
    return this.queue?.getStats() ?? null;
  }

  /**
   * Check if queue has capacity for more requests
   */
  hasCapacity(): boolean {
    if (!this.queue) {
      return true; // No queue means always accept
    }
    return this.queue.hasCapacity();
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue?.length ?? 0;
  }

  /**
   * Shutdown the pool
   * @param graceful If true, waits for in-flight requests to complete
   * @param timeoutMs Maximum time to wait for graceful shutdown (default: 30000)
   */
  async shutdown(graceful = true, timeoutMs = 30_000): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Graceful queue shutdown - wait for in-flight, reject pending
    if (this.queue) {
      if (graceful) {
        await this.queue.shutdown(timeoutMs);
      } else {
        this.queue.clear();
      }
      this.queue = null;
    }

    // Shutdown all workers
    await Promise.all(this.processes.map((proc) => proc.shutdown()));

    this.processes = [];
    this.isInitialized = false;
    this.isShuttingDown = false;
  }

  /**
   * Check if pool is shutting down
   */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}
