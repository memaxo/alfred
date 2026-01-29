import type {
  AutonomyGradient,
  CognitiveState,
  Event,
  Outcome,
  Physiology,
  Plan,
} from "@alfred/cognitive/state";
import type { HookContext, HookRegistry } from "@alfred/type";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { ModelMessage } from "ai";

import { getAssistantAgentDefaults } from "@alfred/agent";
import {
  unwrapEventEnvelope,
  wrapEventEnvelope,
} from "@alfred/agent/utils/envelope";
import {
  idle,
  initialAutonomy,
  timestamp,
  updateAutonomy,
} from "@alfred/cognitive/state";
import { applyTransition } from "@alfred/cognitive/transition";
import { cognitiveRepo } from "@alfred/db";
import {
  cognitiveEntropyEventsTotal,
  cognitivePhysiologyGauge,
} from "@alfred/metrics/shared";

// Temporary: Autonomy Logic (to be expanded)
const createInitialAutonomy = () => initialAutonomy(Date.now());

export type CognitiveEffect =
  | { type: "generate_response"; input: string }
  | { type: "execute_plan"; plan: Plan }
  | { type: "log_reflection"; outcome: Outcome };

export interface CognitiveLoopResult {
  state: CognitiveState;
  effects: CognitiveEffect[];
}

// Type guard for snapshot state with optional autonomy
type SnapshotState = CognitiveState & { autonomy?: AutonomyGradient };

interface HooksRuntime {
  readonly registry: HookRegistry;
  readonly ctx: HookContext;
}

function getHooksRuntime(value: unknown): HooksRuntime | null {
  const ctx = value as { get?: (key: string) => unknown } | null;
  const hooks = ctx?.get?.("hooks") as unknown;
  if (!hooks || typeof hooks !== "object") {
    return null;
  }
  const rec = hooks as Record<string, unknown>;
  const registry = rec.registry as Record<string, unknown> | undefined;
  const baseCtx = rec.ctx as Record<string, unknown> | undefined;
  if (!registry || typeof registry.emit !== "function") {
    return null;
  }
  if (!baseCtx || typeof baseCtx.sessionId !== "string") {
    return null;
  }
  return hooks as HooksRuntime;
}

function createHookContext(
  base: HookContext,
  state: CognitiveState,
  autonomy: AutonomyGradient
): HookContext {
  const a = Number(autonomy.level);
  return {
    ...base,
    autonomy: a,
    cognitive: {
      state: state._,
      autonomy: a,
      physiology: state.physiology,
    },
  };
}

const physiologyThresholds = {
  energy: 0.2,
  boredom: 0.8,
  frustration: 0.8,
} as const;

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
  const hooks = getHooksRuntime(_ctx as unknown);

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
    ({ state } = result);
    ({ autonomy } = result);
    // Don't record metrics during replay - they inflate counters
  }

  let eventToApply: Event = incomingEvent;
  if (hooks && incomingEvent._ === "input") {
    try {
      const ctxForHook = createHookContext(hooks.ctx, state, autonomy);
      const out = await hooks.registry.emit(
        {
          type: "cognitive:input",
          input: incomingEvent.content,
        },
        ctxForHook
      );

      const { transformed } = out;
      if (transformed && transformed.input !== incomingEvent.content) {
        eventToApply = {
          ...incomingEvent,
          content: transformed.input,
        };
      }
    } catch (error) {
      hooks.ctx.log.warn("hooks_cognitive_input_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Permission pre-check: before resolving a decision into execution.
  // If denied/asked, we convert the event into an interrupt so the cognitive
  // state machine does not enter executing.
  if (hooks && state._ === "deciding") {
    try {
      const now = Date.now();
      const inputContent =
        eventToApply._ === "input" ? eventToApply.content : null;
      const selected = inputContent
        ? (state.options.find(
            (opt) => opt.id === inputContent || opt.id.includes(inputContent)
          ) ?? state.options[0])
        : eventToApply._ === "timeout"
          ? state.options[0]
          : undefined;

      if (selected) {
        const riskMax = selected.risks
          .map((r) => r.severity)
          .reduce<"low" | "medium" | "high">((acc, cur) => {
            if (acc === "high" || cur === "high") {
              return "high";
            }
            if (acc === "medium" || cur === "medium") {
              return "medium";
            }
            return "low";
          }, "low");

        const ctxForHook = createHookContext(hooks.ctx, state, autonomy);
        const gate = await hooks.registry.emit(
          {
            type: "cognitive:deciding",
            action: {
              type: "decision",
              risk: riskMax,
              description: selected.description,
            },
          },
          ctxForHook
        );

        if (gate.decision === "deny" || gate.decision === "ask") {
          eventToApply = {
            _: "interrupt",
            reason:
              gate.userMessage ??
              gate.reason ??
              `cognitive_gate:${gate.decision}`,
            priority: 2,
            ts: timestamp(now),
          };
        }
      }
    } catch (error) {
      hooks.ctx.log.warn("hooks_cognitive_deciding_gate_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const beforeState = state;
  const beforeAutonomy = autonomy;

  // 2. Apply New Event
  const transition = applyTransition(state, autonomy, eventToApply);
  const newState = transition.state;
  const newAutonomy = transition.autonomy;
  recordPhysiologyMetrics(newState.physiology);
  maybeRecordEntropyEvent(eventToApply);

  // Update Autonomy based on event type
  const now = Date.now();
  if (eventToApply._ === "feedback") {
    const evidence = calculateEvidence(eventToApply);
    autonomy = updateAutonomy(now, newAutonomy, evidence, newState.physiology);
  } else if (eventToApply._ === "complete") {
    // Update autonomy based on execution outcome
    const evidence = calculateOutcomeEvidence(eventToApply.outcome);
    autonomy = updateAutonomy(now, newAutonomy, evidence, newState.physiology);
  } else {
    autonomy = newAutonomy;
  }

  // The state visible to hooks/persistence for this turn (may be further gated).
  state = newState;

  let gatedMessage: string | null = null;
  let gateInterrupt: Event | null = null;
  let emittedActingGate = false;

  // Permission check: entering execution. If denied, we immediately interrupt
  // execution (persisting an interrupt event) and ask the assistant to explain.
  if (hooks && beforeState._ !== "executing" && newState._ === "executing") {
    try {
      const step = newState.plan.steps[newState.step];
      const ctxForHook = createHookContext(hooks.ctx, newState, autonomy);
      const out = await hooks.registry.emit(
        {
          type: "cognitive:acting",
          action: step?.action ?? "execute",
        },
        ctxForHook
      );
      emittedActingGate = true;

      if (out.decision === "deny" || out.decision === "ask") {
        const ts = timestamp(Date.now());
        gateInterrupt = {
          _: "interrupt",
          reason:
            out.userMessage ?? out.reason ?? `cognitive_gate:${out.decision}`,
          priority: 2,
          ts,
        };
        gatedMessage = out.userMessage ?? out.reason ?? "action_blocked";

        const interrupted = applyTransition(newState, autonomy, gateInterrupt);
        ({ state } = interrupted);
        ({ autonomy } = interrupted);
      }
    } catch (error) {
      hooks.ctx.log.warn("hooks_cognitive_acting_gate_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (hooks) {
    const ctxForHook = createHookContext(hooks.ctx, state, autonomy);

    try {
      if (beforeState._ !== state._) {
        await hooks.registry.emit(
          {
            type: "cognitive:transition",
            fromState: beforeState._,
            toState: state._,
            trigger: eventToApply._,
          },
          ctxForHook
        );
      }

      switch (state._) {
        case "thinking": {
          if (beforeState._ !== "thinking") {
            await hooks.registry.emit(
              { type: "cognitive:thinking", context: state.about },
              ctxForHook
            );
          }
          break;
        }
        case "deciding": {
          if (beforeState._ !== "deciding") {
            const best = [...state.options].sort(
              (a, b) => b.score - a.score
            )[0];
            const riskMax = best?.risks
              .map((r) => r.severity)
              .reduce<"low" | "medium" | "high">((acc, cur) => {
                if (acc === "high" || cur === "high") {
                  return "high";
                }
                if (acc === "medium" || cur === "medium") {
                  return "medium";
                }
                return "low";
              }, "low");

            await hooks.registry.emit(
              {
                type: "cognitive:deciding",
                action: {
                  type: "decision",
                  risk: riskMax ?? "low",
                  description: best?.description ?? "deciding",
                },
              },
              ctxForHook
            );
          }
          break;
        }
        case "executing": {
          if (beforeState._ !== "executing" && !emittedActingGate) {
            const step = state.plan.steps[state.step];
            await hooks.registry.emit(
              { type: "cognitive:acting", action: step?.action ?? "execute" },
              ctxForHook
            );
          }
          break;
        }
        case "reflecting": {
          if (beforeState._ !== "reflecting") {
            const out = state.outcome;
            const outcome: "success" | "failure" =
              out._ === "success"
                ? "success"
                : out._ === "partial"
                  ? out.completed.length >= out.failed.length
                    ? "success"
                    : "failure"
                  : "failure";
            await hooks.registry.emit(
              {
                type: "cognitive:learning",
                outcome,
                context: out._,
              },
              ctxForHook
            );
          }
          break;
        }
        default: {
          break;
        }
      }

      const beforeLevel = Number(beforeAutonomy.level);
      const afterLevel = Number(autonomy.level);
      if (Number.isFinite(beforeLevel) && Number.isFinite(afterLevel)) {
        if (Math.abs(beforeLevel - afterLevel) > 1e-6) {
          await hooks.registry.emit(
            {
              type: "cognitive:autonomy:change",
              fromLevel: beforeLevel,
              toLevel: afterLevel,
              reason: eventToApply._,
            },
            ctxForHook
          );
        }
      }

      const prevPhys = beforeState.physiology;
      const nextPhys = state.physiology;
      const energyTh = physiologyThresholds.energy;
      if (prevPhys.energy > energyTh && nextPhys.energy <= energyTh) {
        await hooks.registry.emit(
          {
            type: "cognitive:physiology:alert",
            metric: "energy",
            threshold: energyTh,
            value: nextPhys.energy,
          },
          ctxForHook
        );
      }
      const boredomTh = physiologyThresholds.boredom;
      if (prevPhys.boredom < boredomTh && nextPhys.boredom >= boredomTh) {
        await hooks.registry.emit(
          {
            type: "cognitive:physiology:alert",
            metric: "boredom",
            threshold: boredomTh,
            value: nextPhys.boredom,
          },
          ctxForHook
        );
      }
      const frTh = physiologyThresholds.frustration;
      if (prevPhys.frustration < frTh && nextPhys.frustration >= frTh) {
        await hooks.registry.emit(
          {
            type: "cognitive:physiology:alert",
            metric: "frustration",
            threshold: frTh,
            value: nextPhys.frustration,
          },
          ctxForHook
        );
      }
    } catch (error) {
      hooks.ctx.log.warn("hooks_cognitive_emit_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const stateWithAutonomy: SnapshotState = {
    ...(state as SnapshotState),
    autonomy,
  };

  // 3. Persist
  const envelope = wrapEventEnvelope({
    id: crypto.randomUUID(),
    type: eventToApply._,
    resource: "user",
    data: eventToApply,
  });
  await cognitiveRepo.appendEvent(streamId, eventToApply._, {
    v: envelope.v,
    id: envelope.id,
    type: envelope.type,
    createdAt: envelope.createdAt,
    resource: envelope.resource,
    data: envelope.data,
  });

  if (gateInterrupt) {
    const gateEnvelope = wrapEventEnvelope({
      id: crypto.randomUUID(),
      type: gateInterrupt._,
      resource: "user",
      data: gateInterrupt,
    });
    await cognitiveRepo.appendEvent(streamId, gateInterrupt._, {
      v: gateEnvelope.v,
      id: gateEnvelope.id,
      type: gateEnvelope.type,
      createdAt: gateEnvelope.createdAt,
      resource: gateEnvelope.resource,
      data: gateEnvelope.data,
    });
  }

  const effects = gatedMessage
    ? [
        {
          type: "generate_response",
          input: gatedMessage,
        } satisfies CognitiveEffect,
      ]
    : computeEffects(state);

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
