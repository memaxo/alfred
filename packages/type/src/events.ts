import type { WorkflowEvent } from "./plan";
import type { StreamEvent } from "./stream";
import type { VoiceStreamServerEvent } from "./voice";

/**
 * Unified Event Catalog for ALFRED.
 * This union enables the TUI Debugger to handle any system event uniformly.
 *
 * NOTE: CognitiveEvent is imported via type-only re-export to avoid circular
 * dependency with @alfred/cognitive. Import CognitiveEvent directly from
 * @alfred/cognitive/state/types when needed.
 */
export type DomainEvent =
  | { _: "cognitive"; event: import("@alfred/cognitive/state/types").Event }
  | { _: "workflow"; event: WorkflowEvent }
  | { _: "stream"; event: StreamEvent }
  | { _: "voice"; event: VoiceStreamServerEvent };

// Re-export CognitiveEvent type (using type-only import to avoid circular dependency)
export type CognitiveEvent = import("@alfred/cognitive/state/types").Event;
