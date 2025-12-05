import { getAssistantAgentDefaults } from "@alfred/agent";
import type {
  CognitiveState,
  Event,
  Outcome,
  Physiology,
  Plan,
} from "@alfred/cognitive/state";
import { idle, initialAutonomy, updateAutonomy } from "@alfred/cognitive/state";
import { applyTransition } from "@alfred/cognitive/transition";
import { cognitiveRepo } from "@alfred/db";
import {
  cognitiveEntropyEventsTotal,
  cognitivePhysiologyGauge,
} from "@alfred/metrics/shared";
import type { RuntimeContext } from "@alfred/type/runtime-context";

// Temporary: Autonomy Logic (to be expanded)
const createInitialAutonomy = () => initialAutonomy(Date.now());

export type CognitiveEffect =
  | { type: "generate_response"; input: string }
  | { type: "execute_plan"; plan: Plan }
  | { type: "log_reflection"; outcome: Outcome };

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
export async function runCognitiveLoop(
  _ctx: RuntimeContext,
  streamId: string,
  incomingEvent: Event
): Promise<CognitiveLoopResult> {
  // 1. Hydrate State (Simplified: Replay all events for now)
  const events = await cognitiveRepo.getAllEvents(streamId);
  let state: CognitiveState = idle(Date.now());
  let autonomy = createInitialAutonomy();

  // Replay history
  for (const record of events) {
    const historicalEvent = record.payload as unknown as Event;
    const result = applyTransition(state, autonomy, historicalEvent);
    state = result.state;
    autonomy = result.autonomy;
    recordPhysiologyMetrics(state.physiology);
    maybeRecordEntropyEvent(historicalEvent);
  }

  // 2. Apply New Event
  const transition = applyTransition(state, autonomy, incomingEvent);
  const newState = transition.state;
  const newAutonomy = transition.autonomy;
  recordPhysiologyMetrics(newState.physiology);
  maybeRecordEntropyEvent(incomingEvent);

  // Update Autonomy if needed (e.g. on feedback)
  if (incomingEvent._ === "feedback") {
    const evidence = calculateEvidence(incomingEvent);
    autonomy = updateAutonomy(
      Date.now(),
      newAutonomy,
      evidence,
      newState.physiology
    );
  } else {
    autonomy = newAutonomy;
  }

  // 3. Persist
  await cognitiveRepo.appendEvent(
    streamId,
    incomingEvent._,
    incomingEvent as unknown as Record<string, unknown>
  );

  const effects = computeEffects(newState);

  return { state: newState, effects };
}

function calculateEvidence(event: Event & { _: "feedback" }) {
  // Simple heuristic: if expected === actual, it's positive.
  // If not, it's negative.
  // In a real system, we might parse the diff or use an LLM to judge.
  const positive = event.expected === event.actual;

  // Strength could be derived from how emphatic the user was, or magnitude of error
  // Defaulting to 0.5
  return {
    _: "feedback",
    positive,
    strength: 0.5,
  } as const;
}

const recordPhysiologyMetrics = (physiology: Physiology) => {
  try {
    cognitivePhysiologyGauge.set({ metric: "energy" }, physiology.energy);
    cognitivePhysiologyGauge.set({ metric: "boredom" }, physiology.boredom);
    cognitivePhysiologyGauge.set(
      { metric: "frustration" },
      physiology.frustration
    );
  } catch {
    // metrics registry not available (tests, local scripts)
  }
};

const maybeRecordEntropyEvent = (event: Event) => {
  if (
    event._ === "interrupt" &&
    (event.reason.includes("loop") || event.reason.includes("boredom"))
  ) {
    try {
      cognitiveEntropyEventsTotal.inc({ type: "high" });
    } catch {
      // metrics registry not available
    }
  }
};

export function computeEffects(state: CognitiveState): CognitiveEffect[] {
  const effects: CognitiveEffect[] = [];

  if (state._ === "thinking") {
    effects.push({ type: "generate_response", input: state.about });
  }

  return effects;
}

export async function runAssistantGeneration(
  ctx: RuntimeContext,
  _streamId: string,
  input: string
): Promise<Outcome> {
  if (!ctx.ai) {
    const outcome: Outcome = {
      _: "failure",
      error: "ai_adapter_missing",
      recoverable: true,
    };
    return outcome;
  }

  const defaults = getAssistantAgentDefaults();
  const startedAt = Date.now();

  // Simulate a message from the user (TODO: Use for context building)
  // const _newMessage: UIMessage = {
  //   id: `cog-${Date.now()}`,
  //   role: "user",
  //   parts: [{ type: "text", text: input }],
  // };

  try {
    // For now, we reconstruct the messages array.
    // In future, we should fetch conversation history properly or rely on the adapter
    // to handle history if it's stateful (though the adapter interface is stateless).
    const messages = [
      { role: "system", content: defaults.instructions },
      { role: "user", content: input },
    ] as any[];

    // Use the injected AI adapter
    const result = await ctx.ai.generateText({
      messages,
      system: defaults.instructions,
      tools: defaults.tools,
    });

    const sanitized = { text: result.text };
    const duration = Date.now() - startedAt;
    const outcome: Outcome = {
      _: "success",
      result: sanitized,
      duration,
    };
    return outcome;
  } catch (error: any) {
    const outcome: Outcome = {
      _: "failure",
      error: error?.message ?? "assistant_generation_failed",
      recoverable: true,
    };
    return outcome;
  }
}
