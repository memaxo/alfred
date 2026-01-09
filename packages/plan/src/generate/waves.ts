import type { WavePlan } from "@alfred/type/plan";
import type { Phase, StructuredPlan } from "../types.js";

/**
 * Configuration for wave generation
 */
export type WaveGenerationOptions = {
  /** Max agents per wave for parallelism */
  maxConcurrency?: number;
  /** Force sequential execution */
  forceSequential?: boolean;
};

/**
 * Helper: Group phases by agent type with concurrency limit
 */
type PhaseGroup = {
  agentType: Phase["agentType"];
  phases: Phase[];
};

/**
 * Convert a StructuredPlan to WavePlan array for execution
 * This is the adapter layer that bridges planning and execution
 */
export function planToWaves(
  plan: StructuredPlan,
  options?: WaveGenerationOptions
): WavePlan[] {
  const maxConcurrency = options?.maxConcurrency ?? 3;

  switch (plan.resources.strategy) {
    case "sequential":
      return generateSequentialWaves(plan);
    case "parallel":
      return generateParallelWaves(plan, maxConcurrency);
    case "topological":
      return generateTopologicalWaves(plan);
    case "mixed":
      return generateMixedWaves(plan, maxConcurrency);
    default:
      throw new Error(`Unknown strategy: ${plan.resources.strategy}`);
  }
}

function generateSequentialWaves(plan: StructuredPlan): WavePlan[] {
  const waves: WavePlan[] = [];
  const waveMap = new Map<string, string>();

  for (const phase of plan.phases) {
    const depWaveIds: string[] = [];
    for (const depPhaseId of phase.dependsOn) {
      const depWaveId = waveMap.get(depPhaseId);
      if (depWaveId) {
        depWaveIds.push(depWaveId);
      }
    }

    const waveId = `wave-${phase.id}`;
    waveMap.set(phase.id, waveId);
    waves.push({
      id: waveId,
      agents: phase.tasks.map((t) => t.id),
      dependsOn: depWaveIds,
      agentType: phase.agentType,
      isolation: plan.resources.isolation,
      phaseId: phase.id,
    });
  }

  return waves;
}

function generateParallelWaves(
  plan: StructuredPlan,
  maxConcurrency: number
): WavePlan[] {
  const waves: WavePlan[] = [];
  const processed = new Set<string>();
  const remaining = new Set(plan.phases.map((p) => p.id));

  while (remaining.size > 0) {
    const readyPhases = plan.phases.filter(
      (p) =>
        remaining.has(p.id) &&
        p.dependsOn.every((dep) => !remaining.has(dep) && processed.has(dep))
    );

    if (readyPhases.length === 0) {
      const next = Array.from(remaining)[0];
      const phase = plan.phases.find((p) => p.id === next);
      if (phase) {
        const waveId = `wave-${phase.id}`;
        const depWaveIds = phase.dependsOn
          .map((depPhaseId) => `wave-${depPhaseId}`)
          .filter((id) => waves.some((w) => w.id === id));

        waves.push({
          id: waveId,
          agents: phase.tasks.map((t) => t.id),
          dependsOn: depWaveIds,
          agentType: phase.agentType,
          isolation: plan.resources.isolation,
          phaseId: phase.id,
        });
        processed.add(phase.id);
        remaining.delete(phase.id);
      }
      continue;
    }

    const grouped = groupByAgentType(readyPhases, maxConcurrency);

    for (const group of grouped) {
      if (group.phases.length === 0) {
        continue;
      }
      const waveId = `wave-${group.phases.map((p) => p.id).join("-")}`;
      const taskIds = group.phases.flatMap((p) => p.tasks.map((t) => t.id));

      const depWaveIds = new Set<string>();
      for (const phase of group.phases) {
        for (const depPhaseId of phase.dependsOn) {
          const depWaveId = `wave-${depPhaseId}`;
          if (waves.some((w) => w.id === depWaveId)) {
            depWaveIds.add(depWaveId);
          }
        }
      }

      const primaryPhase = group.phases[0];
      if (!primaryPhase) {
        continue;
      }

      waves.push({
        id: waveId,
        agents: taskIds,
        dependsOn: Array.from(depWaveIds),
        agentType: group.agentType,
        isolation: plan.resources.isolation,
        phaseId: primaryPhase.id,
      });

      for (const phase of group.phases) {
        processed.add(phase.id);
        remaining.delete(phase.id);
      }
    }
  }

  return waves;
}

function generateTopologicalWaves(plan: StructuredPlan): WavePlan[] {
  const waves: WavePlan[] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  for (const phase of plan.phases) {
    inDegree.set(phase.id, phase.dependsOn.length);
  }

  let queue = plan.phases.filter((p) => p.dependsOn.length === 0);

  while (queue.length > 0) {
    const grouped = groupByAgentType(queue, Number.POSITIVE_INFINITY);

    for (const group of grouped) {
      if (group.phases.length === 0) {
        continue;
      }
      const waveId = `wave-${group.phases.map((p) => p.id).join("-")}`;
      const taskIds = group.phases.flatMap((p) => p.tasks.map((t) => t.id));

      const primaryPhase = group.phases[0];
      if (!primaryPhase) {
        continue;
      }

      waves.push({
        id: waveId,
        agents: taskIds,
        dependsOn: [],
        agentType: group.agentType,
        isolation: plan.resources.isolation,
        phaseId: primaryPhase.id,
      });

      for (const phase of group.phases) {
        visited.add(phase.id);
        for (const other of plan.phases) {
          if (other.dependsOn.includes(phase.id)) {
            const current = inDegree.get(other.id) ?? 0;
            inDegree.set(other.id, current - 1);
          }
        }
      }
    }

    queue = plan.phases.filter(
      (p) => !visited.has(p.id) && (inDegree.get(p.id) ?? 0) === 0
    );
  }

  const remaining = plan.phases.filter((p) => !visited.has(p.id));
  for (const phase of remaining) {
    const depWaveIds = phase.dependsOn
      .map((depPhaseId) => `wave-${depPhaseId}`)
      .filter((id) => waves.some((w) => w.id === id));

    waves.push({
      id: `wave-${phase.id}`,
      agents: phase.tasks.map((t) => t.id),
      dependsOn: depWaveIds,
      agentType: phase.agentType,
      isolation: plan.resources.isolation,
      phaseId: phase.id,
    });
  }

  return waves;
}

function generateMixedWaves(
  plan: StructuredPlan,
  maxConcurrency: number
): WavePlan[] {
  const waves: WavePlan[] = [];
  const processed = new Set<string>();

  const rootPhases = plan.phases.filter((p) => p.dependsOn.length === 0);

  if (rootPhases.length > 0) {
    const grouped = groupByAgentType(rootPhases, maxConcurrency);
    for (const group of grouped) {
      if (group.phases.length === 0) {
        continue;
      }
      const waveId = `wave-${group.phases.map((p) => p.id).join("-")}`;
      const taskIds = group.phases.flatMap((p) => p.tasks.map((t) => t.id));

      const primaryPhase = group.phases[0];
      if (!primaryPhase) {
        continue;
      }

      waves.push({
        id: waveId,
        agents: taskIds,
        dependsOn: [],
        agentType: group.agentType,
        isolation: plan.resources.isolation,
        phaseId: primaryPhase.id,
      });

      for (const phase of group.phases) {
        processed.add(phase.id);
      }
    }
  }

  const remaining = plan.phases.filter((p) => !processed.has(p.id));
  for (const phase of remaining) {
    const depWaveIds = phase.dependsOn
      .map((depPhaseId) => `wave-${depPhaseId}`)
      .filter((id) => waves.some((w) => w.id === id));

    waves.push({
      id: `wave-${phase.id}`,
      agents: phase.tasks.map((t) => t.id),
      dependsOn: depWaveIds,
      agentType: phase.agentType,
      isolation: plan.resources.isolation,
      phaseId: phase.id,
    });
  }

  return waves;
}

function groupByAgentType(
  phases: Phase[],
  maxConcurrency: number
): PhaseGroup[] {
  const groupsByType = new Map<Phase["agentType"], Phase[]>();

  for (const phase of phases) {
    const existing = groupsByType.get(phase.agentType) ?? [];
    existing.push(phase);
    groupsByType.set(phase.agentType, existing);
  }

  const result: PhaseGroup[] = [];
  for (const [agentType, groupPhases] of groupsByType.entries()) {
    for (let i = 0; i < groupPhases.length; i += maxConcurrency) {
      result.push({
        agentType,
        phases: groupPhases.slice(i, i + maxConcurrency),
      });
    }
  }

  return result;
}

export function attachWaves(
  plan: StructuredPlan,
  options?: WaveGenerationOptions
): StructuredPlan {
  return {
    ...plan,
    waves: planToWaves(plan, options),
  };
}

export function validateWaveDependencies(plan: StructuredPlan): {
  valid: boolean;
  errors: string[];
} {
  if (!plan.waves || plan.waves.length === 0) {
    return { valid: false, errors: ["No waves generated"] };
  }

  const waveMap = new Map(plan.waves.map((w) => [w.id, w]));
  const errors: string[] = [];

  for (const wave of plan.waves) {
    for (const depId of wave.dependsOn) {
      if (!waveMap.has(depId)) {
        errors.push(`Wave ${wave.id} depends on non-existent wave ${depId}`);
      }
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(waveId: string): boolean {
    if (recursionStack.has(waveId)) {
      return true;
    }
    if (visited.has(waveId)) {
      return false;
    }

    visited.add(waveId);
    recursionStack.add(waveId);

    const wave = waveMap.get(waveId);
    if (wave) {
      for (const depId of wave.dependsOn) {
        if (hasCycle(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(waveId);
    return false;
  }

  for (const wave of plan.waves) {
    if (hasCycle(wave.id)) {
      errors.push(`Circular dependency detected involving wave ${wave.id}`);
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}
