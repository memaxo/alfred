/**
 * Checkpoint Observer
 *
 * Persists pipeline state after each stage boundary for resume capability.
 * Delegates storage to an injectable CheckpointStorage implementation.
 */

import type { PipelineEvent } from "../events";
import type { StageName } from "../pipeline";
import { STAGE_ORDER } from "../pipeline";
import type { PipelineObserver } from "../runner";
import type {
  PipelineSnapshot,
  PipelineStatus,
  SerializableValue,
} from "../snapshot";

/**
 * Storage interface for checkpoint persistence.
 * Implement this to store checkpoints in your preferred backend
 * (database, filesystem, Redis, etc.)
 */
export type CheckpointStorage = {
  /**
   * Save a checkpoint for a run.
   * Should be idempotent (same runId + stage = same result).
   */
  save(runId: string, snapshot: PipelineSnapshot): Promise<void>;

  /**
   * Load the latest checkpoint for a run.
   * Returns null if no checkpoint exists.
   */
  load(runId: string): Promise<PipelineSnapshot | null>;

  /**
   * Delete checkpoints for a run (after completion/failure).
   * Optional cleanup method.
   */
  delete?(runId: string): Promise<void>;
};

/**
 * In-memory checkpoint storage for testing.
 */
export class InMemoryCheckpointStorage implements CheckpointStorage {
  private readonly checkpoints = new Map<string, PipelineSnapshot>();

  async save(runId: string, snapshot: PipelineSnapshot): Promise<void> {
    this.checkpoints.set(runId, snapshot);
  }

  async load(runId: string): Promise<PipelineSnapshot | null> {
    return this.checkpoints.get(runId) ?? null;
  }

  async delete(runId: string): Promise<void> {
    this.checkpoints.delete(runId);
  }

  /** For testing: get all checkpoints */
  getAll(): Map<string, PipelineSnapshot> {
    return new Map(this.checkpoints);
  }

  /** For testing: clear all checkpoints */
  clear(): void {
    this.checkpoints.clear();
  }
}

/**
 * Observer that checkpoints pipeline state after each stage.
 *
 * Usage:
 * ```typescript
 * const storage = new InMemoryCheckpointStorage();
 * const observer = new CheckpointObserver(storage);
 * runner.addObserver(observer);
 * ```
 */
export class CheckpointObserver implements PipelineObserver {
  private currentRunId: string | null = null;
  private status: PipelineStatus = "idle";
  private requirement = "";
  private lastCompletedStage: StageName | null = null;
  private lastCompletedStageIndex = -1;
  private contextEntries: [string, SerializableValue][] = [];
  private stageResults: Array<{
    name: StageName;
    durationMs: number;
    status: "success" | "failure" | "skipped";
  }> = [];
  private startedAt = 0;
  private lastEventAt = 0;
  private lastEventId: string | null = null;
  private error: string | null = null;

  constructor(private readonly storage: CheckpointStorage) {}

  onEvent(event: PipelineEvent): void {
    this.lastEventAt = event.timestamp;
    this.lastEventId = `${event.type}:${event.timestamp}`;

    switch (event.type) {
      case "pipeline:start":
        this.currentRunId = event.runId;
        this.requirement = event.requirement;
        this.status = "running";
        this.startedAt = event.timestamp;
        this.reset();
        break;

      case "stage:exit":
        this.lastCompletedStage = event.stage;
        this.lastCompletedStageIndex = STAGE_ORDER.indexOf(event.stage);
        this.stageResults.push({
          name: event.stage,
          durationMs: event.durationMs,
          status: "success",
        });
        // Checkpoint after each stage completion
        void this.checkpoint();
        break;

      case "stage:error":
        this.stageResults.push({
          name: event.stage,
          durationMs: 0,
          status: "failure",
        });
        this.status = "failed";
        this.error = event.error;
        void this.checkpoint();
        break;

      case "context:set":
        // Update context entries
        this.contextEntries = this.contextEntries.filter(
          ([key]) => key !== event.key
        );
        this.contextEntries.push([event.key, event.value]);
        break;

      case "pipeline:suspend":
        this.status = "suspended";
        void this.checkpoint();
        break;

      case "pipeline:resume":
        this.status = "running";
        break;

      case "pipeline:complete":
        this.status = "completed";
        // Optionally cleanup checkpoint on completion
        if (this.currentRunId && this.storage.delete) {
          void this.storage.delete(this.currentRunId);
        }
        break;

      case "pipeline:failed":
        this.status = "failed";
        this.error = event.error;
        void this.checkpoint();
        break;
    }
  }

  onComplete(): void {
    // Reset state for next run
    this.currentRunId = null;
    this.reset();
  }

  /**
   * Build and save checkpoint snapshot.
   */
  private async checkpoint(): Promise<void> {
    if (!this.currentRunId) {
      return;
    }

    const snapshot: PipelineSnapshot = {
      runId: this.currentRunId,
      status: this.status,
      requirement: this.requirement,
      lastCompletedStage: this.lastCompletedStage,
      lastCompletedStageIndex: this.lastCompletedStageIndex,
      contextEntries: [...this.contextEntries],
      stageResults: [...this.stageResults],
      startedAt: this.startedAt,
      lastEventAt: this.lastEventAt,
      lastEventId: this.lastEventId,
      error: this.error,
    };

    try {
      await this.storage.save(this.currentRunId, snapshot);
    } catch (_error) {}
  }

  /**
   * Reset mutable state.
   */
  private reset(): void {
    this.lastCompletedStage = null;
    this.lastCompletedStageIndex = -1;
    this.contextEntries = [];
    this.stageResults = [];
    this.error = null;
  }

  /**
   * Get the current snapshot (for testing).
   */
  getCurrentSnapshot(): PipelineSnapshot | null {
    if (!this.currentRunId) {
      return null;
    }

    return {
      runId: this.currentRunId,
      status: this.status,
      requirement: this.requirement,
      lastCompletedStage: this.lastCompletedStage,
      lastCompletedStageIndex: this.lastCompletedStageIndex,
      contextEntries: [...this.contextEntries],
      stageResults: [...this.stageResults],
      startedAt: this.startedAt,
      lastEventAt: this.lastEventAt,
      lastEventId: this.lastEventId,
      error: this.error,
    };
  }
}
