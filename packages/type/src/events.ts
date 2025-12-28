import type { WorkflowEvent } from "./plan";
import type { StreamEvent } from "./stream";
import type { VoiceStreamServerEvent } from "./voice";

/**
 * Unified Event Catalog for ALFRED.
 * This union enables the TUI Debugger to handle any system event uniformly.
 *
 * NOTE: CognitiveEvent should be imported directly from @alfred/cognitive/state/types
 * when needed to avoid circular dependencies.
 */
export type DomainEvent =
  | { _: "workflow"; event: WorkflowEvent }
  | { _: "stream"; event: StreamEvent }
  | { _: "voice"; event: VoiceStreamServerEvent };
