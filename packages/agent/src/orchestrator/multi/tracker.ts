import { LoopDetector } from "@alfred/cognitive";
import type { SubTaskId } from "./decompose";
import type { AgentId, WaveId } from "./spawn";

/**
 * Configuration options for stuck detection thresholds.
 * All thresholds can be tuned per-workflow or via environment variables.
 */
export type StuckDetectionOptions = {
  /** Time in milliseconds without events before agent is considered stuck (default: 120000) */
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
      process.env.STUCK_NO_PROGRESS_MS ?? "120000",
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
  | { type: "codex/thought"; agentId: AgentId; text: string; ts: number; embedding?: number[] }
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

// Per-agent loop detectors (not serialized with state)
const agentDetectors = new Map<AgentId, LoopDetector>();

function getOrCreateDetector(agentId: AgentId, opts?: StuckDetectionOptions): LoopDetector {
  let detector = agentDetectors.get(agentId);
  if (!detector) {
    const defaults = getStuckDetectionDefaults();
    detector = new LoopDetector({
      maxTransitions: opts?.maxTransitions ?? defaults.maxTransitions,
      stallMs: opts?.noProgressMs ?? defaults.noProgressMs,
      similarityThreshold: opts?.similarityThreshold ?? defaults.similarityThreshold,
      windowSize: 8,
    });
    agentDetectors.set(agentId, detector);
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

export function updateTracker(
  state: TrackerState,
  event: AgentEvent
): TrackerState {
  const next = cloneState(state);
  const ts = normaliseTime(event.ts);
  const detector = getOrCreateDetector(event.agentId);

  switch (event.type) {
    case "codex/thought": {
      ensureAgent(next, event.agentId, undefined, ts);
      const agent = next.agents[event.agentId];
      if (!agent) break;

      agent.status = agent.status === "created" ? "running" : agent.status;
      agent.lastEventTs = ts;

      // Check for loops via detector
      const result = detector.check(event.text, event.embedding ?? null);
      if (result.loop) {
        agent.status = "stuck";
      }
      break;
    }
    case "codex/command": {
      ensureAgent(next, event.agentId, undefined, ts);
      const agent = next.agents[event.agentId];
      if (!agent) break;

      agent.lastEventTs = ts;

      // Check for command loops via detector
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
      ensureAgent(next, event.agentId, undefined, ts);
      const agent = next.agents[event.agentId];
      if (!agent) break;

      agent.lastEventTs = ts;

      // Check for file path loops via detector
      const result = detector.check(event.path, null);
      if (result.loop) {
        agent.status = "stuck";
      }
      break;
    }
    case "notice": {
      ensureAgent(next, event.agentId, undefined, ts);
      const agent = next.agents[event.agentId];
      if (!agent) break;

      agent.lastEventTs = ts;
      break;
    }
  }

  return next;
}

/**
 * Detect if an agent is stuck using the LoopDetector.
 *
 * Checks:
 * 1. Time-based: no events for too long
 * 2. Transition count exceeded
 * 3. Exact content repetition (hash)
 * 4. Semantic similarity (embeddings)
 */
export function detectStuck(
  state: TrackerState,
  agentId: AgentId,
  now: number,
  opts?: StuckDetectionOptions
): boolean {
  const agent = state.agents[agentId];
  if (!agent) {
    return false;
  }

  // Check if already marked as stuck
  if (agent.status === "stuck") {
    return true;
  }

  const defaults = getStuckDetectionDefaults();
  const noProgressMs = opts?.noProgressMs ?? defaults.noProgressMs;

  // Time-based check (separate from LoopDetector for external timestamp)
  if (now - agent.lastEventTs > noProgressMs) {
    return true;
  }

  // Detector-based checks happen during updateTracker
  // If status is stuck, detector already found a loop
  return false;
}

/**
 * Clear detector state for an agent (call when agent completes or is reset).
 */
export function clearAgentDetector(agentId: AgentId): void {
  const detector = agentDetectors.get(agentId);
  if (detector) {
    detector.reset();
    agentDetectors.delete(agentId);
  }
}

/**
 * Clear all agent detectors (call when workflow completes).
 */
export function clearAllDetectors(): void {
  for (const detector of agentDetectors.values()) {
    detector.reset();
  }
  agentDetectors.clear();
}

export const __internals = {
  cloneState,
  ensureAgent,
  normaliseTime,
  getOrCreateDetector,
};
