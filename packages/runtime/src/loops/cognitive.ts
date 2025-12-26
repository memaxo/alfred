import { getAssistantAgentDefaults } from "@alfred/agent";
import {
  unwrapEventEnvelope,
  wrapEventEnvelope,
} from "@alfred/agent/utils/envelope";
import type {
  AutonomyGradient,
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
import type { ModelMessage } from "ai";

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

// Type guard for snapshot state with optional autonomy
type SnapshotState = CognitiveState & { autonomy?: AutonomyGradient };

/**
 * The Cognitive Runtime Loop
 *
 * Drives the state machine:
 * 1. Load state (Snapshot + Events since snapshot)
 * 2. Apply pure transition (State + Event -> New State)
 * 3. Persist Event & Snapshot
 * 4. Return Side Effects for the caller to execute safely
 */
export async function runCognitiveLoop(
  _ctx: RuntimeContext,
  streamId: string,
  incomingEvent: Event
): Promise<CognitiveLoopResult> {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const isEventLike = (value: unknown): value is { _: string } =>
    isRecord(value) && typeof value._ === "string";

  // 1. Hydrate State (Snapshot + Events since snapshot for O(1) best case)
  let state: CognitiveState;
  let autonomy: AutonomyGradient;
  let events: Awaited<ReturnType<typeof cognitiveRepo.getAllEvents>>;

  // Try to load from snapshot first
  const snapshot = await cognitiveRepo.getLatestSnapshot(streamId);
  if (snapshot) {
    const snapState = snapshot.state as SnapshotState;
    state = snapState;
    autonomy = snapState.autonomy ?? createInitialAutonomy();
    // Only replay events since the snapshot
    events = await cognitiveRepo.getEventsSince(streamId, snapshot.createdAt);
  } else {
    state = idle(Date.now());
    autonomy = createInitialAutonomy();
    events = await cognitiveRepo.getAllEvents(streamId);
  }

  // Replay history (NO metrics recording during replay - only for new events)
  for (const record of events) {
    const unwrapped = unwrapEventEnvelope(record.payload);
    if (!isEventLike(unwrapped.data)) {
      continue;
    }
    const historicalEvent = unwrapped.data as Event;
    const result = applyTransition(state, autonomy, historicalEvent);
    state = result.state;
    autonomy = result.autonomy;
    // Don't record metrics during replay - they inflate counters
  }

  // 2. Apply New Event
  const transition = applyTransition(state, autonomy, incomingEvent);
  const newState = transition.state;
  const newAutonomy = transition.autonomy;
  recordPhysiologyMetrics(newState.physiology);
  maybeRecordEntropyEvent(incomingEvent);

  // Update Autonomy based on event type
  const now = Date.now();
  if (incomingEvent._ === "feedback") {
    const evidence = calculateEvidence(incomingEvent);
    autonomy = updateAutonomy(now, newAutonomy, evidence, newState.physiology);
  } else if (incomingEvent._ === "complete") {
    // Update autonomy based on execution outcome
    const evidence = calculateOutcomeEvidence(incomingEvent.outcome);
    autonomy = updateAutonomy(now, newAutonomy, evidence, newState.physiology);
  } else {
    autonomy = newAutonomy;
  }

  const stateWithAutonomy: SnapshotState = {
    ...(newState as SnapshotState),
    autonomy,
  };

  // 3. Persist
  const envelope = wrapEventEnvelope({
    id: crypto.randomUUID(),
    type: incomingEvent._,
    resource: "user",
    data: incomingEvent,
  });
  await cognitiveRepo.appendEvent(streamId, incomingEvent._, {
    v: envelope.v,
    id: envelope.id,
    type: envelope.type,
    createdAt: envelope.createdAt,
    resource: envelope.resource,
    data: envelope.data,
  });

  const effects = computeEffects(newState);

  return { state: stateWithAutonomy, effects };
}

function calculateEvidence(event: Event & { _: "feedback" }) {
  const simRaw = event.similarity;
  if (typeof simRaw !== "number" || !Number.isFinite(simRaw)) {
    return {
      _: "feedback",
      positive: false,
      strength: 0,
      reliability: 0,
    } as const;
  }

  const similarity = Math.max(0, Math.min(1, simRaw));
  const positive = similarity >= 0.5;
  const strength = Math.max(0, Math.min(1, Math.abs(similarity - 0.5) * 2));

  return {
    _: "feedback",
    positive,
    strength,
  } as const;
}

function calculateOutcomeEvidence(outcome: Outcome) {
  if (outcome._ === "success") {
    return {
      _: "success" as const,
      task: "execution",
      duration: outcome.duration,
    };
  }
  if (outcome._ === "failure") {
    return {
      _: "failure" as const,
      task: "execution",
      error: outcome.error,
    };
  }
  if (outcome._ === "partial") {
    const total = outcome.completed.length + outcome.failed.length;
    const ratio = total > 0 ? outcome.completed.length / total : 0.5;
    return {
      _: "feedback" as const,
      positive: ratio >= 0.5,
      strength: Math.max(0, Math.min(1, Math.abs(ratio - 0.5) * 2)),
    };
  }

  // Cancelled - explicit no-op (no autonomy change)
  return {
    _: "override" as const,
    reason: outcome.reason,
    reliability: 0,
  };
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

  if (state._ === "executing") {
    // When executing, emit plan execution effect
    effects.push({ type: "execute_plan", plan: state.plan });
  }

  if (state._ === "reflecting") {
    // When reflecting, log the reflection outcome
    effects.push({ type: "log_reflection", outcome: state.outcome });
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
    const system =
      typeof defaults.instructions === "string"
        ? defaults.instructions
        : JSON.stringify(defaults.instructions);

    // For now, we reconstruct the messages array.
    // In future, we should fetch conversation history properly or rely on the adapter
    // to handle history if it's stateful (though the adapter interface is stateless).
    const messages: ModelMessage[] = [
      { role: "system", content: system },
      { role: "user", content: input },
    ];

    // Use the injected AI adapter
    const result = await ctx.ai.generateText({
      messages,
      system,
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
  } catch (error) {
    const outcome: Outcome = {
      _: "failure",
      error:
        error instanceof Error ? error.message : "assistant_generation_failed",
      recoverable: true,
    };
    return outcome;
  }
}
