/**
 * ALFRED Task Queue Processor
 * Processes background tasks during idle time
 */

import { logger } from "@alfred/logger";

// ============================================================================
// Types
// ============================================================================

export interface IdleLoopConfig {
  pollIntervalMs: number;
  maxTasksPerCycle: number;
  idleThresholdMs: number;
  budgetReservePercent: number;
}

export interface QueuedTask {
  id: string;
  userId: string;
  type: string;
  priority: number;
  payload: unknown;
  source?: string;
  sourceId?: string;
  estimatedTokens?: number;
}

export interface ProcessedTask {
  taskId: string;
  status: "completed" | "failed";
  result?: unknown;
  error?: string;
  tokensUsed?: number;
  costCents?: number;
  durationMs: number;
}

export interface TaskProcessor {
  canHandle(type: string): boolean;
  process(task: QueuedTask): Promise<ProcessedTask>;
}

// ============================================================================
// Task Processors Registry
// ============================================================================

const processors: TaskProcessor[] = [];

/**
 * Register a task processor
 */
export function registerProcessor(processor: TaskProcessor): void {
  processors.push(processor);
}

/**
 * Get processor for a task type
 */
function getProcessor(type: string): TaskProcessor | null {
  return processors.find((p) => p.canHandle(type)) ?? null;
}

// ============================================================================
// Default Task Processors
// ============================================================================

/**
 * Reminder task processor - triggers workflows from reminders
 */
const reminderProcessor: TaskProcessor = {
  canHandle(type: string) {
    return type === "reminder";
  },

  async process(task: QueuedTask): Promise<ProcessedTask> {
    const startTime = Date.now();

    try {
      const payload = task.payload as {
        reminderId?: string;
        intentType?: string;
        intentData?: unknown;
      };

      // If it's a workflow intent, we need to trigger the workflow system
      if (payload.intentType === "workflow" && payload.intentData) {
        // Import workflow trigger dynamically to avoid circular deps
        logger.info("reminder_workflow_trigger", {
          taskId: task.id,
          reminderId: payload.reminderId,
        });

        // The actual workflow creation will be handled by the cognitive bridge
        return {
          taskId: task.id,
          status: "completed",
          result: { triggered: true, intentType: payload.intentType },
          durationMs: Date.now() - startTime,
        };
      }

      // Simple notification-only reminder
      return {
        taskId: task.id,
        status: "completed",
        result: { notified: true },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Improvement task processor - self-improvement during idle time
 */
const improvementProcessor: TaskProcessor = {
  canHandle(type: string) {
    return type === "improvement";
  },

  async process(task: QueuedTask): Promise<ProcessedTask> {
    const startTime = Date.now();

    try {
      const payload = task.payload as {
        improvementType?: string;
        targetDomain?: string;
      };

      logger.info("improvement_task_process", {
        taskId: task.id,
        type: payload.improvementType,
        domain: payload.targetDomain,
      });

      // Placeholder - actual improvement logic will be implemented
      // This could involve:
      // - Reviewing recent mistakes
      // - Consolidating knowledge
      // - Updating calibration metrics
      // - etc.

      return {
        taskId: task.id,
        status: "completed",
        result: { improved: true },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Consolidation task processor - consolidate knowledge/memory
 */
const consolidationProcessor: TaskProcessor = {
  canHandle(type: string) {
    return type === "consolidation";
  },

  async process(task: QueuedTask): Promise<ProcessedTask> {
    const startTime = Date.now();

    try {
      logger.info("consolidation_task_process", { taskId: task.id });

      // Placeholder - actual consolidation logic
      // This could involve:
      // - Merging similar memory nodes
      // - Updating knowledge graph relations
      // - Pruning low-confidence facts
      // - etc.

      return {
        taskId: task.id,
        status: "completed",
        result: { consolidated: true },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Dreaming task processor - background learning from past experiences
 */
const dreamingProcessor: TaskProcessor = {
  canHandle(type: string) {
    return type === "dreaming";
  },

  async process(task: QueuedTask): Promise<ProcessedTask> {
    const startTime = Date.now();

    try {
      logger.info("dreaming_task_process", { taskId: task.id });

      // Placeholder - actual dreaming logic
      // This could involve:
      // - Replaying successful workflows
      // - Extracting patterns from failures
      // - Generating heuristics
      // - etc.

      return {
        taskId: task.id,
        status: "completed",
        result: { dreamed: true },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Webhook task processor - process delayed webhook events
 */
const webhookProcessor: TaskProcessor = {
  canHandle(type: string) {
    return type === "webhook";
  },

  async process(task: QueuedTask): Promise<ProcessedTask> {
    const startTime = Date.now();

    try {
      const payload = task.payload as {
        source?: string;
        eventType?: string;
        data?: unknown;
      };

      logger.info("webhook_task_process", {
        taskId: task.id,
        source: payload.source,
        eventType: payload.eventType,
      });

      // The actual processing depends on the webhook source
      // This is a placeholder - real implementation will route to appropriate handlers

      return {
        taskId: task.id,
        status: "completed",
        result: { processed: true, source: payload.source },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// Register default processors
registerProcessor(reminderProcessor);
registerProcessor(improvementProcessor);
registerProcessor(consolidationProcessor);
registerProcessor(dreamingProcessor);
registerProcessor(webhookProcessor);

// ============================================================================
// Queue Processing Functions
// ============================================================================

// Lazy import to avoid circular dependencies
let queueRepo: typeof import("@alfred/db/repo/queue") | null = null;
let budgetModule: typeof import("@alfred/agent/budget") | null = null;

async function getQueueRepo() {
  if (!queueRepo) {
    queueRepo = await import("@alfred/db/repo/queue");
  }
  return queueRepo;
}

async function getBudgetModule() {
  if (!budgetModule) {
    budgetModule = await import("@alfred/agent/budget");
  }
  return budgetModule;
}

/**
 * Select the next task to process
 */
export async function selectNextTask(
  userId: string,
  config: IdleLoopConfig
): Promise<QueuedTask | null> {
  const repo = await getQueueRepo();
  const budget = await getBudgetModule();

  // Check if we have budget for idle tasks
  const manager = budget.getBudgetManager(userId);
  const budgetResult = await manager.checkIdleBudget(
    1000, // Estimate 1k tokens for task
    config.budgetReservePercent / 100
  );

  if (!budgetResult.allowed) {
    logger.debug("idle_budget_exhausted", {
      userId,
      reason: budgetResult.reason,
    });
    return null;
  }

  // Get ready tasks
  const tasks = await repo.getReadyTasks(userId, 1);
  if (tasks.length === 0) {
    return null;
  }

  const task = tasks[0];
  return {
    id: task.id,
    userId: task.userId,
    type: task.type,
    priority: task.priority ?? 5,
    payload: task.payload,
    source: task.source ?? undefined,
    sourceId: task.sourceId ?? undefined,
    estimatedTokens: task.estimatedTokens ?? undefined,
  };
}

/**
 * Process a single task
 */
export async function processTask(task: QueuedTask): Promise<ProcessedTask> {
  const repo = await getQueueRepo();
  const budget = await getBudgetModule();

  // Claim the task
  const claimed = await repo.claimTask(task.id);
  if (!claimed) {
    return {
      taskId: task.id,
      status: "failed",
      error: "Task already claimed or not found",
      durationMs: 0,
    };
  }

  // Find processor
  const processor = getProcessor(task.type);
  if (!processor) {
    await repo.failTask(task.id, `No processor for task type: ${task.type}`);
    return {
      taskId: task.id,
      status: "failed",
      error: `No processor for task type: ${task.type}`,
      durationMs: 0,
    };
  }

  // Process the task
  const result = await processor.process(task);

  // Log execution
  await repo.logExecution({
    taskId: task.id,
    userId: task.userId,
    attempt: claimed.attempts ?? 1,
    status: result.status,
    error: result.error,
    durationMs: result.durationMs,
    tokensUsed: result.tokensUsed,
    costCents: result.costCents,
  });

  // Update task status
  if (result.status === "completed") {
    await repo.completeTask(task.id, result.result, {
      tokens: result.tokensUsed ?? 0,
      costCents: result.costCents ?? 0,
    });
  } else {
    await repo.failTask(task.id, result.error ?? "Unknown error");
  }

  // Record usage if tokens were used
  if (result.tokensUsed && result.costCents) {
    const manager = budget.getBudgetManager(task.userId);
    await manager.recordUsage({
      modelRef: "background:task",
      provider: "background",
      role: "background",
      inputTokens: result.tokensUsed,
      outputTokens: 0,
    });
  }

  return result;
}

/**
 * Process idle queue for a user
 */
export async function processIdleQueue(
  userId: string,
  config: IdleLoopConfig
): Promise<ProcessedTask[]> {
  const results: ProcessedTask[] = [];

  for (let i = 0; i < config.maxTasksPerCycle; i++) {
    const task = await selectNextTask(userId, config);
    if (!task) {
      break; // No more tasks or budget exhausted
    }

    const result = await processTask(task);
    results.push(result);

    // If task failed, don't continue processing more tasks
    if (result.status === "failed") {
      logger.warn("idle_task_failed", {
        taskId: task.id,
        error: result.error,
      });
    }
  }

  return results;
}

/**
 * Get default idle loop config
 */
export function getDefaultIdleLoopConfig(): IdleLoopConfig {
  return {
    pollIntervalMs: Number.parseInt(
      process.env.IDLE_LOOP_INTERVAL_MS ?? "60000",
      10
    ),
    maxTasksPerCycle: Number.parseInt(
      process.env.IDLE_LOOP_MAX_TASKS ?? "5",
      10
    ),
    idleThresholdMs: Number.parseInt(
      process.env.IDLE_LOOP_THRESHOLD_MS ?? "30000",
      10
    ),
    budgetReservePercent: Number.parseInt(
      process.env.BUDGET_RESERVE_PERCENT ?? "20",
      10
    ),
  };
}
