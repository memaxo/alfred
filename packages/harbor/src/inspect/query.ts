/**
 * Query functions for ATIF trajectories
 */

import type {
  AtifStep,
  AtifTrajectory,
  PhaseInfo,
  PlanInfo,
  ResolvedToolCall,
  StepFilter,
  WaveInfo,
} from "../types.js";

/**
 * Query steps matching a filter
 */
export function querySteps(
  traj: AtifTrajectory,
  filter?: StepFilter
): AtifStep[] {
  if (!filter) {
    return traj.steps;
  }

  return traj.steps.filter((step) => {
    if (filter.source && step.source !== filter.source) {
      return false;
    }
    if (filter.hasToolCalls !== undefined) {
      const hasCalls = (step.tool_calls?.length ?? 0) > 0;
      if (filter.hasToolCalls !== hasCalls) {
        return false;
      }
    }
    if (filter.hasObservation !== undefined) {
      const hasObs = (step.observation?.results?.length ?? 0) > 0;
      if (filter.hasObservation !== hasObs) {
        return false;
      }
    }
    if (
      filter.messageContains &&
      !step.message?.includes(filter.messageContains)
    ) {
      return false;
    }
    if (filter.eventType) {
      const stepEventType = step.extra?.eventType as string | undefined;
      if (stepEventType !== filter.eventType) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Query all tool calls in trajectory, optionally filtered by tool name
 */
export function queryToolCalls(
  traj: AtifTrajectory,
  toolName?: string
): ResolvedToolCall[] {
  const results: ResolvedToolCall[] = [];
  const resultsByCallId = new Set<string>();

  // First pass: collect all observation call IDs
  for (const step of traj.steps) {
    if (step.observation?.results) {
      for (const result of step.observation.results) {
        resultsByCallId.add(result.source_call_id);
      }
    }
  }

  // Second pass: collect tool calls
  for (const step of traj.steps) {
    if (!step.tool_calls) {
      continue;
    }
    for (const call of step.tool_calls) {
      if (toolName && call.function_name !== toolName) {
        continue;
      }
      results.push({
        ...call,
        stepId: step.step_id,
        timestamp: step.timestamp,
        hasResult: resultsByCallId.has(call.tool_call_id),
      });
    }
  }

  return results;
}

/**
 * Extract wave information from trajectory
 */
export function extractWaves(traj: AtifTrajectory): WaveInfo[] {
  const waveMap = new Map<string, WaveInfo>();

  for (const step of traj.steps) {
    const msg = step.message ?? "";
    const extra = step.extra ?? {};

    // Check for wave-start message pattern
    if (msg.includes("wave_") && msg.includes("_start")) {
      const match = msg.match(/wave_(\w+)_start/);
      if (match?.[1]) {
        const waveId = match[1];
        waveMap.set(waveId, {
          waveId,
          startStepId: step.step_id,
          agents: [],
          status: "running",
        });
      }
    }

    // Check for wave-complete message pattern
    if (msg.includes("wave_") && msg.includes("_complete")) {
      const match = msg.match(/wave_(\w+)/);
      if (match?.[1]) {
        const waveId = match[1];
        const wave = waveMap.get(waveId);
        if (wave) {
          wave.endStepId = step.step_id;
          wave.status = "completed";
        }
      }
    }

    // Check for eventType in extra
    const eventType = extra.eventType as string | undefined;
    if (eventType === "wave-start") {
      const waveId = extra.waveId as string | undefined;
      if (waveId) {
        waveMap.set(waveId, {
          waveId,
          startStepId: step.step_id,
          agents: [],
          status: "running",
        });
      }
    }
    if (eventType === "wave-complete") {
      const waveId = extra.waveId as string | undefined;
      if (waveId) {
        const wave = waveMap.get(waveId);
        if (wave) {
          wave.endStepId = step.step_id;
          wave.status = "completed";
        }
      }
    }
  }

  return Array.from(waveMap.values());
}

/**
 * Extract phase information from trajectory
 */
export function extractPhases(traj: AtifTrajectory): PhaseInfo[] {
  const phaseMap = new Map<string, PhaseInfo>();

  for (const step of traj.steps) {
    const extra = step.extra ?? {};
    const eventType = extra.eventType as string | undefined;

    if (eventType === "phase-start") {
      const phaseId = extra.phaseId as string | undefined;
      if (phaseId) {
        phaseMap.set(phaseId, {
          phaseId,
          startStepId: step.step_id,
          status: "running",
        });
      }
    }
    if (eventType === "phase-complete") {
      const phaseId = extra.phaseId as string | undefined;
      if (phaseId) {
        const phase = phaseMap.get(phaseId);
        if (phase) {
          phase.endStepId = step.step_id;
          phase.status = "completed";
        }
      }
    }
  }

  return Array.from(phaseMap.values());
}

/**
 * Extract plan information from trajectory
 */
export function extractPlan(traj: AtifTrajectory): PlanInfo | null {
  for (const step of traj.steps) {
    const extra = step.extra ?? {};
    const eventType = extra.eventType as string | undefined;

    if (eventType === "plan-selected") {
      const plan = extra.plan as Record<string, unknown> | undefined;
      if (plan) {
        const phases = (plan.phases ?? []) as Array<{
          tasks?: unknown[];
          deps?: unknown[];
        }>;
        let subtaskCount = 0;
        let hasDependencies = false;

        for (const phase of phases) {
          subtaskCount += phase.tasks?.length ?? 0;
          if ((phase.deps?.length ?? 0) > 0) {
            hasDependencies = true;
          }
        }

        return {
          planId: plan.id as string | undefined,
          subtaskCount,
          hasDependencies,
          hasEstimates: false, // TODO: Check for estimates in plan
        };
      }
    }
  }

  return null;
}
