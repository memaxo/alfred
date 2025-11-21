import type { CognitiveState, Event } from "@alfred/cognitive/state";
import type { RuntimeContext } from "@alfred/type/runtime-context";
/**
 * The Cognitive Runtime Loop
 *
 * Drives the state machine:
 * 1. Load state (Snapshot + Events)
 * 2. Apply pure transition (State + Event -> New State)
 * 3. Persist Event & Snapshot
 * 4. Execute Side Effects (LLM calls, Tools)
 */
export declare function runCognitiveLoop(
  ctx: RuntimeContext,
  streamId: string,
  incomingEvent: Event
): Promise<CognitiveState>;
//# sourceMappingURL=cognitive.d.ts.map
