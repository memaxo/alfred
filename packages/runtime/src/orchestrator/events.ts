import type { Phase, StructuredPlan } from "@alfred/plan";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { AgentOutcome } from "./agent.js";

export type PhaseResult = {
  status: "completed" | "failed" | "partial";
  outcomes: AgentOutcome[];
};

export function makePlanSelectedEvent(plan: StructuredPlan): WorkflowEvent {
  return {
    type: "plan-selected",
    plan,
  } as any;
}

export function makePhaseStartEvent(
  phaseId: string,
  phase: Phase
): WorkflowEvent {
  return {
    type: "phase-start",
    phaseId,
    phase,
  } as any;
}

export function makePhaseCompleteEvent(
  phaseId: string,
  result: PhaseResult
): WorkflowEvent {
  return {
    type: "phase-complete",
    phaseId,
    result,
  } as any;
}

export function makePhaseProgressEvent(
  phaseId: string,
  progress: number
): WorkflowEvent {
  return {
    type: "phase-progress",
    phaseId,
    progress,
  } as any;
}

export function makeAgentStartEvent(
  agentId: string,
  phaseId: string
): WorkflowEvent {
  return {
    type: "agent-start",
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
    type: "agent-complete",
    agentId,
    phaseId,
    result,
  } as any;
}

export function makeWaveStartEvent(waveId: string): WorkflowEvent {
  return {
    type: "wave-start",
    waveId,
  } as any;
}

export function makeWaveCompleteEvent(waveId: string): WorkflowEvent {
  return {
    type: "wave-complete",
    waveId,
  } as any;
}
