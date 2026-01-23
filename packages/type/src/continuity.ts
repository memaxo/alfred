/**
 * Continuity context types.
 *
 * Unified types for encapsulating session/thread/run relationships
 * across voice, chat, and workflow systems.
 */

/**
 * Unified continuity context that encapsulates session/thread/run relationships.
 *
 * Used to clarify the relationships between:
 * - `sessionId`: Ephemeral WebSocket/voice session (Layer 1)
 * - `threadId`: Persistent conversation thread (Layer 2)
 * - `workflowRunId`: Persistent execution run (Layer 3)
 *
 * @example
 * ```typescript
 * const ctx: ContinuityContext = {
 *   sessionId: "voice-session-123",
 *   threadId: "thread-456",
 *   workflowRunId: "run-789",
 *   focusSetId: "focus-abc",
 *   commitmentId: "commit-def",
 * };
 * ```
 */
export type ContinuityContext = {
  /** Ephemeral WebSocket/voice session identifier (Layer 1: Session State) */
  sessionId?: string;
  /** Persistent conversation thread identifier (Layer 2: Conversation Persistence) */
  threadId?: string;
  /** Persistent execution run identifier (Layer 3: Structured Artifacts) */
  workflowRunId?: string;
  /** Focus set identifier (Layer 3: Structured Artifacts) */
  focusSetId?: string | null;
  /** Commitment identifier (Layer 3: Structured Artifacts) */
  commitmentId?: string | null;
};
