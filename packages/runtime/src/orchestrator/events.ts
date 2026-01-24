import type { Phase, StructuredPlan } from "@alfred/plan";
import type { WorkflowEvent } from "@alfred/type/plan";

import type { AgentOutcome } from "./agent.js";

export type PhaseResult = {
  status: "completed" | "failed" | "partial";
  outcomes: AgentOutcome[];
};

export function makePlanSelectedEvent(plan: StructuredPlan): WorkflowEvent {
  return {
    _: "plan-selected",
    plan,
  } as any;
}

export function makePhaseStartEvent(
  phaseId: string,
  phase: Phase
): WorkflowEvent {
  return {
    _: "phase-start",
    phaseId,
    phase,
  } as any;
}

export function makePhaseCompleteEvent(
  phaseId: string,
  result: PhaseResult
): WorkflowEvent {
  return {
    _: "phase-complete",
    phaseId,
    result,
  } as any;
}

export function makePhaseProgressEvent(
  phaseId: string,
  progress: number
): WorkflowEvent {
  return {
    _: "phase-progress",
    phaseId,
    progress,
  } as any;
}

export function makeAgentStartEvent(
  agentId: string,
  phaseId: string
): WorkflowEvent {
  return {
    _: "agent-start",
    agentId,
    phaseId,
  } as any;
}

export function makeAgentCompleteEvent(
  agentId: string,
  phaseId: string,
  result: AgentOutcome
): WorkflowEvent {
  return {
    _: "agent-complete",
    agentId,
    phaseId,
    result,
  } as any;
}

export function makeWaveStartEvent(waveId: string): WorkflowEvent {
  return {
    _: "wave-start",
    waveId,
  } as any;
}

export function makeWaveCompleteEvent(waveId: string): WorkflowEvent {
  return {
    _: "wave-complete",
    waveId,
  } as any;
}
