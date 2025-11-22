import { getAssistantAgentDefaults } from "@alfred/agent";
import type { CognitiveState, Event, Outcome } from "@alfred/cognitive/state";
import {
  idle,
  initialAutonomy,
  reflecting,
  thinking,
  updateAutonomy,
} from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import type { RuntimeContext } from "@alfred/type/runtime-context";

// Temporary: Autonomy Logic (to be expanded)
const AUTONOMY = initialAutonomy();

/**
 * The Cognitive Runtime Loop
 *
 * Drives the state machine:
 * 1. Load state (Snapshot + Events)
 * 2. Apply pure transition (State + Event -> New State)
 * 3. Persist Event & Snapshot
 * 4. Execute Side Effects (LLM calls, Tools)
 */
export async function runCognitiveLoop(
  ctx: RuntimeContext,
  streamId: string,
  incomingEvent: Event
): Promise<CognitiveState> {
  // 1. Hydrate State (Simplified: Replay all events for now)
  const events = await cognitiveRepo.getAllEvents(streamId);
  let state: CognitiveState = idle();
  let autonomy = AUTONOMY;

  // Replay history
  for (const record of events) {
    const historicalEvent = record.payload as unknown as Event;
    [state, autonomy] = applyTransition(state, autonomy, historicalEvent);
  }

  // 2. Apply New Event
  const [newState, newAutonomy] = applyTransition(
    state,
    autonomy,
    incomingEvent
  );

  // Update Autonomy if needed (e.g. on feedback)
  if (incomingEvent._ === "feedback") {
    const evidence = calculateEvidence(incomingEvent);
    autonomy = updateAutonomy(autonomy, evidence);
  }

  // 3. Persist
  await cognitiveRepo.appendEvent(
    streamId,
    incomingEvent._,
    incomingEvent as unknown as Record<string, unknown>
  );

  // 4. Execute Side Effects (Async)
  // We return the new state immediately, but trigger the "Brain" to process it
  // In a real system, this might be a background job
  void processEffects(ctx, streamId, newState, newAutonomy);

  return newState;
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

/**
 * Pure State Transition Function
 * (Should eventually move to @alfred/cognitive/logic if complex)
 */
function applyTransition(
  state: CognitiveState,
  auto: any,
  event: Event
): [CognitiveState, any] {
  switch (state._) {
    case "idle":
      if (event._ === "input") {
        return [thinking(event.content), auto];
      }
      break;

    case "thinking":
      if (event._ === "complete") {
        // Thinking complete -> Executing or Reflecting?
        // For now, LLM "Thinking" usually results in an execution plan or response
        // We treat the LLM response as an "execution" of a response plan
        return [reflecting(event.outcome, "unknown", "unknown"), auto];
      }
      break;

    case "reflecting":
      // After reflection, go back to idle
      return [idle(), auto];
  }

  // Default: No state change
  return [state, auto];
}

/**
 * Side Effect Processor ("The Brain")
 * Interprets the state and calls AI/Tools
 */
async function processEffects(
  ctx: RuntimeContext,
  streamId: string,
  state: CognitiveState,
  _autonomy: any
) {
  if (state._ === "thinking") {
    // The "Thinking" state currently maps to generating an Assistant response
    // In the full architecture, this would generate a Plan
    await runAssistantGeneration(ctx, streamId, state.about);
  }
}

async function runAssistantGeneration(
  ctx: RuntimeContext,
  streamId: string,
  input: string
) {
  // Requires AI Adapter to be present in context
  if (!ctx.ai) {
    return;
  }

  const defaults = getAssistantAgentDefaults();

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

    const sanitized = { text: result.text }; // Simplified sanitization
    const outcome: Outcome = {
      _: "success",
      result: sanitized,
      duration: 0, // TODO: Measure
    };

    // Feed success back into the loop
    await runCognitiveLoop(ctx, streamId, {
      _: "complete",
      outcome,
      ts: Date.now() as any,
    });
  } catch (error: any) {
    const outcome: Outcome = {
      _: "failure",
      error: error.message,
      recoverable: true,
    };

    await runCognitiveLoop(ctx, streamId, {
      _: "complete",
      outcome,
      ts: Date.now() as any,
    });
  }
}
