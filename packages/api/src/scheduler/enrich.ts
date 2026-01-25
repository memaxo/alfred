import { logger as defaultLogger } from "@alfred/logger";

export interface EnrichCleanupSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  retentionDays?: number;
  maxDeletes?: number;
  logger?: Pick<typeof defaultLogger, "info" | "warn" | "error">;
  now?: () => Date;
}

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

function parseRetentionDays(): number {
  const raw = process.env.ALFRED_ENRICHMENT_DB_RETENTION_DAYS;
  if (!raw) {
    return 30;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return 30;
  }
  return n;
}

type TickOptions = Required<
  Omit<EnrichCleanupSchedulerOptions, "logger" | "now" | "retentionDays">
> & {
  logger: Pick<typeof defaultLogger, "info" | "warn" | "error">;
  now: () => Date;
  retentionDays: number;
};

export async function runEnrichCleanupTick(
  options: TickOptions
): Promise<void> {
  if (running) {
    options.logger.warn("enrich_cleanup_tick_skipped", {
      message: "Tick skipped because previous run is still in progress.",
    });
    return;
  }

  running = true;
  try {
    const now = options.now();
    const olderThan = new Date(
      now.getTime() - options.retentionDays * 24 * 60 * 60 * 1000
    );

    const { cleanupOldCodexExecutions } =
      await import("@alfred/db/repo/codex-learning");

    const deleted = await cleanupOldCodexExecutions({
      maxDeletes: options.maxDeletes,
      olderThan,
    });

    if (deleted > 0) {
      options.logger.info("enrich_cleanup_deleted", {
        deleted,
        retentionDays: options.retentionDays,
      });
    }
  } catch (error) {
    options.logger.error("enrich_cleanup_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
}

export function startEnrichCleanupScheduler({
  intervalMs = 6 * 60 * 60 * 1000,
  jitterMs = 60 * 1000,
  retentionDays = parseRetentionDays(),
  maxDeletes = 500,
  logger = defaultLogger,
  now = () => new Date(),
}: EnrichCleanupSchedulerOptions = {}): void {
  if (process.env.SCHED_ENRICH_CLEANUP !== "1") {
    logger.info("enrich_cleanup_disabled", {
      message: "Scheduler disabled (set SCHED_ENRICH_CLEANUP=1 to enable).",
    });
    return;
  }

  if (schedulerHandle) {
    logger.warn("enrich_cleanup_already_running", {
      message: "Scheduler already running.",
    });
    return;
  }

  const run = () =>
    runEnrichCleanupTick({
      intervalMs,
      jitterMs,
      maxDeletes,
      now,
      retentionDays,
      logger,
    });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
    schedulerHandle.unref();
  };

  void run().then(scheduleNext, () => scheduleNext());
}

export function stopEnrichCleanupScheduler(): void {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
