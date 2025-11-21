import type { SubTaskId } from "./decompose";
import type { AgentId, WaveId } from "./spawn";

export type AgentStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "stuck"
  | "paused";

export type AgentEvent =
  | { type: "codex/thought"; agentId: AgentId; text: string; ts: number }
  | {
      type: "codex/command";
      agentId: AgentId;
      command: string;
      status: "running" | "completed" | "failed";
      ts: number;
    }
  | { type: "codex/file"; agentId: AgentId; path: string; kind: string; ts: number }
  | { type: "notice"; agentId: AgentId; message: string; ts: number };

export type TrackerAgentState = {
  subTaskId: SubTaskId;
  status: AgentStatus;
  lastEventTs: number;
  commands: string[];
  filesChanged: string[];
  loopScore: number;
};

export type TrackerWaveState = {
  status: "pending" | "running" | "completed" | "failed";
};

export type TrackerState = {
  agents: Record<AgentId, TrackerAgentState>;
  waves: Record<WaveId, TrackerWaveState>;
};

function cloneState(state: TrackerState): TrackerState {
  const agents: Record<AgentId, TrackerAgentState> = {};
  for (const [id, value] of Object.entries(state.agents)) {
    agents[id as AgentId] = { ...value, commands: [...value.commands], filesChanged: [...value.filesChanged] };
  }

  const waves: Record<WaveId, TrackerWaveState> = {};
  for (const [id, value] of Object.entries(state.waves)) {
    waves[id as WaveId] = { ...value };
  }

  return { agents, waves };
}

function ensureAgent(state: TrackerState, agentId: AgentId, subTaskId?: SubTaskId, ts?: number): void {
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
    commands: [],
    filesChanged: [],
    loopScore: 0,
  };
}

function normaliseTime(ts: number | undefined): number {
  if (!ts || !Number.isFinite(ts)) return Date.now();
  return ts;
}

export function updateTracker(state: TrackerState, event: AgentEvent): TrackerState {
  const next = cloneState(state);
  const ts = normaliseTime(event.ts);

  switch (event.type) {
    case "codex/thought": {
      ensureAgent(next, event.agentId, undefined, ts);
      const agent = next.agents[event.agentId];
      if (!agent) break;
      agent.status = agent.status === "created" ? "running" : agent.status;
      agent.lastEventTs = ts;
      agent.loopScore = Math.max(0, agent.loopScore - 0.1);
      break;
    }
    case "codex/command": {
      ensureAgent(next, event.agentId, undefined, ts);
      const agent = next.agents[event.agentId];
      if (!agent) break;
      agent.lastEventTs = ts;
      agent.commands.push(event.command);
      if (event.status === "completed") {
        agent.status = "completed";
      } else if (event.status === "failed") {
        agent.status = "failed";
      } else if (agent.status === "created") {
        agent.status = "running";
      }
      agent.loopScore += 1;
      break;
    }
    case "codex/file": {
      ensureAgent(next, event.agentId, undefined, ts);
      const agent = next.agents[event.agentId];
      if (!agent) break;
      agent.lastEventTs = ts;
      agent.filesChanged.push(event.path);
      agent.loopScore += 0.5;
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

export function detectStuck(
  state: TrackerState,
  agentId: AgentId,
  now: number,
  opts?: {
    noProgressMs?: number;
    maxRepeats?: number;
    maxFileFlipFlops?: number;
  }
): boolean {
  const agent = state.agents[agentId];
  if (!agent) return false;

  const noProgressMs = opts?.noProgressMs ?? 120_000;
  const maxRepeats = opts?.maxRepeats ?? 5;
  const maxFileFlipFlops = opts?.maxFileFlipFlops ?? 4;

  // 1) Time-based: no events for too long
  if (now - agent.lastEventTs > noProgressMs) {
    return true;
  }

  // 2) Command repetition: last N commands identical
  if (agent.commands.length >= maxRepeats) {
    const tail = agent.commands.slice(-maxRepeats);
    const first = tail[0];
    if (first && tail.every((cmd) => cmd === first)) {
      return true;
    }
  }

  // 3) File flip-flops: same file touched too many times
  if (agent.filesChanged.length > 0) {
    const counts = new Map<string, number>();
    for (const path of agent.filesChanged) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    for (const value of counts.values()) {
      if (value > maxFileFlipFlops) {
        return true;
      }
    }
  }

  return false;
}

export function detectNeedsGuidance(
  state: TrackerState,
  agentId: AgentId,
  thoughts: string[]
): boolean {
  const agent = state.agents[agentId];
  if (!agent) return false;

  if (!Array.isArray(thoughts) || thoughts.length === 0) {
    return false;
  }

  const text = thoughts.join(" ").toLowerCase();

  const patterns = [
    "unsure how to proceed",
    "not sure how to proceed",
    "need guidance",
    "need clarification",
    "uncertain about next step",
    "waiting for instructions",
    "awaiting approval",
  ];

  return patterns.some((p) => text.includes(p));
}

export const __internals = {
  cloneState,
  ensureAgent,
  normaliseTime,
};
