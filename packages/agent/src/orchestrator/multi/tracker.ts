import { LoopDetector } from "@alfred/cognitive";
import type { SubTask, SubTaskId } from "./decompose";
import type { AgentId, WaveId } from "./spawn";

/**
 * Configuration options for stuck detection thresholds.
 * All thresholds can be tuned per-workflow or via environment variables.
 */
export type StuckDetectionOptions = {
  /** Time in milliseconds without events before agent is considered stuck (default: 60000) */
  noProgressMs?: number;
  /** Maximum transitions before agent is considered stuck (default: 200) */
  maxTransitions?: number;
  /** Similarity threshold for semantic loop detection (default: 0.92) */
  similarityThreshold?: number;
};

/**
 * Get stuck detection defaults from environment variables.
 * Falls back to hardcoded defaults if env vars not set.
 */
export function getStuckDetectionDefaults(): Required<StuckDetectionOptions> {
  return {
    noProgressMs: Number.parseInt(
      process.env.STUCK_NO_PROGRESS_MS ?? "60000",
      10
    ),
    maxTransitions: Number.parseInt(
      process.env.STUCK_MAX_TRANSITIONS ?? "200",
      10
    ),
    similarityThreshold: Number.parseFloat(
      process.env.STUCK_SIMILARITY_THRESHOLD ?? "0.92"
    ),
  };
}

export type AgentStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "stuck"
  | "paused";

export type AgentEvent =
  | {
      type: "codex/thought";
      agentId: AgentId;
      text: string;
      ts: number;
      embedding?: number[];
    }
  | {
      type: "codex/command";
      agentId: AgentId;
      command: string;
      status: "running" | "completed" | "failed";
      ts: number;
    }
  | {
      type: "codex/file";
      agentId: AgentId;
      path: string;
      kind: string;
      ts: number;
    }
  | { type: "notice"; agentId: AgentId; message: string; ts: number };

export type TrackerAgentState = {
  subTaskId: SubTaskId;
  status: AgentStatus;
  lastEventTs: number;
};

export type TrackerWaveState = {
  status: "pending" | "running" | "completed" | "failed";
};

export type TrackerState = {
  agents: Record<AgentId, TrackerAgentState>;
  waves: Record<WaveId, TrackerWaveState>;
};

/**
 * Encapsulated tracker context for a single workflow.
 * Contains all state needed for tracking agent progress and dependencies.
 */
export type TrackerContext = {
  state: TrackerState;
  /** Reverse dependency index: task ID → tasks that depend on it */
  blockedBy: Map<SubTaskId, Set<SubTaskId>>;
  /** Forward dependency index: task ID → its dependencies */
  dependsOn: Map<SubTaskId, Set<SubTaskId>>;
  /** Per-agent loop detectors */
  detectors: Map<AgentId, LoopDetector>;
  /** Stuck detection options */
  options: Required<StuckDetectionOptions>;
};

/**
 * Create a new tracker context for a workflow.
 * Initializes dependency indices from subtasks.
 */
export function createTrackerContext(
  tasks: SubTask[],
  options?: StuckDetectionOptions
): TrackerContext {
  const defaults = getStuckDetectionDefaults();
  const blockedBy = new Map<SubTaskId, Set<SubTaskId>>();
  const dependsOn = new Map<SubTaskId, Set<SubTaskId>>();

  for (const task of tasks) {
    dependsOn.set(task.id, new Set(task.deps));
    for (const dep of task.deps) {
      const blocked = blockedBy.get(dep) ?? new Set();
      blocked.add(task.id);
      blockedBy.set(dep, blocked);
    }
  }

  return {
    state: { agents: {}, waves: {} },
    blockedBy,
    dependsOn,
    detectors: new Map(),
    options: {
      noProgressMs: options?.noProgressMs ?? defaults.noProgressMs,
      maxTransitions: options?.maxTransitions ?? defaults.maxTransitions,
      similarityThreshold:
        options?.similarityThreshold ?? defaults.similarityThreshold,
    },
  };
}

/**
 * Clone a tracker context (deep copy of mutable state).
 */
export function cloneTrackerContext(ctx: TrackerContext): TrackerContext {
  return {
    state: cloneState(ctx.state),
    blockedBy: new Map(
      Array.from(ctx.blockedBy.entries()).map(([k, v]) => [k, new Set(v)])
    ),
    dependsOn: new Map(
      Array.from(ctx.dependsOn.entries()).map(([k, v]) => [k, new Set(v)])
    ),
    detectors: ctx.detectors, // Detectors are mutable singletons, shared intentionally
    options: { ...ctx.options },
  };
}

/**
 * Reset a tracker context (clear all state but keep options).
 */
export function resetTrackerContext(ctx: TrackerContext): TrackerContext {
  for (const detector of ctx.detectors.values()) {
    detector.reset();
  }
  return {
    state: { agents: {}, waves: {} },
    blockedBy: new Map(),
    dependsOn: new Map(),
    detectors: new Map(),
    options: ctx.options,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function getOrCreateDetector(
  ctx: TrackerContext,
  agentId: AgentId
): LoopDetector {
  let detector = ctx.detectors.get(agentId);
  if (!detector) {
    detector = new LoopDetector({
      maxTransitions: ctx.options.maxTransitions,
      stallMs: ctx.options.noProgressMs,
      similarityThreshold: ctx.options.similarityThreshold,
      windowSize: 8,
    });
    ctx.detectors.set(agentId, detector);
  }
  return detector;
}

function cloneState(state: TrackerState): TrackerState {
  const agents: Record<AgentId, TrackerAgentState> = {};
  for (const [id, value] of Object.entries(state.agents)) {
    agents[id as AgentId] = { ...value };
  }

  const waves: Record<WaveId, TrackerWaveState> = {};
  for (const [id, value] of Object.entries(state.waves)) {
    waves[id as WaveId] = { ...value };
  }

  return { agents, waves };
}

function ensureAgent(
  state: TrackerState,
  agentId: AgentId,
  subTaskId?: SubTaskId,
  ts?: number
): void {
  const existing = state.agents[agentId];
  if (existing) {
    if (ts && ts > existing.lastEventTs) {
      existing.lastEventTs = ts;
    }
    return;
  }
  state.agents[agentId] = {
    subTaskId: subTaskId ?? ("" as SubTaskId),
    status: "created",
    lastEventTs: ts ?? 0,
  };
}

function normaliseTime(ts: number | undefined): number {
  if (!(ts && Number.isFinite(ts))) {
    return Date.now();
  }
  return ts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context-aware tracker functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update tracker state within a context.
 */
export function updateTrackerWithContext(
  ctx: TrackerContext,
  event: AgentEvent
): TrackerContext {
  const next = cloneTrackerContext(ctx);
  const ts = normaliseTime(event.ts);
  const detector = getOrCreateDetector(next, event.agentId);

  switch (event.type) {
    case "codex/thought": {
      ensureAgent(next.state, event.agentId, undefined, ts);
      const agent = next.state.agents[event.agentId];
      if (!agent) {
        break;
      }

      agent.status = agent.status === "created" ? "running" : agent.status;
      agent.lastEventTs = ts;

      const result = detector.check(event.text, event.embedding ?? null);
      if (result.loop) {
        agent.status = "stuck";
      }
      break;
    }
    case "codex/command": {
      ensureAgent(next.state, event.agentId, undefined, ts);
      const agent = next.state.agents[event.agentId];
      if (!agent) {
        break;
      }

      agent.lastEventTs = ts;

      const result = detector.check(event.command, null);
      if (result.loop) {
        agent.status = "stuck";
      } else if (event.status === "completed") {
        agent.status = "completed";
      } else if (event.status === "failed") {
        agent.status = "failed";
      } else if (agent.status === "created") {
        agent.status = "running";
      }
      break;
    }
    case "codex/file": {
      ensureAgent(next.state, event.agentId, undefined, ts);
      const agent = next.state.agents[event.agentId];
      if (!agent) {
        break;
      }

      agent.lastEventTs = ts;

      const result = detector.check(event.path, null);
      if (result.loop) {
        agent.status = "stuck";
      }
      break;
    }
    case "notice": {
      ensureAgent(next.state, event.agentId, undefined, ts);
      const agent = next.state.agents[event.agentId];
      if (!agent) {
        break;
      }

      agent.lastEventTs = ts;
      break;
    }
  }

  return next;
}

/**
 * Detect if an agent is stuck.
 */
export function detectStuckWithContext(
  ctx: TrackerContext,
  agentId: AgentId,
  now: number
): boolean {
  const agent = ctx.state.agents[agentId];
  if (!agent) {
    return false;
  }

  if (agent.status === "stuck") {
    return true;
  }

  if (now - agent.lastEventTs > ctx.options.noProgressMs) {
    return true;
  }

  return false;
}

/**
 * Get tasks blocked by a given task.
 */
export function getBlockedTasksWithContext(
  ctx: TrackerContext,
  taskId: SubTaskId
): SubTaskId[] {
  return Array.from(ctx.blockedBy.get(taskId) ?? []);
}

/**
 * Check if all dependencies of a task are completed.
 */
export function areAllDepsCompletedWithContext(
  ctx: TrackerContext,
  taskId: SubTaskId
): boolean {
  const deps = ctx.dependsOn.get(taskId);
  if (!deps || deps.size === 0) {
    return true;
  }

  for (const depId of deps) {
    const agentEntry = Object.entries(ctx.state.agents).find(
      ([_, agent]) => agent.subTaskId === depId
    );
    if (!agentEntry) {
      return false;
    }
    const [_, agent] = agentEntry;
    if (agent.status !== "completed") {
      return false;
    }
  }

  return true;
}

/**
 * Propagate task completion to unblock dependent tasks.
 * Returns updated context and list of unblocked tasks.
 */
export function propagateCompletionWithContext(
  ctx: TrackerContext,
  completedTaskId: SubTaskId
): { unblockedTasks: SubTaskId[]; ctx: TrackerContext } {
  const next = cloneTrackerContext(ctx);
  const unblocked: SubTaskId[] = [];

  const dependents = next.blockedBy.get(completedTaskId) ?? new Set();

  for (const dependentId of dependents) {
    const agentEntry = Object.entries(next.state.agents).find(
      ([_, agent]) => agent.subTaskId === dependentId
    );

    if (!agentEntry) {
      continue;
    }

    const [agentId, agent] = agentEntry;

    if (agent.status !== "paused" && agent.status !== "created") {
      continue;
    }

    if (areAllDepsCompletedWithContext(next, dependentId)) {
      unblocked.push(dependentId);
      next.state.agents[agentId as AgentId] = {
        ...agent,
        status: "created",
      };
    }
  }

  return { unblockedTasks: unblocked, ctx: next };
}

/**
 * Clear detector for an agent within context.
 */
export function clearAgentDetectorWithContext(
  ctx: TrackerContext,
  agentId: AgentId
): void {
  const detector = ctx.detectors.get(agentId);
  if (detector) {
    detector.reset();
    ctx.detectors.delete(agentId);
  }
}

/**
 * Clear all detectors within context.
 */
export function clearAllDetectorsWithContext(ctx: TrackerContext): void {
  for (const detector of ctx.detectors.values()) {
    detector.reset();
  }
  ctx.detectors.clear();
}

export const __internals = {
  cloneState,
  ensureAgent,
  normaliseTime,
  getOrCreateDetector,
};
