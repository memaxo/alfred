import { detectLoop } from "../../utils/entropy";

export type SupervisorEvent =
  | { type: "thought"; content: string }
  | { type: "tool_call"; tool: string; input: string }
  | { type: "tool_result"; content: string };

export type InterruptResult =
  | { interrupt: false }
  | { interrupt: true; reason: string };

export class BrainstemSupervisor {
  private thoughtWindow: string[] = [];
  private readonly windowSize = 5;
  private readonly loopThreshold = 0.85;

  // Heartbeat state
  private activeProcess: {
    id: string;
    startedAt: number;
    lastActivityAt: number;
    expectedHeartbeatMs: number;
    abortController: AbortController;
  } | null = null;

  /**
   * Observe an event from the agent
   */
  observe(event: SupervisorEvent): InterruptResult {
    if (event.type === "thought") {
      this.thoughtWindow.push(event.content);
      if (this.thoughtWindow.length > this.windowSize) {
        this.thoughtWindow.shift();
      }

      if (detectLoop(this.thoughtWindow, this.loopThreshold)) {
        return {
          interrupt: true,
          reason: "boredom_loop_detected",
        };
      }
    }
    return { interrupt: false };
  }

  /**
   * Register a new active process to monitor
   */
  registerProcess(
    id: string,
    abortController: AbortController,
    expectedHeartbeatMs = 60000
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
   * Signal that the active process is alive
   */
  heartbeat() {
    if (this.activeProcess) {
      this.activeProcess.lastActivityAt = Date.now();
    }
  }

  /**
   * Clear the active process (completed)
   */
  clearProcess() {
    this.activeProcess = null;
  }

  /**
   * Check physiology (Heartbeats)
   * Should be called periodically (e.g., every 1s)
   */
  checkPhysiology(): InterruptResult {
    if (!this.activeProcess) {
      return { interrupt: false };
    }

    const now = Date.now();
    const silentDuration = now - this.activeProcess.lastActivityAt;

    if (silentDuration > this.activeProcess.expectedHeartbeatMs) {
      // Kill it
      this.activeProcess.abortController.abort();
      const reason = `process_heartbeat_failed:${this.activeProcess.id}:silent_for_${Math.round(silentDuration / 1000)}s`;
      this.activeProcess = null;
      return {
        interrupt: true,
        reason,
      };
    }

    return { interrupt: false };
  }
}
