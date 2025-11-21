/**
 * Storage Adapter
 *
 * Abstraction layer for workflow persistence.
 * Runtime uses this interface, router provides implementation via dependency injection.
 */

import type { WorkflowEvent } from "@alfred/type/plan";

/**
 * Storage operations for workflow persistence
 *
 * Runtime doesn't know about database internals - it uses this interface.
 * Router/API layer provides implementation that talks to @alfred/db
 */
export type StorageAdapter = {
  /**
   * Append single event to workflow run
   */
  appendEvent(runId: string, event: WorkflowEvent): Promise<void>;

  /**
   * Append batch of events atomically
   */
  appendEventBatch(runId: string, events: WorkflowEvent[]): Promise<void>;

  /**
   * Update workflow run status
   */
  updateStatus(
    runId: string,
    status: "running" | "completed" | "failed" | "cancelled",
    message?: string
  ): Promise<void>;
};

/**
 * No-op storage adapter for testing
 */
export class NoOpStorageAdapter implements StorageAdapter {
  async appendEvent(_runId: string, _event: WorkflowEvent): Promise<void> {
    // No-op
  }

  async appendEventBatch(
    _runId: string,
    _events: WorkflowEvent[]
  ): Promise<void> {
    // No-op
  }

  async updateStatus(
    _runId: string,
    _status: "running" | "completed" | "failed" | "cancelled",
    _message?: string
  ): Promise<void> {
    // No-op
  }
}
