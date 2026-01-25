/**
 * Brainstem Supervisor
 *
 * Monitors cognitive processes for loops and stalls using embedding-centric detection.
 */

import { type LoopConfig, LoopDetector } from "./loop";

export type SupervisorEvent =
  | { type: "thought"; content: string; embedding?: number[] }
  | { type: "tool_call"; tool: string; input: string }
  | { type: "tool_result"; content: string };

export type InterruptResult =
  | { interrupt: false }
  | { interrupt: true; reason: string };

export interface BrainstemConfig {
  /** Loop detector configuration */
  loop?: Partial<LoopConfig>;
}

export class BrainstemSupervisor {
  private readonly detector: LoopDetector;

  // Heartbeat state
  private activeProcess: {
    id: string;
    startedAt: number;
    lastActivityAt: number;
    expectedHeartbeatMs: number;
    abortController: AbortController;
  } | null = null;

  constructor(config: BrainstemConfig = {}) {
    this.detector = new LoopDetector(config.loop);
  }

  /**
   * Observe an event and check for loop conditions.
   *
   * @param event - The supervisor event to observe
   * @returns Interrupt result if loop detected
   */
  observe(event: SupervisorEvent): InterruptResult {
    if (event.type === "thought") {
      const result = this.detector.check(
        event.content,
        event.embedding ?? null
      );

      if (result.loop) {
        return {
          interrupt: true,
          reason: result.reason,
        };
      }
    }

    // Tool calls and results pass through without loop checking
    // (they contribute to activity but aren't checked for semantic loops)
    return { interrupt: false };
  }

  /**
   * Register a process for heartbeat monitoring.
   */
  registerProcess(
    id: string,
    abortController: AbortController,
    expectedHeartbeatMs = 60_000
  ) {
    this.activeProcess = {
      id,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      expectedHeartbeatMs,
      abortController,
    };
  }

  /**
   * Record activity to prevent stall detection.
   */
  heartbeat() {
    if (this.activeProcess) {
      this.activeProcess.lastActivityAt = Date.now();
    }
  }

  /**
   * Clear the active process and reset detector state.
   */
  clearProcess() {
    this.activeProcess = null;
    this.detector.reset();
  }

  /**
   * Check for heartbeat failures (zombie processes).
   */
  checkPhysiology(): InterruptResult {
    if (!this.activeProcess) {
      return { interrupt: false };
    }

    const now = Date.now();
    const silentDuration = now - this.activeProcess.lastActivityAt;

    if (silentDuration > this.activeProcess.expectedHeartbeatMs) {
      this.activeProcess.abortController.abort();
      const reason = `process_heartbeat_failed:${this.activeProcess.id}:silent_for_${Math.round(silentDuration / 1000)}s`;
      this.activeProcess = null;
      return { interrupt: true, reason };
    }

    return { interrupt: false };
  }

  /** Get detector transition count for observability */
  getTransitionCount(): number {
    return this.detector.getTransitionCount();
  }

  /** Reset loop detection state without affecting heartbeat monitoring */
  resetLoop(): void {
    this.detector.reset();
  }
}
