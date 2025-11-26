import type { CognitiveState, Event, Outcome, Plan } from "@alfred/cognitive/state";
import type { RuntimeContext } from "@alfred/type/runtime-context";
export type CognitiveEffect = {
    type: "generate_response";
    input: string;
} | {
    type: "execute_plan";
    plan: Plan;
} | {
    type: "log_reflection";
    outcome: Outcome;
};
export type CognitiveLoopResult = {
    state: CognitiveState;
    effects: CognitiveEffect[];
};
/**
 * The Cognitive Runtime Loop
 *
 * Drives the state machine:
 * 1. Load state (Snapshot + Events)
 * 2. Apply pure transition (State + Event -> New State)
 * 3. Persist Event & Snapshot
 * 4. Return Side Effects for the caller to execute safely
 */
export declare function runCognitiveLoop(_ctx: RuntimeContext, streamId: string, incomingEvent: Event): Promise<CognitiveLoopResult>;
export declare function computeEffects(state: CognitiveState): CognitiveEffect[];
export declare function runAssistantGeneration(ctx: RuntimeContext, _streamId: string, input: string): Promise<Outcome>;
//# sourceMappingURL=cognitive.d.ts.map