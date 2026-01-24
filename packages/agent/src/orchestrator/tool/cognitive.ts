/**
 * Cognitive State Tool
 * Exposes cognitive state query capabilities as an agent tool
 */

import { unwrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import {
  type AutonomyGradient,
  type CognitiveState,
  type Event,
} from "@alfred/cognitive/state";
import { idle, initialAutonomy } from "@alfred/cognitive/state";
import { applyTransition } from "@alfred/cognitive/transition";
import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { z } from "zod";

import { withPolicyApproval, type AITool } from "./approval.js";
import { type ToolExecuteArgs } from "./shared/context.js";

// ============================================================================
// Schemas
// ============================================================================

const cognitiveStateInputSchema = z.object({
  authz: z.string().optional().describe("Authorization token"),
  metric: z
    .enum(["energy", "boredom", "frustration", "autonomy", "all"])
    .optional()
    .describe("Specific metric to query (default: all)"),
  streamId: z.string().min(1).describe("Cognitive stream ID (e.g., thread ID)"),
});

const cognitiveStateOutputSchema = z.object({
  autonomy: z.object({
    level: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    alpha: z.number(),
    beta: z.number(),
  }),
  physiology: z.object({
    energy: z.number().min(0).max(1),
    boredom: z.number().min(0).max(1),
    frustration: z.number().min(0).max(1),
  }),
  since: z.number().describe("Timestamp of current state start"),
  state: z.enum([
    "idle",
    "capturing",
    "thinking",
    "deciding",
    "executing",
    "reflecting",
  ]),
});

export type CognitiveStateInput = z.infer<typeof cognitiveStateInputSchema>;
export type CognitiveStateOutput = z.infer<typeof cognitiveStateOutputSchema>;

// ============================================================================
// Policy Enforcement
// ============================================================================

/**
 * Enforce policy for cognitive_state (read-only)
 * Scope: cognitive.read
 * Autonomy: read (0.0-0.3)
 */
async function enforceCognitiveStatePolicy(
  input: CognitiveStateInput
): Promise<void> {
  await requireToolScopesAndPolicy(input.authz, ["cognitive.read"], {
    action: "cognitive.query",
    resource: {
      id: input.streamId,
      kind: "cognitive",
    },
  });
}

// ============================================================================
// Execution Logic
// ============================================================================

// Type guard for snapshot state with optional autonomy
type SnapshotState = CognitiveState & { autonomy?: AutonomyGradient };

/**
 * Type guards for event validation
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEventLike(value: unknown): value is { _: string } {
  return isRecord(value) && typeof value._ === "string";
}

/**
 * Replay events to reconstruct state
 * Applies transitions sequentially without recording metrics
 */
function replayEvents(
  state: CognitiveState,
  autonomy: AutonomyGradient,
  events: Awaited<ReturnType<typeof cognitiveRepo.getAllEvents>>
): { state: CognitiveState; autonomy: AutonomyGradient } {
  for (const record of events) {
    const unwrapped = unwrapEventEnvelope(record.payload);
    if (!isEventLike(unwrapped.data)) {
      continue;
    }
    const historicalEvent = unwrapped.data as Event;
    const result = applyTransition(state, autonomy, historicalEvent);
    ({ state } = result);
    ({ autonomy } = result);
  }
  return { autonomy, state };
}

/**
 * Reconstruct cognitive state from snapshot + events
 * Follows the same pattern as runCognitiveLoop but without persisting new events
 */
async function reconstructState(
  streamId: string
): Promise<{ state: CognitiveState; autonomy: AutonomyGradient }> {
  // Try to load from snapshot first
  const snapshot = await cognitiveRepo.getLatestSnapshot(streamId);

  if (snapshot) {
    // Snapshot state may include autonomy gradient for fast hydration
    // Type assertion needed because snapshot.state is Record<string, unknown>
    const snapState = snapshot.state as SnapshotState;
    const state = snapState;
    const autonomy = snapState.autonomy ?? initialAutonomy(Date.now());

    // Only replay events since the snapshot
    const events = await cognitiveRepo.getEventsSince(
      streamId,
      snapshot.createdAt
    );
    return replayEvents(state, autonomy, events);
  }

  // No snapshot: start from idle and replay all events
  const state = idle(Date.now());
  const autonomy = initialAutonomy(Date.now());
  const events = await cognitiveRepo.getAllEvents(streamId);
  return replayEvents(state, autonomy, events);
}

/**
 * Extract timestamp from state
 */
function getStateSince(state: CognitiveState): number {
  if (state._ === "idle") {
    return state.since;
  }
  if (
    state._ === "capturing" ||
    state._ === "thinking" ||
    state._ === "executing"
  ) {
    return state.started;
  }
  if (state._ === "deciding") {
    // Deciding state has deadline (now + 5000ms), estimate start as deadline - 5000ms
    // Use current time if deadline is in the past (shouldn't happen but safe fallback)
    const { deadline } = state;
    const estimatedStart = deadline - 5000;
    return estimatedStart > 0 ? estimatedStart : Date.now();
  }
  // reflecting - use current time as fallback
  return Date.now();
}

/**
 * Zero values for filtering
 */
const zeroPhysiology = {
  boredom: 0,
  energy: 0,
  frustration: 0,
};

const zeroAutonomy = {
  alpha: 0,
  beta: 0,
  confidence: 0,
  level: 0,
};

/**
 * Filter output by metric type
 * Returns output with only the requested metric populated
 */
function filterMetricsByType(
  output: CognitiveStateOutput,
  metric: "energy" | "boredom" | "frustration" | "autonomy"
): CognitiveStateOutput {
  switch (metric) {
    case "energy": {
      return {
        ...output,
        physiology: {
          energy: output.physiology.energy,
          boredom: 0,
          frustration: 0,
        },
        autonomy: zeroAutonomy,
      };
    }
    case "boredom": {
      return {
        ...output,
        physiology: {
          energy: 0,
          boredom: output.physiology.boredom,
          frustration: 0,
        },
        autonomy: zeroAutonomy,
      };
    }
    case "frustration": {
      return {
        ...output,
        physiology: {
          energy: 0,
          boredom: 0,
          frustration: output.physiology.frustration,
        },
        autonomy: zeroAutonomy,
      };
    }
    case "autonomy": {
      return {
        ...output,
        physiology: zeroPhysiology,
      };
    }
  }
}

/**
 * Execute cognitive_state query
 */
async function executeCognitiveState(
  input: CognitiveStateInput
): Promise<CognitiveStateOutput> {
  try {
    const { state, autonomy } = await reconstructState(input.streamId);

    const since = getStateSince(state);
    const stateName = state._;

    // Build base output
    const output: CognitiveStateOutput = {
      autonomy: {
        level: autonomy.level,
        confidence: autonomy.confidence,
        alpha: autonomy.prior.alpha,
        beta: autonomy.prior.beta,
      },
      physiology: {
        energy: state.physiology.energy,
        boredom: state.physiology.boredom,
        frustration: state.physiology.frustration,
      },
      since,
      state: stateName,
    };

    // Filter by metric if specified
    if (input.metric && input.metric !== "all") {
      return filterMetricsByType(output, input.metric);
    }

    return output;
  } catch (error) {
    logger.error("cognitive_state_query_failed", {
      error: error instanceof Error ? error.message : String(error),
      streamId: input.streamId,
    });
    throw new Error(
      `cognitive_state_query_failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
}

// ============================================================================
// Tool Export
// ============================================================================

export const toolCognitiveState = {
  description:
    "Query current cognitive state including physiology (energy, boredom, frustration) and autonomy level. Returns state machine state, physiological metrics, and autonomy gradient with Beta prior.",
  execute: async ({ input }: ToolExecuteArgs<CognitiveStateInput>) => {
    await enforceCognitiveStatePolicy(input);
    return executeCognitiveState(input);
  },
  inputSchema: cognitiveStateInputSchema,
  name: "cognitive_state",
  outputSchema: cognitiveStateOutputSchema,
};

const aiToolCognitiveStateBase = {
  description: toolCognitiveState.description,
  execute: async (input: CognitiveStateInput) =>
    toolCognitiveState.execute({ input }),
  inputSchema: toolCognitiveState.inputSchema,
  name: toolCognitiveState.name,
  parameters: toolCognitiveState.inputSchema,
};

export const aiToolCognitiveState: AITool<CognitiveStateInput, any> =
  withPolicyApproval(
    aiToolCognitiveStateBase,
    (input: CognitiveStateInput) => ({
      action: "cognitive.query",
      authz: input.authz,
      resource: {
        kind: "cognitive",
        id: input.streamId,
      },
      scopes: ["cognitive.read"],
    })
  );

export type ToolCognitiveState = typeof toolCognitiveState;
