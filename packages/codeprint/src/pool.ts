import { logger } from "@alfred/logger";

import type {
  EnrichedEntry,
  ParseTask,
  ParseResult,
  PoolOptions,
  PoolStats,
} from "./types.js";

// ─────────────────────────────────────────────────────────
// Parse Pool
// ─────────────────────────────────────────────────────────

export class ParsePool {
  private readonly workers: Worker[];
  private readonly pending = new Map<
    number,
    {
      path: string;
      resolve: (entry: EnrichedEntry) => void;
      reject: (error: string) => void;
    }
  >();
  private nextId = 0;
  private roundRobin = 0;
  private processedCount = 0;
  private errorCount = 0;

  constructor(options: PoolOptions = {}) {
    const count = options.workers ?? navigator.hardwareConcurrency ?? 4;

    this.workers = Array.from({ length: count }, () => {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = this.handleMessage.bind(this);
      worker.onerror = this.handleError.bind(this);
      return worker;
    });

    logger.debug("codeprint_pool_created", { workers: count });
  }

  async parseMany(
    workspace: string,
    files: readonly string[]
  ): Promise<{ entries: Map<string, EnrichedEntry>; errors: number }> {
    const entries = new Map<string, EnrichedEntry>();
    let errors = 0;

    const promises = files.map((path) => {
      return new Promise<void>((resolve) => {
        const id = this.nextId++;
        const worker = this.workers[this.roundRobin++ % this.workers.length]!;

        this.pending.set(id, {
          path,
          resolve: (entry: EnrichedEntry) => {
            entries.set(path, entry);
            this.processedCount++;
            resolve();
          },
          reject: (error: string) => {
            errors++;
            this.errorCount++;
            logger.debug("codeprint_parse_error", { file: path, error });
            resolve(); // Don't fail entire batch
          },
        });

        const task: ParseTask = { id, workspace, path };
        worker.postMessage(task);
      });
    });

    await Promise.all(promises);

    return { entries, errors };
  }

  async parseOne(
    workspace: string,
    path: string
  ): Promise<EnrichedEntry | null> {
    const { entries, errors } = await this.parseMany(workspace, [path]);
    if (errors > 0) {
      return null;
    }
    return entries.get(path) ?? null;
  }

  shutdown(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.length = 0;
    this.pending.clear();
    logger.debug("codeprint_pool_shutdown", {
      processed: this.processedCount,
      errors: this.errorCount,
    });
  }

  stats(): PoolStats {
    return {
      workers: this.workers.length,
      pending: this.pending.size,
      processed: this.processedCount,
      errors: this.errorCount,
    };
  }

  private handleMessage(event: MessageEvent<ParseResult>): void {
    const { id, entry, error } = event.data;
    const handler = this.pending.get(id);

    if (!handler) {
      logger.warn("codeprint_pool_orphan_result", { id });
      return;
    }

    this.pending.delete(id);

    if (error) {
      handler.reject(error);
    } else if (entry) {
      handler.resolve(entry);
    } else {
      handler.reject("No entry returned");
    }
  }

  private handleError(event: ErrorEvent): void {
    logger.error("codeprint_pool_worker_error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    });
  }
}

// ─────────────────────────────────────────────────────────
// Singleton Pool Management
// ─────────────────────────────────────────────────────────

let globalPool: ParsePool | null = null;

export function getPool(options?: PoolOptions): ParsePool {
  if (!globalPool) {
    globalPool = new ParsePool(options);
  }
  return globalPool;
}

export function shutdownPool(): void {
  if (globalPool) {
    globalPool.shutdown();
    globalPool = null;
  }
}

export function isPoolAvailable(): boolean {
  return process.env.CODEPRINT_PARALLEL !== "0";
}
